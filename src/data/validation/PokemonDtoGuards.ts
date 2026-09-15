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

function assertStat(value: unknown, path: string): void {
  assertRecord(value, path);
  assertInteger(value.base_stat, `${path}.base_stat`);
  assertNamedResource(value.stat, `${path}.stat`);
}

function assertType(value: unknown, path: string): void {
  assertRecord(value, path);
  assertInteger(value.slot, `${path}.slot`);
  assertNamedResource(value.type, `${path}.type`);
}

function assertSprites(value: unknown, path: string): void {
  assertRecord(value, path);
  assertNullableString(value.front_default, `${path}.front_default`);

  assertRecord(value.other, `${path}.other`);
  const artwork = value.other['official-artwork'];
  assertRecord(artwork, `${path}.other.official-artwork`);
  assertNullableString(
    artwork.front_default,
    `${path}.other.official-artwork.front_default`,
  );
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
  assertInteger(value.weight, 'response.weight');
  assertArray(value.abilities, 'response.abilities', assertAbility);
  assertSprites(value.sprites, 'response.sprites');
  assertArray(value.stats, 'response.stats', assertStat);
  assertArray(value.types, 'response.types', assertType);
}
