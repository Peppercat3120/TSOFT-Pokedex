import {
  canRecoverAutomatically,
  useImageRecovery,
  useRecovery,
} from './useRecovery';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PokemonDetail } from '../../domain/entities/Pokemon';
import { mapPokemonError } from '../errors/mapPokemonError';
import { usePokemonDetailUseCase } from '../context/PokemonDetailContext';

export type PokemonDetailState =
  | { readonly status: 'loading' }
  | { readonly status: 'not-found'; readonly message: string }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly canRetry: boolean;
    }
  | {
      readonly status: 'ready';
      readonly pokemon: PokemonDetail;
      readonly isStale: boolean;
    };

export function usePokemonDetail(pokemonId: number, focused = true) {
  const {
    pending: imagesPending,
    imageRetryGeneration,
    reportImageFailure,
    retryImages,
  } = useImageRecovery();
  const [autoPending, setAutoPending] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const useCase = usePokemonDetailUseCase();
  const [record, setRecord] = useState<{
    readonly id: number;
    readonly state: PokemonDetailState;
  }>({ id: pokemonId, state: { status: 'loading' } });
  const current = useRef(record);
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const queuedRefresh = useRef(false);
  const refreshAction = useRef<() => Promise<void>>(async () => {});

  const load = useCallback(
    async (networkFirst = false) => {
      if (!mounted.current || inFlight.current) {
        if (networkFirst && mounted.current) {
          queuedRefresh.current = true;
        }
        return;
      }
      inFlight.current = true;
      const token = generation.current;
      const publish = (state: PokemonDetailState) => {
        const next = { id: pokemonId, state };
        current.current = next;
        setRecord(next);
      };
      const previous =
        current.current.id === pokemonId ? current.current.state : null;
      if (previous?.status !== 'ready') {
        publish({ status: 'loading' });
      }
      setRefreshing(networkFirst);
      setRefreshError(null);
      if (!networkFirst) {
        setAutoPending(false);
      }
      try {
        const result = networkFirst
          ? await useCase.execute(pokemonId, { policy: 'network-first' })
          : await useCase.execute(pokemonId);
        if (mounted.current && token === generation.current) {
          setAutoPending(result.isStale);
          publish({
            status: 'ready',
            pokemon: result.data,
            isStale: result.isStale,
          });
        }
      } catch (error) {
        if (!mounted.current || token !== generation.current) {
          return;
        }
        setAutoPending(canRecoverAutomatically(error));
        const feedback = mapPokemonError(error, 'detail');
        if (previous?.status === 'ready' && feedback.canRetry) {
          setRefreshError(feedback.message);
          publish({ ...previous, isStale: true });
          return;
        }
        publish(
          feedback.kind === 'not-found'
            ? { status: 'not-found', message: feedback.message }
            : {
                status: 'error',
                message: feedback.message,
                canRetry: feedback.canRetry,
              },
        );
      } finally {
        if (token === generation.current) {
          inFlight.current = false;
          if (mounted.current) {
            setRefreshing(false);
            if (queuedRefresh.current) {
              queuedRefresh.current = false;
              refreshAction.current();
            }
          }
        }
      }
    },
    [pokemonId, useCase],
  );

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
    };
  }, [load]);

  refreshAction.current = () => load(true);
  const recover = useCallback(async () => {
    if (inFlight.current || !mounted.current) {
      return false;
    }
    retryImages();
    if (autoPending) {
      await load(true);
    }
  }, [retryImages, autoPending, load]);
  const { restart: restartRecovery, exhausted: recoveryExhausted } =
    useRecovery(autoPending || imagesPending, recover, focused);
  const refresh = useCallback(() => {
    restartRecovery();
    retryImages();
    return load(true);
  }, [restartRecovery, retryImages, load]);
  const retry = useCallback(() => {
    const state = current.current.state;
    if (
      Object.is(current.current.id, pokemonId) &&
      state.status === 'error' &&
      state.canRetry
    ) {
      refresh();
    }
  }, [refresh, pokemonId]);

  return {
    state: Object.is(record.id, pokemonId)
      ? record.state
      : { status: 'loading' as const },
    retry,
    refresh,
    refreshing,
    refreshError,
    recoveryExhausted,
    imageRetryGeneration,
    reportImageFailure,
  };
}
