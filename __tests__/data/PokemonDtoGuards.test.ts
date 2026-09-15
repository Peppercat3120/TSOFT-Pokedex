import {InvalidPayloadError} from '../../src/domain/errors/PokemonErrors';
import {
  assertPokemonDetailDto,
  assertPokemonListDto,
} from '../../src/data/validation/PokemonDtoGuards';
import {pokemonDetailFixture, pokemonListFixture} from './fixtures';

describe('Pokémon DTO guards', () => {
  it('accepts the reduced detail contract and unknown fields', () => {
    const payload: unknown = {
      ...pokemonDetailFixture,
      undocumented_field: true,
      sprites: {...pokemonDetailFixture.sprites, versions: {future: {}}},
    };

    expect(() => assertPokemonDetailDto(payload)).not.toThrow();
  });

  it('rejects malformed used nested detail data with a useful path', () => {
    const payload: unknown = {
      ...pokemonDetailFixture,
      abilities: [{...pokemonDetailFixture.abilities[0], is_hidden: 'yes'}],
    };

    expect(() => assertPokemonDetailDto(payload)).toThrow(
      'response.abilities[0].is_hidden',
    );
  });

  it('rejects malformed list results', () => {
    const payload: unknown = {
      ...pokemonListFixture,
      results: [{name: 'bulbasaur'}],
    };

    expect(() => assertPokemonListDto(payload)).toThrow(InvalidPayloadError);
  });
});
