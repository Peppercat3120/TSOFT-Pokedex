import type {PokemonPageRequest} from '../entities/Pokemon';
import {InvalidArgumentError} from '../errors/PokemonErrors';

export const DEFAULT_PAGE_REQUEST: PokemonPageRequest = {
  offset: 0,
  limit: 20,
};

export function normalizePageRequest(
  request: Partial<PokemonPageRequest> = {},
): PokemonPageRequest {
  const offset = request.offset ?? DEFAULT_PAGE_REQUEST.offset;
  const limit = request.limit ?? DEFAULT_PAGE_REQUEST.limit;

  if (!Number.isInteger(offset) || offset < 0) {
    throw new InvalidArgumentError('offset must be a non-negative integer');
  }
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new InvalidArgumentError('limit must be a positive integer');
  }

  return {offset, limit};
}

export function validatePokemonId(id: number): number {
  if (!Number.isInteger(id) || id <= 0) {
    throw new InvalidArgumentError('Pokémon id must be a positive integer');
  }
  return id;
}
