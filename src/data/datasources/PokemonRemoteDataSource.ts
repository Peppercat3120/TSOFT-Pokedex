import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
  NotFoundError,
} from '../../domain/errors/PokemonErrors';
import type { PokemonDetailDto, PokemonListDto } from '../dtos/PokemonDtos';
import {
  assertPokemonDetailDto,
  assertPokemonListDto,
} from '../validation/PokemonDtoGuards';

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchFunction = (
  url: string,
  options: { readonly signal: AbortSignal },
) => Promise<FetchResponse>;

export interface PokemonRemoteDataSource {
  getPokemonPage(offset: number, limit: number): Promise<PokemonListDto>;
  getPokemonById(id: number): Promise<PokemonDetailDto>;
}

export class FetchPokemonRemoteDataSource implements PokemonRemoteDataSource {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string = 'https://pokeapi.co/api/v2',
    private readonly fetcher: FetchFunction = (url, options) =>
      fetch(url, options),
    private readonly timeoutMs: number = 15000,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getPokemonPage(offset: number, limit: number): Promise<PokemonListDto> {
    const payload = await this.request(
      `${this.baseUrl}/pokemon?offset=${offset}&limit=${limit}`,
    );
    assertPokemonListDto(payload);
    return payload;
  }

  async getPokemonById(id: number): Promise<PokemonDetailDto> {
    const payload = await this.request(`${this.baseUrl}/pokemon/${id}`);
    assertPokemonDetailDto(payload);
    return {
      id: payload.id,
      name: payload.name,
      base_experience: payload.base_experience,
      height: payload.height,
      weight: payload.weight,
      abilities: payload.abilities.map(ability => ({
        ability: { name: ability.ability.name, url: ability.ability.url },
        is_hidden: ability.is_hidden,
        slot: ability.slot,
      })),
      sprites: {
        front_default: payload.sprites.front_default,
        other: {
          'official-artwork': {
            front_default:
              payload.sprites.other['official-artwork'].front_default,
          },
        },
      },
      stats: payload.stats.map(stat => ({
        base_stat: stat.base_stat,
        stat: { name: stat.stat.name, url: stat.stat.url },
      })),
      types: payload.types.map(type => ({
        slot: type.slot,
        type: { name: type.type.name, url: type.type.url },
      })),
    };
  }

  private async request(url: string): Promise<unknown> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new NetworkError('PokéAPI request timed out'));
        controller.abort();
      }, this.timeoutMs);
    });
    const read = async (): Promise<unknown> => {
      let response: FetchResponse;
      try {
        response = await this.fetcher(url, { signal: controller.signal });
      } catch (error) {
        throw new NetworkError('Unable to reach PokéAPI', error);
      }
      if (response.status === 404) {
        throw new NotFoundError();
      }
      if (!response.ok) {
        throw new HttpError(response.status);
      }
      try {
        return await response.json();
      } catch {
        throw new InvalidPayloadError('PokéAPI returned invalid JSON');
      }
    };
    try {
      return await Promise.race([read(), deadline]);
    } finally {
      clearTimeout(timer);
    }
  }
}
