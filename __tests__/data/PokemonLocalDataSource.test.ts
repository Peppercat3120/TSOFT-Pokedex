jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {},
}));

import {
  AsyncStoragePokemonLocalDataSource,
  type KeyValueStorage,
} from '../../src/data/datasources/PokemonLocalDataSource';
import { pokemonDetailFixture, pokemonListFixture } from './fixtures';

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

describe('AsyncStoragePokemonLocalDataSource', () => {
  it('isolates detail entries by Pokémon ID and ignores corrupt detail cache', async () => {
    const storage = new MemoryStorage();
    const source = new AsyncStoragePokemonLocalDataSource(storage);
    await source.setPokemonById(1, { cachedAt: 1, data: pokemonDetailFixture });
    await source.setPokemonById(2, {
      cachedAt: 2,
      data: { ...pokemonDetailFixture, id: 2, name: 'ivysaur' },
    });
    expect((await source.getPokemonById(1))?.data.name).toBe('bulbasaur');
    expect((await source.getPokemonById(2))?.data.name).toBe('ivysaur');
    expect(await source.getPokemonById(3)).toBeNull();
    const key = '@tsoft-pokedex/v1/pokemon/detail/2';
    storage.values.set(
      key,
      JSON.stringify({ version: 1, cachedAt: 2, data: { id: 2 } }),
    );
    expect(await source.getPokemonById(2)).toBeNull();
    storage.values.set(
      key,
      JSON.stringify({ version: 0, cachedAt: 2, data: pokemonDetailFixture }),
    );
    expect(await source.getPokemonById(2)).toBeNull();
  });
  it('stores list and detail DTOs in versioned, isolated entries', async () => {
    const storage = new MemoryStorage();
    const source = new AsyncStoragePokemonLocalDataSource(storage);

    await source.setPokemonPage(0, 20, {
      cachedAt: 100,
      data: pokemonListFixture,
    });
    await source.setPokemonById(1, {
      cachedAt: 200,
      data: pokemonDetailFixture,
    });

    await expect(source.getPokemonPage(0, 20)).resolves.toEqual({
      cachedAt: 100,
      data: pokemonListFixture,
    });
    await expect(source.getPokemonById(1)).resolves.toEqual({
      cachedAt: 200,
      data: pokemonDetailFixture,
    });
    expect([...storage.values.keys()]).toEqual([
      '@tsoft-pokedex/v1/pokemon/list/0:20',
      '@tsoft-pokedex/v1/pokemon/detail/1',
    ]);
  });

  it('ignores malformed, old-version, and invalid DTO cache records', async () => {
    const storage = new MemoryStorage();
    const source = new AsyncStoragePokemonLocalDataSource(storage);
    const key = '@tsoft-pokedex/v1/pokemon/list/0:20';

    storage.values.set(key, '{broken');
    await expect(source.getPokemonPage(0, 20)).resolves.toBeNull();

    storage.values.set(
      key,
      JSON.stringify({ version: 0, cachedAt: 100, data: pokemonListFixture }),
    );
    await expect(source.getPokemonPage(0, 20)).resolves.toBeNull();

    storage.values.set(
      key,
      JSON.stringify({ version: 1, cachedAt: 100, data: { count: 'many' } }),
    );
    await expect(source.getPokemonPage(0, 20)).resolves.toBeNull();
  });

  it('treats storage read failures as cache misses', async () => {
    const storage: KeyValueStorage = {
      getItem: async () => {
        throw new Error('storage unavailable');
      },
      setItem: async () => undefined,
    };
    const source = new AsyncStoragePokemonLocalDataSource(storage);

    await expect(source.getPokemonById(1)).resolves.toBeNull();
  });
});
