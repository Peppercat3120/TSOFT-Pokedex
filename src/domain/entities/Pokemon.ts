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

export interface PokemonHistoricalAbility {
  readonly ability: NamedResource | null;
  readonly isHidden: boolean;
  readonly slot: number;
}

export interface PokemonGameIndex {
  readonly gameIndex: number;
  readonly version: NamedResource;
}

export interface PokemonHeldItemVersion {
  readonly rarity: number;
  readonly version: NamedResource;
}

export interface PokemonHeldItem {
  readonly item: NamedResource;
  readonly versionDetails: readonly PokemonHeldItemVersion[];
}

export interface PokemonMoveVersion {
  readonly levelLearnedAt: number;
  readonly moveLearnMethod: NamedResource;
  readonly order: number | null;
  readonly versionGroup: NamedResource;
}

export interface PokemonMove {
  readonly move: NamedResource;
  readonly versionGroupDetails: readonly PokemonMoveVersion[];
}

export interface PokemonStat {
  readonly baseStat: number;
  readonly effort: number;
  readonly stat: NamedResource;
}

export interface PokemonType {
  readonly slot: number;
  readonly type: NamedResource;
}

export interface PokemonTypePast {
  readonly generation: NamedResource;
  readonly types: readonly PokemonType[];
}

export interface PokemonAbilityPast {
  readonly generation: NamedResource;
  readonly abilities: readonly PokemonHistoricalAbility[];
}

export interface PokemonStatPast {
  readonly generation: NamedResource;
  readonly stats: readonly PokemonStat[];
}

export interface PokemonSprites {
  readonly backDefault: string | null;
  readonly backFemale: string | null;
  readonly backShiny: string | null;
  readonly backShinyFemale: string | null;
  readonly frontDefault: string | null;
  readonly frontFemale: string | null;
  readonly frontShiny: string | null;
  readonly frontShinyFemale: string | null;
  readonly officialArtwork: {
    readonly frontDefault: string | null;
    readonly frontShiny: string | null;
  };
}

export interface PokemonCries {
  readonly latest: string | null;
  readonly legacy: string | null;
}

export interface PokemonDetail {
  readonly id: number;
  readonly name: string;
  readonly baseExperience: number | null;
  readonly heightDecimetres: number;
  readonly isDefault: boolean;
  readonly order: number;
  readonly weightHectograms: number;
  readonly abilities: readonly PokemonAbility[];
  readonly forms: readonly NamedResource[];
  readonly gameIndices: readonly PokemonGameIndex[];
  readonly heldItems: readonly PokemonHeldItem[];
  readonly moves: readonly PokemonMove[];
  readonly pastTypes: readonly PokemonTypePast[];
  readonly pastAbilities: readonly PokemonAbilityPast[];
  readonly pastStats: readonly PokemonStatPast[];
  readonly sprites: PokemonSprites;
  readonly cries: PokemonCries;
  readonly species: NamedResource;
  readonly stats: readonly PokemonStat[];
  readonly types: readonly PokemonType[];
}
