import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { HortaBackground } from '../components/HortaBackground';
import { MetricCard } from '../components/MetricCard';
import { useRealtimeStatus } from '../hooks/useRealtimeStatus';
import { getTelemetryHistory } from '../services/api';
import type { Telemetry } from '../types/api';
import { colors, spacing } from '../styles/theme';

const HISTORY_LIMIT = 36;
const chartWidth = Math.max(
  220,
  Dimensions.get('window').width - (spacing.lg * 2) - (spacing.md * 2),
);

export function StatusScreen() {
  const { status, connected, error, latestTelemetry } = useRealtimeStatus();
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const soilMoisture = status?.soilMoisture ?? 0;

  useEffect(() => {
    let active = true;
    getTelemetryHistory(24, HISTORY_LIMIT)
      .then((readings) => {
        if (active) {
          setHistory((current) => {
            const merged = [...readings, ...current];
            return merged
              .filter((reading, index, all) =>
                all.findIndex((item) => item.timestamp === reading.timestamp) === index)
              .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
              .slice(-HISTORY_LIMIT);
          });
          setHistoryError('');
        }
      })
      .catch(() => {
        if (active) setHistoryError('Histórico temporariamente indisponível.');
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!latestTelemetry) return;
    setHistory((current) => {
      const readings = [
        ...current.filter((reading) => reading.timestamp !== latestTelemetry.timestamp),
        latestTelemetry,
      ];
      return readings
        .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
        .slice(-HISTORY_LIMIT);
    });
  }, [latestTelemetry]);

  const chartData = history.map((reading, index) => ({
    value: reading.soilMoisture,
    label: index % 6 === 0 ? new Date(reading.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
  }));
  const trend = history.length > 1
    ? history[history.length - 1].soilMoisture - history[0].soilMoisture
    : 0;
  const chartMaxValue = Math.ceil(
    (Math.max(...history.map((reading) => reading.soilMoisture), 100) + 10) / 10,
  ) * 10;
  const chartMinValue = Math.floor(
    (Math.min(...history.map((reading) => reading.soilMoisture), 0) - 10) / 10,
  ) * 10;
  const chartSpacing = chartData.length > 1
    ? Math.max(4, (chartWidth - 12) / (chartData.length - 1))
    : 12;

  return (
    <HortaBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>HORTA NORTE · MONITORAMENTO</Text>
          <Text style={styles.title}>Saúde da horta</Text>
          <ConnectionBanner connected={connected} error={error} />
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="leaf-outline" size={28} color={colors.green} />
            </View>
            <Text style={styles.heroValue}>{status ? `${soilMoisture}%` : '--'}</Text>
            <Text style={styles.heroLabel}>umidade do solo</Text>
            <Text style={styles.heroStatus}>
              {soilMoisture < 40 ? 'Atenção: solo seco' : 'Umidade acompanhada'}
            </Text>
          </View>
          <View style={styles.metrics}>
            <MetricCard
              icon="☀️"
              label="Temperatura"
              value={status ? `${status.temperature}°C` : '--'}
            />
            <MetricCard
              icon="💧"
              label="Umidade do ar"
              value={status ? `${status.humidity}%` : '--'}
            />
          </View>
          <View style={styles.note}>
            <Text style={styles.noteTitle}>Estado da irrigação</Text>
            <Text style={styles.noteText}>
              {status?.irrigation.mode === 'manual'
                ? 'O sistema está sob controle manual.'
                : 'O sistema está seguindo os sensores automaticamente.'}
            </Text>
          </View>
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Umidade do solo</Text>
                <Text style={styles.chartSubtitle}>Últimas 24 horas · leituras persistidas</Text>
              </View>
              <View style={styles.rangeBadge}>
                <Text style={styles.rangeBadgeText}>Histerese 40–60%</Text>
              </View>
            </View>
            {historyLoading ? (
              <ActivityIndicator color={colors.green} style={styles.chartLoading} />
            ) : chartData.length < 2 ? (
              <Text style={styles.chartMessage}>
                {historyError || 'Aguardando leituras para formar o gráfico.'}
              </Text>
            ) : (
              <>
                <View style={styles.chartPlot}>
                  <LineChart
                    areaChart
                    data={chartData}
                    width={chartWidth}
                    height={185}
                    spacing={chartSpacing}
                    scrollToEnd
                    color={colors.green}
                    thickness={3}
                    startFillColor={colors.leaf}
                    endFillColor={colors.mint}
                    startOpacity={0.35}
                    endOpacity={0.05}
                    maxValue={chartMaxValue - chartMinValue}
                    yAxisOffset={chartMinValue}
                    noOfSections={4}
                    yAxisLabelSuffix="%"
                    showReferenceLine1
                    referenceLine1Position={40}
                    referenceLine1Config={{ color: colors.warning, dashWidth: 4, dashGap: 4, labelText: '40%' }}
                    showReferenceLine2
                    referenceLine2Position={60}
                    referenceLine2Config={{ color: colors.green, dashWidth: 4, dashGap: 4, labelText: '60%' }}
                    yAxisColor={colors.border}
                    xAxisColor={colors.border}
                    yAxisTextStyle={styles.axisText}
                    xAxisLabelTextStyle={styles.axisText}
                    hideDataPoints
                    curved
                  />
                </View>
                <Text style={styles.trend}>
                  Tendência: {trend > 1 ? 'subindo' : trend < -1 ? 'descendo' : 'estável'}
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </HortaBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  kicker: { color: colors.muted, fontSize: 10, letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '800', marginTop: 8, marginBottom: spacing.lg },
  hero: { alignItems: 'center', backgroundColor: 'rgba(229,243,223,0.92)', borderRadius: 26, padding: 26 },
  heroIcon: { alignItems: 'center', backgroundColor: colors.white, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  heroValue: { color: colors.ink, fontSize: 56, fontWeight: '800', marginTop: 10 },
  heroLabel: { color: colors.muted, fontSize: 14 },
  heroStatus: { color: colors.green, fontSize: 13, fontWeight: '700', marginTop: 17 },
  metrics: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  note: { backgroundColor: 'rgba(255,255,255,0.75)', borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  noteTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  noteText: { color: colors.muted, fontSize: 13, marginTop: 5 },
  chartCard: { backgroundColor: 'rgba(255,255,255,0.86)', borderColor: colors.border, borderRadius: 18, borderWidth: 1, marginTop: spacing.md, overflow: 'hidden', padding: spacing.md },
  chartHeader: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  chartPlot: { paddingTop: spacing.sm },
  chartTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  chartSubtitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  rangeBadge: { backgroundColor: colors.mint, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 6 },
  rangeBadgeText: { color: colors.green, fontSize: 11, fontWeight: '700' },
  chartLoading: { height: 190 },
  chartMessage: { color: colors.muted, fontSize: 13, paddingVertical: 70, textAlign: 'center' },
  axisText: { color: colors.muted, fontSize: 10 },
  trend: { color: colors.green, fontSize: 12, fontWeight: '700', marginTop: 4 },
});