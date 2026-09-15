import {
  HttpError,
  InvalidArgumentError,
  InvalidPayloadError,
  NetworkError,
} from '../../domain/errors/PokemonErrors';

export type PokemonErrorContext = 'list' | 'pagination' | 'detail';

export interface PokemonErrorFeedback {
  readonly kind: 'error' | 'not-found';
  readonly message: string;
  readonly canRetry: boolean;
}

/** Maps failures to safe UI feedback without exposing technical error details. */
export function mapPokemonError(
  error: unknown,
  context: PokemonErrorContext,
): PokemonErrorFeedback {
  let kind: PokemonErrorFeedback['kind'] = 'error';
  let canRetry = true;
  let message =
    context === 'detail'
      ? 'We couldn’t load this Pokémon. Please try again.'
      : context === 'pagination'
      ? 'Please try again.'
      : 'We couldn’t load Pokémon. Please try again.';

  if (error instanceof InvalidArgumentError) {
    canRetry = false;
    message =
      context === 'detail'
        ? 'We couldn’t open this Pokémon. Return to the list and select it again.'
        : 'We couldn’t open this Pokémon list. Please restart the app.';
  } else if (error instanceof NetworkError) {
    message =
      'We couldn’t connect to PokéAPI. Check your connection and try again.';
  } else if (error instanceof InvalidPayloadError) {
    message = 'We couldn’t read the Pokémon information. Please try again.';
  } else if (error instanceof HttpError) {
    if (error.status === 404 && context === 'detail') {
      kind = 'not-found';
      canRetry = false;
      message = 'This Pokémon couldn’t be found.';
    } else if (error.status === 429) {
      message =
        'Too many requests right now. Please wait a moment before trying again.';
    } else if (error.status === 408) {
      message = 'The request took too long. Please try again.';
    } else if (error.status >= 500 && error.status <= 599) {
      message = 'PokéAPI is temporarily unavailable. Please try again shortly.';
    } else if (error.status >= 400 && error.status <= 499) {
      canRetry = false;
      message =
        context === 'detail'
          ? 'We couldn’t open this Pokémon. Return to the list and select it again.'
          : 'We couldn’t open this Pokémon list. Please restart the app.';
    }
  }

  if (context === 'pagination') {
    message = `Couldn’t load more Pokémon. ${message} Your loaded Pokémon are still available.`;
  }
  return { kind, message, canRetry };
}
