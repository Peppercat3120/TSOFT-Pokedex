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

function uniqueItems(
  items: readonly PokemonSummary[],
  ids: Set<number>,
): readonly PokemonSummary[] {
  return items.filter(item => {
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
}

function nextPageRequest(
  request: PokemonPageRequest,
  page: PokemonPage,
  added: number,
): PokemonPageRequest | null {
  const next = page.nextPage;
  return added > 0 && next !== null && next.offset > request.offset
    ? { offset: next.offset, limit: 20 }
    : null;
}

export function hasAutomaticPageRecovery(
  pages: readonly PokemonListPage[],
): boolean {
  return pages.some(page => page.auto);
}

export function pagesToRefresh(
  pages: readonly PokemonListPage[],
  all: boolean,
  explicit: boolean,
): readonly PokemonListPage[] {
  return pages.filter(page =>
    all ? true : explicit ? page.result.isStale : page.auto,
  );
}

export function snapshotPokemonPages(
  pages: readonly PokemonListPage[],
): PokemonListSnapshot {
  const ordered = [...pages].sort(
    (a, b) => a.request.offset - b.request.offset,
  );
  const ids = new Set<number>();
  const items: PokemonSummary[] = [];
  let nextPage: PokemonPageRequest | null = null;
  let stopped = false;
  for (const page of ordered) {
    const added = uniqueItems(page.result.data.items, ids);
    items.push(...added);
    nextPage = nextPageRequest(page.request, page.result.data, added.length);
    stopped = stopped || nextPage === null;
  }
  return {
    items,
    nextPage: stopped ? null : nextPage,
    // Keep warnings for every loaded page, including pages whose cursor has stopped.
    hasStaleData: ordered.some(page => page.result.isStale),
  };
}
