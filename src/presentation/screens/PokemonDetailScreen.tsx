import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PokemonProfile } from '../components/PokemonProfile';
import { PokemonDetailLoadingSkeleton } from '../components/LoadingSkeletons';
import { usePokemonDetail } from '../hooks/usePokemonDetail';
import type { PokemonDetailScreenProps } from '../navigation/RootStackParamList';

export function PokemonDetailScreen({
  route,
  navigation,
}: PokemonDetailScreenProps) {
  const { state, retry } = usePokemonDetail(route.params.pokemonId);
  const insets = useSafeAreaInsets();
  if (state.status === 'loading') {
    return (
      <ScrollView
        testID="pokemon-detail-loading-scroll"
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <PokemonDetailLoadingSkeleton />
      </ScrollView>
    );
  }
  if (state.status === 'ready') {
    return (
      <ScrollView
        testID="pokemon-detail-scroll"
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <PokemonProfile pokemon={state.pokemon} isStale={state.isStale} />
      </ScrollView>
    );
  }
  const canRetry = state.status === 'error' && state.canRetry;
  const label = canRetry ? 'Try again' : 'Back to list';
  return (
    <View
      style={[styles.center, { paddingBottom: Math.max(insets.bottom, 24) }]}
    >
      <>
        <Text accessibilityRole="alert" style={styles.message}>
          {state.message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={
            canRetry
              ? retry
              : () => {
                  if (navigation.canGoBack()) {
                    navigation.goBack();
                  } else {
                    navigation.replace('PokemonList');
                  }
                }
          }
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{label}</Text>
        </Pressable>
      </>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  center: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  message: {
    color: '#374151',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 16,
  },
  button: {
    backgroundColor: '#B91C1C',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.75 },
});
