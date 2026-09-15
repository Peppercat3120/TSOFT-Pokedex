import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Image, Text } from 'react-native';
import { PokemonProfile } from '../../src/presentation/components/PokemonProfile';
import { PokemonArtwork } from '../../src/presentation/components/PokemonArtwork';
import { mapPokemonDetailDto } from '../../src/data/mappers/PokemonMapper';
import type { PokemonDetail } from '../../src/domain/entities/Pokemon';
import { pokemonDetailFixture } from '../data/fixtures';

const pokemon = mapPokemonDetailDto(pokemonDetailFixture);

describe('PokemonProfile', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  async function mount(data: PokemonDetail = pokemon, isStale = false) {
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PokemonProfile pokemon={data} isStale={isStale} />,
      );
    });
  }
  afterEach(async () => {
    await act(async () => renderer.unmount());
  });
  function texts() {
    return renderer.root.findAllByType(Text).map(node => node.props.children);
  }

  it('shows ordered sections, converted units, identity, and accessibility headings', async () => {
    await mount({ ...pokemon, name: 'mr-mime' });
    expect(texts()).toContain('Mr Mime');
    expect(texts()).toContain('0.7 m');
    expect(texts()).toContain('6.9 kg');
    expect(texts()).toContain('64');
    expect(
      renderer.root
        .findAllByType(Text)
        .filter(node => node.props.accessibilityRole === 'header')
        .map(node => node.props.children),
    ).toEqual(['Mr Mime', 'Types', 'Attributes', 'Abilities', 'Statistics']);
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Height: 0.7 m' }),
    ).not.toHaveLength(0);
  });

  it.each([null, 0])(
    'preserves null/zero base experience %s and zero physical values',
    async baseExperience => {
      await mount({
        ...pokemon,
        baseExperience,
        heightDecimetres: 0,
        weightHectograms: 0,
      });
      expect(texts()).toContain(
        baseExperience === null ? 'Not available' : '0',
      );
      expect(texts()).toContain('0.0 m');
      expect(texts()).toContain('0.0 kg');
    },
  );

  it('sorts types and abilities by slot and annotates hidden abilities', async () => {
    await mount({
      ...pokemon,
      types: [
        { slot: 2, type: { id: 4, name: 'poison' } },
        { slot: 1, type: { id: 12, name: 'grass' } },
      ],
      abilities: [
        { slot: 3, ability: { id: 2, name: 'chlorophyll' }, isHidden: true },
        { ...pokemon.abilities[0], slot: 1 },
      ],
    });
    expect(texts().indexOf('Grass')).toBeLessThan(texts().indexOf('Poison'));
    const abilities = texts().filter(value => Array.isArray(value));
    expect(abilities).toContainEqual(['Overgrow', '']);
    expect(abilities).toContainEqual(['Chlorophyll', ' (Hidden)']);
    expect(pokemon.abilities[0].slot).toBe(1);
  });

  it('orders statistics, appends unknown ones, and totals exact values', async () => {
    const names = [
      'speed',
      'special-defense',
      'defense',
      'hp',
      'special-attack',
      'attack',
      'extra-stat',
    ];
    await mount({
      ...pokemon,
      stats: names.map((name, i) => ({
        stat: { id: i + 1, name },
        baseStat: i,
      })),
    });
    const labels = texts().filter(value =>
      [
        'HP',
        'Attack',
        'Defense',
        'Special Attack',
        'Special Defense',
        'Speed',
        'Extra Stat',
        'Total',
      ].includes(value),
    );
    expect(labels).toEqual([
      'HP',
      'Attack',
      'Defense',
      'Special Attack',
      'Special Defense',
      'Speed',
      'Extra Stat',
      'Total',
    ]);
    expect(texts()).toContain('21');
  });

  it('shows section-specific empty feedback and only warns on stale cache', async () => {
    await mount({ ...pokemon, types: [], abilities: [], stats: [] });
    expect(texts().filter(value => value === 'Not available')).toHaveLength(3);
    expect(texts()).not.toContain('Total');
    expect(texts()).not.toContain(
      'Showing saved data; updates are unavailable.',
    );
    await act(async () =>
      renderer.update(<PokemonProfile pokemon={pokemon} isStale />),
    );
    expect(texts()).toContain('Showing saved data; updates are unavailable.');
  });
});

describe('PokemonArtwork', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  async function mount(artworkUrl: string | null, spriteUrl: string | null) {
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PokemonArtwork artworkUrl={artworkUrl} spriteUrl={spriteUrl} />,
      );
    });
  }
  afterEach(async () => {
    await act(async () => renderer.unmount());
  });
  it('loads artwork, falls back after failure, and handles a late callback safely', async () => {
    await mount('art.png', 'sprite.png');
    const first = renderer.root.findByType(Image).props;
    expect(first.source.uri).toBe('art.png');
    expect(first.accessible).toBe(false);
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-artwork-loading' }),
    ).not.toHaveLength(0);
    await act(async () => first.onError());
    expect(renderer.root.findByType(Image).props.source.uri).toBe('sprite.png');
    await act(async () => first.onLoad());
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-artwork-loading' }),
    ).not.toHaveLength(0);
    await act(async () => renderer.root.findByType(Image).props.onLoad());
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-artwork-loading' }),
    ).toHaveLength(0);
    await act(async () => renderer.root.findByType(Image).props.onError());
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(renderer.root.findByType(Text).props.children).toBe(
      'Image unavailable',
    );
  });
  it('uses the sprite immediately when artwork is null', async () => {
    await mount(null, 'sprite.png');
    expect(renderer.root.findByType(Image).props.source.uri).toBe('sprite.png');
  });
  it.each([
    [null, null],
    ['same.png', 'same.png'],
  ] as const)(
    'handles absent or identical URLs: %s %s',
    async (artworkUrl, spriteUrl) => {
      await mount(artworkUrl, spriteUrl);
      if (artworkUrl !== null) {
        await act(async () => renderer.root.findByType(Image).props.onError());
      }
      expect(renderer.root.findAllByType(Image)).toHaveLength(0);
      expect(renderer.root.findByType(Text).props.children).toBe(
        'Image unavailable',
      );
    },
  );
});
