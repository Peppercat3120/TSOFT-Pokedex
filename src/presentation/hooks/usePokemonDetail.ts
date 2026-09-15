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

interface DetailController {
  readonly state: PokemonDetailState;
  readonly retry: () => void;
}

export function usePokemonDetail(pokemonId: number): DetailController {
  const useCase = usePokemonDetailUseCase();
  const [record, setRecord] = useState<{
    readonly id: number;
    readonly state: PokemonDetailState;
  }>({ id: pokemonId, state: { status: 'loading' } });
  const current = useRef(record);
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!mounted.current || inFlight.current) {
      return;
    }
    inFlight.current = true;
    const token = generation.current;
    const publish = (state: PokemonDetailState) => {
      const next = { id: pokemonId, state };
      current.current = next;
      setRecord(next);
    };
    publish({ status: 'loading' });
    try {
      const result = await useCase.execute(pokemonId);
      if (mounted.current && token === generation.current) {
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
      const feedback = mapPokemonError(error, 'detail');
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
      }
    }
  }, [pokemonId, useCase]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
      generation.current += 1;
      inFlight.current = false;
    };
  }, [load]);

  const retry = useCallback(() => {
    const state = current.current.state;
    if (
      Object.is(current.current.id, pokemonId) &&
      state.status === 'error' &&
      state.canRetry
    ) {
      load();
    }
  }, [load, pokemonId]);

  return {
    state: Object.is(record.id, pokemonId)
      ? record.state
      : { status: 'loading' },
    retry,
  };
}
