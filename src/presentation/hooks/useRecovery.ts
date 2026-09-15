import { useCallback } from 'react';
import { HttpError, NetworkError } from '../../domain/errors/PokemonErrors';
import { useBoundedRecovery, type RecoveryOutcome } from './useBoundedRecovery';
import { useRecoveryLifecycle } from './useRecoveryLifecycle';
import { useImageRecovery } from './useImageRecovery';

export function canRecoverAutomatically(error: unknown): boolean {
  return (
    error instanceof NetworkError ||
    (error instanceof HttpError &&
      (error.status === 408 || (error.status >= 500 && error.status <= 599)))
  );
}

/** Composes independent channels while retaining the screen-facing contract. */
export function useAutomaticRecovery({
  dataPending,
  focused,
  onRecover,
}: {
  readonly dataPending: boolean;
  readonly focused: boolean;
  readonly onRecover: () => Promise<RecoveryOutcome>;
}) {
  const lifecycle = useRecoveryLifecycle(focused);
  const images = useImageRecovery();
  const { restart: restartData, exhausted: dataExhausted } = useBoundedRecovery(
    dataPending,
    lifecycle,
    onRecover,
  );
  const { retryImages } = images;
  const recoverImages = useCallback(async (): Promise<RecoveryOutcome> => {
    retryImages();
    return 'attempted';
  }, [retryImages]);
  const { restart: restartImage, exhausted: imageExhausted } =
    useBoundedRecovery(images.pending, lifecycle, recoverImages);
  const restartRecovery = useCallback(() => {
    restartData();
    restartImage();
  }, [restartData, restartImage]);
  return {
    restartRecovery,
    recoveryExhausted: dataExhausted || imageExhausted,
    imageRetryGeneration: images.imageRetryGeneration,
    reportImageFailure: images.reportImageFailure,
    retryImages: images.retryImages,
  };
}
