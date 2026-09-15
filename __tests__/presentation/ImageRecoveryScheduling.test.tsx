import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { ActivityIndicator, Image } from 'react-native';
import { PokemonRow } from '../../src/presentation/components/PokemonRow';
import { useAutomaticRecovery } from '../../src/presentation/hooks/useRecovery';

const DELAYS = [2000, 4000, 8000, 16000, 30000];
describe('mounted image recovery scheduling', () => {
  let renderer: Renderer.ReactTestRenderer;
  let recovery: ReturnType<typeof useAutomaticRecovery>;
  const recoverData = jest.fn(async () => 'attempted' as const);
  function Harness({ second = false }) {
    recovery = useAutomaticRecovery({
      dataPending: false,
      focused: true,
      onRecover: recoverData,
    });
    const row = (id: number) => (
      <PokemonRow
        key={id}
        pokemon={{ id, name: 'pokemon', imageUrl: `image-${id}` }}
        onSelect={() => {}}
        imageRetryGeneration={recovery.imageRetryGeneration}
        reportImageFailure={recovery.reportImageFailure}
      />
    );
    return (
      <>
        {row(1)}
        {second && row(2)}
      </>
    );
  }
  beforeEach(() => {
    jest.useFakeTimers();
    recoverData.mockClear();
  });
  afterEach(async () => {
    await act(async () => renderer?.unmount());
    jest.useRealTimers();
  });
  const image = (id = 1) =>
    renderer.root.findByProps({ testID: `pokemon-image-${id}` });
  async function mount(second = false) {
    await act(async () => {
      renderer = Renderer.create(<Harness second={second} />);
    });
  }
  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }
  async function fail(id = 1) {
    await act(async () => image(id).props.onError());
  }

  it('waits for a slow retry without consuming the remaining budget', async () => {
    await mount();
    await fail();
    await advance(2000);
    const active = image().props;
    for (const delay of [4000, 8000, 16000, 30000, 30000]) {
      await advance(delay);
    }
    expect(recovery.imageRetryGeneration).toBe(1);
    expect(recovery.recoveryExhausted).toBe(false);
    expect(renderer.root.findAllByType(Image)).toHaveLength(1);
    await act(async () => active.onError());
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(recovery.imageRetryGeneration).toBe(1);
    await advance(3999);
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    await advance(1);
    expect(recovery.imageRetryGeneration).toBe(2);
    expect(image().props.source.uri).toBe('image-1');
    expect(recoverData).not.toHaveBeenCalled();
  });

  it('consumes generations for loading images without replaying them on late failure', async () => {
    await mount(true);
    const secondLoad = image(2).props;
    await fail(1);
    await advance(2000);
    const firstRetry = image(1).props;
    await act(async () => secondLoad.onError());
    expect(
      renderer.root.findAllByProps({ testID: 'pokemon-image-2' }),
    ).toHaveLength(0);
    expect(recovery.imageRetryGeneration).toBe(1);
    await advance(4000);
    expect(recovery.imageRetryGeneration).toBe(2);
    expect(image(2).props.source.uri).toBe('image-2');
    await act(async () => firstRetry.onLoad());
    expect(renderer.root.findAllByType(ActivityIndicator)).toHaveLength(1);
    const generation = recovery.imageRetryGeneration;
    await advance(8000);
    expect(recovery.imageRetryGeneration).toBe(generation);
    // The original callback still belongs to the active first retry after metadata changes.
    await act(async () => image(2).props.onLoad());
    await advance(60000);
    expect(recovery.recoveryExhausted).toBe(false);
  });

  it('exhausts only after five real failed retry rounds', async () => {
    await mount();
    await fail();
    for (const [index, delay] of DELAYS.entries()) {
      await advance(delay);
      expect(recovery.imageRetryGeneration).toBe(index + 1);
      expect(image().props.source.uri).toBe('image-1');
      await fail();
    }
    expect(recovery.recoveryExhausted).toBe(true);
    await advance(60000);
    expect(recovery.imageRetryGeneration).toBe(5);
  });

  it('does not interrupt or queue manual requests behind an active load', async () => {
    await mount();
    await fail();
    await act(async () => {
      expect(recovery.retryImages()).toBe('attempted');
    });
    const load = image().props;
    await act(async () => {
      expect(recovery.retryImages()).toBe('busy');
    });
    expect(recovery.imageRetryGeneration).toBe(1);
    await act(async () => load.onError());
    expect(renderer.root.findAllByType(Image)).toHaveLength(0);
    expect(recovery.imageRetryGeneration).toBe(1);
    await advance(2000);
    expect(recovery.imageRetryGeneration).toBe(2);
  });
});
