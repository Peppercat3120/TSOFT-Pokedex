import {
  HttpError,
  InvalidArgumentError,
  InvalidPayloadError,
  NetworkError,
} from '../../src/domain/errors/PokemonErrors';
import { mapPokemonError } from '../../src/presentation/errors/mapPokemonError';

describe('mapPokemonError', () => {
  it.each([
    [
      new NetworkError('secret'),
      'We couldn’t connect to PokéAPI. Check your connection and try again.',
      true,
    ],
    [
      new HttpError(429),
      'Too many requests right now. Please wait a moment before trying again.',
      true,
    ],
    [
      new HttpError(503),
      'PokéAPI is temporarily unavailable. Please try again shortly.',
      true,
    ],
    [new HttpError(408), 'The request took too long. Please try again.', true],
    [
      new InvalidPayloadError('secret'),
      'We couldn’t read the Pokémon information. Please try again.',
      true,
    ],
    [
      new InvalidArgumentError('secret'),
      'We couldn’t open this Pokémon. Return to the list and select it again.',
      false,
    ],
    [
      new HttpError(403),
      'We couldn’t open this Pokémon. Return to the list and select it again.',
      false,
    ],
    [
      new Error('secret'),
      'We couldn’t load this Pokémon. Please try again.',
      true,
    ],
    [null, 'We couldn’t load this Pokémon. Please try again.', true],
  ])('provides safe detail feedback for %s', (error, message, canRetry) => {
    expect(mapPokemonError(error, 'detail')).toEqual({
      kind: 'error',
      message,
      canRetry,
    });
  });

  it('treats a detail 404 as missing without treating the list as a missing Pokémon', () => {
    expect(mapPokemonError(new HttpError(404), 'detail')).toEqual({
      kind: 'not-found',
      message: 'This Pokémon couldn’t be found.',
      canRetry: false,
    });
    expect(mapPokemonError(new HttpError(404), 'list')).toMatchObject({
      kind: 'error',
      canRetry: false,
    });
  });

  it('keeps pagination context and recovery advice in the same message', () => {
    const feedback = mapPokemonError(new NetworkError('secret'), 'pagination');
    expect(feedback.message).toContain('Couldn’t load more Pokémon.');
    expect(feedback.message).toContain('Check your connection');
    expect(feedback.message).toContain(
      'Your loaded Pokémon are still available.',
    );
    expect(feedback.message).not.toContain('secret');
  });
});
