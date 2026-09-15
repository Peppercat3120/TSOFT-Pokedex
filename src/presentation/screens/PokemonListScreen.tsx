import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ListRenderItemInfo } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PokemonSummary } from '../../domain/entities/Pokemon';
import { PokemonRow } from '../components/PokemonRow';
import { usePokemonList } from '../hooks/usePokemonList';
import type { PokemonListScreenProps } from '../navigation/RootStackParamList';

function RetryButton({
  label,
  onPress,
}: {
  readonly label: string;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export function PokemonListScreen({ navigation }: PokemonListScreenProps) {
  const { state, retryInitial, loadNextPage, retryNextPage } = usePokemonList();
  const scrollArmed = useRef(false);
  const insets = useSafeAreaInsets();
  const selectPokemon = useCallback(
    (pokemonId: number) => {
      navigation.navigate('PokemonDetail', { pokemonId });
    },
    [navigation],
  );
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<PokemonSummary>) => (
      <PokemonRow pokemon={item} onSelect={selectPokemon} />
    ),
    [selectPokemon],
  );

  if (state.status !== 'ready') {
    return (
      <View style={styles.center}>
        {state.status === 'loading' ? (
          <>
            <ActivityIndicator color="#B91C1C" size="large" />
            <Text style={styles.message}>Loading Pokémon…</Text>
          </>
        ) : (
          <>
            <Text accessibilityRole="alert" style={styles.message}>
              {state.status === 'error' ? state.message : 'No Pokémon found.'}
            </Text>
            <RetryButton label="Try again" onPress={retryInitial} />
          </>
        )}
      </View>
    );
  }

  return (
    <FlatList
      testID="pokemon-list"
      style={styles.list}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}
      data={state.items}
      keyExtractor={item => String(item.id)}
      renderItem={renderItem}
      onEndReachedThreshold={0.5}
      onScrollBeginDrag={() => {
        scrollArmed.current =
          state.loadMore.status === 'idle' && state.nextPage !== null;
      }}
      onEndReached={() => {
        if (
          scrollArmed.current &&
          state.nextPage !== null &&
          state.loadMore.status === 'idle'
        ) {
          scrollArmed.current = false;
          loadNextPage();
        }
      }}
      ListHeaderComponent={
        state.hasStaleData ? (
          <Text accessibilityRole="alert" style={styles.banner}>
            Showing saved data; updates are unavailable.
          </Text>
        ) : undefined
      }
      ListFooterComponent={
        <View style={styles.footer}>
          {state.loadMore.status === 'loading' ? (
            <>
              <ActivityIndicator color="#B91C1C" />
              <Text style={styles.message}>Loading more Pokémon…</Text>
            </>
          ) : state.loadMore.status === 'error' ? (
            <>
              <Text accessibilityRole="alert" style={styles.message}>
                {state.loadMore.message}
              </Text>
              <RetryButton
                label="Retry loading more"
                onPress={() => {
                  scrollArmed.current = false;
                  retryNextPage();
                }}
              />
            </>
          ) : state.nextPage === null ? (
            <Text style={styles.message}>You’ve reached the end.</Text>
          ) : null}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#FFFFFF' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#FFFFFF',
  },
  message: {
    color: '#374151',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 12,
  },
  footer: { alignItems: 'center', padding: 16 },
  banner: {
    backgroundColor: '#FEF3C7',
    color: '#78350F',
    fontSize: 16,
    padding: 16,
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
