import { useRetryableImage } from '../hooks/useRetryableImage';
import type { ImageFailureReporter } from '../hooks/useRetryableImage';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

interface Props {
  readonly imageRetryGeneration?: number;
  readonly reportImageFailure?: ImageFailureReporter;
  readonly artworkUrl: string | null;
  readonly spriteUrl: string | null;
}

export function PokemonArtwork({
  artworkUrl,
  spriteUrl,
  imageRetryGeneration = 0,
  reportImageFailure,
}: Props) {
  const urls = [
    ...new Set(
      [artworkUrl, spriteUrl].filter((url): url is string => url !== null),
    ),
  ];
  const image = useRetryableImage(
    urls,
    imageRetryGeneration,
    reportImageFailure,
  );
  const url = image.url;
  return (
    <View
      style={styles.container}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {url === undefined ? (
        <Text style={styles.fallback}>Image unavailable</Text>
      ) : (
        <>
          <Image
            key={image.key}
            testID="pokemon-detail-artwork"
            accessible={false}
            source={{ uri: url }}
            resizeMode="contain"
            style={styles.image}
            onLoad={image.onLoad}
            onError={image.onError}
          />
          {!image.loaded && (
            <ActivityIndicator
              testID="pokemon-artwork-loading"
              style={styles.loading}
              color="#B91C1C"
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 240,
    aspectRatio: 1,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  image: { width: '100%', height: '100%' },
  loading: { position: 'absolute' },
  fallback: { color: '#4B5563', fontSize: 16, textAlign: 'center' },
});
