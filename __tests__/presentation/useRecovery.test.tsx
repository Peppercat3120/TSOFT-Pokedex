import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState } from 'react-native';
import {
  useAutomaticRecovery,
  canRecoverAutomatically,
} from '../../src/presentation/hooks/useRecovery';
import {
  HttpError,
  InvalidPayloadError,
  NetworkError,
} from '../../src/domain/errors/PokemonErrors';

describe('bounded recovery', () => {
  let renderer: Renderer.ReactTestRenderer;
  let controller: ReturnType<typeof useAutomaticRecovery>;
  let listener: (state: 'active' | 'background') => void;
  const remove = jest.fn();
  let recover: jest.Mock;
  function Harness({ dataPending = true, focused = true }) {
    controller = useAutomaticRecovery({
      dataPending,
      focused,
      onRecover: recover,
    });
    return null;
  }
  beforeEach(() => {
    jest.useFakeTimers();
    recover = jest.fn().mockResolvedValue('attempted');
    jest
      .spyOn(AppState, 'addEventListener')
      .mockClear()
      .mockImplementation((_event, callback) => {
        listener = callback;
        return { remove };
      });
  });
  afterEach(async () => {
    await act(async () => renderer?.unmount());
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  async function mount() {
    await act(async () => {
      renderer = Renderer.create(<Harness />);
    });
    recover.mockClear();
  }
  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }
  it('stops after five rounds and restarts explicitly', async () => {
    await mount();
    for (const delay of [2000, 4000, 8000, 16000, 30000]) {
      await advance(delay);
    }
    expect(recover).toHaveBeenCalledTimes(5);
    expect(recover).toHaveBeenCalledWith();
    expect(controller.recoveryExhausted).toBe(true);
    await advance(60000);
    expect(recover).toHaveBeenCalledTimes(5);
    await act(async () => controller.restartRecovery());
    await advance(2000);
    expect(recover).toHaveBeenCalledTimes(6);
  });
  it('pauses in background and on blur, cleans up, and stops when resolved', async () => {
    await mount();
    await act(async () => listener('background'));
    await advance(60000);
    expect(recover).not.toHaveBeenCalled();
    await act(async () => listener('active'));
    expect(recover).toHaveBeenCalledTimes(1);
    await act(async () => renderer.update(<Harness focused={false} />));
    await advance(60000);
    expect(recover).toHaveBeenCalledTimes(1);
    await act(async () => renderer.update(<Harness dataPending={false} />));
    recover.mockClear();
    await advance(60000);
    expect(recover).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
    expect(remove).toHaveBeenCalled();
    await advance(60000);
    expect(recover).not.toHaveBeenCalled();
  });
  it('uses one lifecycle subscription and recovers immediately on refocus', async () => {
    await mount();
    await act(async () => controller.reportImageFailure('image', true));
    await act(async () => renderer.update(<Harness focused={false} />));
    await advance(60000);
    expect(recover).not.toHaveBeenCalled();
    expect(controller.imageRetryGeneration).toBe(0);
    await act(async () => renderer.update(<Harness />));
    expect(recover).toHaveBeenCalledTimes(1);
    expect(controller.imageRetryGeneration).toBe(1);
    expect(AppState.addEventListener).toHaveBeenCalledTimes(1);
    await advance(2000);
    expect(recover).toHaveBeenCalledTimes(2);
    expect(controller.imageRetryGeneration).toBe(2);
  });
  it('does not consume a round when the controller is busy', async () => {
    await mount();
    recover.mockResolvedValue('busy');
    for (let index = 0; index < 7; index++) {
      await advance(2000);
    }
    expect(controller.recoveryExhausted).toBe(false);
  });
  it('gives late image failures a full budget after data exhaustion', async () => {
    await mount();
    for (const delay of [2000, 4000, 8000, 16000, 30000]) {
      await advance(delay);
    }
    expect(recover).toHaveBeenCalledTimes(5);
    await act(async () => controller.reportImageFailure('image', true));
    for (const delay of [2000, 4000, 8000, 16000, 30000]) {
      await advance(delay);
    }
    expect(controller.imageRetryGeneration).toBe(5);
    expect(recover).toHaveBeenCalledTimes(5);
  });
  it('recovers images while a data attempt is still in flight', async () => {
    let finish!: (outcome: 'attempted') => void;
    recover.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await mount();
    await act(async () => controller.reportImageFailure('image', true));
    await advance(2000);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(controller.imageRetryGeneration).toBe(1);
    await advance(4000);
    expect(recover).toHaveBeenCalledTimes(1);
    expect(controller.imageRetryGeneration).toBe(2);
    await act(async () => finish('attempted'));
  });
  it('keeps separate mounted failures pending when one is disposed', async () => {
    await act(async () => {
      renderer = Renderer.create(<Harness dataPending={false} />);
    });
    await act(async () => {
      controller.reportImageFailure('first', true);
      controller.reportImageFailure('second', true);
      controller.reportImageFailure('first', false);
    });
    await advance(2000);
    expect(controller.imageRetryGeneration).toBe(1);
    await act(async () => controller.reportImageFailure('second', false));
    await advance(60000);
    expect(controller.imageRetryGeneration).toBe(1);
  });
  it('limits automatic retries to connectivity, timeouts, and server errors', () => {
    for (const error of [
      new NetworkError('offline'),
      new HttpError(408),
      new HttpError(503),
    ]) {
      expect(canRecoverAutomatically(error)).toBe(true);
    }
    for (const error of [
      new HttpError(429),
      new HttpError(404),
      new InvalidPayloadError('invalid'),
    ]) {
      expect(canRecoverAutomatically(error)).toBe(false);
    }
  });
});
