import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
  NotFoundError,
} from '../../src/domain/errors/PokemonErrors';
import { FetchPokemonRemoteDataSource } from '../../src/data/datasources/PokemonRemoteDataSource';
import { CachedPokemonRepository } from '../../src/data/repositories/CachedPokemonRepository';
import type { PokemonLocalDataSource } from '../../src/data/datasources/PokemonLocalDataSource';
import { pokemonDetailFixture, pokemonListFixture } from './fixtures';

describe('FetchPokemonRemoteDataSource', () => {
  it('builds a paginated request and validates its response', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => pokemonListFixture,
    }));
    const source = new FetchPokemonRemoteDataSource(
      'https://pokeapi.co/api/v2/',
      fetcher,
    );

    await expect(source.getPokemonPage(20, 10)).resolves.toBe(
      pokemonListFixture,
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://pokeapi.co/api/v2/pokemon?offset=20&limit=10',
      { signal: expect.any(Object) },
    );
  });

  it('projects raw detail payloads to the fields used by the profile', async () => {
    const rawPayload = {
      ...pokemonDetailFixture,
      order: 1,
      cries: { latest: 'https://cries.example/latest.ogg', legacy: null },
      stats: [{ ...pokemonDetailFixture.stats[0], effort: 0 }],
      sprites: {
        ...pokemonDetailFixture.sprites,
        front_shiny: 'https://sprites.example/front-shiny.png',
        other: {
          'official-artwork': {
            ...pokemonDetailFixture.sprites.other['official-artwork'],
            front_shiny: 'https://sprites.example/artwork-shiny.png',
          },
        },
      },
    };
    const source = new FetchPokemonRemoteDataSource(undefined, async () => ({
      ok: true,
      status: 200,
      json: async () => rawPayload,
    }));

    await expect(source.getPokemonById(1)).resolves.toEqual(
      pokemonDetailFixture,
    );
  });

  it.each([
    [404, NotFoundError],
    [400, HttpError],
    [503, HttpError],
  ])('classifies HTTP %s', async (status, ErrorType) => {
    const source = new FetchPokemonRemoteDataSource(undefined, async () => ({
      ok: false,
      status,
      json: async () => ({}),
    }));

    await expect(source.getPokemonById(1)).rejects.toBeInstanceOf(ErrorType);
  });

  it('classifies fetch failures as network errors', async () => {
    const source = new FetchPokemonRemoteDataSource(undefined, async () => {
      throw new Error('offline');
    });

    await expect(source.getPokemonById(1)).rejects.toBeInstanceOf(NetworkError);
  });

  it('rejects invalid JSON and invalid contracts', async () => {
    const invalidJson = new FetchPokemonRemoteDataSource(
      undefined,
      async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('bad json');
        },
      }),
    );
    const invalidContract = new FetchPokemonRemoteDataSource(
      undefined,
      async () => ({ ok: true, status: 200, json: async () => ({ id: 1 }) }),
    );

    await expect(invalidJson.getPokemonById(1)).rejects.toBeInstanceOf(
      InvalidPayloadError,
    );
    await expect(invalidContract.getPokemonById(1)).rejects.toBeInstanceOf(
      InvalidPayloadError,
    );
  });
});

describe('request deadlines', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it.each(['fetch', 'body'])(
    'bounds a stalled %s and aborts the request',
    async stage => {
      let signal!: AbortSignal;
      const source = new FetchPokemonRemoteDataSource(
        undefined,
        async (_url, options) => {
          signal = options.signal;
          if (stage === 'fetch') {
            return new Promise(() => {});
          }
          return { ok: true, status: 200, json: () => new Promise(() => {}) };
        },
        100,
      );
      const rejection = source.getPokemonPage(0, 20).catch(error => error);
      await jest.advanceTimersByTimeAsync(99);
      expect(signal.aborted).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      await expect(rejection).resolves.toBeInstanceOf(NetworkError);
      expect(signal.aborted).toBe(true);
      expect(jest.getTimerCount()).toBe(0);
    },
  );

  it('defaults to a fifteen-second deadline', async () => {
    let signal!: AbortSignal;
    const source = new FetchPokemonRemoteDataSource(
      undefined,
      async (_url, options) => {
        signal = options.signal;
        return new Promise(() => {});
      },
    );
    const rejection = source.getPokemonById(1).catch(error => error);
    await jest.advanceTimersByTimeAsync(14999);
    expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(rejection).resolves.toBeInstanceOf(NetworkError);
    expect(signal.aborted).toBe(true);
  });

  it.each(['success', 'http', 'json', 'network'])(
    'cleans up the timer after %s',
    async outcome => {
      let signal!: AbortSignal;
      const source = new FetchPokemonRemoteDataSource(
        undefined,
        async (_url, options) => {
          signal = options.signal;
          if (outcome === 'network') {
            throw new Error('offline');
          }
          return {
            ok: outcome !== 'http',
            status: outcome === 'http' ? 503 : 200,
            json: async () => {
              if (outcome === 'json') {
                throw new SyntaxError('invalid');
              }
              return pokemonListFixture;
            },
          };
        },
        100,
      );
      if (outcome === 'success') {
        await expect(source.getPokemonPage(0, 20)).resolves.toBe(
          pokemonListFixture,
        );
      } else {
        await expect(source.getPokemonPage(0, 20)).rejects.toBeInstanceOf(
          Error,
        );
      }
      expect(jest.getTimerCount()).toBe(0);
      await jest.advanceTimersByTimeAsync(1000);
      expect(signal.aborted).toBe(false);
    },
  );

  it('returns stale cached data after a network-first deadline', async () => {
    const source = new FetchPokemonRemoteDataSource(
      undefined,
      () => new Promise(() => {}),
      100,
    );
    const local: PokemonLocalDataSource = {
      getPokemonPage: async () => ({ cachedAt: 1, data: pokemonListFixture }),
      setPokemonPage: jest.fn(),
      getPokemonById: async () => null,
      setPokemonById: jest.fn(),
    };
    const repository = new CachedPokemonRepository(source, local, () => 2);
    const pending = repository.getPokemonPage({}, { policy: 'network-first' });
    await jest.advanceTimersByTimeAsync(100);
    await expect(pending).resolves.toMatchObject({
      source: 'cache',
      isStale: true,
    });
    expect(local.setPokemonPage).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});
