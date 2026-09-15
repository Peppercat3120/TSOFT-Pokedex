import type {
  NamedResource,
  PokemonAbility,
  PokemonAbilityPast,
  PokemonDetail,
  PokemonHeldItem,
  PokemonMove,
  PokemonPage,
  PokemonPageRequest,
  PokemonStat,
  PokemonStatPast,
  PokemonType,
  PokemonTypePast,
} from '../../domain/entities/Pokemon';
import { InvalidPayloadError } from '../../domain/errors/PokemonErrors';
import type {
  NamedApiResourceDto,
  PokemonAbilityDto,
  PokemonAbilityPastDto,
  PokemonDetailDto,
  PokemonHeldItemDto,
  PokemonListDto,
  PokemonMoveDto,
  PokemonStatDto,
  PokemonStatPastDto,
  PokemonTypeDto,
  PokemonTypePastDto,
} from '../dtos/PokemonDtos';

const URL_BASE = 'https://pokeapi.co';

function parseResourceId(url: string): number {
  try {
    const pathname = new URL(url, URL_BASE).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const rawId = segments.at(-1);
    const id = rawId === undefined ? Number.NaN : Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Resource URL does not end in a positive integer');
    }
    return id;
  } catch (error) {
    if (error instanceof InvalidPayloadError) {
      throw error;
    }
    throw new InvalidPayloadError(`Invalid PokéAPI resource URL: ${url}`);
  }
}

function mapNamedResource(dto: NamedApiResourceDto): NamedResource {
  return { id: parseResourceId(dto.url), name: dto.name };
}

function mapPageLink(url: string | null): PokemonPageRequest | null {
  if (url === null) {
    return null;
  }

  try {
    const parsed = new URL(url, URL_BASE);
    const offset = Number(parsed.searchParams.get('offset') ?? '0');
    const limit = Number(parsed.searchParams.get('limit'));
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('Invalid offset');
    }
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new Error('Invalid limit');
    }
    return { offset, limit };
  } catch {
    throw new InvalidPayloadError(`Invalid PokéAPI pagination URL: ${url}`);
  }
}

function mapAbility(dto: PokemonAbilityDto): PokemonAbility {
  return {
    ability: mapNamedResource(dto.ability),
    isHidden: dto.is_hidden,
    slot: dto.slot,
  };
}

function mapHeldItem(dto: PokemonHeldItemDto): PokemonHeldItem {
  return {
    item: mapNamedResource(dto.item),
    versionDetails: dto.version_details.map(detail => ({
      rarity: detail.rarity,
      version: mapNamedResource(detail.version),
    })),
  };
}

function mapMove(dto: PokemonMoveDto): PokemonMove {
  return {
    move: mapNamedResource(dto.move),
    versionGroupDetails: dto.version_group_details.map(detail => ({
      levelLearnedAt: detail.level_learned_at,
      moveLearnMethod: mapNamedResource(detail.move_learn_method),
      order: detail.order,
      versionGroup: mapNamedResource(detail.version_group),
    })),
  };
}

function mapStat(dto: PokemonStatDto): PokemonStat {
  return {
    baseStat: dto.base_stat,
    effort: dto.effort,
    stat: mapNamedResource(dto.stat),
  };
}

function mapType(dto: PokemonTypeDto): PokemonType {
  return { slot: dto.slot, type: mapNamedResource(dto.type) };
}

function mapTypePast(dto: PokemonTypePastDto): PokemonTypePast {
  return {
    generation: mapNamedResource(dto.generation),
    types: dto.types.map(mapType),
  };
}

function mapAbilityPast(dto: PokemonAbilityPastDto): PokemonAbilityPast {
  return {
    generation: mapNamedResource(dto.generation),
    abilities: dto.abilities.map(ability => ({
      ability:
        ability.ability === null ? null : mapNamedResource(ability.ability),
      isHidden: ability.is_hidden,
      slot: ability.slot,
    })),
  };
}

function mapStatPast(dto: PokemonStatPastDto): PokemonStatPast {
  return {
    generation: mapNamedResource(dto.generation),
    stats: dto.stats.map(mapStat),
  };
}

export function mapPokemonListDto(dto: PokemonListDto): PokemonPage {
  return {
    count: dto.count,
    items: dto.results.map(resource => {
      const named = mapNamedResource(resource);
      return {
        ...named,
        imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${named.id}.png`,
      };
    }),
    nextPage: mapPageLink(dto.next),
    previousPage: mapPageLink(dto.previous),
  };
}

export function mapPokemonDetailDto(dto: PokemonDetailDto): PokemonDetail {
  const artwork = dto.sprites.other['official-artwork'];

  return {
    id: dto.id,
    name: dto.name,
    baseExperience: dto.base_experience,
    heightDecimetres: dto.height,
    isDefault: dto.is_default,
    order: dto.order,
    weightHectograms: dto.weight,
    abilities: dto.abilities.map(mapAbility),
    forms: dto.forms.map(mapNamedResource),
    gameIndices: dto.game_indices.map(gameIndex => ({
      gameIndex: gameIndex.game_index,
      version: mapNamedResource(gameIndex.version),
    })),
    heldItems: dto.held_items.map(mapHeldItem),
    moves: dto.moves.map(mapMove),
    pastTypes: dto.past_types.map(mapTypePast),
    pastAbilities: dto.past_abilities.map(mapAbilityPast),
    pastStats: dto.past_stats.map(mapStatPast),
    sprites: {
      backDefault: dto.sprites.back_default,
      backFemale: dto.sprites.back_female,
      backShiny: dto.sprites.back_shiny,
      backShinyFemale: dto.sprites.back_shiny_female,
      frontDefault: dto.sprites.front_default,
      frontFemale: dto.sprites.front_female,
      frontShiny: dto.sprites.front_shiny,
      frontShinyFemale: dto.sprites.front_shiny_female,
      officialArtwork: {
        frontDefault: artwork.front_default,
        frontShiny: artwork.front_shiny,
      },
    },
    cries: { latest: dto.cries.latest, legacy: dto.cries.legacy },
    species: mapNamedResource(dto.species),
    stats: dto.stats.map(mapStat),
    types: dto.types.map(mapType),
  };
}
