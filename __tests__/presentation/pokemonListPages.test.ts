import {
  hasAutomaticPageRecovery,
  pagesToRefresh,
  snapshotPokemonPages,
  type PokemonListPage,
} from '../../src/presentation/hooks/pokemonListPages';
import { mapPokemonListDto } from '../../src/data/mappers/PokemonMapper';
import type { RepositoryResult } from '../../src/domain/repositories/PokemonRepository';
import type { PokemonPage } from '../../src/domain/entities/Pokemon';
import { firstPageFixture, secondPageFixture } from '../data/fixtures';

function result(
  page: PokemonPage,
  isStale = false,
): RepositoryResult<PokemonPage> {
  return {
    data: page,
    source: isStale ? 'cache' : 'remote',
    isStale,
    cachedAt: 1,
  };
}

describe('pokemon list pages', () => {
  const first = mapPokemonListDto(firstPageFixture);
  const second = mapPokemonListDto(secondPageFixture);

  it('appends unique rows and stops a duplicate-only page', () => {
    const firstRecord: PokemonListPage = {
      request: { offset: 0, limit: 20 },
      result: result(first),
      auto: false,
    };
    const appended = snapshotPokemonPages([firstRecord]);
    expect(appended.items).toHaveLength(20);
    expect(appended.nextPage).toEqual({ offset: 20, limit: 20 });
    const duplicateOnly = snapshotPokemonPages([
      firstRecord,
      {
        request: { offset: 20, limit: 20 },
        result: result({ ...second, items: [...first.items] }),
        auto: false,
      },
    ]);
    expect(duplicateOnly.items).toHaveLength(20);
    expect(duplicateOnly.nextPage).toBeNull();
  });

  it('rebuilds sorted rows and selects the correct recovery targets', () => {
    const pages: readonly PokemonListPage[] = [
      {
        request: { offset: 20, limit: 20 },
        result: result(second),
        auto: false,
      },
      {
        request: { offset: 0, limit: 20 },
        result: result(first, true),
        auto: true,
      },
    ];

    const snapshot = snapshotPokemonPages(pages);
    expect(snapshot.items.map(item => item.id)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1),
    );
    expect(snapshot.hasStaleData).toBe(true);
    expect(snapshot.nextPage).toEqual({ offset: 40, limit: 20 });
    expect(hasAutomaticPageRecovery(pages)).toBe(true);
    expect(
      pagesToRefresh(pages, false, false).map(page => page.request.offset),
    ).toEqual([0]);
    expect(
      pagesToRefresh(pages, false, true).map(page => page.request.offset),
    ).toEqual([0]);
  });
});
