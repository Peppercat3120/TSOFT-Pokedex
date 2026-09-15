import {
  initialListModel,
  pokemonListReducer,
} from '../../src/presentation/hooks/pokemonListState';
import { mapPokemonListDto } from '../../src/data/mappers/PokemonMapper';
import { firstPageFixture } from '../data/fixtures';

describe('pagination failure reconciliation', () => {
  it.each([20, 10])(
    'compares the failed request limit %i and preserves unrelated refresh feedback',
    limit => {
      const loaded = pokemonListReducer(initialListModel, {
        type: 'load-success',
        initial: true,
        page: {
          request: { offset: 0, limit: 20 },
          result: {
            data: mapPokemonListDto(firstPageFixture),
            source: 'cache',
            isStale: true,
            cachedAt: 1,
          },
          auto: true,
        },
      });
      const failed = pokemonListReducer(loaded, {
        type: 'load-error',
        initial: false,
        request: { offset: 20, limit },
        feedback: {
          kind: 'error',
          message: 'Pagination failed',
          canRetry: true,
        },
        auto: true,
      });
      const model = {
        ...failed,
        refreshing: true,
        refreshError: 'Still offline',
      };
      const reconciled = pokemonListReducer(model, { type: 'refresh-end' });
      expect(reconciled.refreshing).toBe(false);
      expect(reconciled.pages).toBe(model.pages);
      expect(reconciled.refreshError).toBe('Still offline');
      expect(reconciled.pages[0].auto).toBe(true);
      expect(reconciled.requestAuto).toBe(limit === 20);
      expect(reconciled.failedRequest).toEqual(
        limit === 20 ? { offset: 20, limit } : null,
      );
      expect(reconciled.loadMore).toEqual(
        limit === 20 ? failed.loadMore : { status: 'idle' },
      );
    },
  );
});
