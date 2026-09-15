import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
  NotFoundError,
} from '../../src/domain/errors/PokemonErrors';
import {FetchPokemonRemoteDataSource} from '../../src/data/datasources/PokemonRemoteDataSource';
import {pokemonDetailFixture, pokemonListFixture} from './fixtures';

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
    );
  });

  it('projects raw detail payloads to the fields used by the profile', async () => {
    const rawPayload = {
      ...pokemonDetailFixture,
      order: 1,
      cries: {latest: 'https://cries.example/latest.ogg', legacy: null},
      stats: [
        {...pokemonDetailFixture.stats[0], effort: 0},
      ],
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

    await expect(source.getPokemonById(1)).resolves.toEqual(pokemonDetailFixture);
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
    const invalidJson = new FetchPokemonRemoteDataSource(undefined, async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('bad json');
      },
    }));
    const invalidContract = new FetchPokemonRemoteDataSource(
      undefined,
      async () => ({ok: true, status: 200, json: async () => ({id: 1})}),
    );

    await expect(invalidJson.getPokemonById(1)).rejects.toBeInstanceOf(
      InvalidPayloadError,
    );
    await expect(invalidContract.getPokemonById(1)).rejects.toBeInstanceOf(
      InvalidPayloadError,
    );
  });
});
