import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { HortaBackground } from '../components/HortaBackground';
import { IrrigationControl } from '../components/IrrigationControl';
import { useRealtimeStatus } from '../hooks/useRealtimeStatus';
import { setIrrigation } from '../services/api';
import { useTheme, spacing, type ThemeColors } from '../styles/theme';

export function IrrigationScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { status, connected, error, setStatus, setError } = useRealtimeStatus();
  const [pending, setPending] = useState(false);

  const sendCommand = async (action: 'on' | 'off' | 'auto') => {
    setPending(true);
    try {
      const result = await setIrrigation(action);
      setStatus((current) =>
        current ? { ...current, irrigation: result.irrigation } : current,
      );
      setError('');
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Falha no comando.';
      setError(message);
      Alert.alert('Não foi possível controlar', message);
    } finally {
      setPending(false);
    }
  };

  return (
    <HortaBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>CONTROLE REMOTO · ESP32</Text>
          <Text style={styles.title}>Irrigação</Text>
          <ConnectionBanner connected={connected} error={error} />
          {status ? (
            <IrrigationControl
              irrigation={status.irrigation}
              pending={pending}
              onToggle={() => sendCommand(status.irrigation.active ? 'off' : 'on')}
              onAutomatic={() => sendCommand('auto')}
            />
          ) : (
            <Text style={styles.loading}>Carregando estado do sistema...</Text>
          )}
          <Text style={styles.helper}>
            O modo manual permanece ativo até o comando “Retomar modo automático”.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </HortaBackground>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  kicker: { color: colors.muted, fontSize: 10, letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '800', marginTop: 8, marginBottom: spacing.lg },
  loading: { color: colors.muted, fontSize: 14, paddingVertical: spacing.xl },
  helper: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: spacing.md, textAlign: 'center' },
  });
}