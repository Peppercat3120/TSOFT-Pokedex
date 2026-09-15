import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PokemonPageRequest,
  PokemonSummary,
} from '../../domain/entities/Pokemon';
import { NetworkError } from '../../domain/errors/PokemonErrors';
import { usePokemonPageUseCase } from '../context/PokemonListContext';

type LoadMoreState =
  | { readonly status: 'idle' | 'loading' }
  | { readonly status: 'error'; readonly message: string };

export type PokemonListState =
  | { readonly status: 'loading' | 'empty' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready';
      readonly items: readonly PokemonSummary[];
      readonly nextPage: PokemonPageRequest | null;
      readonly hasStaleData: boolean;
      readonly loadMore: LoadMoreState;
    };

function errorMessage(error: unknown): string {
  return error instanceof NetworkError
    ? 'Unable to connect. Check your connection and try again.'
    : 'Unable to load Pokémon right now. Please try again.';
}

export function usePokemonList() {
  const useCase = usePokemonPageUseCase();
  const [state, setState] = useState<PokemonListState>({ status: 'loading' });
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
          (previous.loadMore.status === 'error' && !retry))
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
        const result = await useCase.execute(request);
        if (!mounted.current || token !== generation.current) {
          return;
        }
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
                hasStaleData:
                  result.isStale ||
                  (!initial &&
                    previous.status === 'ready' &&
                    previous.hasStaleData),
                loadMore: { status: 'idle' },
              },
        );
      } catch (error) {
        if (!mounted.current || token !== generation.current) {
          return;
        }
        const message = errorMessage(error);
        publish(
          !initial && previous.status === 'ready'
            ? { ...previous, loadMore: { status: 'error', message } }
            : { status: 'error', message },
        );
      } finally {
        if (token === generation.current) {
          inFlight.current = false;
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

  const retryInitial = useCallback(() => {
    if (
      stateRef.current.status === 'error' ||
      stateRef.current.status === 'empty'
    ) {
      load(true);
    }
  }, [load]);
  const loadNextPage = useCallback(() => {
    load(false);
  }, [load]);
  const retryNextPage = useCallback(() => {
    const current = stateRef.current;
    if (current.status === 'ready' && current.loadMore.status === 'error') {
      load(false, true);
    }
  }, [load]);

  return { state, retryInitial, loadNextPage, retryNextPage };
}
