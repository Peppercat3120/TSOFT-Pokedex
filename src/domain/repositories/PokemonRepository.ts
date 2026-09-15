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

export interface PokemonRepository {
  getPokemonPage(
    request?: Partial<PokemonPageRequest>,
  ): Promise<RepositoryResult<PokemonPage>>;

  getPokemonById(id: number): Promise<RepositoryResult<PokemonDetail>>;
}
