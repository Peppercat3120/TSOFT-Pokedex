import {InvalidPayloadError} from '../../domain/errors/PokemonErrors';
import type {
  NamedApiResourceDto,
  PokemonDetailDto,
  PokemonListDto,
} from '../dtos/PokemonDtos';

type UnknownRecord = Record<string, unknown>;

function fail(path: string, expected: string): never {
  throw new InvalidPayloadError(`${path} must be ${expected}`);
}

function assertRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'an object');
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') {
    fail(path, 'a string');
  }
}

function assertNullableString(
  value: unknown,
  path: string,
): asserts value is string | null {
  if (value !== null && typeof value !== 'string') {
    fail(path, 'a string or null');
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    fail(path, 'a boolean');
  }
}

function assertInteger(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(path, 'an integer');
  }
}

function assertNullableInteger(
  value: unknown,
  path: string,
): asserts value is number | null {
  if (value !== null) {
    assertInteger(value, path);
  }
}

function assertArray(
  value: unknown,
  path: string,
  assertItem: (item: unknown, itemPath: string) => void,
): asserts value is readonly unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'an array');
  }
  value.forEach((item, index) => assertItem(item, `${path}[${index}]`));
}

function assertNamedResource(
  value: unknown,
  path: string,
): asserts value is NamedApiResourceDto {
  assertRecord(value, path);
  assertString(value.name, `${path}.name`);
  assertString(value.url, `${path}.url`);
}

function assertAbility(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNamedResource(value.ability, `${path}.ability`);
  assertBoolean(value.is_hidden, `${path}.is_hidden`);
  assertInteger(value.slot, `${path}.slot`);
}

function assertHistoricalAbility(value: unknown, path: string): void {
  assertRecord(value, path);
  if (value.ability !== null) {
    assertNamedResource(value.ability, `${path}.ability`);
  }
  assertBoolean(value.is_hidden, `${path}.is_hidden`);
  assertInteger(value.slot, `${path}.slot`);
}

function assertGameIndex(value: unknown, path: string): void {
  assertRecord(value, path);
  assertInteger(value.game_index, `${path}.game_index`);
  assertNamedResource(value.version, `${path}.version`);
}

function assertHeldItemVersion(value: unknown, path: string): void {
  assertRecord(value, path);
  assertInteger(value.rarity, `${path}.rarity`);
  assertNamedResource(value.version, `${path}.version`);
}

function assertHeldItem(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNamedResource(value.item, `${path}.item`);
  assertArray(
    value.version_details,
    `${path}.version_details`,
    assertHeldItemVersion,
  );
}

function assertMoveVersion(value: unknown, path: string): void {
  assertRecord(value, path);
  assertInteger(value.level_learned_at, `${path}.level_learned_at`);
  assertNamedResource(value.move_learn_method, `${path}.move_learn_method`);
  assertNullableInteger(value.order, `${path}.order`);
  assertNamedResource(value.version_group, `${path}.version_group`);
}

function assertMove(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNamedResource(value.move, `${path}.move`);
  assertArray(
    value.version_group_details,
    `${path}.version_group_details`,
    assertMoveVersion,
  );
}

function assertStat(value: unknown, path: string): void {
  assertRecord(value, path);
  assertInteger(value.base_stat, `${path}.base_stat`);
  assertInteger(value.effort, `${path}.effort`);
  assertNamedResource(value.stat, `${path}.stat`);
}

function assertType(value: unknown, path: string): void {
  assertRecord(value, path);
  assertInteger(value.slot, `${path}.slot`);
  assertNamedResource(value.type, `${path}.type`);
}

function assertTypePast(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNamedResource(value.generation, `${path}.generation`);
  assertArray(value.types, `${path}.types`, assertType);
}

function assertAbilityPast(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNamedResource(value.generation, `${path}.generation`);
  assertArray(value.abilities, `${path}.abilities`, assertHistoricalAbility);
}

function assertStatPast(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNamedResource(value.generation, `${path}.generation`);
  assertArray(value.stats, `${path}.stats`, assertStat);
}

function assertSprites(value: unknown, path: string): void {
  assertRecord(value, path);
  const coreKeys = [
    'back_default',
    'back_female',
    'back_shiny',
    'back_shiny_female',
    'front_default',
    'front_female',
    'front_shiny',
    'front_shiny_female',
  ] as const;
  coreKeys.forEach(key => assertNullableString(value[key], `${path}.${key}`));

  assertRecord(value.other, `${path}.other`);
  const artwork = value.other['official-artwork'];
  assertRecord(artwork, `${path}.other.official-artwork`);
  assertNullableString(
    artwork.front_default,
    `${path}.other.official-artwork.front_default`,
  );
  assertNullableString(
    artwork.front_shiny,
    `${path}.other.official-artwork.front_shiny`,
  );
}

function assertCries(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNullableString(value.latest, `${path}.latest`);
  assertNullableString(value.legacy, `${path}.legacy`);
}

export function assertPokemonListDto(
  value: unknown,
): asserts value is PokemonListDto {
  assertRecord(value, 'response');
  assertInteger(value.count, 'response.count');
  assertNullableString(value.next, 'response.next');
  assertNullableString(value.previous, 'response.previous');
  assertArray(value.results, 'response.results', assertNamedResource);
}

export function assertPokemonDetailDto(
  value: unknown,
): asserts value is PokemonDetailDto {
  assertRecord(value, 'response');
  assertInteger(value.id, 'response.id');
  assertString(value.name, 'response.name');
  assertNullableInteger(value.base_experience, 'response.base_experience');
  assertInteger(value.height, 'response.height');
  assertBoolean(value.is_default, 'response.is_default');
  assertInteger(value.order, 'response.order');
  assertInteger(value.weight, 'response.weight');
  assertArray(value.abilities, 'response.abilities', assertAbility);
  assertArray(value.forms, 'response.forms', assertNamedResource);
  assertArray(value.game_indices, 'response.game_indices', assertGameIndex);
  assertArray(value.held_items, 'response.held_items', assertHeldItem);
  assertString(
    value.location_area_encounters,
    'response.location_area_encounters',
  );
  assertArray(value.moves, 'response.moves', assertMove);
  assertArray(value.past_types, 'response.past_types', assertTypePast);
  assertArray(
    value.past_abilities,
    'response.past_abilities',
    assertAbilityPast,
  );
  assertArray(value.past_stats, 'response.past_stats', assertStatPast);
  assertSprites(value.sprites, 'response.sprites');
  assertCries(value.cries, 'response.cries');
  assertNamedResource(value.species, 'response.species');
  assertArray(value.stats, 'response.stats', assertStat);
  assertArray(value.types, 'response.types', assertType);
}
