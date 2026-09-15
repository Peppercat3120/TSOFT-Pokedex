import type {
  PokemonPage,
  PokemonPageRequest,
  PokemonSummary,
} from '../../domain/entities/Pokemon';
import type { RepositoryResult } from '../../domain/repositories/PokemonRepository';
import type { PokemonErrorFeedback } from '../errors/mapPokemonError';
import type { PokemonListPage } from './pokemonListPages';

export type LoadMoreState =
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

export interface PokemonListModel {
  readonly status: 'loading' | 'loaded' | 'error';
  readonly pages: readonly PokemonListPage[];
  readonly initialError: PokemonErrorFeedback | null;
  readonly failedRequest: PokemonPageRequest | null;
  readonly requestAuto: boolean;
  readonly loadMore: LoadMoreState;
  readonly refreshing: boolean;
  readonly refreshError: string | null;
}
export const initialListModel: PokemonListModel = {
  status: 'loading',
  pages: [],
  initialError: null,
  failedRequest: null,
  requestAuto: false,
  loadMore: { status: 'idle' },
  refreshing: false,
  refreshError: null,
};
export type PokemonListAction =
  | { readonly type: 'reset' }
  | { readonly type: 'load-start'; readonly initial: boolean }
  | {
      readonly type: 'load-success';
      readonly initial: boolean;
      readonly page: PokemonListPage;
    }
  | {
      readonly type: 'load-error';
      readonly initial: boolean;
      readonly request: PokemonPageRequest;
      readonly feedback: PokemonErrorFeedback;
      readonly auto: boolean;
    }
  | { readonly type: 'refresh-start' | 'refresh-end' }
  | {
      readonly type: 'page-success';
      readonly request: PokemonPageRequest;
      readonly result: RepositoryResult<PokemonPage>;
    }
  | {
      readonly type: 'page-error';
      readonly request: PokemonPageRequest;
      readonly message: string;
      readonly auto: boolean;
    };

export function pokemonListReducer(
  model: PokemonListModel,
  action: PokemonListAction,
): PokemonListModel {
  switch (action.type) {
    case 'reset':
      return initialListModel;
    case 'load-start':
      return action.initial
        ? {
            ...model,
            status: 'loading',
            initialError: null,
            refreshError: null,
          }
        : { ...model, loadMore: { status: 'loading' } };
    case 'load-success':
      return {
        ...model,
        status: 'loaded',
        initialError: null,
        failedRequest: null,
        requestAuto: false,
        pages: action.initial ? [action.page] : [...model.pages, action.page],
        loadMore: { status: 'idle' },
      };
    case 'load-error':
      return {
        ...model,
        status: action.initial ? 'error' : model.status,
        initialError: action.initial ? action.feedback : model.initialError,
        failedRequest: action.request,
        requestAuto: action.auto,
        loadMore: action.initial
          ? { status: 'idle' }
          : {
              status: 'error',
              message: action.feedback.message,
              canRetry: action.feedback.canRetry,
            },
      };
    case 'refresh-start':
      return { ...model, refreshing: true, refreshError: null };
    case 'refresh-end':
      return { ...model, refreshing: false };
    case 'page-success':
      return {
        ...model,
        pages: model.pages.map(page =>
          page.request.offset === action.request.offset
            ? { ...page, result: action.result, auto: action.result.isStale }
            : page,
        ),
      };
    case 'page-error':
      return {
        ...model,
        refreshError: action.message,
        pages: model.pages.map(page =>
          page.request.offset === action.request.offset
            ? {
                ...page,
                result: { ...page.result, isStale: true },
                auto: action.auto,
              }
            : page,
        ),
      };
  }
}
