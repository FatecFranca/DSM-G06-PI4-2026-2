import type { Harvest, HarvestCalendarEvent, HortaStatus, Telemetry } from '../types/api';
import * as SecureStore from 'expo-secure-store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
let authToken: string | null = null;
const REQUEST_TIMEOUT_MS = 15000;
const AUTH_TOKEN_KEY = 'horta-auth-token';
let authExpiredHandler: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function restoreAuthToken() {
  authToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  return authToken;
}

export async function saveAuthToken(token: string) {
  authToken = token;
  await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export async function clearAuthToken() {
  authToken = null;
  await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}

export function setAuthExpiredHandler(handler: (() => void) | null) {
  authExpiredHandler = handler;
}

export async function requestApi<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  if (!API_URL) {
    throw new Error(
      'API não configurada. Defina EXPO_PUBLIC_API_URL no app/mobile/.env e reinicie o Expo.',
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...options?.headers,
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) {
        await clearAuthToken();
        authExpiredHandler?.();
      }
      throw new Error(body?.error || `A API respondeu com erro (${response.status}).`);
    }
    return body as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      (error instanceof Error && error.name === 'AbortError') ||
      errorMessage.includes('canceled') ||
      errorMessage.includes('cancelled')
    ) {
      throw new Error(
        `Não foi possível concluir a conexão com a API em ${REQUEST_TIMEOUT_MS / 1000}s (${API_URL}). Abra ${API_URL}/health no navegador do celular. Se não abrir, conecte o celular à mesma rede Wi-Fi, desative VPN/dados móveis e permita a porta 3000 no Firewall do Windows.`,
      );
    }
    if (error instanceof TypeError) {
      throw new Error(
        `Não foi possível alcançar a API em ${API_URL}. No celular, não use localhost: use o IP da máquina ou o endereço da VM Azure.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const getStatus = () => requestApi<HortaStatus>('/status');

export const login = (email: string, password: string) =>
  requestApi<{ token: string; user: { id: string; fullName: string; roles: string[] } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export type MobileUser = {
  id: string;
  fullName: string;
  email: string;
  cpf?: string;
  phone: string;
  birthDate: string;
  address: string;
  emergencyContact: string;
  roles: string[];
  status: string;
  residentProfile?: {
    householdSize?: number;
    neighborhood?: string;
    foodPreferences?: string;
    communityNeeds?: string;
  };
};

export const getCurrentUser = () =>
  requestApi<{ user: MobileUser; permissions: string[] }>('/auth/me');

export const updateCurrentUser = (data: Partial<Pick<
  MobileUser,
  'fullName' | 'email' | 'cpf' | 'phone' | 'birthDate' | 'address' | 'emergencyContact'
>>) =>
  requestApi<{ user: MobileUser; permissions: string[] }>('/auth/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const changePassword = (currentPassword: string, password: string) =>
  requestApi<{ message: string; sessionInvalidated: boolean }>('/auth/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, password }),
  });

export const register = (data: Record<string, unknown>) =>
  requestApi<{ message: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const requestPasswordRecovery = (email: string) =>
  requestApi<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const getTelemetryHistory = () =>
  requestApi<Telemetry[]>('/telemetry/history');

export const getHarvests = () => requestApi<Harvest[]>('/harvest');

export const getHarvestCalendar = (from: string, to: string) =>
  requestApi<{ events: HarvestCalendarEvent[] }>(`/harvest/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

export const getMyReservations = () => requestApi<Harvest[]>('/harvest/mine');

export const setIrrigation = (action: 'on' | 'off' | 'auto') =>
  requestApi<{ irrigation: HortaStatus['irrigation'] }>('/irrigation', {
    method: 'POST',
    body: JSON.stringify({ action }),
  });

export const reserveHarvest = (id: string, quantity = 1) =>
  requestApi<Harvest>(`/harvest/${id}/reserve`, {
    method: 'PUT',
    body: JSON.stringify({ quantity }),
  });

export const cancelReservation = (id: string) =>
  requestApi<Harvest>(`/harvest/${id}/cancel-reservation`, {
    method: 'PUT',
  });
