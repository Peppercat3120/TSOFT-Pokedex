import type {
  PokemonPage,
  PokemonPageRequest,
  PokemonSummary,
} from '../../domain/entities/Pokemon';
import type { RepositoryResult } from '../../domain/repositories/PokemonRepository';

export interface PokemonListPage {
  readonly request: PokemonPageRequest;
  readonly result: RepositoryResult<PokemonPage>;
  readonly auto: boolean;
}

export interface PokemonListSnapshot {
  readonly items: readonly PokemonSummary[];
  readonly hasStaleData: boolean;
  readonly nextPage: PokemonPageRequest | null;
}

export function appendPokemonPage(
  existing: readonly PokemonSummary[],
  request: PokemonPageRequest,
  page: PokemonPage,
): Pick<PokemonListSnapshot, 'items' | 'nextPage'> {
  const ids = new Set(existing.map(item => item.id));
  const added = page.items.filter(item => {
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
  const next = page.nextPage;
  return {
    items: [...existing, ...added],
    nextPage:
      added.length > 0 && next !== null && next.offset > request.offset
        ? { offset: next.offset, limit: 20 }
        : null,
  };
}

export function hasAutomaticPageRecovery(
  pages: ReadonlyMap<number, PokemonListPage>,
): boolean {
  return [...pages.values()].some(page => page.auto);
}

export function pagesToRefresh(
  pages: ReadonlyMap<number, PokemonListPage>,
  all: boolean,
  explicit: boolean,
): readonly [number, PokemonListPage][] {
  return [...pages.entries()].filter(([, page]) =>
    all ? true : explicit ? page.result.isStale : page.auto,
  );
}

export function snapshotPokemonPages(
  pages: ReadonlyMap<number, PokemonListPage>,
): PokemonListSnapshot {
  const ordered = [...pages.values()].sort(
    (a, b) => a.request.offset - b.request.offset,
  );
  const ids = new Set<number>();
  const items = ordered.flatMap(page => page.result.data.items).filter(item => {
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
  const last = ordered.at(-1);
  const next = last?.result.data.nextPage;
  return {
    items,
    hasStaleData: ordered.some(page => page.result.isStale),
    nextPage:
      last !== undefined &&
      next !== undefined &&
      next !== null &&
      next.offset > last.request.offset
        ? { offset: next.offset, limit: 20 }
        : null,
  };
}
