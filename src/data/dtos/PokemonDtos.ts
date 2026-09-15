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

export interface PokemonStatDto {
  readonly base_stat: number;
  readonly stat: NamedApiResourceDto;
}

export interface PokemonTypeDto {
  readonly slot: number;
  readonly type: NamedApiResourceDto;
}

export interface PokemonOfficialArtworkDto {
  readonly front_default: string | null;
}

export interface PokemonSpritesDto {
  readonly front_default: string | null;
  readonly other: {
    readonly 'official-artwork': PokemonOfficialArtworkDto;
  };
}

/**
 * Fields intentionally omitted until a feature needs them: is_default, order,
 * forms, game_indices, held_items, location_area_encounters, moves,
 * past_types, past_abilities, past_stats, cries, species, stats[].effort,
 * sprites.back_*, sprites.front_female, sprites.front_shiny,
 * sprites.front_shiny_female, and official-artwork.front_shiny.
 */
export interface PokemonDetailDto {
  readonly id: number;
  readonly name: string;
  readonly base_experience: number | null;
  readonly height: number;
  readonly weight: number;
  readonly abilities: readonly PokemonAbilityDto[];
  readonly sprites: PokemonSpritesDto;
  readonly stats: readonly PokemonStatDto[];
  readonly types: readonly PokemonTypeDto[];
}
