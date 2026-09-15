import type {PokemonDetail} from '../entities/Pokemon';
import type {
  PokemonRepository,
  RepositoryResult,
} from '../repositories/PokemonRepository';
import {validatePokemonId} from '../validation/PokemonRequestValidation';

export class GetPokemonById {
  constructor(private readonly repository: PokemonRepository) {}

  execute(id: number): Promise<RepositoryResult<PokemonDetail>> {
    return this.repository.getPokemonById(validatePokemonId(id));
  }
}
