export class InvalidArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidArgumentError';
  }
}

export class NetworkError extends Error {
  readonly originalError: unknown;

  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
    this.originalError = originalError;
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string = `PokéAPI request failed with HTTP ${status}`,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string = 'The requested Pokémon was not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class InvalidPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPayloadError';
  }
}
