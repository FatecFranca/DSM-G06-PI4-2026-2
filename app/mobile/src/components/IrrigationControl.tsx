import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { IrrigationState } from '../types/api';
import { useTheme, spacing, type ThemeColors } from '../styles/theme';

type Props = {
  irrigation: IrrigationState;
  pending: boolean;
  onToggle: () => void;
  onAutomatic: () => void;
};

export function IrrigationControl({
  irrigation,
  pending,
  onToggle,
  onAutomatic,
}: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const isManual = irrigation.mode === 'manual';
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>CONTROLE DO SISTEMA</Text>
          <Text style={styles.title}>Irrigação</Text>
        </View>
        <View style={[styles.badge, isManual ? styles.manual : styles.auto]}>
          <Text style={styles.badgeText}>{isManual ? 'MANUAL' : 'AUTO'}</Text>
        </View>
      </View>
      <View style={[styles.visual, irrigation.active && styles.visualActive]}>
        <Ionicons
          name={irrigation.active ? 'water' : 'water-outline'}
          size={54}
          color={irrigation.active ? '#4f9ba2' : colors.green}
        />
        <Text style={styles.state}>
          {isManual
            ? irrigation.active
              ? 'Irrigação manual ligada'
              : 'Irrigação manual desligada'
            : 'Operação automática ativa'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={onToggle}
        style={[styles.button, irrigation.active && styles.stopButton]}
      >
        <Ionicons
          name={irrigation.active ? 'stop' : 'play'}
          size={16}
          color={colors.white}
        />
        <Text style={styles.buttonText}>
          {pending
            ? 'Enviando comando...'
            : irrigation.active
              ? 'Desligar irrigação'
              : 'Ligar irrigação'}
        </Text>
      </Pressable>
      {isManual && (
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={onAutomatic}
          style={styles.autoButton}
        >
          <Ionicons name="sync-outline" size={16} color={colors.green} />
          <Text style={styles.autoButtonText}>Retomar modo automático</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.mint,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.lg,
  },
  header: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  kicker: { color: colors.muted, fontSize: 10, letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 24, fontWeight: '700', marginTop: 5 },
  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 },
  manual: { backgroundColor: colors.mint },
  auto: { backgroundColor: colors.mint },
  badgeText: { color: colors.muted, fontSize: 10, fontWeight: '800' },
  visual: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 20,
    justifyContent: 'center',
    marginVertical: spacing.lg,
    minHeight: 176,
  },
  visualActive: { backgroundColor: colors.water },
  state: { color: colors.muted, fontSize: 13, marginTop: 12 },
  button: {
    alignItems: 'center',
    backgroundColor: colors.green,
    borderRadius: 13,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    padding: 15,
  },
  stopButton: { backgroundColor: colors.danger },
  buttonText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  autoButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: spacing.md,
    padding: 8,
  },
  autoButtonText: { color: colors.green, fontSize: 13, fontWeight: '700' },
  });
}