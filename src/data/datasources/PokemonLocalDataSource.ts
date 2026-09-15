import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PokemonDetailDto, PokemonListDto } from '../dtos/PokemonDtos';
import {
  assertPokemonDetailDto,
  assertPokemonListDto,
} from '../validation/PokemonDtoGuards';

const CACHE_VERSION = 2;
const CACHE_PREFIX = '@tsoft-pokedex/v2/pokemon';

export interface CacheEntry<T> {
  readonly cachedAt: number;
  readonly data: T;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PokemonLocalDataSource {
  getPokemonPage(
    offset: number,
    limit: number,
  ): Promise<CacheEntry<PokemonListDto> | null>;
  setPokemonPage(
    offset: number,
    limit: number,
    entry: CacheEntry<PokemonListDto>,
  ): Promise<void>;
  getPokemonById(id: number): Promise<CacheEntry<PokemonDetailDto> | null>;
  setPokemonById(
    id: number,
    entry: CacheEntry<PokemonDetailDto>,
  ): Promise<void>;
}

interface CacheEnvelope {
  readonly version: number;
  readonly cachedAt: number;
  readonly data: unknown;
}

function parseEnvelope(raw: string): CacheEnvelope | null {
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    !('version' in parsed) ||
    parsed.version !== CACHE_VERSION ||
    !('cachedAt' in parsed) ||
    typeof parsed.cachedAt !== 'number' ||
    !Number.isFinite(parsed.cachedAt) ||
    parsed.cachedAt < 0 ||
    !('data' in parsed)
  ) {
    return null;
  }
  return {
    version: CACHE_VERSION,
    cachedAt: parsed.cachedAt,
    data: parsed.data,
  };
}

export class AsyncStoragePokemonLocalDataSource
  implements PokemonLocalDataSource
{
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  async getPokemonPage(
    offset: number,
    limit: number,
  ): Promise<CacheEntry<PokemonListDto> | null> {
    return this.read(this.pageKey(offset, limit), assertPokemonListDto);
  }

  setPokemonPage(
    offset: number,
    limit: number,
    entry: CacheEntry<PokemonListDto>,
  ): Promise<void> {
    return this.write(this.pageKey(offset, limit), entry);
  }

  async getPokemonById(
    id: number,
  ): Promise<CacheEntry<PokemonDetailDto> | null> {
    return this.read(this.detailKey(id), assertPokemonDetailDto);
  }

  setPokemonById(
    id: number,
    entry: CacheEntry<PokemonDetailDto>,
  ): Promise<void> {
    return this.write(this.detailKey(id), entry);
  }

  private async read<T>(
    key: string,
    assertData: (value: unknown) => asserts value is T,
  ): Promise<CacheEntry<T> | null> {
    try {
      const raw = await this.storage.getItem(key);
      if (raw === null) {
        return null;
      }
      const envelope = parseEnvelope(raw);
      if (envelope === null) {
        return null;
      }
      assertData(envelope.data);
      return { cachedAt: envelope.cachedAt, data: envelope.data };
    } catch {
      return null;
    }
  }

  private write<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    return this.storage.setItem(
      key,
      JSON.stringify({ version: CACHE_VERSION, ...entry }),
    );
  }

  private pageKey(offset: number, limit: number): string {
    return `${CACHE_PREFIX}/list/${offset}:${limit}`;
  }

  private detailKey(id: number): string {
    return `${CACHE_PREFIX}/detail/${id}`;
  }
}
