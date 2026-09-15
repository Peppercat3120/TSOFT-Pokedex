import type { PokemonDetail } from '../../domain/entities/Pokemon';
import type { RepositoryResult } from '../../domain/repositories/PokemonRepository';
import type { PokemonErrorFeedback } from '../errors/mapPokemonError';

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
export interface PokemonDetailModel {
  readonly id: number;
  readonly state: PokemonDetailState;
  readonly autoPending: boolean;
  readonly refreshing: boolean;
  readonly refreshError: string | null;
}
export function initialDetailModel(id: number): PokemonDetailModel {
  return {
    id,
    state: { status: 'loading' },
    autoPending: false,
    refreshing: false,
    refreshError: null,
  };
}
export type PokemonDetailAction =
  | { readonly type: 'reset'; readonly id: number }
  | { readonly type: 'start'; readonly networkFirst: boolean }
  | {
      readonly type: 'success';
      readonly result: RepositoryResult<PokemonDetail>;
    }
  | {
      readonly type: 'error';
      readonly feedback: PokemonErrorFeedback;
      readonly auto: boolean;
    }
  | { readonly type: 'finish' };
export function pokemonDetailReducer(
  model: PokemonDetailModel,
  action: PokemonDetailAction,
): PokemonDetailModel {
  switch (action.type) {
    case 'reset':
      return initialDetailModel(action.id);
    case 'start':
      return {
        ...model,
        state:
          model.state.status === 'ready' ? model.state : { status: 'loading' },
        refreshing: action.networkFirst,
        refreshError: null,
      };
    case 'success':
      return {
        ...model,
        autoPending: action.result.isStale,
        state: {
          status: 'ready',
          pokemon: action.result.data,
          isStale: action.result.isStale,
        },
      };
    case 'error': {
      const { feedback } = action;
      if (model.state.status === 'ready' && feedback.canRetry) {
        return {
          ...model,
          autoPending: action.auto,
          refreshError: feedback.message,
          state: { ...model.state, isStale: true },
        };
      }
      return {
        ...model,
        autoPending: action.auto,
        state:
          feedback.kind === 'not-found'
            ? { status: 'not-found', message: feedback.message }
            : {
                status: 'error',
                message: feedback.message,
                canRetry: feedback.canRetry,
              },
      };
    }
    case 'finish':
      return { ...model, refreshing: false };
  }
}
