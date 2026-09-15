import type { PokemonDetail } from '../entities/Pokemon';
import type {
  PokemonRepository,
  RepositoryResult,
  RepositoryReadOptions,
} from '../repositories/PokemonRepository';
import { validatePokemonId } from '../validation/PokemonRequestValidation';

export class GetPokemonById {
  constructor(private readonly repository: PokemonRepository) {}

  execute(
    id: number,
    options?: RepositoryReadOptions,
  ): Promise<RepositoryResult<PokemonDetail>> {
    return options === undefined
      ? this.repository.getPokemonById(validatePokemonId(id))
      : this.repository.getPokemonById(validatePokemonId(id), options);
  }
}
