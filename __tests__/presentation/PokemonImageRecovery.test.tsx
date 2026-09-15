import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Image } from 'react-native';
import { PokemonArtwork } from '../../src/presentation/components/PokemonArtwork';
import { useImageRecovery } from '../../src/presentation/hooks/useImageRecovery';
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
      expect.stringContaining(JSON.stringify([pokemon.imageUrl])),
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
  it('tracks duplicate URLs by instance and keeps failures pending during retry', async () => {
    let recovery!: ReturnType<typeof useImageRecovery>;
    function Harness({ first = true, url = 'shared' }) {
      recovery = useImageRecovery();
      const row = (id: number) => (
        <PokemonRow
          key={id}
          pokemon={{ id, name: 'pokemon', imageUrl: url }}
          onSelect={() => {}}
          imageRetryGeneration={recovery.imageRetryGeneration}
          reportImageFailure={recovery.reportImageFailure}
        />
      );
      return (
        <>
          {first && row(1)}
          {row(2)}
        </>
      );
    }
    await act(async () => {
      renderer = Renderer.create(<Harness />);
    });
    const images = renderer.root.findAllByType(Image);
    await act(async () => {
      images[0].props.onError();
      images[1].props.onError();
    });
    expect(recovery.pending).toBe(true);
    await act(async () => renderer.update(<Harness first={false} />));
    expect(recovery.pending).toBe(true);
    await act(async () => recovery.retryImages());
    expect(renderer.root.findAllByType(Image)).toHaveLength(1);
    expect(recovery.pending).toBe(true);
    await act(async () => renderer.root.findByType(Image).props.onLoad());
    expect(recovery.pending).toBe(false);
    await act(async () =>
      renderer.update(<Harness first={false} url="replacement" />),
    );
    await act(async () => renderer.root.findByType(Image).props.onError());
    expect(recovery.pending).toBe(true);
    await act(async () => renderer.update(<Harness first={false} url="new" />));
    expect(recovery.pending).toBe(false);
  });
});
