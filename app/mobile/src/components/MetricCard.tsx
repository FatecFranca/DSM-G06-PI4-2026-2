import { StyleSheet, Text, View } from 'react-native';
import { useTheme, spacing, type ThemeColors } from '../styles/theme';

type Props = { label: string; value: string; icon: string };

export function MetricCard({ label, value, icon }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    padding: spacing.md,
  },
  icon: { fontSize: 18, marginBottom: 8 },
  label: { color: colors.muted, fontSize: 11 },
  value: { color: colors.ink, fontSize: 21, fontWeight: '700', marginTop: 5 },
  });
}