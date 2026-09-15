import type { ReactElement, ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PokemonDetailPanelsProps {
  readonly horizontal: boolean;
  readonly identity: ReactNode;
  readonly details: ReactNode;
  readonly refreshControl?: ReactElement;
}

/** Stable panel ancestry preserves artwork state when the window changes shape. */
export function PokemonDetailPanels({
  horizontal,
  identity,
  details,
  refreshControl,
}: PokemonDetailPanelsProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.content, horizontal && styles.horizontal]}>
      <ScrollView
        testID="pokemon-detail-identity-panel"
        scrollEnabled={horizontal}
        style={horizontal ? styles.panel : styles.stackedPanel}
        contentContainerStyle={[
          horizontal && styles.identity,
          horizontal && { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        {identity}
      </ScrollView>
      <ScrollView
        testID="pokemon-detail-stats-panel"
        scrollEnabled={horizontal}
        style={horizontal ? styles.panel : styles.stackedPanel}
        refreshControl={horizontal ? refreshControl : undefined}
        contentContainerStyle={
          horizontal && {
            paddingBottom: Math.max(insets.bottom, 16),
          }
        }
      >
        {details}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24 },
  horizontal: { flex: 1, maxWidth: '100%', flexDirection: 'row', gap: 24 },
  panel: { flex: 1, minWidth: 0 },
  stackedPanel: { flexGrow: 0, flexShrink: 0 },
  identity: { flexGrow: 1, justifyContent: 'center' },
});
