import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import { PokemonArtwork } from '../../src/presentation/components/PokemonArtwork';
import { PokemonRow } from '../../src/presentation/components/PokemonRow';

describe('image recovery', () => {
  let renderer: Renderer.ReactTestRenderer;
  afterEach(async () => {
    await act(async () => renderer?.unmount());
  });
  it('retries a failed memoized row with the same URL and ignores obsolete callbacks', async () => {
    const report = jest.fn();
    const select = jest.fn();
    const pokemon = {
      id: 1,
      name: 'bulbasaur',
      imageUrl: 'https://example.com/1.png',
    };
    const row = (generation: number) => (
      <PokemonRow
        pokemon={pokemon}
        onSelect={select}
        imageRetryGeneration={generation}
        reportImageFailure={report}
      />
    );
    await act(async () => {
      renderer = Renderer.create(row(0));
    });
    const old = renderer.root.findByType(Image).props;
    await act(async () => old.onError());
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    await act(async () => renderer.update(row(1)));
    expect(renderer.root.findByType(Image).props.source.uri).toBe(
      pokemon.imageUrl,
    );
    await act(async () => old.onError());
    expect(renderer.root.findAllByType(Image)).toHaveLength(1);
    await act(async () => renderer.root.findByType(Image).props.onLoad());
    expect(report).toHaveBeenLastCalledWith(
      JSON.stringify([pokemon.imageUrl]),
      false,
    );
  });
  it('resets exhausted artwork, preserves successful images, and resets changed URLs', async () => {
    const artwork = (generation: number, url = 'art') => (
      <PokemonArtwork
        artworkUrl={url}
        spriteUrl="sprite"
        imageRetryGeneration={generation}
      />
    );
    await act(async () => {
      renderer = Renderer.create(artwork(0));
    });
    await act(async () => renderer.root.findByType(Image).props.onError());
    expect(renderer.root.findByType(Image).props.source.uri).toBe('sprite');
    await act(async () => renderer.root.findByType(Image).props.onError());
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    await act(async () => renderer.update(artwork(1)));
    expect(renderer.root.findByType(Image).props.source.uri).toBe('art');
    await act(async () => renderer.root.findByType(Image).props.onLoad());
    const onLoad = renderer.root.findByType(Image).props.onLoad;
    await act(async () => renderer.update(artwork(2)));
    expect(renderer.root.findByType(Image).props.onLoad).not.toBeUndefined();
    await act(async () => renderer.update(artwork(2, 'changed')));
    await act(async () => onLoad());
    expect(renderer.root.findByType(Image).props.source.uri).toBe('changed');
  });
});
