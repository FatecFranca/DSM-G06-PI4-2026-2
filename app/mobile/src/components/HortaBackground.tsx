import { LinearGradient } from 'expo-linear-gradient';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../styles/theme';

export function HortaBackground({ children }: PropsWithChildren) {
  const { colors, mode } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={mode === 'dark' ? [colors.background, '#14231a', '#16313a'] : ['#f7fbf2', '#e7f2e0', '#dcefeb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.sun, styles.decorative, mode === 'dark' && { opacity: 0.08 }]} />
      <View style={[styles.leaf, styles.leafOne, styles.decorative, { backgroundColor: colors.leaf }]} />
      <View style={[styles.leaf, styles.leafTwo, styles.decorative, { backgroundColor: colors.leaf }]} />
      <View style={[styles.waterRing, styles.decorative, { borderColor: colors.water }]} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  decorative: { position: 'absolute' },
  sun: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#f4d993',
    opacity: 0.2,
    top: -70,
    right: -45,
  },
  leaf: {
    width: 100,
    height: 42,
    borderTopLeftRadius: 60,
    borderBottomRightRadius: 60,
    opacity: 0.13,
  },
  leafOne: { left: -34, top: 155, transform: [{ rotate: '-28deg' }] },
  leafTwo: { right: -38, bottom: 150, transform: [{ rotate: '26deg' }] },
  waterRing: {
    width: 220,
    height: 80,
    borderWidth: 1,
    borderRadius: 110,
    bottom: 90,
    left: -58,
    opacity: 0.9,
  },
});