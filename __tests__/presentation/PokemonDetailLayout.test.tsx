jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
} from 'react-native';
import { usePokemonDetailLayout } from '../../src/presentation/hooks/usePokemonDetailLayout';
import { PokemonProfile } from '../../src/presentation/components/PokemonProfile';
import { mapPokemonDetailDto } from '../../src/data/mappers/PokemonMapper';
import { pokemonDetailFixture } from '../data/fixtures';

import { PokemonDetailScreen } from '../../src/presentation/screens/PokemonDetailScreen';
import { PokemonDetailProvider } from '../../src/presentation/context/PokemonDetailContext';

const pokemon = mapPokemonDetailDto(pokemonDetailFixture);
function ResponsiveProfile() {
  const horizontal = usePokemonDetailLayout();
  return (
    <PokemonProfile
      pokemon={pokemon}
      isStale
      horizontal={horizontal}
      feedback={<Text>Refresh failed</Text>}
      refreshControl={
        <RefreshControl refreshing={false} onRefresh={jest.fn()} />
      }
    />
  );
}

const originalOS = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
const originalPad = Object.getOwnPropertyDescriptor(Platform, 'isPad');
const originalWindow = Dimensions.get('window');
const originalScreen = Dimensions.get('screen');
function resize(width: number, height: number, tablet = true) {
  Dimensions.set({
    window: { width, height, scale: 1, fontScale: 1 },
    screen: {
      width: tablet ? 1200 : 400,
      height: tablet ? 800 : 800,
      scale: 1,
      fontScale: 1,
    },
  });
}

describe('responsive Pokémon detail', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  afterEach(async () => {
    if (renderer) await act(async () => renderer.unmount());
    Object.defineProperty(Platform, 'OS', originalOS);
    if (originalPad) Object.defineProperty(Platform, 'isPad', originalPad);
    else Reflect.deleteProperty(Platform, 'isPad');
    Dimensions.set({ window: originalWindow, screen: originalScreen });
  });

  it.each([
    ['ios', true, 1024, 768, true, true],
    ['ios', true, 768, 1024, true, false],
    ['ios', true, 400, 300, true, true],
    ['ios', true, 500, 500, true, false],
    ['ios', false, 800, 400, false, false],
    ['android', false, 1200, 800, true, true],
    ['android', false, 800, 1200, true, false],
    ['android', false, 400, 300, true, true],
    ['android', false, 500, 500, true, false],
    ['android', false, 800, 400, false, false],
  ] as const)(
    'handles %s pad=%s window=%sx%s tablet=%s',
    async (os, pad, width, height, tablet, horizontal) => {
      Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
      Object.defineProperty(Platform, 'isPad', {
        configurable: true,
        value: pad,
      });
      resize(width, height, tablet);
      await act(async () => {
        renderer = ReactTestRenderer.create(<ResponsiveProfile />);
      });
      const panels = renderer.root.findAllByType(ScrollView);
      expect(panels.map(panel => panel.props.scrollEnabled)).toEqual([
        horizontal,
        horizontal,
      ]);
      expect(panels[0].findAllByType(Image)).toHaveLength(1);
      expect(panels[1].findAllByType(Image)).toHaveLength(0);
      expect(
        panels[1].findAllByType(Text).map(node => node.props.children),
      ).toContain('Types');
      expect(Boolean(panels[1].props.refreshControl)).toBe(horizontal);
    },
  );

  it('resizes without refetching and refreshes from the right panel', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    resize(1200, 800);
    const execute = jest
      .fn()
      .mockResolvedValue({
        data: pokemon,
        source: 'remote',
        isStale: false,
        cachedAt: 1,
      });
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PokemonDetailProvider useCase={{ execute }}>
          <PokemonDetailScreen
            route={{ params: { pokemonId: 1 } } as never}
            navigation={{} as never}
          />
        </PokemonDetailProvider>,
      );
    });
    await act(async () => resize(800, 1200));
    await act(async () => resize(400, 300));
    expect(execute).toHaveBeenCalledTimes(1);
    const scrolls = renderer.root.findAllByType(ScrollView);
    expect(scrolls[0].props.scrollEnabled).toBe(false);
    expect(scrolls[0].props.refreshControl).toBeUndefined();
    await act(async () => scrolls[2].props.refreshControl.props.onRefresh());
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('preserves loaded artwork through rotation and small window resizing', async () => {
    Object.defineProperty(Platform, 'OS', {
      configurable: true,
      value: 'android',
    });
    resize(1200, 800);
    await act(async () => {
      renderer = ReactTestRenderer.create(<ResponsiveProfile />);
    });
    await act(async () => renderer.root.findByType(Image).props.onLoad());
    const imageKey = renderer.root.findByType(Image).props.source.uri;
    for (const [width, height] of [
      [800, 1200],
      [400, 300],
      [500, 500],
      [1200, 800],
    ]) {
      await act(async () => resize(width, height));
      expect(renderer.root.findByType(Image).props.source.uri).toBe(imageKey);
      expect(
        renderer.root.findAllByProps({ testID: 'pokemon-artwork-loading' }),
      ).toHaveLength(0);
    }
  });
});
