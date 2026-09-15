import type {
  PokemonDetail,
  PokemonPage,
  PokemonPageRequest,
} from '../../domain/entities/Pokemon';
import { HttpError, NetworkError } from '../../domain/errors/PokemonErrors';
import type {
  PokemonRepository,
  RepositoryResult,
  RepositoryReadOptions,
} from '../../domain/repositories/PokemonRepository';
import {
  normalizePageRequest,
  validatePokemonId,
} from '../../domain/validation/PokemonRequestValidation';
import {
  mapPokemonDetailDto,
  mapPokemonListDto,
} from '../mappers/PokemonMapper';
import type {
  CacheEntry,
  PokemonLocalDataSource,
} from '../datasources/PokemonLocalDataSource';
import type { PokemonRemoteDataSource } from '../datasources/PokemonRemoteDataSource';

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

interface LoadOperations<TDto, TEntity> {
  readonly readCache: () => Promise<CacheEntry<TDto> | null>;
  readonly fetchRemote: () => Promise<TDto>;
  readonly writeCache: (entry: CacheEntry<TDto>) => Promise<void>;
  readonly map: (dto: TDto) => TEntity;
}

export class CachedPokemonRepository implements PokemonRepository {
  constructor(
    private readonly remote: PokemonRemoteDataSource,
    private readonly local: PokemonLocalDataSource,
    private readonly now: () => number = Date.now,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  getPokemonPage(
    request: Partial<PokemonPageRequest> = {},
    options?: RepositoryReadOptions,
  ): Promise<RepositoryResult<PokemonPage>> {
    const { offset, limit } = normalizePageRequest(request);
    return this.load(
      {
        readCache: () => this.local.getPokemonPage(offset, limit),
        fetchRemote: () => this.remote.getPokemonPage(offset, limit),
        writeCache: entry => this.local.setPokemonPage(offset, limit, entry),
        map: mapPokemonListDto,
      },
      options,
    );
  }

  getPokemonById(
    id: number,
    options?: RepositoryReadOptions,
  ): Promise<RepositoryResult<PokemonDetail>> {
    const validId = validatePokemonId(id);
    return this.load(
      {
        readCache: () => this.local.getPokemonById(validId),
        fetchRemote: () => this.remote.getPokemonById(validId),
        writeCache: entry => this.local.setPokemonById(validId, entry),
        map: mapPokemonDetailDto,
      },
      options,
    );
  }

  private async load<TDto, TEntity>(
    operations: LoadOperations<TDto, TEntity>,
    options?: RepositoryReadOptions,
  ): Promise<RepositoryResult<TEntity>> {
    const cached = await operations.readCache();
    let cachedData: TEntity | null = null;

    if (cached !== null) {
      try {
        cachedData = operations.map(cached.data);
      } catch {
        cachedData = null;
      }
    }

    if (
      options?.policy !== 'network-first' &&
      cached !== null &&
      cachedData !== null &&
      this.now() - cached.cachedAt < this.ttlMs
    ) {
      return {
        data: cachedData,
        source: 'cache',
        isStale: false,
        cachedAt: cached.cachedAt,
      };
    }

    try {
      const dto = await operations.fetchRemote();
      const data = operations.map(dto);
      const cachedAt = this.now();
      try {
        await operations.writeCache({ cachedAt, data: dto });
      } catch {
        // Caching is best-effort; valid remote data must still be returned.
      }
      return { data, source: 'remote', isStale: false, cachedAt };
    } catch (error) {
      if (
        cached !== null &&
        cachedData !== null &&
        this.canUseStaleCache(error)
      ) {
        return {
          data: cachedData,
          source: 'cache',
          isStale: true,
          cachedAt: cached.cachedAt,
        };
      }
      throw error;
    }
  }

  private canUseStaleCache(error: unknown): boolean {
    return (
      error instanceof NetworkError ||
      (error instanceof HttpError && error.status >= 500 && error.status <= 599)
    );
  }
}
