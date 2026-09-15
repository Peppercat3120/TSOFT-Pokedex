import { AppState } from 'react-native';
import {
  canRecoverAutomatically,
  useAutomaticRecovery,
  type RecoveryReason,
} from './useRecovery';
import {
  appendPokemonPage,
  hasAutomaticPageRecovery,
  pagesToRefresh,
  snapshotPokemonPages,
  type PokemonListPage,
} from './pokemonListPages';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PokemonPageRequest,
  PokemonSummary,
} from '../../domain/entities/Pokemon';
import { mapPokemonError } from '../errors/mapPokemonError';
import { usePokemonPageUseCase } from '../context/PokemonListContext';

type LoadMoreState =
  | { readonly status: 'idle' | 'loading' }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly canRetry: boolean;
    };

export type PokemonListState =
  | { readonly status: 'loading' | 'empty' }
  | {
      readonly status: 'error';
      readonly message: string;
      readonly canRetry: boolean;
    }
  | {
      readonly status: 'ready';
      readonly items: readonly PokemonSummary[];
      readonly nextPage: PokemonPageRequest | null;
      readonly hasStaleData: boolean;
      readonly loadMore: LoadMoreState;
    };

export function usePokemonList(focused = true) {
  const focusedRef = useRef(focused);
  focusedRef.current = focused;
  const useCase = usePokemonPageUseCase();
  const [state, setState] = useState<PokemonListState>({ status: 'loading' });
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoPending, setAutoPending] = useState(false);
  const pages = useRef(new Map<number, PokemonListPage>());
  const paginationAuto = useRef(false);
  const queuedRefresh = useRef(false);
  const refreshAction = useRef<() => Promise<void | boolean>>(async () => {});
  const stateRef = useRef(state);
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const publish = useCallback((next: PokemonListState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const load = useCallback(
    async (initial: boolean, retry = false) => {
      if (!mounted.current || inFlight.current) {
        return;
      }
      const previous = stateRef.current;
      if (
        !initial &&
        (previous.status !== 'ready' ||
          previous.nextPage === null ||
          (previous.loadMore.status === 'error' &&
            (!retry || !previous.loadMore.canRetry)))
      ) {
        return;
      }
      const request =
        !initial && previous.status === 'ready' && previous.nextPage
          ? { offset: previous.nextPage.offset, limit: 20 }
          : { offset: 0, limit: 20 };
      const token = generation.current;
      inFlight.current = true;
      publish(
        !initial && previous.status === 'ready'
          ? { ...previous, loadMore: { status: 'loading' } }
          : { status: 'loading' },
      );
      try {
        const result = retry
          ? await useCase.execute(request, { policy: 'network-first' })
          : await useCase.execute(request);
        if (!mounted.current || token !== generation.current) {
          return;
        }
        if (initial) {
          pages.current.clear();
        }
        pages.current.set(request.offset, {
          request,
          result,
          auto: result.isStale,
        });
        paginationAuto.current = false;
        const existing =
          !initial && previous.status === 'ready' ? previous.items : [];
        const { items, nextPage } = appendPokemonPage(
          existing,
          request,
          result.data,
        );
        setAutoPending(hasAutomaticPageRecovery(pages.current));
        publish(
          items.length === 0
            ? { status: 'empty' }
            : {
                status: 'ready',
                items,
                nextPage,
                hasStaleData: snapshotPokemonPages(pages.current).hasStaleData,
                loadMore: { status: 'idle' },
              },
        );
      } catch (error) {
        if (!mounted.current || token !== generation.current) {
          return;
        }
        paginationAuto.current = canRecoverAutomatically(error);
        setAutoPending(
          paginationAuto.current || hasAutomaticPageRecovery(pages.current),
        );
        const { message, canRetry } = mapPokemonError(
          error,
          initial ? 'list' : 'pagination',
        );
        publish(
          !initial && previous.status === 'ready'
            ? { ...previous, loadMore: { status: 'error', message, canRetry } }
            : { status: 'error', message, canRetry },
        );
      } finally {
        if (token === generation.current) {
          inFlight.current = false;
          if (mounted.current && queuedRefresh.current) {
            queuedRefresh.current = false;
            refreshAction.current();
          }
        }
      }
    },
    [publish, useCase],
  );

  useEffect(() => {
    mounted.current = true;
    load(true);
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
    };
  }, [load]);

  const recoverData = useCallback(
    async (all = false, explicit = false) => {
      if (!mounted.current || inFlight.current) {
        if (all) {
          queuedRefresh.current = true;
        }
        return false;
      }
      if (
        !all &&
        (!focusedRef.current ||
          AppState.currentState === 'background' ||
          AppState.currentState === 'inactive')
      ) {
        return false;
      }
      const previous = stateRef.current;
      if (previous.status !== 'ready') {
        if (
          ((all || hasAutomaticPageRecovery(pages.current)) &&
            previous.status === 'empty') ||
          (previous.status === 'error' &&
            previous.canRetry &&
            (all || paginationAuto.current))
        ) {
          await load(true, true);
        }
        return;
      }
      inFlight.current = true;
      setRefreshing(true);
      setRefreshError(null);
      const token = generation.current;
      let retryable = false;
      try {
        for (const [offset, page] of pagesToRefresh(
          pages.current,
          all,
          explicit,
        )) {
          if (
            !focusedRef.current ||
            AppState.currentState === 'background' ||
            AppState.currentState === 'inactive'
          ) {
            break;
          }
          try {
            const result = await useCase.execute(page.request, {
              policy: 'network-first',
            });
            if (!mounted.current || token !== generation.current) {
              return;
            }
            pages.current.set(offset, {
              ...page,
              result,
              auto: result.isStale,
            });
          } catch (error) {
            if (!mounted.current || token !== generation.current) {
              return;
            }
            setRefreshError(mapPokemonError(error, 'list').message);
            const auto = canRecoverAutomatically(error);
            retryable = retryable || auto;
            pages.current.set(offset, {
              ...page,
              result: { ...page.result, isStale: true },
              auto,
            });
          }
          if (!mounted.current || token !== generation.current) {
            return;
          }
        }
        const snapshot = snapshotPokemonPages(pages.current);
        publish({
          ...previous,
          items: snapshot.items,
          hasStaleData: snapshot.hasStaleData,
          nextPage:
            previous.loadMore.status === 'error'
              ? previous.nextPage
              : snapshot.nextPage,
        });
        setAutoPending(
          retryable ||
            paginationAuto.current ||
            hasAutomaticPageRecovery(pages.current),
        );
      } finally {
        if (mounted.current && token === generation.current) {
          inFlight.current = false;
          setRefreshing(false);
        }
      }
      if (
        mounted.current &&
        focusedRef.current &&
        AppState.currentState !== 'background' &&
        AppState.currentState !== 'inactive' &&
        token === generation.current &&
        previous.loadMore.status === 'error' &&
        previous.loadMore.canRetry &&
        (all || explicit || paginationAuto.current)
      ) {
        await load(false, true);
      }
      if (queuedRefresh.current) {
        queuedRefresh.current = false;
        await recoverData(true);
      }
    },
    [load, publish, useCase],
  );
  const recoverAutomatically = useCallback(
    async (reason: RecoveryReason, retryImages: () => void) => {
      if (!mounted.current || inFlight.current) {
        return false;
      }
      if (reason !== 'data') {
        retryImages();
      }
      if (reason !== 'images') {
        await recoverData();
      }
    },
    [recoverData],
  );
  const {
    restartRecovery,
    recoveryExhausted,
    imageRetryGeneration,
    reportImageFailure,
    retryImages,
  } = useAutomaticRecovery({
    dataPending: autoPending,
    focused,
    onRecover: recoverAutomatically,
  });
  refreshAction.current = async () => {
    retryImages();
    return recoverData(true);
  };
  const refresh = useCallback(() => {
    restartRecovery();
    retryImages();
    return recoverData(true);
  }, [restartRecovery, retryImages, recoverData]);
  const retryInitial = useCallback(() => {
    if (
      (stateRef.current.status === 'error' && stateRef.current.canRetry) ||
      stateRef.current.status === 'empty'
    ) {
      restartRecovery();
      load(true, true);
    }
  }, [load, restartRecovery]);
  const loadNextPage = useCallback(() => {
    load(false);
  }, [load]);
  const retryNextPage = useCallback(() => {
    const current = stateRef.current;
    if (
      current.status === 'ready' &&
      current.loadMore.status === 'error' &&
      current.loadMore.canRetry
    ) {
      restartRecovery();
      retryImages();
      recoverData(false, true);
    }
  }, [recoverData, restartRecovery, retryImages]);

  return {
    state,
    retryInitial,
    loadNextPage,
    retryNextPage,
    refreshing,
    refreshError,
    refresh,
    recoveryExhausted,
    imageRetryGeneration,
    reportImageFailure,
  };
}
