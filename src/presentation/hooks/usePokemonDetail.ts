import { useCallback, useEffect, useReducer, useRef } from 'react';
import { canRecoverAutomatically, useAutomaticRecovery } from './useRecovery';
import type { RecoveryOutcome } from './useBoundedRecovery';
import {
  initialDetailModel,
  pokemonDetailReducer,
  type PokemonDetailAction,
} from './pokemonDetailState';
import { mapPokemonError } from '../errors/mapPokemonError';
import { usePokemonDetailUseCase } from '../context/PokemonDetailContext';
export type { PokemonDetailState } from './pokemonDetailState';

type ManualRefreshMode = 'all' | 'updates';

export function usePokemonDetail(pokemonId: number, focused = true) {
  const useCase = usePokemonDetailUseCase();
  const [model, dispatch] = useReducer(
    pokemonDetailReducer,
    pokemonId,
    initialDetailModel,
  );
  const current = useRef(model);
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const queuedRefresh = useRef<ManualRefreshMode | null>(null);
  const refreshAction = useRef<
    (mode: ManualRefreshMode) => Promise<RecoveryOutcome>
  >(async () => 'busy');
  const send = useCallback((action: PokemonDetailAction) => {
    current.current = pokemonDetailReducer(current.current, action);
    dispatch(action);
  }, []);
  const load = useCallback(
    async (networkFirst = false): Promise<RecoveryOutcome> => {
      if (!mounted.current || inFlight.current) {
        return 'busy';
      }
      const token = generation.current;
      inFlight.current = true;
      send({ type: 'start', networkFirst });
      try {
        const result = networkFirst
          ? await useCase.execute(pokemonId, { policy: 'network-first' })
          : await useCase.execute(pokemonId);
        if (mounted.current && token === generation.current) {
          send({ type: 'success', result });
        }
      } catch (error) {
        if (mounted.current && token === generation.current) {
          send({
            type: 'error',
            feedback: mapPokemonError(error, 'detail'),
            auto: canRecoverAutomatically(error),
          });
        }
      } finally {
        if (token === generation.current) {
          inFlight.current = false;
          if (mounted.current) {
            send({ type: 'finish' });
            if (queuedRefresh.current) {
              const mode = queuedRefresh.current;
              queuedRefresh.current = null;
              await refreshAction.current(mode);
            }
          }
        }
      }
      return 'attempted';
    },
    [pokemonId, send, useCase],
  );
  useEffect(() => {
    mounted.current = true;
    queuedRefresh.current = null;
    send({ type: 'reset', id: pokemonId });
    load();
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
      queuedRefresh.current = null;
    };
  }, [load, pokemonId, send]);
  const recoverAutomatically = useCallback(() => load(true), [load]);
  const recovery = useAutomaticRecovery({
    dataPending: model.id === pokemonId && model.autoPending,
    focused,
    onRecover: recoverAutomatically,
  });
  const { restartRecovery, retryImages } = recovery;
  const readUpdates = useCallback(
    async (mode: ManualRefreshMode): Promise<RecoveryOutcome> => {
      if (!mounted.current) {
        return 'busy';
      }
      if (inFlight.current) {
        queuedRefresh.current = queuedRefresh.current === 'all' ? 'all' : mode;
        return 'busy';
      }
      const latest = current.current;
      if (
        mode === 'updates' &&
        !(
          latest.state.status === 'ready' &&
          (latest.state.isStale || latest.refreshError !== null)
        ) &&
        !(latest.state.status === 'error' && latest.state.canRetry)
      ) {
        return 'attempted';
      }
      return load(true);
    },
    [load],
  );
  refreshAction.current = readUpdates;
  const refresh = useCallback(async (): Promise<void> => {
    restartRecovery();
    retryImages();
    await readUpdates('all');
  }, [readUpdates, restartRecovery, retryImages]);
  const retryUpdates = useCallback(async (): Promise<void> => {
    restartRecovery();
    retryImages();
    await readUpdates('updates');
  }, [readUpdates, restartRecovery, retryImages]);
  const retry = useCallback(() => {
    const latest = current.current;
    if (
      Object.is(latest.id, pokemonId) &&
      latest.state.status === 'error' &&
      latest.state.canRetry
    ) {
      refresh();
    }
  }, [pokemonId, refresh]);
  return {
    state: Object.is(model.id, pokemonId)
      ? model.state
      : { status: 'loading' as const },
    retry,
    refresh,
    retryUpdates,
    refreshing: model.refreshing,
    refreshError: model.refreshError,
    recoveryExhausted: recovery.recoveryExhausted,
    imageRetryGeneration: recovery.imageRetryGeneration,
    reportImageFailure: recovery.reportImageFailure,
  };
}
