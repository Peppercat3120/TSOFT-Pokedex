import { InvalidPayloadError } from '../../src/domain/errors/PokemonErrors';
import {
  mapPokemonDetailDto,
  mapPokemonListDto,
} from '../../src/data/mappers/PokemonMapper';
import {
  firstPageFixture,
  secondPageFixture,
  finalPageFixture,
  pokemonDetailFixture,
  pokemonListFixture,
} from './fixtures';

describe('Pokémon mappers', () => {
  it('preserves full page order, images, totals, and final pagination', () => {
    const first = mapPokemonListDto(firstPageFixture);
    const second = mapPokemonListDto(secondPageFixture);
    const final = mapPokemonListDto(finalPageFixture);
    expect(first.items.map(item => item.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(first.items[19]).toEqual({
      id: 20,
      name: 'raticate',
      imageUrl:
        'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/20.png',
    });
    expect(first.count).toBe(43);
    expect(second.previousPage).toEqual({ offset: 0, limit: 20 });
    expect(second.nextPage).toEqual({ offset: 40, limit: 20 });
    expect(final.items).toHaveLength(3);
    expect(final.nextPage).toBeNull();
  });
  it('maps list resources and pagination into domain values', () => {
    const page = mapPokemonListDto(pokemonListFixture);

    expect(page.items).toEqual([
      {
        id: 1,
        name: 'bulbasaur',
        imageUrl:
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png',
      },
    ]);
    expect(page.nextPage).toEqual({ offset: 20, limit: 20 });
    expect(page.previousPage).toBeNull();
  });

  it('maps the detail fields used by the profile', () => {
    const detail = mapPokemonDetailDto(pokemonDetailFixture);

    expect(detail).toMatchObject({
      id: 1,
      name: 'bulbasaur',
      abilities: [
        { ability: { id: 65, name: 'overgrow' }, isHidden: false, slot: 1 },
      ],
      types: [{ type: { id: 12, name: 'grass' }, slot: 1 }],
      stats: [{ stat: { id: 1, name: 'hp' }, baseStat: 45 }],
      baseExperience: 64,
      heightDecimetres: 7,
      weightHectograms: 69,
      sprites: {
        frontDefault: 'https://sprites.example/front.png',
        officialArtwork: {
          frontDefault: 'https://sprites.example/artwork.png',
        },
      },
    });
  });

  it('preserves nullable detail attributes and hidden ability flags', () => {
    const detail = mapPokemonDetailDto({
      ...pokemonDetailFixture,
      base_experience: null,
      height: 0,
      weight: 0,
      abilities: [{ ...pokemonDetailFixture.abilities[0], is_hidden: true }],
      sprites: {
        ...pokemonDetailFixture.sprites,
        front_default: null,
        other: {
          'official-artwork': {front_default: null},
        },
      },
    });
    expect(detail.baseExperience).toBeNull();
    expect(detail.heightDecimetres).toBe(0);
    expect(detail.weightHectograms).toBe(0);
    expect(detail.abilities[0].isHidden).toBe(true);
    expect(detail.sprites.frontDefault).toBeNull();
    expect(detail.sprites.officialArtwork.frontDefault).toBeNull();
  });

  it('rejects resource URLs without numeric IDs', () => {
    const invalid = {
      ...pokemonListFixture,
      results: [
        { name: 'bulbasaur', url: 'https://pokeapi.co/pokemon/no-id/' },
      ],
    };

    expect(() => mapPokemonListDto(invalid)).toThrow(InvalidPayloadError);
  });
});
