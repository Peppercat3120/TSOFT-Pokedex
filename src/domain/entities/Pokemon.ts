export interface NamedResource {
  readonly id: number;
  readonly name: string;
}

export interface PokemonSummary extends NamedResource {
  readonly imageUrl: string;
}

export interface PokemonPageRequest {
  readonly offset: number;
  readonly limit: number;
}

export interface PokemonPage {
  readonly count: number;
  readonly items: readonly PokemonSummary[];
  readonly nextPage: PokemonPageRequest | null;
  readonly previousPage: PokemonPageRequest | null;
}

export interface PokemonAbility {
  readonly ability: NamedResource;
  readonly isHidden: boolean;
  readonly slot: number;
}

export interface PokemonStat {
  readonly baseStat: number;
  readonly stat: NamedResource;
}

export interface PokemonType {
  readonly slot: number;
  readonly type: NamedResource;
}

export interface PokemonSprites {
  readonly frontDefault: string | null;
  readonly officialArtwork: {
    readonly frontDefault: string | null;
  };
}

export interface PokemonDetail {
  readonly id: number;
  readonly name: string;
  readonly baseExperience: number | null;
  readonly heightDecimetres: number;
  readonly weightHectograms: number;
  readonly abilities: readonly PokemonAbility[];
  readonly sprites: PokemonSprites;
  readonly stats: readonly PokemonStat[];
  readonly types: readonly PokemonType[];
}
