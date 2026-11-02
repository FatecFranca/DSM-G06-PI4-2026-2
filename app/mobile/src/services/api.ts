import type { Harvest, HortaStatus, Telemetry } from '../types/api';

export const API_URL = process.env.EXPO_PUBLIC_API_URL;
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function requestApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || 'Não foi possível comunicar com a API.');
  }
  return body as T;
}

export const getStatus = () => requestApi<HortaStatus>('/status');

export const login = (email: string, password: string) =>
  requestApi<{ token: string; user: { id: string; fullName: string; roles: string[] } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const register = (data: Record<string, string>) =>
  requestApi<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getTelemetryHistory = () =>
  requestApi<Telemetry[]>('/telemetry/history');

export const getHarvests = () => requestApi<Harvest[]>('/harvest');

export const setIrrigation = (action: 'on' | 'off' | 'auto') =>
  requestApi<{ irrigation: HortaStatus['irrigation'] }>('/irrigation', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });

export const reserveHarvest = (id: string) =>
  requestApi<Harvest>(`/harvest/${id}/reserve`, {
    method: 'PUT',
    body: JSON.stringify({ reservedBy: 'Morador' }),
  });
