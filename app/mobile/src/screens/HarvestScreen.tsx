import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { HortaBackground } from '../components/HortaBackground';
import { cancelReservation, getCurrentUser, getHarvestCalendar, getHarvests, getMyReservations, reserveHarvest } from '../services/api';
import { createRealtimeSocket } from '../services/realtimeService';
import type { Harvest, HarvestCalendarEvent } from '../types/api';
import { useTheme, spacing, type ThemeColors } from '../styles/theme';

type ViewMode = 'available' | 'mine';

export function HarvestScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [reservations, setReservations] = useState<Harvest[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<HarvestCalendarEvent[]>([]);
  const [mode, setMode] = useState<ViewMode>('available');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [canReserve, setCanReserve] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date();
      const to = new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
      const [nextHarvests, nextReservations, calendar, currentUser] = await Promise.all([
        getHarvests(),
        getMyReservations(),
        getHarvestCalendar(from.toISOString(), to.toISOString()),
        getCurrentUser(),
      ]);
      setHarvests(nextHarvests);
      setReservations(nextReservations);
      setUpcomingEvents(calendar.events.filter((event) => event.type === 'harvest').slice(0, 4));
      setCanReserve(currentUser.permissions.includes('reserve_harvest'));
      setError('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar as colheitas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  useEffect(() => {
    const socket = createRealtimeSocket();
    const refresh = () => { void load(); };
    socket.on('harvest:created', refresh);
    socket.on('harvest:updated', refresh);
    socket.on('harvest:statusChanged', refresh);
    socket.on('reservation:created', refresh);
    socket.on('reservation:cancelled', refresh);
    return () => {
      socket.off('harvest:created', refresh);
      socket.off('harvest:updated', refresh);
      socket.off('harvest:statusChanged', refresh);
      socket.off('reservation:created', refresh);
      socket.off('reservation:cancelled', refresh);
      socket.disconnect();
    };
  }, [load]);

  async function reserve(harvest: Harvest) {
    const quantity = Number(quantities[harvest.id] || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Informe uma quantidade inteira maior que zero.');
      return;
    }
    setPendingId(harvest.id);
    try {
      await reserveHarvest(harvest.id, quantity);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao reservar.');
    } finally {
      setPendingId(null);
    }
  }

  async function cancel(harvest: Harvest) {
    setPendingId(harvest.id);
    try {
      await cancelReservation(harvest.id);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao cancelar reserva.');
    } finally {
      setPendingId(null);
    }
  }

  const reservedHarvestIds = new Set(reservations.map((item) => item.id));
  const list = mode === 'available'
    ? harvests.filter((item) => item.available && item.status !== 'cancelled' && !reservedHarvestIds.has(item.id))
    : reservations;

  return (
    <HortaBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.green} />}
        >
          <Text style={styles.kicker}>DISTRIBUIÇÃO COMUNITÁRIA</Text>
          <Text style={styles.title}>Colheitas</Text>
          <ConnectionBanner connected={!error} error={error} label="API conectada" />
          <View style={styles.tabs}>
            <Pressable style={[styles.tab, mode === 'available' && styles.activeTab]} onPress={() => setMode('available')}><Text style={mode === 'available' ? styles.activeTabText : styles.tabText}>Disponíveis</Text></Pressable>
            <Pressable style={[styles.tab, mode === 'mine' && styles.activeTab]} onPress={() => setMode('mine')}><Text style={mode === 'mine' ? styles.activeTabText : styles.tabText}>Minhas reservas</Text></Pressable>
          </View>
          {upcomingEvents.length > 0 && (
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleTitle}>Próximas colheitas</Text>
              {upcomingEvents.map((event) => (
                <View style={styles.scheduleRow} key={`${event.harvestId}-${event.date}`}>
                  <Text style={styles.scheduleDate}>{new Date(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</Text>
                  <Text style={styles.scheduleCrop}>{event.crop}</Text>
                  <Text style={styles.scheduleQuantity}>{event.quantity} {event.unit || 'unidade'}</Text>
                </View>
              ))}
            </View>
          )}
          {loading && <Text style={styles.muted}>Carregando colheitas...</Text>}
          {!loading && list.length === 0 && <Text style={styles.muted}>{mode === 'available' ? 'Nenhuma colheita disponível.' : 'Você não possui reservas ativas.'}</Text>}
          {list.map((harvest) => (
            <View key={harvest.reservationId || harvest.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{harvest.crop.charAt(0)}</Text></View>
                <View style={styles.info}><Text style={styles.crop}>{harvest.crop}</Text><Text style={styles.meta}>{new Date(harvest.harvestDate).toLocaleDateString('pt-BR')} · {harvest.unit || 'unidade'}</Text></View>
                <Text style={mode === 'available' ? styles.available : styles.reserved}>{mode === 'available' ? 'Disponível' : 'Reservada'}</Text>
              </View>
              <Text style={styles.quantity}>{mode === 'mine' ? `Quantidade reservada: ${harvest.reservationQuantity || harvest.reservedQuantity || 1}` : `${harvest.availableQuantity ?? harvest.quantity} ${harvest.unit || 'unidade'} disponíveis`}</Text>
              {mode === 'available' && canReserve ? (
                <View style={styles.reserveRow}>
                  <TextInput
                    value={quantities[harvest.id] ?? ''}
                    placeholder="1"
                    onChangeText={(value) => setQuantities((current) => ({ ...current, [harvest.id]: value.replace(/\D/g, '') }))}
                    keyboardType="number-pad"
                    style={styles.quantityInput}
                    accessibilityLabel={`Quantidade de ${harvest.crop}`}
                  />
                  <Pressable style={styles.button} disabled={pendingId === harvest.id} onPress={() => void reserve(harvest)}><Text style={styles.buttonText}>{pendingId === harvest.id ? '...' : 'Reservar'}</Text></Pressable>
                </View>
              ) : mode === 'mine' ? <Pressable style={styles.cancelButton} disabled={pendingId === harvest.id} onPress={() => void cancel(harvest)}><Text style={styles.cancelText}>{pendingId === harvest.id ? 'Cancelando...' : 'Cancelar reserva'}</Text></Pressable> : <Text style={styles.muted}>Seu perfil não possui permissão para reservar.</Text>}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </HortaBackground>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  safeArea: { flex: 1 }, content: { padding: spacing.lg, paddingBottom: 40 }, kicker: { color: colors.muted, fontSize: 10, letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 31, fontWeight: '800', marginBottom: spacing.md, marginTop: 8 }, muted: { color: colors.muted, fontSize: 14, paddingVertical: spacing.lg }, tabs: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', marginBottom: spacing.md, padding: 4 }, tab: { alignItems: 'center', borderRadius: 9, flex: 1, padding: 10 }, activeTab: { backgroundColor: colors.surfaceRaised }, tabText: { color: colors.muted, fontSize: 12, fontWeight: '700' }, activeTabText: { color: colors.green, fontSize: 12, fontWeight: '800' }, scheduleCard: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md }, scheduleTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm }, scheduleRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingVertical: 9 }, scheduleDate: { color: colors.green, fontSize: 12, fontWeight: '800', width: 62 }, scheduleCrop: { color: colors.ink, flex: 1, fontSize: 13, fontWeight: '700' }, scheduleQuantity: { color: colors.muted, fontSize: 12 }, card: { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderRadius: 20, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md }, cardTop: { alignItems: 'center', flexDirection: 'row' }, avatar: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 13, height: 42, justifyContent: 'center', width: 42 }, avatarText: { color: colors.green, fontSize: 21, fontWeight: '800' }, info: { flex: 1, marginLeft: spacing.sm }, crop: { color: colors.ink, fontSize: 16, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 12, marginTop: 4 }, available: { color: colors.green, fontSize: 11, fontWeight: '800' }, reserved: { color: colors.warning, fontSize: 11, fontWeight: '800' }, quantity: { color: colors.muted, fontSize: 13, marginTop: spacing.md }, reserveRow: { alignItems: 'center', flexDirection: 'row', gap: 9, marginTop: spacing.md }, quantityInput: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.ink, padding: 11, textAlign: 'center', width: 60 }, button: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 11, flex: 1, padding: 12 }, buttonText: { color: colors.white, fontSize: 13, fontWeight: '700' }, cancelButton: { alignItems: 'center', borderColor: colors.danger, borderRadius: 11, borderWidth: 1, marginTop: spacing.md, padding: 11 }, cancelText: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  });
}
