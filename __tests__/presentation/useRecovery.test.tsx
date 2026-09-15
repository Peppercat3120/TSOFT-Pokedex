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
    recover = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(AppState, 'addEventListener')
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
    expect(recover.mock.calls[0][0]).toBe('data');
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
  it('does not consume a round when the controller is busy', async () => {
    await mount();
    recover.mockResolvedValue(false);
    for (let index = 0; index < 7; index++) {
      await advance(2000);
    }
    expect(controller.recoveryExhausted).toBe(false);
  });
  it('uses explicit image and combined recovery reasons', async () => {
    await act(async () => {
      renderer = Renderer.create(<Harness dataPending={false} />);
    });
    recover.mockClear();
    await act(async () => controller.reportImageFailure('image', true));
    await advance(2000);
    expect(recover).toHaveBeenLastCalledWith('images', expect.any(Function));

    await act(async () => renderer.update(<Harness dataPending />));
    await advance(4000);
    expect(recover).toHaveBeenLastCalledWith(
      'data-and-images',
      expect.any(Function),
    );
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
