import type {PokemonPageRequest} from '../entities/Pokemon';
import type {
  PokemonRepository,
  RepositoryResult,
} from '../repositories/PokemonRepository';
import type {PokemonPage} from '../entities/Pokemon';
import {normalizePageRequest} from '../validation/PokemonRequestValidation';

export class GetPokemonPage {
  constructor(private readonly repository: PokemonRepository) {}

  execute(
    request: Partial<PokemonPageRequest> = {},
  ): Promise<RepositoryResult<PokemonPage>> {
    return this.repository.getPokemonPage(normalizePageRequest(request));
  }
}
