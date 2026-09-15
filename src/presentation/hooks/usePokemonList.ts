import { AppState } from 'react-native';
import {
  canRecoverAutomatically,
  useImageRecovery,
  useRecovery,
} from './useRecovery';
import type { PokemonPage } from '../../domain/entities/Pokemon';
import type { RepositoryResult } from '../../domain/repositories/PokemonRepository';
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
  const pages = useRef(
    new Map<
      number,
      {
        request: PokemonPageRequest;
        result: RepositoryResult<PokemonPage>;
        auto: boolean;
      }
    >(),
  );
  const paginationAuto = useRef(false);
  const queuedRefresh = useRef(false);
  const refreshAction = useRef<() => Promise<void | boolean>>(async () => {});
  const {
    pending: imagesPending,
    imageRetryGeneration,
    reportImageFailure,
    retryImages,
  } = useImageRecovery();
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
        setAutoPending([...pages.current.values()].some(page => page.auto));
        const existing =
          !initial && previous.status === 'ready' ? previous.items : [];
        const ids = new Set(existing.map(item => item.id));
        const added = result.data.items.filter(item => {
          if (ids.has(item.id)) {
            return false;
          }
          ids.add(item.id);
          return true;
        });
        const items = [...existing, ...added];
        const next = result.data.nextPage;
        const nextPage =
          added.length > 0 && next !== null && next.offset > request.offset
            ? { offset: next.offset, limit: 20 }
            : null;
        publish(
          items.length === 0
            ? { status: 'empty' }
            : {
                status: 'ready',
                items,
                nextPage,
                hasStaleData: [...pages.current.values()].some(
                  page => page.result.isStale,
                ),
                loadMore: { status: 'idle' },
              },
        );
      } catch (error) {
        if (!mounted.current || token !== generation.current) {
          return;
        }
        paginationAuto.current = canRecoverAutomatically(error);
        setAutoPending(
          paginationAuto.current ||
            [...pages.current.values()].some(page => page.auto),
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

  const recover = useCallback(
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
      retryImages();
      const previous = stateRef.current;
      if (previous.status !== 'ready') {
        if (
          ((all || [...pages.current.values()].some(page => page.auto)) &&
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
        for (const [offset, page] of pages.current) {
          if (
            !focusedRef.current ||
            AppState.currentState === 'background' ||
            AppState.currentState === 'inactive'
          ) {
            break;
          }
          if (!all && !(explicit ? page.result.isStale : page.auto)) {
            continue;
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
        const ids = new Set<number>();
        const items = [...pages.current.values()]
          .sort((a, b) => a.request.offset - b.request.offset)
          .flatMap(page => page.result.data.items)
          .filter(item => {
            if (ids.has(item.id)) {
              return false;
            }
            ids.add(item.id);
            return true;
          });
        const hasStaleData = [...pages.current.values()].some(
          page => page.result.isStale,
        );
        const last = [...pages.current.values()].sort(
          (a, b) => b.request.offset - a.request.offset,
        )[0];
        const next = last?.result.data.nextPage;
        publish({
          ...previous,
          items,
          hasStaleData,
          nextPage:
            previous.loadMore.status === 'error'
              ? previous.nextPage
              : next && next.offset > last.request.offset
              ? { offset: next.offset, limit: 20 }
              : null,
        });
        setAutoPending(
          retryable ||
            paginationAuto.current ||
            [...pages.current.values()].some(page => page.auto),
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
        await recover(true);
      }
    },
    [retryImages, load, publish, useCase],
  );
  refreshAction.current = () => recover(true);
  const { restart: restartRecovery, exhausted: recoveryExhausted } =
    useRecovery(autoPending || imagesPending, recover, focused);
  const refresh = useCallback(() => {
    restartRecovery();
    return recover(true);
  }, [restartRecovery, recover]);
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
      recover(false, true);
    }
  }, [recover, restartRecovery]);

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
