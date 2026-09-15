import type { PokemonPageRequest } from '../entities/Pokemon';
import type {
  PokemonRepository,
  RepositoryResult,
  RepositoryReadOptions,
} from '../repositories/PokemonRepository';
import type { PokemonPage } from '../entities/Pokemon';
import { normalizePageRequest } from '../validation/PokemonRequestValidation';

export class GetPokemonPage {
  constructor(private readonly repository: PokemonRepository) {}

  execute(
    request: Partial<PokemonPageRequest> = {},
    options?: RepositoryReadOptions,
  ): Promise<RepositoryResult<PokemonPage>> {
    return options === undefined
      ? this.repository.getPokemonPage(normalizePageRequest(request))
      : this.repository.getPokemonPage(normalizePageRequest(request), options);
  }
}
