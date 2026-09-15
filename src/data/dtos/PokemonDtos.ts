export interface NamedApiResourceDto {
  readonly name: string;
  readonly url: string;
}

export interface PokemonListDto {
  readonly count: number;
  readonly next: string | null;
  readonly previous: string | null;
  readonly results: readonly NamedApiResourceDto[];
}

export interface PokemonAbilityDto {
  readonly ability: NamedApiResourceDto;
  readonly is_hidden: boolean;
  readonly slot: number;
}

export interface PokemonHistoricalAbilityDto {
  readonly ability: NamedApiResourceDto | null;
  readonly is_hidden: boolean;
  readonly slot: number;
}

export interface VersionGameIndexDto {
  readonly game_index: number;
  readonly version: NamedApiResourceDto;
}

export interface PokemonHeldItemVersionDto {
  readonly rarity: number;
  readonly version: NamedApiResourceDto;
}

export interface PokemonHeldItemDto {
  readonly item: NamedApiResourceDto;
  readonly version_details: readonly PokemonHeldItemVersionDto[];
}

export interface PokemonMoveVersionDto {
  readonly level_learned_at: number;
  readonly move_learn_method: NamedApiResourceDto;
  readonly order: number | null;
  readonly version_group: NamedApiResourceDto;
}

export interface PokemonMoveDto {
  readonly move: NamedApiResourceDto;
  readonly version_group_details: readonly PokemonMoveVersionDto[];
}

export interface PokemonStatDto {
  readonly base_stat: number;
  readonly effort: number;
  readonly stat: NamedApiResourceDto;
}

export interface PokemonTypeDto {
  readonly slot: number;
  readonly type: NamedApiResourceDto;
}

export interface PokemonTypePastDto {
  readonly generation: NamedApiResourceDto;
  readonly types: readonly PokemonTypeDto[];
}

export interface PokemonAbilityPastDto {
  readonly generation: NamedApiResourceDto;
  readonly abilities: readonly PokemonHistoricalAbilityDto[];
}

export interface PokemonStatPastDto {
  readonly generation: NamedApiResourceDto;
  readonly stats: readonly PokemonStatDto[];
}

export interface PokemonOfficialArtworkDto {
  readonly front_default: string | null;
  readonly front_shiny: string | null;
}

export interface PokemonSpritesDto {
  readonly back_default: string | null;
  readonly back_female: string | null;
  readonly back_shiny: string | null;
  readonly back_shiny_female: string | null;
  readonly front_default: string | null;
  readonly front_female: string | null;
  readonly front_shiny: string | null;
  readonly front_shiny_female: string | null;
  readonly other: {
    readonly 'official-artwork': PokemonOfficialArtworkDto;
  };
}

export interface PokemonCriesDto {
  readonly latest: string | null;
  readonly legacy: string | null;
}

export interface PokemonDetailDto {
  readonly id: number;
  readonly name: string;
  readonly base_experience: number | null;
  readonly height: number;
  readonly is_default: boolean;
  readonly order: number;
  readonly weight: number;
  readonly abilities: readonly PokemonAbilityDto[];
  readonly forms: readonly NamedApiResourceDto[];
  readonly game_indices: readonly VersionGameIndexDto[];
  readonly held_items: readonly PokemonHeldItemDto[];
  readonly location_area_encounters: string;
  readonly moves: readonly PokemonMoveDto[];
  readonly past_types: readonly PokemonTypePastDto[];
  readonly past_abilities: readonly PokemonAbilityPastDto[];
  readonly past_stats: readonly PokemonStatPastDto[];
  readonly sprites: PokemonSpritesDto;
  readonly cries: PokemonCriesDto;
  readonly species: NamedApiResourceDto;
  readonly stats: readonly PokemonStatDto[];
  readonly types: readonly PokemonTypeDto[];
}
