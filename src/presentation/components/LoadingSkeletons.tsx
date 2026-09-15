import { StyleSheet, Text, View } from 'react-native';

function SkeletonBlock({
  style,
}: {
  readonly style?: object;
}) {
  return <View style={[styles.block, style]} />;
}

function LoadingStatus() {
  return (
    <Text accessibilityRole="alert" style={styles.loadingStatus}>
      Loading Pokémon…
    </Text>
  );
}

function PokemonRowSkeleton({
  compact = false,
  testID,
}: {
  readonly compact?: boolean;
  readonly testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.row, compact && styles.compactRow]}>
      <SkeletonBlock style={styles.thumbnail} />
      <View style={styles.rowLabels}>
        <SkeletonBlock style={styles.rowName} />
        <SkeletonBlock style={styles.rowIdentifier} />
      </View>
    </View>
  );
}

export function PokemonListLoadingSkeleton() {
  return (
    <View testID="pokemon-list-loading-skeleton" style={styles.listLoading}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.listSkeleton}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <PokemonRowSkeleton key={index} testID={`pokemon-list-loading-row-${index + 1}`} />
        ))}
      </View>
      <LoadingStatus />
    </View>
  );
}

export function PokemonListFooterLoadingSkeleton() {
  return (
    <View
      testID="pokemon-list-footer-loading-skeleton"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.footerSkeleton}
    >
      {Array.from({ length: 3 }, (_, index) => (
        <PokemonRowSkeleton
          compact
          key={index}
          testID={`pokemon-list-footer-loading-row-${index + 1}`}
        />
      ))}
    </View>
  );
}

export function PokemonDetailLoadingSkeleton() {
  return (
    <View testID="pokemon-detail-loading-skeleton" style={styles.detailLoading}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.detailSkeleton}
      >
        <SkeletonBlock style={styles.detailName} />
        <SkeletonBlock style={styles.detailIdentifier} />
        <SkeletonBlock style={styles.artwork} />
        <SkeletonBlock style={styles.sectionHeading} />
        <View style={styles.types}>
          <SkeletonBlock style={styles.type} />
          <SkeletonBlock style={styles.shortType} />
        </View>
        <SkeletonBlock style={styles.sectionHeading} />
        {Array.from({ length: 3 }, (_, index) => (
          <View key={index} style={styles.attribute}>
            <SkeletonBlock style={styles.attributeLabel} />
            <SkeletonBlock style={styles.attributeValue} />
          </View>
        ))}
        <SkeletonBlock style={styles.sectionHeading} />
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} style={styles.ability} />
        ))}
        <SkeletonBlock style={styles.sectionHeading} />
        {Array.from({ length: 4 }, (_, index) => (
          <View key={index} style={styles.attribute}>
            <SkeletonBlock style={styles.attributeLabel} />
            <SkeletonBlock style={styles.attributeValue} />
          </View>
        ))}
      </View>
      <LoadingStatus />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: '#E5E7EB', borderRadius: 6 },
  loadingStatus: {
    color: '#374151',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  listLoading: { flex: 1, backgroundColor: '#FFFFFF' },
  listSkeleton: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  compactRow: { paddingVertical: 8 },
  thumbnail: { width: 72, height: 72, borderRadius: 8 },
  rowLabels: { flex: 1, marginLeft: 16 },
  rowName: { width: '55%', height: 18 },
  rowIdentifier: { width: '28%', height: 14, marginTop: 10 },
  footerSkeleton: { paddingVertical: 8 },
  detailLoading: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24 },
  detailSkeleton: { width: '100%' },
  detailName: { width: '52%', height: 32, alignSelf: 'center' },
  detailIdentifier: { width: '20%', height: 18, alignSelf: 'center', marginTop: 12 },
  artwork: { width: '100%', maxWidth: 240, aspectRatio: 1, alignSelf: 'center', marginVertical: 16 },
  sectionHeading: { width: '34%', height: 24, marginTop: 20, marginBottom: 12 },
  types: { flexDirection: 'row' },
  type: { width: 76, height: 34, marginRight: 8 },
  shortType: { width: 58, height: 34 },
  attribute: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  attributeLabel: { width: '35%', height: 16 },
  attributeValue: { width: '20%', height: 16 },
  ability: { width: '45%', height: 16, marginBottom: 12 },
});
