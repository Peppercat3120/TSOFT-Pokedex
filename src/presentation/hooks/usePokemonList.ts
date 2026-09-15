import { AppState } from 'react-native';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { canRecoverAutomatically, useAutomaticRecovery } from './useRecovery';
import type { RecoveryOutcome } from './useBoundedRecovery';
import {
  hasAutomaticPageRecovery,
  pagesToRefresh,
  snapshotPokemonPages,
} from './pokemonListPages';
import {
  initialListModel,
  pokemonListReducer,
  type PokemonListAction,
  type PokemonListState,
} from './pokemonListState';
import { mapPokemonError } from '../errors/mapPokemonError';
import { usePokemonPageUseCase } from '../context/PokemonListContext';
export type { PokemonListState } from './pokemonListState';

type ManualRefreshMode = 'all' | 'updates';
type RefreshMode = 'automatic' | ManualRefreshMode;

export function usePokemonList(focused = true) {
  const useCase = usePokemonPageUseCase();
  const [model, dispatch] = useReducer(pokemonListReducer, initialListModel);
  const current = useRef(model);
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const queuedRefresh = useRef<ManualRefreshMode | null>(null);
  const refreshAction = useRef<
    (mode: ManualRefreshMode) => Promise<RecoveryOutcome>
  >(async () => 'busy');
  const send = useCallback((action: PokemonListAction) => {
    // Async operations need the latest transition before React commits a render.
    current.current = pokemonListReducer(current.current, action);
    dispatch(action);
  }, []);
  const visible = useCallback(
    (token: number) => mounted.current && token === generation.current,
    [],
  );
  const canRecover = useCallback(
    () =>
      mounted.current &&
      focusedRef.current &&
      AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
    [],
  );

  const load = useCallback(
    async (initial: boolean, retry = false): Promise<RecoveryOutcome> => {
      if (!mounted.current || inFlight.current) {
        return 'busy';
      }
      const previous = current.current;
      const snapshot = snapshotPokemonPages(previous.pages);
      const request = initial
        ? { offset: 0, limit: 20 }
        : previous.failedRequest ?? snapshot.nextPage;
      if (
        !initial &&
        (previous.status !== 'loaded' ||
          request === null ||
          (previous.loadMore.status === 'error' &&
            (!retry || !previous.loadMore.canRetry)))
      ) {
        return 'attempted';
      }
      if (request === null) {
        return 'attempted';
      }
      const token = generation.current;
      inFlight.current = true;
      send({ type: 'load-start', initial });
      try {
        const result = retry
          ? await useCase.execute(request, { policy: 'network-first' })
          : await useCase.execute(request);
        if (visible(token)) {
          send({
            type: 'load-success',
            initial,
            page: { request, result, auto: result.isStale },
          });
        }
      } catch (error) {
        if (visible(token)) {
          send({
            type: 'load-error',
            initial,
            request,
            feedback: mapPokemonError(error, initial ? 'list' : 'pagination'),
            auto: canRecoverAutomatically(error),
          });
        }
      } finally {
        if (token === generation.current) {
          inFlight.current = false;
          if (mounted.current && queuedRefresh.current) {
            const mode = queuedRefresh.current;
            queuedRefresh.current = null;
            await refreshAction.current(mode);
          }
        }
      }
      return 'attempted';
    },
    [send, useCase, visible],
  );

  useEffect(() => {
    mounted.current = true;
    queuedRefresh.current = null;
    send({ type: 'reset' });
    load(true);
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
      queuedRefresh.current = null;
    };
  }, [load, send]);

  const recoverData = useCallback(
    async (mode: RefreshMode = 'automatic'): Promise<RecoveryOutcome> => {
      if (!mounted.current || inFlight.current) {
        if (mounted.current && mode !== 'automatic') {
          queuedRefresh.current =
            queuedRefresh.current === 'all' ? 'all' : mode;
        }
        return 'busy';
      }
      if (!canRecover()) {
        return 'busy';
      }
      const previous = current.current;
      if (previous.status !== 'loaded') {
        if (
          previous.initialError?.canRetry &&
          (mode !== 'automatic' || previous.requestAuto)
        ) {
          return load(true, true);
        }
        return 'attempted';
      }
      const targets = pagesToRefresh(
        previous.pages,
        mode === 'all',
        mode === 'updates',
      );
      const retryCursor =
        previous.loadMore.status === 'error' &&
        previous.loadMore.canRetry &&
        (mode !== 'automatic' || previous.requestAuto);
      if (targets.length === 0 && !retryCursor) {
        return 'attempted';
      }
      const token = generation.current;
      inFlight.current = true;
      send({ type: 'refresh-start' });
      try {
        for (const page of targets) {
          if (!visible(token) || !canRecover()) {
            break;
          }
          try {
            const result = await useCase.execute(page.request, {
              policy: 'network-first',
            });
            if (!visible(token)) {
              return 'attempted';
            }
            send({ type: 'page-success', request: page.request, result });
          } catch (error) {
            if (!visible(token)) {
              return 'attempted';
            }
            send({
              type: 'page-error',
              request: page.request,
              message: mapPokemonError(error, 'list').message,
              auto: canRecoverAutomatically(error),
            });
          }
        }
      } finally {
        if (visible(token)) {
          inFlight.current = false;
          send({ type: 'refresh-end' });
        }
      }
      const latest = current.current;
      if (
        visible(token) &&
        canRecover() &&
        latest.loadMore.status === 'error' &&
        latest.loadMore.canRetry &&
        (mode !== 'automatic' || latest.requestAuto)
      ) {
        await load(false, true);
      }
      if (visible(token) && queuedRefresh.current) {
        const queued = queuedRefresh.current;
        queuedRefresh.current = null;
        await refreshAction.current(queued);
      }
      return 'attempted';
    },
    [canRecover, load, send, useCase, visible],
  );

  const recovery = useAutomaticRecovery({
    dataPending: model.requestAuto || hasAutomaticPageRecovery(model.pages),
    focused,
    onRecover: recoverData,
  });
  const { restartRecovery, retryImages } = recovery;
  refreshAction.current = mode => recoverData(mode);
  const refresh = useCallback(async (): Promise<void> => {
    restartRecovery();
    retryImages();
    await recoverData('all');
  }, [restartRecovery, retryImages, recoverData]);
  const retryUpdates = useCallback(async (): Promise<void> => {
    restartRecovery();
    retryImages();
    await recoverData('updates');
  }, [restartRecovery, retryImages, recoverData]);
  const retryInitial = useCallback(() => {
    const latest = current.current;
    if (
      latest.initialError?.canRetry ||
      (latest.status === 'loaded' &&
        snapshotPokemonPages(latest.pages).items.length === 0)
    ) {
      restartRecovery();
      load(true, true);
    }
  }, [load, restartRecovery]);
  const loadNextPage = useCallback(() => {
    load(false);
  }, [load]);
  const retryNextPage = useCallback(() => {
    if (
      current.current.loadMore.status === 'error' &&
      current.current.loadMore.canRetry
    ) {
      restartRecovery();
      retryImages();
      recoverData('updates');
    }
  }, [recoverData, restartRecovery, retryImages]);
  const snapshot = useMemo(
    () => snapshotPokemonPages(model.pages),
    [model.pages],
  );
  const state: PokemonListState =
    model.status === 'loading'
      ? { status: 'loading' }
      : model.status === 'error' && model.initialError
      ? {
          status: 'error',
          message: model.initialError.message,
          canRetry: model.initialError.canRetry,
        }
      : snapshot.items.length === 0
      ? { status: 'empty' }
      : {
          status: 'ready',
          ...snapshot,
          nextPage: model.failedRequest ?? snapshot.nextPage,
          loadMore: model.loadMore,
        };
  return {
    state,
    retryInitial,
    loadNextPage,
    retryNextPage,
    refresh,
    retryUpdates,
    refreshing: model.refreshing,
    refreshError: model.refreshError,
    recoveryExhausted: recovery.recoveryExhausted,
    imageRetryGeneration: recovery.imageRetryGeneration,
    reportImageFailure: recovery.reportImageFailure,
  };
}
