import type {
  NamedResource,
  PokemonAbility,
  PokemonDetail,
  PokemonPage,
  PokemonPageRequest,
  PokemonStat,
  PokemonType,
} from '../../domain/entities/Pokemon';
import { InvalidPayloadError } from '../../domain/errors/PokemonErrors';
import type {
  NamedApiResourceDto,
  PokemonAbilityDto,
  PokemonDetailDto,
  PokemonListDto,
  PokemonStatDto,
  PokemonTypeDto,
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

function mapStat(dto: PokemonStatDto): PokemonStat {
  return {
    baseStat: dto.base_stat,
    stat: mapNamedResource(dto.stat),
  };
}

function mapType(dto: PokemonTypeDto): PokemonType {
  return { slot: dto.slot, type: mapNamedResource(dto.type) };
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
    weightHectograms: dto.weight,
    abilities: dto.abilities.map(mapAbility),
    sprites: {
      frontDefault: dto.sprites.front_default,
      officialArtwork: {
        frontDefault: artwork.front_default,
      },
    },
    stats: dto.stats.map(mapStat),
    types: dto.types.map(mapType),
  };
}
