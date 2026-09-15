import { memo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PokemonSummary } from '../../domain/entities/Pokemon';

interface Props {
  readonly pokemon: PokemonSummary;
  readonly onSelect: (id: number) => void;
}

export const PokemonRow = memo(function PokemonRowView({
  pokemon,
  onSelect,
}: Props) {
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const name = pokemon.name.charAt(0).toUpperCase() + pokemon.name.slice(1);
  return (
    <Pressable
      testID={`pokemon-row-${pokemon.id}`}
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityHint="Opens the Pokémon detail screen"
      onPress={() => onSelect(pokemon.id)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View
        style={styles.imageContainer}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {imageState !== 'error' && (
          <Image
            testID={`pokemon-image-${pokemon.id}`}
            accessible={false}
            source={{ uri: pokemon.imageUrl }}
            resizeMode="contain"
            style={styles.image}
            onLoad={() => setImageState('ready')}
            onError={() => setImageState('error')}
          />
        )}
        {imageState === 'loading' && (
          <ActivityIndicator style={styles.imageLoading} color="#B91C1C" />
        )}
        {imageState === 'error' && (
          <Text style={styles.imageError}>Image unavailable</Text>
        )}
      </View>
      <View style={styles.labels}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.identifier}>
          #{String(pokemon.id).padStart(3, '0')}
        </Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D1D5DB',
  },
  pressed: { backgroundColor: '#FEE2E2' },
  imageContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  image: { width: 72, height: 72 },
  imageLoading: { position: 'absolute' },
  imageError: { color: '#4B5563', fontSize: 12, textAlign: 'center' },
  labels: { flex: 1, marginLeft: 16 },
  name: { color: '#111827', fontSize: 18, fontWeight: '600' },
  identifier: { color: '#4B5563', fontSize: 14, marginTop: 4 },
});
