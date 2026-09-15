import type { ImageFailureReporter } from '../hooks/useRetryableImage';
import { StyleSheet, Text, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { PokemonDetail } from '../../domain/entities/Pokemon';
import { PokemonArtwork } from './PokemonArtwork';

function humanize(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const STAT_NAMES: Readonly<Record<string, string>> = {
  hp: 'HP',
  attack: 'Attack',
  defense: 'Defense',
  'special-attack': 'Special Attack',
  'special-defense': 'Special Defense',
  speed: 'Speed',
};
const STAT_ORDER = Object.keys(STAT_NAMES);

function Section({
  title,
  children,
}: PropsWithChildren<{ readonly title: string }>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Attribute({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={styles.attribute}
    >
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function PokemonProfile({
  pokemon,
  isStale,
  imageRetryGeneration = 0,
  reportImageFailure,
}: {
  readonly pokemon: PokemonDetail;
  readonly isStale: boolean;
  readonly imageRetryGeneration?: number;
  readonly reportImageFailure?: ImageFailureReporter;
}) {
  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot);
  const abilities = [...pokemon.abilities].sort((a, b) => a.slot - b.slot);
  const rank = (name: string) => {
    const index = STAT_ORDER.indexOf(name);
    return index < 0 ? STAT_ORDER.length : index;
  };
  const stats = [...pokemon.stats].sort(
    (a, b) => rank(a.stat.name) - rank(b.stat.name),
  );
  return (
    <View style={styles.content}>
      {isStale && (
        <Text accessibilityRole="alert" style={styles.banner}>
          Showing saved data; updates are unavailable.
        </Text>
      )}
      <Text accessibilityRole="header" style={styles.name}>
        {humanize(pokemon.name)}
      </Text>
      <Text testID="pokemon-detail-id" style={styles.identifier}>
        #{String(pokemon.id).padStart(3, '0')}
      </Text>
      <PokemonArtwork
        imageRetryGeneration={imageRetryGeneration}
        reportImageFailure={reportImageFailure}
        key={`${pokemon.id}:${pokemon.sprites.officialArtwork.frontDefault}:${pokemon.sprites.frontDefault}`}
        artworkUrl={pokemon.sprites.officialArtwork.frontDefault}
        spriteUrl={pokemon.sprites.frontDefault}
      />
      <Section title="Types">
        {types.length === 0 ? (
          <Text style={styles.value}>Not available</Text>
        ) : (
          <View style={styles.types}>
            {types.map(entry => (
              <Text key={entry.slot} style={styles.type}>
                {humanize(entry.type.name)}
              </Text>
            ))}
          </View>
        )}
      </Section>
      <Section title="Attributes">
        <Attribute
          label="Height"
          value={`${(pokemon.heightDecimetres / 10).toFixed(1)} m`}
        />
        <Attribute
          label="Weight"
          value={`${(pokemon.weightHectograms / 10).toFixed(1)} kg`}
        />
        <Attribute
          label="Base experience"
          value={
            pokemon.baseExperience === null
              ? 'Not available'
              : String(pokemon.baseExperience)
          }
        />
      </Section>
      <Section title="Abilities">
        {abilities.length === 0 ? (
          <Text style={styles.value}>Not available</Text>
        ) : (
          abilities.map(entry => (
            <Text key={entry.slot} style={styles.value}>
              {humanize(entry.ability.name)}
              {entry.isHidden ? ' (Hidden)' : ''}
            </Text>
          ))
        )}
      </Section>
      <Section title="Statistics">
        {stats.length === 0 ? (
          <Text style={styles.value}>Not available</Text>
        ) : (
          <>
            {stats.map(entry => (
              <Attribute
                key={entry.stat.id}
                label={STAT_NAMES[entry.stat.name] ?? humanize(entry.stat.name)}
                value={String(entry.baseStat)}
              />
            ))}
            <Attribute
              label="Total"
              value={String(
                stats.reduce((total, entry) => total + entry.baseStat, 0),
              )}
            />
          </>
        )}
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 640, alignSelf: 'center', padding: 24 },
  name: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  identifier: {
    color: '#4B5563',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  section: { marginTop: 20 },
  heading: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  types: { flexDirection: 'row', flexWrap: 'wrap' },
  type: {
    color: '#1F2937',
    backgroundColor: '#F3F4F6',
    fontSize: 16,
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  attribute: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  label: { color: '#374151', fontSize: 16, marginRight: 16 },
  value: { color: '#111827', fontSize: 16, lineHeight: 24 },
  banner: {
    backgroundColor: '#FEF3C7',
    color: '#78350F',
    fontSize: 16,
    padding: 16,
    marginBottom: 20,
  },
});
