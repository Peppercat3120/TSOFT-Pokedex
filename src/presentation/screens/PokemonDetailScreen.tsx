import { useIsFocused } from '@react-navigation/native';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PokemonProfile } from '../components/PokemonProfile';
import { PokemonDetailLoadingSkeleton } from '../components/LoadingSkeletons';
import { usePokemonDetailLayout } from '../hooks/usePokemonDetailLayout';
import { usePokemonDetail } from '../hooks/usePokemonDetail';
import type { PokemonDetailScreenProps } from '../navigation/RootStackParamList';

export function PokemonDetailScreen({
  route,
  navigation,
}: PokemonDetailScreenProps) {
  const horizontal = usePokemonDetailLayout();
  const focused = useIsFocused();
  const {
    state,
    retry,
    refresh,
    retryUpdates,
    refreshing,
    refreshError,
    recoveryExhausted,
    imageRetryGeneration,
    reportImageFailure,
  } = usePokemonDetail(route.params.pokemonId, focused);
  const insets = useSafeAreaInsets();
  if (state.status === 'loading') {
    return (
      <ScrollView
        testID="pokemon-detail-loading-scroll"
        style={styles.screen}
        scrollEnabled={!horizontal}
        contentContainerStyle={
          horizontal
            ? [
                styles.horizontalContent,
                { paddingLeft: insets.left, paddingRight: insets.right },
              ]
            : { paddingBottom: Math.max(insets.bottom, 16) }
        }
      >
        <PokemonDetailLoadingSkeleton horizontal={horizontal} />
      </ScrollView>
    );
  }
  if (state.status === 'ready') {
    return (
      <ScrollView
        refreshControl={
          horizontal ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          )
        }
        testID="pokemon-detail-scroll"
        style={styles.screen}
        scrollEnabled={!horizontal}
        contentContainerStyle={
          horizontal
            ? [
                styles.horizontalContent,
                { paddingLeft: insets.left, paddingRight: insets.right },
              ]
            : { paddingBottom: Math.max(insets.bottom, 16) }
        }
      >
        <PokemonProfile
          horizontal={horizontal}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} />
          }
          feedback={
            <>
              {refreshing && (
                <Text style={styles.message}>Refreshing Pokémon…</Text>
              )}
              {refreshError && (
                <Text accessibilityRole="alert" style={styles.message}>
                  {refreshError}
                </Text>
              )}
              {(recoveryExhausted || refreshError !== null) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry updates"
                  onPress={retryUpdates}
                  style={styles.button}
                >
                  <Text style={styles.buttonText}>Retry updates</Text>
                </Pressable>
              )}
            </>
          }
          pokemon={state.pokemon}
          isStale={state.isStale}
          imageRetryGeneration={imageRetryGeneration}
          reportImageFailure={reportImageFailure}
        />
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
  horizontalContent: { flex: 1 },
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
