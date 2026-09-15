import type {
  PokemonDetail,
  PokemonPage,
  PokemonPageRequest,
} from '../entities/Pokemon';

export interface RepositoryResult<T> {
  readonly data: T;
  readonly source: 'remote' | 'cache';
  readonly isStale: boolean;
  readonly cachedAt: number;
}

export interface RepositoryReadOptions {
  readonly policy: 'cache-first' | 'network-first';
}

export interface PokemonRepository {
  getPokemonPage(
    request?: Partial<PokemonPageRequest>,
    options?: RepositoryReadOptions,
  ): Promise<RepositoryResult<PokemonPage>>;

  getPokemonById(
    id: number,
    options?: RepositoryReadOptions,
  ): Promise<RepositoryResult<PokemonDetail>>;
}
