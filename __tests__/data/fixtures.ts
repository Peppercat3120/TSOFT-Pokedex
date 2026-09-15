import type {
  PokemonDetailDto,
  PokemonListDto,
} from '../../src/data/dtos/PokemonDtos';

const resource = (name: string, path: string) => ({
  name,
  url: `https://pokeapi.co/api/v2/${path}`,
});

const names = [
  'bulbasaur',
  'ivysaur',
  'venusaur',
  'charmander',
  'charmeleon',
  'charizard',
  'squirtle',
  'wartortle',
  'blastoise',
  'caterpie',
  'metapod',
  'butterfree',
  'weedle',
  'kakuna',
  'beedrill',
  'pidgey',
  'pidgeotto',
  'pidgeot',
  'rattata',
  'raticate',
  'spearow',
  'fearow',
  'ekans',
  'arbok',
  'pikachu',
  'raichu',
  'sandshrew',
  'sandslash',
  'nidoran-f',
  'nidorina',
  'nidoqueen',
  'nidoran-m',
  'nidorino',
  'nidoking',
  'clefairy',
  'clefable',
  'vulpix',
  'ninetales',
  'jigglypuff',
  'wigglytuff',
  'zubat',
  'golbat',
  'oddish',
];

export function listPageFixture(
  offset: number,
  size = 20,
  nextOffset: number | null = offset + size,
): PokemonListDto {
  return {
    count: 43,
    next:
      nextOffset === null
        ? null
        : `https://pokeapi.co/api/v2/pokemon?offset=${nextOffset}&limit=20`,
    previous:
      offset === 0
        ? null
        : `https://pokeapi.co/api/v2/pokemon?offset=${Math.max(
            0,
            offset - 20,
          )}&limit=20`,
    results: names
      .slice(offset, offset + size)
      .map((name, index) => resource(name, `pokemon/${offset + index + 1}/`)),
  };
}

export const firstPageFixture = listPageFixture(0);
export const secondPageFixture = listPageFixture(20);
export const finalPageFixture = listPageFixture(40, 3, null);

export const pokemonListFixture: PokemonListDto = {
  count: 1351,
  next: 'https://pokeapi.co/api/v2/pokemon?offset=20&limit=20',
  previous: null,
  results: [resource('bulbasaur', 'pokemon/1/')],
};

export const pokemonDetailFixture: PokemonDetailDto = {
  id: 1,
  name: 'bulbasaur',
  base_experience: 64,
  height: 7,
  is_default: true,
  order: 1,
  weight: 69,
  abilities: [
    { ability: resource('overgrow', 'ability/65/'), is_hidden: false, slot: 1 },
  ],
  forms: [resource('bulbasaur', 'pokemon-form/1/')],
  game_indices: [{ game_index: 1, version: resource('red', 'version/1/') }],
  held_items: [
    {
      item: resource('miracle-seed', 'item/130/'),
      version_details: [{ rarity: 5, version: resource('ruby', 'version/7/') }],
    },
  ],
  location_area_encounters: '/api/v2/pokemon/1/encounters',
  moves: [
    {
      move: resource('razor-wind', 'move/13/'),
      version_group_details: [
        {
          level_learned_at: 0,
          version_group: resource('gold-silver', 'version-group/3/'),
          move_learn_method: resource('egg', 'move-learn-method/2/'),
          order: null,
        },
      ],
    },
  ],
  past_types: [
    {
      generation: resource('generation-v', 'generation/5/'),
      types: [{ slot: 1, type: resource('grass', 'type/12/') }],
    },
  ],
  past_abilities: [
    {
      generation: resource('generation-iv', 'generation/4/'),
      abilities: [{ ability: null, is_hidden: true, slot: 3 }],
    },
  ],
  past_stats: [
    {
      generation: resource('generation-i', 'generation/1/'),
      stats: [{ base_stat: 45, effort: 0, stat: resource('hp', 'stat/1/') }],
    },
  ],
  sprites: {
    back_default: 'https://sprites.example/back.png',
    back_female: null,
    back_shiny: 'https://sprites.example/back-shiny.png',
    back_shiny_female: null,
    front_default: 'https://sprites.example/front.png',
    front_female: null,
    front_shiny: 'https://sprites.example/front-shiny.png',
    front_shiny_female: null,
    other: {
      'official-artwork': {
        front_default: 'https://sprites.example/artwork.png',
        front_shiny: null,
      },
    },
  },
  cries: {
    latest: 'https://cries.example/latest.ogg',
    legacy: null,
  },
  species: resource('bulbasaur', 'pokemon-species/1/'),
  stats: [{ base_stat: 45, effort: 0, stat: resource('hp', 'stat/1/') }],
  types: [{ slot: 1, type: resource('grass', 'type/12/') }],
};
