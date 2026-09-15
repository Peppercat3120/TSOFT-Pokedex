jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
}));
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { FlatList, RefreshControl } from 'react-native';
import { PokemonListProvider } from '../../src/presentation/context/PokemonListContext';
import { PokemonDetailProvider } from '../../src/presentation/context/PokemonDetailContext';
import { PokemonListScreen } from '../../src/presentation/screens/PokemonListScreen';
import { PokemonDetailScreen } from '../../src/presentation/screens/PokemonDetailScreen';
import {
  mapPokemonListDto,
  mapPokemonDetailDto,
} from '../../src/data/mappers/PokemonMapper';
import { firstPageFixture, pokemonDetailFixture } from '../data/fixtures';

describe('Retry updates screen actions', () => {
  let renderer: Renderer.ReactTestRenderer;
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    await act(async () => renderer?.unmount());
    jest.useRealTimers();
  });
  it.each(['list', 'detail'])(
    'retries exhausted %s images without requesting fresh JSON',
    async screen => {
      const executePage = jest
        .fn()
        .mockResolvedValue({
          data: mapPokemonListDto(firstPageFixture),
          source: 'remote',
          isStale: false,
          cachedAt: 1,
        });
      const executeDetail = jest
        .fn()
        .mockResolvedValue({
          data: mapPokemonDetailDto(pokemonDetailFixture),
          source: 'remote',
          isStale: false,
          cachedAt: 1,
        });
      await act(async () => {
        renderer = Renderer.create(
          screen === 'list' ? (
            <PokemonListProvider useCase={{ execute: executePage }}>
              <PokemonListScreen
                navigation={{ navigate: jest.fn() } as never}
                route={{} as never}
              />
            </PokemonListProvider>
          ) : (
            <PokemonDetailProvider useCase={{ execute: executeDetail }}>
              <PokemonDetailScreen
                navigation={{ goBack: jest.fn() } as never}
                route={{ params: { pokemonId: 1 } } as never}
              />
            </PokemonDetailProvider>
          ),
        );
      });
      const imageId =
        screen === 'list' ? 'pokemon-image-1' : 'pokemon-detail-artwork';
      async function failAttempt() {
        await act(async () =>
          renderer.root.findByProps({ testID: imageId }).props.onError(),
        );
        if (screen === 'detail') {
          await act(async () =>
            renderer.root.findByProps({ testID: imageId }).props.onError(),
          );
        }
      }
      await failAttempt();
      for (const delay of [2000, 4000, 8000, 16000, 30000]) {
        await act(async () => {
          jest.advanceTimersByTime(delay);
        });
        await failAttempt();
      }
      const button = renderer.root
        .findAllByProps({ accessibilityLabel: 'Retry updates' })
        .find(node => typeof node.props.onPress === 'function')!;
      await act(async () => {
        await button.props.onPress();
      });
      const execute = screen === 'list' ? executePage : executeDetail;
      expect(execute).toHaveBeenCalledTimes(1);
      expect(
        renderer.root.findByProps({ testID: imageId }).props.source.uri,
      ).toBeTruthy();
      await act(async () =>
        renderer.root.findByProps({ testID: imageId }).props.onLoad(),
      );
      await act(async () => {
        if (screen === 'list') {
          await renderer.root.findByType(FlatList).props.onRefresh();
        } else {
          await renderer.root
            .findAllByType(RefreshControl)[0]
            .props.onRefresh();
        }
      });
      expect(execute).toHaveBeenCalledTimes(2);
    },
  );
});
