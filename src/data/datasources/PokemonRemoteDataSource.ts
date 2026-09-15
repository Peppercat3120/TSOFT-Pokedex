import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
  NotFoundError,
} from '../../domain/errors/PokemonErrors';
import type {
  PokemonDetailDto,
  PokemonListDto,
} from '../dtos/PokemonDtos';
import {
  assertPokemonDetailDto,
  assertPokemonListDto,
} from '../validation/PokemonDtoGuards';

export interface FetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export type FetchFunction = (url: string) => Promise<FetchResponse>;

export interface PokemonRemoteDataSource {
  getPokemonPage(offset: number, limit: number): Promise<PokemonListDto>;
  getPokemonById(id: number): Promise<PokemonDetailDto>;
}

export class FetchPokemonRemoteDataSource implements PokemonRemoteDataSource {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string = 'https://pokeapi.co/api/v2',
    private readonly fetcher: FetchFunction = url => fetch(url),
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
    return payload;
  }

  private async request(url: string): Promise<unknown> {
    let response: FetchResponse;
    try {
      response = await this.fetcher(url);
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
  }
}
