import { useEffect, useState } from 'react';
import { getStatus } from '../services/api';
import { createRealtimeSocket } from '../services/realtimeService';
import type { HortaStatus, Telemetry } from '../types/api';

export function useRealtimeStatus() {
  const [status, setStatus] = useState<HortaStatus | null>(null);
  const [latestTelemetry, setLatestTelemetry] = useState<Telemetry | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getStatus()
      .then((nextStatus) => {
        setStatus(nextStatus);
        setError('');
      })
      .catch((requestError: Error) => setError(requestError.message));

    const socket = createRealtimeSocket();
    socket.on('connect', () => {
      setConnected(true);
      setError('');
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => {
      setConnected(false);
      setError('Conexão realtime indisponível.');
    });
    socket.on('status:update', (nextStatus: HortaStatus) => {
      setStatus(nextStatus);
      setError('');
    });
    socket.on('telemetry:update', (telemetry: Telemetry) => {
      setLatestTelemetry(telemetry);
      setStatus((current) =>
        current
          ? { ...current, ...telemetry }
          : ({ ...telemetry, irrigation: { active: false, mode: 'automatic', updatedAt: telemetry.timestamp } } as HortaStatus),
      );
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  return { status, connected, error, latestTelemetry, setStatus, setError };
}