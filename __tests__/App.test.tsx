import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ActivityIndicator, FlatList, Image, Text } from 'react-native';
import App from '../App';
import { mapPokemonListDto } from '../src/data/mappers/PokemonMapper';
import type { PokemonPageUseCase } from '../src/presentation/context/PokemonListContext';
import { firstPageFixture, secondPageFixture } from './data/fixtures';
import { NetworkError } from '../src/domain/errors/PokemonErrors';
import { NotFoundError } from '../src/domain/errors/PokemonErrors';
import { mapPokemonDetailDto } from '../src/data/mappers/PokemonMapper';
import { pokemonDetailFixture } from './data/fixtures';
import type { PokemonDetailUseCase } from '../src/presentation/context/PokemonDetailContext';

function page(dto = firstPageFixture) {
  return {
    data: mapPokemonListDto(dto),
    source: 'remote' as const,
    isStale: false,
    cachedAt: 1,
  };
}

describe('Pokémon list application', () => {
  let renderer: ReactTestRenderer.ReactTestRenderer;
  let execute: jest.MockedFunction<PokemonPageUseCase['execute']>;
  let executeDetail: jest.MockedFunction<PokemonDetailUseCase['execute']>;
  async function mount() {
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <App
          pokemonPageUseCase={{ execute }}
          pokemonDetailUseCase={{ execute: executeDetail }}
        />,
      );
    });
  }
  beforeEach(() => {
    execute = jest.fn().mockResolvedValue(page());
    executeDetail = jest.fn(async id => ({
      data: { ...mapPokemonDetailDto(pokemonDetailFixture), id },
      source: 'remote' as const,
      isStale: false,
      cachedAt: 1,
    }));
  });
  afterEach(async () => {
    await act(async () => renderer.unmount());
  });

  function pressButton(label: string) {
    renderer.root
      .findAllByProps({ accessibilityLabel: label })[0]
      .props.onPress();
  }

  function hasText(value: string) {
    return renderer.root
      .findAllByType(Text)
      .some(node => node.props.children === value);
  }

  it('does not arm another request during an in-flight append', async () => {
    await mount();
    let resolve!: (value: ReturnType<typeof page>) => void;
    execute.mockImplementationOnce(
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
    await act(async () => {
      list().props.onScrollBeginDrag();
      list().props.onEndReached();
    });
    await act(async () => resolve(page(secondPageFixture)));
    await act(async () => list().props.onEndReached());
    expect(execute).toHaveBeenCalledTimes(2);
    expect(list().props.data).toHaveLength(40);
  });

  it('shows an initial network error with retry', async () => {
    execute.mockRejectedValueOnce(new NetworkError('offline'));
    await mount();
    expect(
      hasText('We couldn’t connect to PokéAPI. Check your connection and try again.'),
    ).toBe(true);
    await act(async () => pressButton('Try again'));
    expect(renderer.root.findByType(FlatList).props.data).toHaveLength(20);
  });

  it('shows empty results and allows retry', async () => {
    execute.mockResolvedValueOnce({
      ...page(),
      data: { ...page().data, items: [], nextPage: null },
    });
    await mount();
    expect(hasText('No Pokémon found.')).toBe(true);
    await act(async () => pressButton('Try again'));
    expect(renderer.root.findByType(FlatList).props.data).toHaveLength(20);
  });

  it('shows stale feedback and an end marker', async () => {
    execute.mockResolvedValueOnce({
      ...page(),
      isStale: true,
      data: { ...page().data, nextPage: null },
    });
    await mount();
    expect(hasText('Showing saved data; updates are unavailable.')).toBe(true);
    expect(hasText('You’ve reached the end.')).toBe(true);
  });

  it('keeps loaded rows on next-page failure and retries through the footer', async () => {
    await mount();
    execute.mockRejectedValueOnce(new NetworkError('offline'));
    const list = () => renderer.root.findByType(FlatList);
    await act(async () => {
      list().props.onScrollBeginDrag();
      list().props.onEndReached();
    });
    expect(list().props.data).toHaveLength(20);
    expect(hasText('Retry loading more')).toBe(true);
    await act(async () => {
      list().props.onScrollBeginDrag();
      list().props.onEndReached();
    });
    expect(execute).toHaveBeenCalledTimes(2);
    execute.mockResolvedValueOnce(page(secondPageFixture));
    await act(async () => pressButton('Retry loading more'));
    expect(list().props.data).toHaveLength(40);
    expect(hasText('Retry loading more')).toBe(false);
  });

  it('removes the individual image spinner after image load', async () => {
    await mount();
    const row = renderer.root.findAllByProps({ testID: 'pokemon-row-1' })[0];
    expect(row.findAllByType(ActivityIndicator)).toHaveLength(1);
    await act(async () => row.findByType(Image).props.onLoad());
    expect(row.findAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('renders 20 rows and loads another page only after a new user drag', async () => {
    execute
      .mockResolvedValueOnce(page())
      .mockResolvedValueOnce(page(secondPageFixture));
    await mount();
    const list = () => renderer.root.findByType(FlatList);
    expect(list().props.data).toHaveLength(20);
    await act(async () => list().props.onEndReached());
    expect(execute).toHaveBeenCalledTimes(1);
    await act(async () => {
      list().props.onScrollBeginDrag();
      list().props.onEndReached();
      list().props.onEndReached();
    });
    expect(list().props.data).toHaveLength(40);
    await act(async () => list().props.onEndReached());
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2])('navigates with selected Pokémon ID %i', async id => {
    await mount();
    await act(async () =>
      renderer.root
        .findAllByProps({ testID: `pokemon-row-${id}` })[0]
        .props.onPress(),
    );
    const identifier = renderer.root.findAllByProps({
      testID: 'pokemon-detail-id',
    })[0];
    expect(identifier.props.children).toEqual([
      '#',
      String(id).padStart(3, '0'),
    ]);
    expect(executeDetail).toHaveBeenCalledWith(id);
  });

  it('returns to the mounted paginated list after a not-found detail', async () => {
    await mount();
    execute.mockResolvedValueOnce(page(secondPageFixture));
    const list = () => renderer.root.findByType(FlatList);
    await act(async () => {
      list().props.onScrollBeginDrag();
      list().props.onEndReached();
    });
    executeDetail.mockRejectedValueOnce(new NotFoundError());
    await act(async () =>
      renderer.root
        .findAllByProps({ testID: 'pokemon-row-1' })[0]
        .props.onPress(),
    );
    expect(hasText('This Pokémon couldn’t be found.')).toBe(true);
    await act(async () => pressButton('Back to list'));
    expect(list().props.data).toHaveLength(40);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('retries a detail network failure without reloading the list', async () => {
    await mount();
    executeDetail.mockRejectedValueOnce(new NetworkError('offline'));
    await act(async () =>
      renderer.root
        .findAllByProps({ testID: 'pokemon-row-1' })[0]
        .props.onPress(),
    );
    expect(
      hasText('We couldn’t connect to PokéAPI. Check your connection and try again.'),
    ).toBe(true);
    await act(async () => pressButton('Try again'));
    expect(hasText('Attributes')).toBe(true);
    expect(executeDetail).toHaveBeenCalledTimes(2);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('shows image loading and failure without disabling the row', async () => {
    await mount();
    const image = renderer.root
      .findAllByType(Image)
      .find(node => node.props.testID === 'pokemon-image-1')!;
    expect(image.props.source.uri).toContain('/pokemon/1.png');
    await act(async () => image.props.onError());
    expect(
      renderer.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Image unavailable'),
    ).toBe(true);
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-row-1' })[0].props
        .accessibilityLabel,
    ).toBe('Bulbasaur');
  });
});
