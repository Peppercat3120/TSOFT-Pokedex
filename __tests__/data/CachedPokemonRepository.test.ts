import type { PokemonLocalDataSource } from '../../src/data/datasources/PokemonLocalDataSource';
import type { PokemonRemoteDataSource } from '../../src/data/datasources/PokemonRemoteDataSource';
import { CachedPokemonRepository } from '../../src/data/repositories/CachedPokemonRepository';
import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
} from '../../src/domain/errors/PokemonErrors';
import {
  firstPageFixture,
  secondPageFixture,
  pokemonDetailFixture,
  pokemonListFixture,
} from './fixtures';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 2 * DAY_MS;

function emptyRemote() {
  return {
    getPokemonPage: jest.fn(async () => pokemonListFixture),
    getPokemonById: jest.fn(async () => pokemonDetailFixture),
  } satisfies PokemonRemoteDataSource;
}

function emptyLocal() {
  return {
    getPokemonPage: jest
      .fn<
        ReturnType<PokemonLocalDataSource['getPokemonPage']>,
        Parameters<PokemonLocalDataSource['getPokemonPage']>
      >()
      .mockResolvedValue(null),
    setPokemonPage: jest.fn<
      ReturnType<PokemonLocalDataSource['setPokemonPage']>,
      Parameters<PokemonLocalDataSource['setPokemonPage']>
    >(),
    getPokemonById: jest
      .fn<
        ReturnType<PokemonLocalDataSource['getPokemonById']>,
        Parameters<PokemonLocalDataSource['getPokemonById']>
      >()
      .mockResolvedValue(null),
    setPokemonById: jest.fn<
      ReturnType<PokemonLocalDataSource['setPokemonById']>,
      Parameters<PokemonLocalDataSource['setPokemonById']>
    >(),
  } satisfies PokemonLocalDataSource;
}

describe('CachedPokemonRepository', () => {
  it('uses fresh detail cache without network and returns remote detail when writes fail', async () => {
    const remote = emptyRemote();
    const local = emptyLocal();
    local.getPokemonById.mockResolvedValueOnce({
      cachedAt: NOW - 1,
      data: pokemonDetailFixture,
    });
    const repository = new CachedPokemonRepository(remote, local, () => NOW);
    expect((await repository.getPokemonById(1)).source).toBe('cache');
    expect(remote.getPokemonById).not.toHaveBeenCalled();
    local.setPokemonById.mockRejectedValueOnce(new Error('disk full'));
    remote.getPokemonById.mockResolvedValueOnce({...pokemonDetailFixture, id: 2, name: 'ivysaur'});
    expect((await repository.getPokemonById(2)).source).toBe('remote');
    expect(local.getPokemonById.mock.calls).toEqual([[1], [2]]);
  });

  it.each([new NetworkError('offline'), new HttpError(503)])(
    'falls back to expired detail cache, but fails for an uncached ID: %s',
    async error => {
      const remote = emptyRemote();
      const local = emptyLocal();
      local.getPokemonById.mockResolvedValueOnce({
        cachedAt: 0,
        data: pokemonDetailFixture,
      });
      remote.getPokemonById.mockRejectedValue(error);
      const repository = new CachedPokemonRepository(remote, local, () => NOW);
      await expect(repository.getPokemonById(1)).resolves.toMatchObject({
        source: 'cache',
        isStale: true,
        data: { id: 1 },
      });
      await expect(repository.getPokemonById(2)).rejects.toBe(error);
    },
  );

  it('does not hide detail 404 or invalid payloads behind expired cache', async () => {
    const remote = emptyRemote();
    const local = emptyLocal();
    local.getPokemonById.mockResolvedValue({
      cachedAt: 0,
      data: pokemonDetailFixture,
    });
    const repository = new CachedPokemonRepository(remote, local, () => NOW);
    remote.getPokemonById
      .mockRejectedValueOnce(new HttpError(404))
      .mockRejectedValueOnce(new InvalidPayloadError('bad payload'));
    await expect(repository.getPokemonById(1)).rejects.toMatchObject({
      status: 404,
    });
    await expect(repository.getPokemonById(1)).rejects.toBeInstanceOf(
      InvalidPayloadError,
    );
  });
  it('caches pages independently and keeps visited pages available offline', async () => {
    const pages = new Map<
      number,
      { cachedAt: number; data: typeof firstPageFixture }
    >();
    const remote = emptyRemote();
    remote.getPokemonPage.mockImplementation(async (...args: unknown[]) =>
      args[0] === 20 ? secondPageFixture : firstPageFixture,
    );
    const local: PokemonLocalDataSource = {
      ...emptyLocal(),
      getPokemonPage: async offset => pages.get(offset) ?? null,
      setPokemonPage: async (offset, _limit, entry) => {
        pages.set(offset, entry);
      },
    };
    let now = NOW;
    const repository = new CachedPokemonRepository(remote, local, () => now);
    await repository.getPokemonPage({ offset: 0, limit: 20 });
    await repository.getPokemonPage({ offset: 20, limit: 20 });
    expect([...pages.keys()]).toEqual([0, 20]);
    remote.getPokemonPage.mockRejectedValue(new NetworkError('offline'));
    expect((await repository.getPokemonPage({ offset: 20 })).isStale).toBe(
      false,
    );
    expect(remote.getPokemonPage).toHaveBeenCalledTimes(2);
    now += 2 * DAY_MS;
    const cached = await repository.getPokemonPage({ offset: 20 });
    expect(cached.isStale).toBe(true);
    expect(cached.data.items[0].id).toBe(21);
    await expect(
      repository.getPokemonPage({ offset: 40 }),
    ).rejects.toBeInstanceOf(NetworkError);
  });
  it('returns fresh list cache without contacting the remote source', async () => {
    const remote = emptyRemote();
    const local = emptyLocal();
    local.getPokemonPage.mockResolvedValue({
      cachedAt: NOW - 1,
      data: pokemonListFixture,
    });
    const repository = new CachedPokemonRepository(remote, local, () => NOW);

    const result = await repository.getPokemonPage();

    expect(result.source).toBe('cache');
    expect(result.isStale).toBe(false);
    expect(result.data.items[0]).toMatchObject({ id: 1, name: 'bulbasaur' });
    expect(remote.getPokemonPage).not.toHaveBeenCalled();
  });

  it('refreshes stale detail cache and persists the remote DTO', async () => {
    const remote = emptyRemote();
    const local = emptyLocal();
    local.getPokemonById.mockResolvedValue({
      cachedAt: 0,
      data: pokemonDetailFixture,
    });
    const repository = new CachedPokemonRepository(remote, local, () => NOW);

    const result = await repository.getPokemonById(1);

    expect(result).toMatchObject({
      source: 'remote',
      isStale: false,
      cachedAt: NOW,
    });
    expect(result.data.species).toEqual({ id: 1, name: 'bulbasaur' });
    expect(local.setPokemonById).toHaveBeenCalledWith(1, {
      cachedAt: NOW,
      data: pokemonDetailFixture,
    });
  });

  it.each([new NetworkError('offline'), new HttpError(503)])(
    'uses stale cache for retryable failure: %s',
    async error => {
      const remote = emptyRemote();
      const local = emptyLocal();
      local.getPokemonPage.mockResolvedValue({
        cachedAt: 0,
        data: pokemonListFixture,
      });
      remote.getPokemonPage.mockRejectedValue(error);
      const repository = new CachedPokemonRepository(remote, local, () => NOW);

      await expect(
        repository.getPokemonPage({ offset: 0, limit: 20 }),
      ).resolves.toMatchObject({
        source: 'cache',
        isStale: true,
        cachedAt: 0,
      });
    },
  );

  it.each([new HttpError(400), new InvalidPayloadError('bad payload')])(
    'does not use stale cache for non-retryable failure: %s',
    async error => {
      const remote = emptyRemote();
      const local = emptyLocal();
      local.getPokemonPage.mockResolvedValue({
        cachedAt: 0,
        data: pokemonListFixture,
      });
      remote.getPokemonPage.mockRejectedValue(error);
      const repository = new CachedPokemonRepository(remote, local, () => NOW);

      await expect(repository.getPokemonPage()).rejects.toBe(error);
    },
  );

  it('returns remote data when cache persistence fails', async () => {
    const remote = emptyRemote();
    const local = emptyLocal();
    local.setPokemonPage.mockRejectedValue(new Error('disk full'));
    const repository = new CachedPokemonRepository(remote, local, () => NOW);

    await expect(repository.getPokemonPage()).resolves.toMatchObject({
      source: 'remote',
      isStale: false,
    });
  });

  it('ignores structurally valid cache data with invalid resource URLs', async () => {
    const remote = emptyRemote();
    const local = emptyLocal();
    local.getPokemonPage.mockResolvedValue({
      cachedAt: NOW - 1,
      data: {
        ...pokemonListFixture,
        results: [{ name: 'bad', url: 'https://pokeapi.co/not-an-id/' }],
      },
    });
    const repository = new CachedPokemonRepository(remote, local, () => NOW);

    const result = await repository.getPokemonPage();

    expect(result.source).toBe('remote');
    expect(remote.getPokemonPage).toHaveBeenCalledTimes(1);
  });
});
