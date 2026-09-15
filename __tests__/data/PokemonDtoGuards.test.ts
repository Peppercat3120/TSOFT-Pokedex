import {InvalidPayloadError} from '../../src/domain/errors/PokemonErrors';
import {
  assertPokemonDetailDto,
  assertPokemonListDto,
} from '../../src/data/validation/PokemonDtoGuards';
import {pokemonDetailFixture, pokemonListFixture} from './fixtures';

describe('Pokémon DTO guards', () => {
  it('accepts complete detail data, nullable fields, and unknown fields', () => {
    const payload: unknown = {
      ...pokemonDetailFixture,
      undocumented_field: true,
      sprites: {...pokemonDetailFixture.sprites, versions: {future: {}}},
    };

    expect(() => assertPokemonDetailDto(payload)).not.toThrow();
  });

  it('rejects malformed nested detail data with a useful path', () => {
    const payload: unknown = {
      ...pokemonDetailFixture,
      past_abilities: [
        {
          ...pokemonDetailFixture.past_abilities[0],
          abilities: [{ability: null, is_hidden: 'yes', slot: 3}],
        },
      ],
    };

    expect(() => assertPokemonDetailDto(payload)).toThrow(
      'response.past_abilities[0].abilities[0].is_hidden',
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
