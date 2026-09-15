import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, FlatList, Text } from 'react-native';
import { PokemonListProvider } from '../../src/presentation/context/PokemonListContext';
import type { PokemonPageUseCase } from '../../src/presentation/context/PokemonListContext';
import { PokemonDetailProvider } from '../../src/presentation/context/PokemonDetailContext';
import type { PokemonDetailUseCase } from '../../src/presentation/context/PokemonDetailContext';
import { PokemonListScreen } from '../../src/presentation/screens/PokemonListScreen';
import { PokemonDetailScreen } from '../../src/presentation/screens/PokemonDetailScreen';
import { mapPokemonListDto, mapPokemonDetailDto } from '../../src/data/mappers/PokemonMapper';
import { firstPageFixture, secondPageFixture, pokemonDetailFixture } from '../data/fixtures';

const page = (dto = firstPageFixture) => ({
  data: mapPokemonListDto(dto),
  source: 'remote' as const,
  isStale: false,
  cachedAt: 1,
});

describe('Pokémon loading skeletons', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  let executePage: jest.MockedFunction<PokemonPageUseCase['execute']>;
  let executeDetail: jest.MockedFunction<PokemonDetailUseCase['execute']>;

  afterEach(async () => {
    if (renderer) {
      await act(async () => renderer.unmount());
    }
  });

  it('replaces initial list loading with six skeleton rows until data resolves', async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    executePage = jest.fn(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PokemonListProvider useCase={{ execute: executePage }}>
          <PokemonListScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
        </PokemonListProvider>,
      );
    });
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-list-loading-skeleton' }),
    ).not.toHaveLength(0);
    for (let index = 1; index <= 6; index += 1) {
      expect(
        renderer.root.findAllByProps({
          testID: `pokemon-list-loading-row-${index}`,
        }),
      ).not.toHaveLength(0);
    }
    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(
      renderer.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Loading Pokémon…'),
    ).toBe(true);
    await act(async () => resolve(page()));
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-list-loading-skeleton' }),
    ).toHaveLength(0);
    expect(renderer.root.findByType(FlatList).props.data).toHaveLength(20);
  });

  it('shows footer skeletons while retaining loaded list rows during pagination', async () => {
    executePage = jest.fn().mockResolvedValueOnce(page());
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PokemonListProvider useCase={{ execute: executePage }}>
          <PokemonListScreen navigation={{ navigate: jest.fn() } as never} route={{} as never} />
        </PokemonListProvider>,
      );
    });
    let resolve!: (value: ReturnType<typeof page>) => void;
    executePage.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        }),
    );
    const list = () => renderer.root.findByType(FlatList);
    await act(async () => {
      list().props.onScrollBeginDrag();
      list().props.onEndReached();
    });
    expect(list().props.data).toHaveLength(20);
    expect(
      renderer.root.findAllByProps({
        testID: 'pokemon-list-footer-loading-skeleton',
      }),
    ).not.toHaveLength(0);
    await act(async () => resolve(page(secondPageFixture)));
    expect(
      renderer.root.findAllByProps({
        testID: 'pokemon-list-footer-loading-skeleton',
      }),
    ).toHaveLength(0);
    expect(list().props.data).toHaveLength(40);
  });

  it('replaces detail loading with a profile skeleton until the Pokémon resolves', async () => {
    let resolve!: (value: Awaited<ReturnType<PokemonDetailUseCase['execute']>>) => void;
    executeDetail = jest.fn(
      (_id: number) =>
        new Promise(done => {
          resolve = done;
        }),
    );
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PokemonDetailProvider useCase={{ execute: executeDetail }}>
          <PokemonDetailScreen
            navigation={{ canGoBack: () => true, goBack: jest.fn(), replace: jest.fn() } as never}
            route={{ params: { pokemonId: 1 } } as never}
          />
        </PokemonDetailProvider>,
      );
    });
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-detail-loading-skeleton' }),
    ).not.toHaveLength(0);
    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(0);
    await act(async () =>
      resolve({
        data: mapPokemonDetailDto(pokemonDetailFixture),
        source: 'remote',
        isStale: false,
        cachedAt: 1,
      }),
    );
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-detail-loading-skeleton' }),
    ).toHaveLength(0);
    expect(
      renderer.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Attributes'),
    ).toBe(true);
  });
});
