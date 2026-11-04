import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Droplets,
  History,
  LayoutDashboard,
  Leaf,
  Play,
  Plus,
  Sprout,
  Square,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { io } from 'socket.io-client';
import './App.css';

type Harvest = {
  id?: string;
  crop: string;
  category?: string;
  status?: string;
  harvestDate: string;
  quantity: number;
  availableQuantity?: number;
  reservedQuantity?: number;
  deliveredQuantity?: number;
  unit?: string;
  available: boolean;
  reservedBy?: string;
  reservedAt?: string;
  reservationId?: string;
  reservationQuantity?: number;
  plantingDate?: string;
  notes?: string;
};
type AdminReservation = {
  _id: string;
  quantity: number;
  status: 'active' | 'cancelled' | 'expired' | 'delivered';
  reservedAt: string;
  harvestCode: string;
  harvestId?: { id?: string; crop?: string; harvestDate?: string; unit?: string };
  userId?: { fullName?: string; email?: string };
};
type HarvestMetrics = {
  harvests: number;
  produced: number;
  available: number;
  reserved: number;
  delivered: number;
};
type HarvestCalendarEvent = {
  harvestId: string;
  crop: string;
  type: 'planting' | 'harvest';
  date: string;
  status?: string;
  quantity: number;
  unit?: string;
};
type AuditEntry = {
  _id: string;
  actorUserId: string;
  targetUserId: string;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
};

type Telemetry = {
  soilMoisture: number;
  temperature: number;
  humidity: number;
  timestamp: string;
  irrigationOn?: boolean;
  mode?: 'manual' | 'automatic';
};

type Status = Telemetry & {
  irrigation: {
    active: boolean;
    mode: string;
    updatedAt: string;
  };
};

type AnalyticsMetric = {
  average: number;
  median: number;
  minimum: number;
  maximum: number;
  standardDeviation: number;
};
type AnalyticsSummary = {
  range: '24h' | '7d' | '30d';
  from: string;
  to: string;
  samples: number;
  sampling: { configuredIntervalMs: number; averageIntervalMs: number | null };
  metrics: {
    soilMoisture: AnalyticsMetric | null;
    temperature: AnalyticsMetric | null;
    humidity: AnalyticsMetric | null;
  };
  series: Array<Telemetry & { irrigationOn?: boolean }>;
  health: number | null;
  criticalMinutes: number;
  irrigation: { cycles: number; activeMinutes: number };
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
type User = {
  id: string;
  fullName: string;
  email: string;
  cpf?: string;
  roles: string[];
  status: string;
  phone?: string;
  birthDate?: string;
  address?: string;
  emergencyContact?: string;
  collaboratorProfile?: {
    employeeId?: string;
    department?: string;
    startDate?: string;
    skills?: string[];
    availability?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};
type AuthSession = { token: string; user: User; permissions: string[] };
type ApiError = Error & { code?: string };
type UserStats = {
  total: number;
  statuses: Record<string, number>;
  roles: Record<string, number>;
};

function toApiDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function requestApi<T>(
  path: string,
  options?: RequestInit,
  token?: string,
): Promise<T> {
  const storedToken = token || (() => {
    try {
      return (JSON.parse(localStorage.getItem('horta-session') || 'null') as AuthSession | null)?.token;
    } catch {
      return undefined;
    }

  })();
  const requestOptions = storedToken && !token
    ? {
        ...options,
        headers: {
          ...options?.headers,
          Authorization: `Bearer ${storedToken}`,
        },
      }
    : options;
  const response = await fetch(`${API_URL}${path}`, {
    ...requestOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...requestOptions?.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      body?.error || 'Não foi possível comunicar com a API.',
    ) as ApiError;
    error.code = body?.code;
    throw error;
  }
  return body as T;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function roleLabel(role: string) {
  return {
    resident: 'Morador',
    volunteer: 'Voluntário',
    collaborator: 'Colaborador',
    admin: 'Administrador',
  }[role] || role;
}

function userStatusLabel(status: string) {
  return {
    pending: 'Pendente',
    active: 'Ativo',
    rejected: 'Rejeitado',
    suspended: 'Suspenso',
  }[status] || status;
}

const navigationItems = [
  { label: 'Visão geral', Icon: LayoutDashboard },
  { label: 'Analítico', Icon: LayoutDashboard, permission: 'view_telemetry' },
  { label: 'Irrigação', Icon: Droplets },
  { label: 'Colheitas', Icon: Sprout },
  { label: 'Minhas reservas', Icon: Sprout, permission: 'view_harvests' },
  { label: 'Histórico', Icon: History },
  { label: 'Usuários', Icon: Users, permission: 'view_users' },
  { label: 'Auditoria', Icon: History, permission: 'view_users' },
  { label: 'Meu perfil', Icon: Users },
];

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      return JSON.parse(localStorage.getItem('horta-session') || 'null');
    } catch {
      return null;
    }
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('token') || '');
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirmation, setResetPasswordConfirmation] = useState('');
  const [registrationPending, setRegistrationPending] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [registrationForm, setRegistrationForm] = useState({
    fullName: '',
    email: '',
    cpf: '',
    requestedRole: 'resident',
    password: '',
    confirmPassword: '',
    phone: '',
    birthDate: '',
    address: '',
    emergencyContact: '',
  });
  const [activeSection, setActiveSection] = useState('Visão geral');
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [harvests, setHarvests] = useState<Harvest[]>([]);
  const [myReservations, setMyReservations] = useState<Harvest[]>([]);
  const [adminReservations, setAdminReservations] = useState<AdminReservation[]>([]);
  const [harvestMetrics, setHarvestMetrics] = useState<HarvestMetrics | null>(null);
  const [harvestAdminTab, setHarvestAdminTab] = useState<'production' | 'reservations'>('production');
  const [reservationView, setReservationView] = useState<'active' | 'history'>('active');
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [calendarEvents, setCalendarEvents] = useState<HarvestCalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [harvestFilter, setHarvestFilter] = useState<'all' | 'available'>(
    'all',
  );
  const [historyRange, setHistoryRange] = useState('24');
  const [analyticsRange, setAnalyticsRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState('');
  const [requestErrorIsConnection, setRequestErrorIsConnection] = useState(false);
  const [irrigationPending, setIrrigationPending] = useState(false);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [reservationQuantities, setReservationQuantities] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [harvestFormError, setHarvestFormError] = useState('');
  const [editingHarvest, setEditingHarvest] = useState<Harvest | null>(null);
  const [newCrop, setNewCrop] = useState('');
  const [newCategory, setNewCategory] = useState('other');
  const [newDate, setNewDate] = useState('');
  const [newPlantingDate, setNewPlantingDate] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('unidade');
  const [newStatus, setNewStatus] = useState('available');
  const [newNotes, setNewNotes] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserForm, setEditingUserForm] = useState({
    fullName: '',
    email: '',
    cpf: '',
    phone: '',
    birthDate: '',
    address: '',
    emergencyContact: '',
    roles: [] as string[],
  });
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
    cpf: '',
    phone: '',
    birthDate: '',
    address: '',
    emergencyContact: '',
    currentPassword: '',
    password: '',
  });
  const [profileMessage, setProfileMessage] = useState('');
  const [profileMessageType, setProfileMessageType] = useState<'error' | 'success'>('error');
  const irrigationOn = status?.irrigation.active ?? false;
  const latestTelemetry = status;
  const rangeHours = Number(historyRange);
  const chartHistory = [...history]
    .reverse()
    .filter(
      (item) =>
        currentTime - new Date(item.timestamp).getTime() <=
        rangeHours * 60 * 60 * 1000,
    )
    .slice(-24);
  const chartData = chartHistory.map((item) => ({
    ...item,
    label: new Date(item.timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  }));
  const canManageHarvests = Boolean(session?.permissions.includes('manage_harvests'));
  const canManageReservations = Boolean(session?.permissions.includes('manage_reservations'));
  const visibleAdminReservations = adminReservations.filter((reservation) =>
    reservationView === 'active' ? reservation.status === 'active' : reservation.status !== 'active',
  );
  const filteredHarvests = harvests.filter(
    (harvest) => {
      if (canManageHarvests) return true;
      const alreadyReserved = myReservations.some((reservation) => reservation.id === harvest.id);
      return !alreadyReserved && (harvestFilter === 'all' || harvest.available);
    },
  );
  const apiOnline = Boolean(status) && !requestError;
  const canManageUsers = Boolean(session?.permissions.includes('view_users'));
  const visibleNavigationItems = navigationItems.filter(
    (item) => !item.permission || session?.permissions.includes(item.permission),
  );
  const statusLabel = useMemo(() => {
    if (status?.irrigation.mode === 'manual') {
      return irrigationOn
        ? 'Irrigação manual ativa'
        : 'Irrigação manual desligada';
    }
    return 'Operação automática ativa';
  }, [irrigationOn, status?.irrigation.mode]);

  async function loadDashboard() {
    try {
      const [nextStatus, nextHistory, nextHarvests, nextReservations, nextAdminReservations, nextHarvestMetrics] = await Promise.all([
        requestApi<Status>('/status', undefined, session?.token),
        requestApi<Telemetry[]>('/telemetry/history', undefined, session?.token),
        requestApi<Harvest[]>('/harvest', undefined, session?.token),
        requestApi<Harvest[]>('/harvest/mine', undefined, session?.token),
        canManageReservations
          ? requestApi<{ reservations: AdminReservation[] }>('/reservations?status=all', undefined, session?.token)
          : Promise.resolve({ reservations: [] }),
        canManageHarvests
          ? requestApi<{ totals: HarvestMetrics }>('/harvest/dashboard', undefined, session?.token)
          : Promise.resolve({ totals: null }),
      ]);
      setStatus(nextStatus);
      setHistory(nextHistory);
      setHarvests(nextHarvests);
      setMyReservations(nextReservations);
      setAdminReservations(nextAdminReservations.reservations);
      setHarvestMetrics(nextHarvestMetrics.totals);
      setLastSyncedAt(new Date().toISOString());
      setCurrentTime(Date.now());
      setRequestError('');
      setRequestErrorIsConnection(false);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'API indisponível.',
      );
      setRequestErrorIsConnection(true);
    } finally {
      setLoading(false);
    }

  }

  async function loadAnalytics() {
    if (!session?.token) return;
    setAnalyticsLoading(true);
    try {
      const nextAnalytics = await requestApi<AnalyticsSummary>(
        `/analytics/summary?range=${analyticsRange}`,
        undefined,
        session.token,
      );
      setAnalytics(nextAnalytics);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Falha ao carregar o painel analítico.');
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function loadCalendar() {
    if (!session?.token) return;
    const from = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const to = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    setCalendarLoading(true);
    try {
      const result = await requestApi<{ events: HarvestCalendarEvent[] }>(
        `/harvest/calendar?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
        undefined,
        session.token,
      );
      setCalendarEvents(result.events);
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Falha ao carregar o calendário.');
    } finally {
      setCalendarLoading(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      setLoginPending(true);
      setLoginError('');
      try {
        const result = await requestApi<{ token: string; user: User }>(
          '/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({ email: loginEmail, password: loginPassword }),
          },
        );
        const nextSession: AuthSession = {
          token: result.token,
          user: result.user,
          permissions: [],
        };
        const current = await requestApi<{ user: User; permissions: string[] }>(
          '/auth/me',
          { headers: { Authorization: `Bearer ${result.token}` } },
        );
        nextSession.user = current.user;
        nextSession.permissions = current.permissions;
        setSession(nextSession);
        localStorage.setItem('horta-session', JSON.stringify(nextSession));
        setActiveSection('Visão geral');
        setLoginPassword('');
      } catch (error) {
        setLoginError(error instanceof Error ? error.message : 'Falha no login.');
      } finally {
        setLoginPending(false);
      }

  }

  async function requestPasswordRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await requestApi<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: loginEmail }),
      });
      setLoginError(result.message);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Falha ao solicitar recuperação.');
    }
  }

  async function resetPasswordRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError('');
    try {
      const result = await requestApi<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: resetToken,
          password: resetPassword,
          confirmPassword: resetPasswordConfirmation,
        }),
      });
      setLoginError(result.message);
      setResetPassword('');
      setResetPasswordConfirmation('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Falha ao redefinir senha.');
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setRegistrationPending(true);
        setRegistrationError('');
        setRegistrationMessage('');
        try {
          await requestApi('/auth/register', {
            method: 'POST',
            body: JSON.stringify(registrationForm),
          });
          setRegistrationMessage(
            'Cadastro enviado com sucesso. Aguarde a aprovação do administrador para entrar no sistema.',
          );
          setRegistrationForm({
            fullName: '',
            email: '',
            cpf: '',
            requestedRole: 'resident',
            password: '',
            confirmPassword: '',
            phone: '',
            birthDate: '',
            address: '',
            emergencyContact: '',
          });
        } catch (error) {
          setRegistrationError(
            error instanceof Error ? error.message : 'Não foi possível enviar o cadastro.',
          );
        } finally {
          setRegistrationPending(false);
      }
  }

  function logout() {
      localStorage.removeItem('horta-session');
      setSession(null);
      setStatus(null);
      setHistory([]);
      setHarvests([]);
      setMyReservations([]);
  }

  function openProfile() {
    if (!session) return;
    setProfileForm({
      fullName: session.user.fullName,
      email: session.user.email,
      cpf: session.user.cpf || '',
      phone: session.user.phone || '',
      birthDate: session.user.birthDate?.slice(0, 10) || '',
      address: session.user.address || '',
      emergencyContact: session.user.emergencyContact || '',
      currentPassword: '',
      password: '',
    });
    setProfileMessage('');
    setActiveSection('Meu perfil');
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setProfileMessage('');
    setProfileMessageType('error');
    if (profileForm.password && !profileForm.currentPassword) {
      setProfileMessage('Informe a senha atual para definir uma nova senha.');
      return;
    }
    if (profileForm.password && profileForm.password.length < 12) {
      setProfileMessage(
        `A nova senha deve ter pelo menos 12 caracteres; a informada tem ${profileForm.password.length}.`,
      );
      return;
    }
    try {
      const result = await requestApi<{ user: User; permissions: string[] }>(
        '/auth/me/profile',
        {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: profileForm.fullName,
            email: profileForm.email,
            cpf: profileForm.cpf,
            phone: profileForm.phone,
            birthDate: profileForm.birthDate,
            address: profileForm.address,
            emergencyContact: profileForm.emergencyContact,
          }),
        },
        session.token,
      );
      const nextSession = { ...session, user: result.user, permissions: result.permissions };
      setSession(nextSession);
      localStorage.setItem('horta-session', JSON.stringify(nextSession));
      if (profileForm.password) {
        await requestApi<{ sessionInvalidated: boolean }>('/auth/me/password', {
          method: 'PATCH',
          body: JSON.stringify({
            currentPassword: profileForm.currentPassword,
            password: profileForm.password,
          }),
        }, session.token);
        logout();
        return;
      }
      setProfileForm((current) => ({ ...current, currentPassword: '', password: '' }));
      setProfileMessageType('success');
      setProfileMessage('Perfil atualizado com sucesso.');
    } catch (error) {
      setProfileMessageType('error');
      const apiError = error as ApiError;
      setProfileMessage(
        apiError.code === 'CURRENT_PASSWORD_INVALID'
          ? 'Senha atual inválida. Digite a senha que está sendo usada atualmente para entrar no sistema.'
          : apiError.message || 'Falha ao atualizar perfil.',
      );
    }
  }

  async function loadUsers() {
    if (!session?.token || !canManageUsers) return;
    setUsersLoading(true);
    setUsersError('');
    try {
      const params = new URLSearchParams();
      if (userStatusFilter !== 'all') params.set('status', userStatusFilter);
      if (userRoleFilter !== 'all') params.set('role', userRoleFilter);
      const query = params.toString();
      const result = await requestApi<{ users: User[] }>(
        `/users${query ? `?${query}` : ''}`,
        undefined,
        session.token,
      );
      setUsers(result.users);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Falha ao carregar usuários.');
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadUserStats(token = session?.token) {
    if (!token || !canManageUsers) return;
    try {
      setUserStats(await requestApi<UserStats>('/users/stats', undefined, token));
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Falha ao carregar indicadores.');
    }

  }

  async function loadAuditLogs() {
    if (!session?.token || !canManageUsers) return;
    try {
      const result = await requestApi<{ logs: AuditEntry[] }>('/users/audit?limit=100', undefined, session.token);
      setAuditLogs(result.logs);
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Falha ao carregar auditoria.');
    }
  }

  async function updateUser(
    id: string,
    path: string,
    body: Record<string, unknown>,
  ) {
    if (!session?.token) return;
    try {
      const result = await requestApi<{ user: User; token?: string; permissions?: string[] }>(`/users/${id}/${path}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }, session.token);
      setUsers((current) => current.map((user) => user.id === id ? result.user : user));
      if (id === session.user.id) {
        const nextSession = {
          ...session,
          token: result.token || session.token,
          user: result.user,
          permissions: result.permissions || session.permissions,
        };
        setSession(nextSession);
        localStorage.setItem('horta-session', JSON.stringify(nextSession));
        setProfileForm((current) => ({
          ...current,
          fullName: result.user.fullName,
          email: result.user.email,
          cpf: result.user.cpf || '',
          phone: result.user.phone || '',
          birthDate: result.user.birthDate?.slice(0, 10) || '',
          address: result.user.address || '',
          emergencyContact: result.user.emergencyContact || '',
        }));
      }
      await loadUserStats(result.token);
      setUsersError('');
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Falha ao atualizar usuário.');
    }
  }

  function startEditingUser(user: User) {
    setEditingUserId(user.id);
    setEditingUserForm({
      fullName: user.fullName,
      email: user.email,
      cpf: user.cpf || '',
      phone: user.phone || '',
      birthDate: user.birthDate?.slice(0, 10) || '',
      address: user.address || '',
      emergencyContact: user.emergencyContact || '',
      roles: [...user.roles],
    });
  }

  async function saveAdminUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.token || !editingUserId) return;
    try {
      const profile = await requestApi<{ user: User }>(`/users/${editingUserId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editingUserForm.fullName,
          email: editingUserForm.email,
          cpf: editingUserForm.cpf,
          phone: editingUserForm.phone,
          birthDate: editingUserForm.birthDate,
          address: editingUserForm.address,
          emergencyContact: editingUserForm.emergencyContact,
        }),
      }, session.token);
      const roles = await requestApi<{ user: User; token?: string; permissions?: string[] }>(`/users/${editingUserId}/roles`, {
        method: 'PATCH',
        body: JSON.stringify({ roles: editingUserForm.roles }),
      }, session.token);
      setUsers((current) =>
        current.map((user) => user.id === editingUserId ? { ...profile.user, ...roles.user } : user),
      );
      if (editingUserId === session.user.id) {
        const nextSession = {
          ...session,
          token: roles.token || session.token,
          user: roles.user,
          permissions: roles.permissions || session.permissions,
        };
        setSession(nextSession);
        localStorage.setItem('horta-session', JSON.stringify(nextSession));
        setProfileForm((current) => ({
          ...current,
          fullName: roles.user.fullName,
          email: roles.user.email,
          cpf: roles.user.cpf || '',
          phone: roles.user.phone || '',
          birthDate: roles.user.birthDate?.slice(0, 10) || '',
          address: roles.user.address || '',
          emergencyContact: roles.user.emergencyContact || '',
        }));
      }
      setEditingUserId(null);
      await loadUserStats(roles.token);
      setUsersError('');
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Falha ao salvar usuário.');
    }
  }

  async function deleteUser(user: User) {
    if (!session?.token || !window.confirm(`Excluir o usuário ${user.fullName}? Esta ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await requestApi<void>(`/users/${user.id}`, { method: 'DELETE' }, session.token);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      await loadUserStats();
      setUsersError('');
    } catch (error) {
      setUsersError(error instanceof Error ? error.message : 'Falha ao excluir usuário.');
    }
  }

  useEffect(() => {
    if (!session) return;
    const initialLoadTimer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);
    const socket = io(API_URL, { transports: ['websocket', 'polling'] });
    const handleStatusUpdate = (nextStatus: Status) => {
      setStatus(nextStatus);
      setLastSyncedAt(new Date().toISOString());
      setCurrentTime(Date.now());
      setRequestError('');
    };
    const handleTelemetryUpdate = (telemetry: Telemetry) => {
      setHistory((current) => {
        const withoutDuplicate = current.filter(
          (item) => item.timestamp !== telemetry.timestamp,
        );
        return [telemetry, ...withoutDuplicate].slice(0, 100);
      });
    };
    const handleHarvestUpdate = (nextHarvest: Harvest) => {
      if (!nextHarvest.id) return;
      setHarvests((current) => {
        const exists = current.some((item) => item.id === nextHarvest.id);
        return exists
          ? current.map((item) => item.id === nextHarvest.id ? { ...item, ...nextHarvest } : item)
          : [...current, nextHarvest];
      });
    };
    const handleReservationUpdate = () => {
      void loadDashboard();
    };
    socket.on('connect', () => {
      setSocketConnected(true);
      setRequestError('');
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('connect_error', () => {
      setSocketConnected(false);
      setRequestError('Conexão realtime indisponível.');
    });
    socket.on('status:update', handleStatusUpdate);
    socket.on('telemetry:update', handleTelemetryUpdate);
    socket.on('harvest:created', handleHarvestUpdate);
    socket.on('harvest:updated', handleHarvestUpdate);
    socket.on('harvest:statusChanged', handleHarvestUpdate);
    socket.on('reservation:created', handleReservationUpdate);
    socket.on('reservation:cancelled', handleReservationUpdate);
    return () => {
      window.clearTimeout(initialLoadTimer);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [session]);

  useEffect(() => {
    void loadCalendar();
  }, [calendarMonth, session]);

  useEffect(() => {
    if (!session?.token) return;
    let cancelled = false;
    void requestApi<{ user: User; permissions: string[] }>(
      '/auth/me',
      undefined,
      session.token,
    )
      .then((current) => {
        if (cancelled) return;
        const rolesChanged =
          JSON.stringify(current.user.roles) !== JSON.stringify(session.user.roles);
        const permissionsChanged =
          JSON.stringify(current.permissions) !== JSON.stringify(session.permissions);
        if (rolesChanged || permissionsChanged || current.user.updatedAt !== session.user.updatedAt) {
          const nextSession = {
            ...session,
            user: current.user,
            permissions: current.permissions,
          };
          setSession(nextSession);
          localStorage.setItem('horta-session', JSON.stringify(nextSession));
        }
      })
      .catch((error) => {
        if (!cancelled && error instanceof Error && error.message === 'Sessão inválida.') {
          logout();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  useEffect(() => {
    if (activeSection === 'Usuários' && !canManageUsers) {
      setActiveSection('Visão geral');
      return;
    }
    if (activeSection === 'Usuários') {
      void loadUsers();
      void loadUserStats();
    }
    if (activeSection === 'Auditoria') void loadAuditLogs();
    if (activeSection === 'Analítico') void loadAnalytics();
  }, [activeSection, canManageUsers, session, userStatusFilter, userRoleFilter, analyticsRange]);

  if (!session) {
    return (
      <div className="auth-shell">
        <form className="auth-card" onSubmit={showForgotPassword ? (resetToken ? resetPasswordRequest : requestPasswordRecovery) : showRegistration ? register : login}>
          <div className="brand">
            <span className="brand-mark"><Leaf size={18} strokeWidth={2.2} /></span>
            <span>Horta<br /><strong>Comunitária</strong></span>
          </div>
          <p className="eyebrow">ACESSO AO SISTEMA</p>
          <h1>{showRegistration ? 'Criar cadastro' : showForgotPassword ? resetToken ? 'Redefinir senha' : 'Recuperar senha' : 'Entrar'}</h1>
          <p className="subheading">
            {showRegistration
              ? 'Informe seus dados e crie sua senha privada. O acesso será liberado após a aprovação do administrador.'
              : showForgotPassword
              ? 'Solicite um link de recuperação. O envio por e-mail é opcional neste ambiente.'
              : 'Use uma conta aprovada para acessar a horta.'}
          </p>
          {!showRegistration && loginError && <div className="profile-message success" role="status">{loginError}</div>}
          {showRegistration && registrationError && <div className="api-error" role="alert">{registrationError}</div>}
          {showRegistration && registrationMessage && <div className="profile-message success" role="status">{registrationMessage}</div>}
          {showRegistration ? (
            <>
              <label>Nome completo<input value={registrationForm.fullName} onChange={(event) => setRegistrationForm({ ...registrationForm, fullName: event.target.value })} required /></label>
              <label>E-mail<input type="email" value={registrationForm.email} onChange={(event) => setRegistrationForm({ ...registrationForm, email: event.target.value })} required /></label>
              <label>CPF<input value={registrationForm.cpf} onChange={(event) => setRegistrationForm({ ...registrationForm, cpf: event.target.value })} required /></label>
              <label>Tipo de usuário
                <select value={registrationForm.requestedRole} onChange={(event) => setRegistrationForm({ ...registrationForm, requestedRole: event.target.value })}>
                  <option value="resident">Morador</option>
                  <option value="volunteer">Voluntário</option>
                  <option value="collaborator">Colaborador</option>
                </select>
              </label>
              <label>
                Senha privada
                <input type="password" minLength={12} value={registrationForm.password} onChange={(event) => setRegistrationForm({ ...registrationForm, password: event.target.value })} autoComplete="new-password" required />
                <small className="field-help">Mínimo de 12 caracteres. Esta senha será conhecida somente por você.</small>
              </label>
              <label>Confirmar senha<input type="password" minLength={12} value={registrationForm.confirmPassword} onChange={(event) => setRegistrationForm({ ...registrationForm, confirmPassword: event.target.value })} autoComplete="new-password" required /></label>
              <label>Telefone<input value={registrationForm.phone} onChange={(event) => setRegistrationForm({ ...registrationForm, phone: event.target.value })} required /></label>
              <label>Data de nascimento<input type="date" value={registrationForm.birthDate} onChange={(event) => setRegistrationForm({ ...registrationForm, birthDate: event.target.value })} required /></label>
              <label>Endereço<input value={registrationForm.address} onChange={(event) => setRegistrationForm({ ...registrationForm, address: event.target.value })} required /></label>
              <label>Contato de emergência<input value={registrationForm.emergencyContact} onChange={(event) => setRegistrationForm({ ...registrationForm, emergencyContact: event.target.value })} required /></label>
            </>
          ) : showForgotPassword ? (
            resetToken ? (
              <>
                <label>Nova senha<input type="password" minLength={12} value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} required /></label>
                <label>Confirmar nova senha<input type="password" minLength={12} value={resetPasswordConfirmation} onChange={(event) => setResetPasswordConfirmation(event.target.value)} required /></label>
              </>
            ) : (
              <label>E-mail<input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required /></label>
            )
          ) : (
            <>
              <label>E-mail<input type="email" value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} required /></label>
              <label>Senha<input type="password" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} required /></label>
            </>
          )}
          <button className="primary-button" type="submit" disabled={loginPending || registrationPending}>
            {showRegistration
              ? registrationPending ? 'Enviando cadastro...' : 'Enviar cadastro'
              : showForgotPassword
              ? resetToken ? 'Redefinir senha' : 'Enviar link de recuperação'
              : loginPending ? 'Entrando...' : 'Entrar'}
          </button>
          {!showForgotPassword && <button
            className="text-button auth-switch"
            type="button"
            onClick={() => {
              setShowRegistration(!showRegistration);
              setShowForgotPassword(false);
              setLoginError('');
              setRegistrationError('');
              setRegistrationMessage('');
            }}
          >
            {showRegistration ? 'Já tenho uma conta: entrar' : 'Ainda não tenho conta: criar cadastro'}
          </button>}
          {!showRegistration && !showForgotPassword && (
            <button className="text-button auth-switch" type="button" onClick={() => { setShowForgotPassword(true); setLoginError(''); }}>
              Esqueci minha senha
            </button>
          )}
          {showForgotPassword && (
            <button className="text-button auth-switch" type="button" onClick={() => { setShowForgotPassword(false); setLoginError(''); }}>
              Voltar para entrar
            </button>
          )}
        </form>
      </div>
    );
  }

  async function toggleIrrigation() {
    setIrrigationPending(true);
    try {
      const nextStatus = await requestApi<{ irrigation: Status['irrigation'] }>(
        '/irrigation',
        {
          method: 'POST',
          body: JSON.stringify({ action: irrigationOn ? 'off' : 'on' }),
        },
      );
      setStatus((current) =>
        current ? { ...current, irrigation: nextStatus.irrigation } : current,
      );
      setRequestError('');
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : 'Falha ao controlar irrigação.',
      );
    } finally {
      setIrrigationPending(false);
    }
  }

  async function resumeAutomatic() {
    setIrrigationPending(true);
    try {
      const nextStatus = await requestApi<{ irrigation: Status['irrigation'] }>(
        '/irrigation',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'auto' }),
        },
      );
      setStatus((current) =>
        current ? { ...current, irrigation: nextStatus.irrigation } : current,
      );
      setRequestError('');
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Falha ao retomar automático.',
      );
    } finally {
      setIrrigationPending(false);
    }
  }

  async function reserveHarvest(harvest: Harvest) {
    if (!harvest.id || !harvest.available) return;
    const quantity = Number(reservationQuantities[harvest.id] || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setRequestError('Informe uma quantidade inteira maior que zero.');
      return;
    }
    setReservingId(harvest.id);
    try {
      const reserved = await requestApi<Harvest>(
        `/harvest/${harvest.id}/reserve`,
        {
          method: 'PUT',
          body: JSON.stringify({ quantity }),
        },
      );
      setHarvests((current) =>
        current.map((item) => (item.id === reserved.id ? reserved : item)),
      );
      setMyReservations((current) => [...current, reserved]);
      setRequestError('');
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : 'Falha ao reservar colheita.',
      );
    } finally {
      setReservingId(null);
    }
  }

  async function cancelReservation(harvest: Harvest) {
    if (!harvest.id) return;
    try {
      await requestApi<Harvest>(`/harvest/${harvest.id}/cancel-reservation`, {
        method: 'PUT',
      });
      setMyReservations((current) => current.filter((item) => item.id !== harvest.id));
      setHarvests((current) =>
        current.map((item) =>
          item.id === harvest.id ? { ...item, available: true, reservedBy: undefined, reservedAt: undefined } : item,
        ),
      );
      setRequestError('');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Falha ao cancelar reserva.');
    }
  }

  async function addHarvest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const crop = String(formData.get('crop') || '').trim();
    if (!crop || !newDate || !newQuantity) {
      setHarvestFormError('Preencha cultura, data de colheita e quantidade.');
      return;
    }
    const harvestDate = toApiDate(newDate);
    const plantingDate = newPlantingDate ? toApiDate(newPlantingDate) : null;
    if (!harvestDate) {
      setHarvestFormError('Informe uma data de colheita válida.');
      return;
    }
    if (newPlantingDate && !plantingDate) {
      setHarvestFormError('Informe uma data de plantio válida.');
      return;
    }
    if (plantingDate && new Date(plantingDate) > new Date(harvestDate)) {
      setHarvestFormError('A data do plantio não pode ser posterior à data prevista da colheita.');
      return;
    }
    try {
      const payload = {
        crop,
        category: newCategory,
        harvestDate,
        plantingDate: plantingDate || undefined,
        quantity: Number(newQuantity),
        unit: newUnit,
        status: newStatus,
        notes: newNotes || undefined,
      };
      await requestApi<Harvest>(editingHarvest?.id ? `/harvest/${editingHarvest.id}` : '/harvest', {
        method: editingHarvest?.id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      await loadDashboard();
      setEditingHarvest(null);
      setNewCrop('');
      setNewCategory('other');
      setNewDate('');
      setNewPlantingDate('');
      setNewQuantity('');
      setNewUnit('unidade');
      setNewStatus('available');
      setNewNotes('');
      setShowForm(false);
      setHarvestFormError('');
      setRequestError('');
      setRequestErrorIsConnection(false);
    } catch (error) {
      setHarvestFormError(
        error instanceof Error ? error.message : 'Falha ao criar colheita.',
      );
    }
  }

  function openHarvestForm(harvest?: Harvest) {
      setEditingHarvest(harvest || null);
      setNewCrop(harvest?.crop || '');
      setNewCategory(harvest?.category || 'other');
      setNewDate(harvest ? new Date(harvest.harvestDate).toISOString().slice(0, 16) : '');
      setNewPlantingDate(harvest?.plantingDate ? new Date(harvest.plantingDate).toISOString().slice(0, 16) : '');
      setNewQuantity(harvest ? String(harvest.quantity) : '');
      setNewUnit(harvest?.unit || 'unidade');
      setNewStatus(harvest?.status || 'available');
      setNewNotes(harvest?.notes || '');
      setHarvestFormError('');
      setShowForm(true);
    }

  async function deleteHarvest(harvest: Harvest) {
      if (!harvest.id || !window.confirm(`Excluir a colheita de ${harvest.crop}?`)) return;
      try {
        await requestApi(`/harvest/${harvest.id}`, { method: 'DELETE' });
        setHarvests((current) => current.filter((item) => item.id !== harvest.id));
        setRequestError('');
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : 'Falha ao excluir colheita.');
      }
    }

  async function changeHarvestStatus(harvest: Harvest, statusValue: string) {
      if (!harvest.id) return;
      try {
        const updated = await requestApi<Harvest>(`/harvest/${harvest.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: statusValue }),
        });
        setHarvests((current) => current.map((item) => item.id === updated.id ? updated : item));
        setRequestError('');
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : 'Falha ao atualizar status.');
      }
    }

  async function changeReservationStatus(reservation: AdminReservation, statusValue: 'delivered' | 'cancelled') {
    try {
      await requestApi(`/reservations/${reservation._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusValue }),
      });
      await loadDashboard();
      setRequestError('');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Falha ao atualizar reserva.');
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={18} strokeWidth={2.2} />
          </span>
          <span>
            Horta
            <br />
            <strong>Comunitária</strong>
          </span>
        </div>
        <div className="workspace-label">ESPAÇO DE GESTÃO</div>
        <nav aria-label="Navegação principal">
          {visibleNavigationItems.map(({ label, Icon }) => (
              <button
                key={label}
                className={
                  activeSection === label ? 'nav-item active' : 'nav-item'
                }
                onClick={() =>
                  label === 'Meu perfil'
                    ? openProfile()
                    : setActiveSection(label)
                }
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                {label}
              </button>
            ))}
        </nav>
        <div className="sidebar-footer">
          <span
            className={
              apiOnline && socketConnected ? 'online-dot' : 'online-dot offline'
            }
          ></span>
          <div>
            <strong>
              {apiOnline && socketConnected
                ? 'Sistema online'
                : 'Realtime desconectado'}
            </strong>
            <small>
              {lastSyncedAt
                ? `Sincronizado às ${new Date(lastSyncedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Aguardando sincronização'}
            </small>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Horta Norte <span>/</span> <strong>{activeSection}</strong>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notificações">
              <Bell size={17} strokeWidth={1.8} />
              <i></i>
            </button>
            <div className="profile">
              <span className="avatar">{session.user.fullName.slice(0, 2).toUpperCase()}</span>
              <button className="profile-trigger" onClick={openProfile}>
                <div>
                <strong>{session.user.fullName}</strong>
                <small>{session.user.roles.map((role) => roleLabel(role)).join(' · ')}</small>
                </div>
              </button>
              <ChevronDown size={16} className="chevron" />
              <button className="text-button" onClick={logout}>Sair</button>
            </div>
          </div>
        </header>
        <section className="content-wrap">
          {requestError && (
            <div className="api-error" role="alert">
              <strong>{requestErrorIsConnection ? 'API indisponível' : 'Atenção'}</strong>
              <span>{requestError}</span>
              {requestErrorIsConnection && <button onClick={loadDashboard}>Tentar novamente</button>}
            </div>
          )}
          {loading && (
            <div className="loading-state">Carregando dados da horta...</div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {new Intl.DateTimeFormat('pt-BR', {
                  weekday: 'long',
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })
                  .format(new Date())
                  .toUpperCase()}
              </p>
              <h1>
                {activeSection === 'Usuários'
                  ? 'Gestão de usuários'
                  : activeSection === 'Visão geral'
                  ? `Bom dia, ${session.user.fullName.split(' ')[0]}`
                  : activeSection}
                {activeSection === 'Visão geral' && <span>☀</span>}
              </h1>
              <p className="subheading">
                {activeSection === 'Usuários'
                  ? 'Aprove, suspenda usuários e controle os papéis do sistema.'
                  : activeSection === 'Colheitas'
                  ? 'Cadastre, acompanhe e reserve alimentos da horta.'
                  : activeSection === 'Histórico'
                    ? 'Acompanhe a evolução da umidade do solo.'
                    : activeSection === 'Analítico'
                      ? 'Transforme a telemetria histórica em indicadores para decisão.'
                    : activeSection === 'Irrigação'
                      ? 'Controle o sistema e acompanhe o estado atual.'
                      : 'Aqui está o que está acontecendo na horta hoje.'}
              </p>
            </div>
            {canManageHarvests &&
              activeSection !== 'Usuários' &&
              (activeSection === 'Visão geral' ||
                activeSection === 'Colheitas') && (
              <button
                className="primary-button"
                onClick={() => openHarvestForm()}
              >
                <Plus size={16} strokeWidth={2} /> Nova colheita
              </button>
            )}
          </div>
          {activeSection === 'Analítico' ? (
            <section className="analytics-page">
              <div className="analytics-toolbar">
                <div>
                  <h2>Painel analítico</h2>
                  <p>Dados persistidos no MongoDB · atualização sob demanda</p>
                </div>
                <div className="analytics-actions">
                  <select className="select-button" value={analyticsRange} onChange={(event) => setAnalyticsRange(event.target.value as '24h' | '7d' | '30d')} aria-label="Período analítico">
                    <option value="24h">Últimas 24 horas</option>
                    <option value="7d">Últimos 7 dias</option>
                    <option value="30d">Últimos 30 dias</option>
                  </select>
                  <button className="text-button" onClick={() => void loadAnalytics()}>Atualizar</button>
                </div>
              </div>
              {analyticsLoading && <div className="loading-state">Calculando indicadores...</div>}
              {!analyticsLoading && analytics && (
                <>
                  <div className="analytics-kpis">
                    <div className="analytics-kpi"><span>SAÚDE DA HORTA</span><strong>{analytics.health ?? '--'}<small>/100</small></strong><em>{analytics.health === null ? 'Sem dados' : analytics.health >= 80 ? 'Excelente' : analytics.health >= 60 ? 'Boa' : analytics.health >= 40 ? 'Atenção' : 'Crítica'}</em></div>
                    <div className="analytics-kpi"><span>LEITURAS ANALISADAS</span><strong>{analytics.samples}</strong><em>Registros persistidos</em></div>
                    <div className="analytics-kpi"><span>IRRIGAÇÕES</span><strong>{analytics.irrigation.cycles}</strong><em>{analytics.irrigation.activeMinutes} min em funcionamento</em></div>
                    <div className="analytics-kpi"><span>CONDIÇÃO CRÍTICA</span><strong>{Math.floor(analytics.criticalMinutes / 60)}h {analytics.criticalMinutes % 60}min</strong><em>Solo, temperatura ou ar</em></div>
                  </div>
                  <div className="analytics-grid">
                    <section className="panel analytics-chart-panel">
                      <div className="panel-heading"><div><h2>Evolução dos sensores</h2><p>Leituras amostradas no período selecionado</p></div><span className="status-pill healthy">{analytics.samples} registros</span></div>
                      <div className="analytics-chart">
                        <ResponsiveContainer width="100%" height={280}>
                          <LineChart data={analytics.series.map((item) => ({ ...item, label: new Date(item.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }))} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
                            <CartesianGrid stroke="#e8ede7" strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fill: '#aab3ac', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, 100]} tick={{ fill: '#aab3ac', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}${name === 'temperature' ? ' °C' : '%'}`, name === 'soilMoisture' ? 'Solo' : name === 'humidity' ? 'Ar' : 'Temperatura']} contentStyle={{ border: '1px solid #e4e9e2', borderRadius: 8, fontSize: 11 }} />
                            <Line type="monotone" dataKey="soilMoisture" name="soilMoisture" stroke="#3f7a4b" strokeWidth={2.5} dot={false} />
                            <Line type="monotone" dataKey="humidity" name="humidity" stroke="#6b9db2" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="temperature" name="temperature" stroke="#c88952" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="analytics-legend"><span><i className="analytics-dot soil"></i> Umidade do solo</span><span><i className="analytics-dot air"></i> Umidade do ar</span><span><i className="analytics-dot temperature"></i> Temperatura</span></div>
                    </section>
                    <section className="panel analytics-sampling-panel">
                      <div className="panel-heading"><div><h2>Qualidade da coleta</h2><p>Frequência efetiva de persistência</p></div></div>
                      <div className="sampling-value"><strong>{analytics.sampling.averageIntervalMs ? `${Math.round(analytics.sampling.averageIntervalMs / 1000)}s` : '--'}</strong><span>intervalo médio entre leituras</span></div>
                      <div className="sampling-row"><span>Configuração atual</span><strong>{Math.round(analytics.sampling.configuredIntervalMs / 1000)}s</strong></div>
                      <div className="sampling-row"><span>Amostras no período</span><strong>{analytics.samples}</strong></div>
                      <div className="sampling-note">A frequência deve ser calibrada conforme o teste de utilidade dos gráficos e o volume de armazenamento.</div>
                    </section>
                  </div>
                  <section className="panel analytics-table-panel">
                    <div className="panel-heading"><div><h2>Resumo estatístico</h2><p>Média, extremos e dispersão das leituras persistidas</p></div></div>
                    <div className="analytics-table">
                      <div className="analytics-table-head"><span>Indicador</span><span>Média</span><span>Mediana</span><span>Mínimo</span><span>Máximo</span><span>Desvio</span></div>
                      {[
                        ['Umidade do solo', analytics.metrics.soilMoisture, '%'],
                        ['Umidade do ar', analytics.metrics.humidity, '%'],
                        ['Temperatura', analytics.metrics.temperature, '°C'],
                      ].map(([label, metric, unit]) => {
                        const values = metric as AnalyticsMetric | null;
                        return <div className="analytics-table-row" key={label as string}><strong>{label as string}</strong><span>{values ? `${values.average}${unit}` : '--'}</span><span>{values ? `${values.median}${unit}` : '--'}</span><span>{values ? `${values.minimum}${unit}` : '--'}</span><span>{values ? `${values.maximum}${unit}` : '--'}</span><span>{values ? `${values.standardDeviation}${unit}` : '--'}</span></div>;
                      })}
                    </div>
                  </section>
                </>
              )}
              {!analyticsLoading && !analytics && <div className="empty-state">Não foi possível gerar indicadores para este período.</div>}
            </section>
          ) : activeSection === 'Meu perfil' ? (
            <section className="panel profile-panel">
              <div className="panel-heading"><div><h2>Meu perfil</h2><p>Atualize seus dados pessoais e sua senha.</p></div></div>
              {profileMessage && (
                <div
                  className={`profile-message ${
                    profileMessageType
                  }`}
                  role="alert"
                  aria-live="polite"
                >
                  <span>
                    {profileMessage}
                    {profileMessageType === 'error' &&
                      profileForm.password &&
                      !profileMessage.includes('Senha atual inválida') && (
                        <strong className="message-detail">
                          Regra da nova senha: mínimo de 12 caracteres. Não há
                          exigência adicional de maiúsculas, números ou símbolos.
                        </strong>
                      )}
                  </span>
                </div>
              )}
              <form className="profile-form" onSubmit={saveProfile}>
                <label>Nome completo<input value={profileForm.fullName} onChange={(event) => setProfileForm({ ...profileForm, fullName: event.target.value })} required /></label>
                <label>E-mail<input type="email" value={profileForm.email} onChange={(event) => setProfileForm({ ...profileForm, email: event.target.value })} required /></label>
                <label>CPF<input value={profileForm.cpf} onChange={(event) => setProfileForm({ ...profileForm, cpf: event.target.value })} required /></label>
                <label>Telefone<input value={profileForm.phone} onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })} required /></label>
                <label>Data de nascimento<input type="date" value={profileForm.birthDate} onChange={(event) => setProfileForm({ ...profileForm, birthDate: event.target.value })} required /></label>
                <label>Endereço<input value={profileForm.address} onChange={(event) => setProfileForm({ ...profileForm, address: event.target.value })} required /></label>
                <label>Contato de emergência<input value={profileForm.emergencyContact} onChange={(event) => setProfileForm({ ...profileForm, emergencyContact: event.target.value })} required /></label>
                <div className="profile-role-summary"><strong>Papéis</strong><div className="user-badges">{session.user.roles.map((role) => <span className={`role-badge role-${role}`} key={role}>{roleLabel(role)}</span>)}</div></div>
                <h3>Alterar senha (opcional)</h3>
                <label>
                  Senha atual
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        currentPassword: event.target.value,
                      })
                    }
                    autoComplete="current-password"
                  />
                </label>
                <label>
                  Nova senha
                  <input
                    type="password"
                    minLength={12}
                    value={profileForm.password}
                    onChange={(event) =>
                      setProfileForm({
                        ...profileForm,
                        password: event.target.value,
                      })
                    }
                    autoComplete="new-password"
                  />
                  <small className="field-help">
                    Mínimo de 12 caracteres. Informe a senha atual para confirmar
                    a troca.
                  </small>
                </label>
                <button className="primary-button" type="submit">Salvar alterações</button>
              </form>
            </section>
          ) : activeSection === 'Minhas reservas' ? (
            <section className="panel users-panel">
              <div className="panel-heading">
                <div><h2>Minhas reservas</h2><p>Acompanhe e cancele suas reservas de colheitas.</p></div>
                <button className="text-button" onClick={() => void loadDashboard()}>Atualizar</button>
              </div>
                <div className="harvest-list">
                {myReservations.map((harvest) => (
                  <div className="harvest-row" key={harvest.id}>
                    <div className="crop-avatar">{harvest.crop.charAt(0)}</div>
                    <div className="crop-info"><strong>{harvest.crop}</strong><span>{formatDate(harvest.harvestDate)} · Quantidade reservada: {harvest.reservationQuantity || harvest.reservedQuantity || 1} {harvest.unit || 'unidade'}</span></div>
                    <span className="status-pill upcoming">Reservada</span>
                    <button className="text-button" onClick={() => void cancelReservation(harvest)}>Cancelar reserva</button>
                  </div>
                ))}
                {!myReservations.length && <div className="empty-state">Você não possui reservas ativas.</div>}
              </div>
            </section>
          ) : activeSection === 'Auditoria' && canManageUsers ? (
            <section className="panel users-panel">
              <div className="panel-heading">
                <div><h2>Auditoria</h2><p>Registro das ações administrativas e operacionais críticas.</p></div>
                <button className="text-button" onClick={() => void loadAuditLogs()}>Atualizar</button>
              </div>
              {usersError && <div className="api-error" role="alert">{usersError}</div>}
              <div className="audit-list">
                {auditLogs.map((entry) => (
                  <div className="audit-row" key={entry._id}>
                    <div><strong>{entry.action}</strong><span>{formatDate(entry.createdAt)}</span></div>
                    <small>Responsável: {entry.actorUserId}</small>
                    <small>Alvo: {entry.targetUserId}</small>
                  </div>
                ))}
                {!auditLogs.length && <div className="loading-state">Nenhum registro de auditoria encontrado.</div>}
              </div>
            </section>
          ) : activeSection === 'Usuários' && canManageUsers ? (
            <section className="panel users-panel">
              <div className="panel-heading">
                <div>
                  <h2>Usuários cadastrados</h2>
                  <p>Dados pessoais permanecem restritos à administração.</p>
                </div>
                <button className="text-button" onClick={() => { void loadUsers(); void loadUserStats(); }}>
                  Atualizar
                </button>
              </div>
              {userStats && (
                <div className="user-stats" aria-label="Indicadores de usuários">
                  <div><strong>{userStats.total}</strong><span>Total</span></div>
                  <div><strong>{userStats.statuses.pending || 0}</strong><span>Pendentes</span></div>
                  <div><strong>{userStats.statuses.active || 0}</strong><span>Ativos</span></div>
                  <div><strong>{userStats.statuses.suspended || 0}</strong><span>Suspensos</span></div>
                  <div><strong>{userStats.roles.admin || 0}</strong><span>Administradores</span></div>
                </div>
              )}
              <div className="user-filters">
                <label>Status
                  <select value={userStatusFilter} onChange={(event) => setUserStatusFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    <option value="pending">Pendentes</option>
                    <option value="active">Ativos</option>
                    <option value="rejected">Rejeitados</option>
                    <option value="suspended">Suspensos</option>
                  </select>
                </label>
                <label>Perfil
                  <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    <option value="resident">Morador</option>
                    <option value="volunteer">Voluntário</option>
                    <option value="collaborator">Colaborador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </label>
              </div>
              {usersError && <div className="api-error" role="alert">{usersError}</div>}
              {usersLoading ? <div className="loading-state">Carregando usuários...</div> : (
                <div className="users-list">
                  {users.map((user) => (
                    <div className="user-row" key={user.id}>
                      {editingUserId === user.id ? (
                        <form className="admin-user-form" onSubmit={saveAdminUser}>
                          <label>Nome completo<input value={editingUserForm.fullName} onChange={(event) => setEditingUserForm({ ...editingUserForm, fullName: event.target.value })} required /></label>
                          <label>E-mail<input type="email" value={editingUserForm.email} onChange={(event) => setEditingUserForm({ ...editingUserForm, email: event.target.value })} required /></label>
                          <label>CPF<input value={editingUserForm.cpf} onChange={(event) => setEditingUserForm({ ...editingUserForm, cpf: event.target.value })} required /></label>
                          <label>Telefone<input value={editingUserForm.phone} onChange={(event) => setEditingUserForm({ ...editingUserForm, phone: event.target.value })} required /></label>
                          <label>Nascimento<input type="date" value={editingUserForm.birthDate} onChange={(event) => setEditingUserForm({ ...editingUserForm, birthDate: event.target.value })} required /></label>
                          <label>Endereço<input value={editingUserForm.address} onChange={(event) => setEditingUserForm({ ...editingUserForm, address: event.target.value })} required /></label>
                          <label>Contato de emergência<input value={editingUserForm.emergencyContact} onChange={(event) => setEditingUserForm({ ...editingUserForm, emergencyContact: event.target.value })} required /></label>
                          <fieldset>
                            <legend>Papéis</legend>
                            {['resident', 'volunteer', 'collaborator', 'admin'].map((role) => (
                              <label key={role}><input type="checkbox" checked={editingUserForm.roles.includes(role)} disabled={role === 'admin' && user.id === session.user.id} onChange={(event) => setEditingUserForm((current) => ({ ...current, roles: event.target.checked ? [...current.roles, role] : current.roles.filter((item) => item !== role) }))} />{roleLabel(role)}</label>
                            ))}
                          </fieldset>
                          <div className="user-actions"><button className="reserve-button" type="submit">Salvar</button><button className="text-button" type="button" onClick={() => setEditingUserId(null)}>Cancelar</button></div>
                        </form>
                      ) : (
                        <>
                      <div><strong>{user.fullName}</strong><span>{user.email}</span><small>{user.phone} · Cadastro em {user.createdAt ? formatDate(user.createdAt) : 'data indisponível'}</small></div>
                      <div className="user-badges">{user.roles.map((role) => <span className={`role-badge role-${role}`} key={role}>{roleLabel(role)}</span>)}<span className={`status-pill ${user.status === 'active' ? 'healthy' : 'attention'}`}>{userStatusLabel(user.status)}</span></div>
                      <div className="user-actions">
                        {user.status === 'pending' && <button className="reserve-button" onClick={() => void updateUser(user.id, 'status', { status: 'active' })}>Aprovar</button>}
                        {user.status === 'pending' && <button className="text-button" onClick={() => void updateUser(user.id, 'status', { status: 'rejected' })}>Rejeitar</button>}
                        {user.status === 'rejected' && <button className="reserve-button" onClick={() => void updateUser(user.id, 'status', { status: 'active' })}>Aprovar</button>}
                        {user.status === 'active' && user.id !== session.user.id && <button className="text-button" onClick={() => void updateUser(user.id, 'status', { status: 'suspended' })}>Suspender</button>}
                        {user.status === 'suspended' && <button className="reserve-button" onClick={() => void updateUser(user.id, 'status', { status: 'active' })}>Reativar</button>}
                        <button className="text-button" onClick={() => startEditingUser(user)}>Editar</button>
                        {user.id !== session.user.id && <button className="text-button" onClick={() => void deleteUser(user)}>Excluir</button>}
                      </div>
                        </>
                      )}
                    </div>
                  ))}
                  {!users.length && !usersLoading && <div className="loading-state">Nenhum usuário encontrado com os filtros atuais.</div>}
                </div>
              )}
            </section>
          ) : null}
          <div
            className={`alert-banner ${activeSection === 'Colheitas' || activeSection === 'Histórico' || activeSection === 'Analítico' ? 'section-hidden' : ''}`}
          >
            <span className="alert-icon">
              <TriangleAlert size={14} strokeWidth={2} />
            </span>
            <div>
              <strong>Atenção necessária</strong>
              <p>O canteiro de tomates está com umidade abaixo do ideal.</p>
            </div>
            <button
              className="alert-link"
              onClick={() => setActiveSection('Irrigação')}
            >
              Ver irrigação <span>→</span>
            </button>
          </div>
          <div
            className={`stats-grid ${activeSection !== 'Visão geral' ? 'section-hidden' : ''}`}
          >
            <div className="stat-card">
              <div className="stat-top">
                <span>SAÚDE DA HORTA</span>
                <span className="status-pill healthy">Saudável</span>
              </div>
              <div className="stat-value">
                Boa <span className="leaf-icon">✦</span>
              </div>
              <div className="stat-foot">
                <span className="trend up">↗ 8%</span> desde ontem
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>UMIDADE DO SOLO</span>
                <span className="status-pill attention">Atenção</span>
              </div>
              <div className="stat-value">
                {latestTelemetry?.soilMoisture ?? '--'}
                <small>%</small>
              </div>
              <div className="stat-foot">Ideal entre 50% e 70%</div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>TEMPERATURA</span>
                <span className="status-pill healthy">Ideal</span>
              </div>
              <div className="stat-value">
                {latestTelemetry?.temperature ?? '--'}
                <small>°C</small>
              </div>
              <div className="stat-foot">
                Umidade do ar:{' '}
                <strong>{latestTelemetry?.humidity ?? '--'}%</strong>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-top">
                <span>PRÓXIMA COLHEITA</span>
                <CalendarDays size={18} className="calendar-mini" />
              </div>
              <div className="stat-value date-value">
                {harvests[0] ? formatDate(harvests[0].harvestDate) : '--'}
              </div>
              <div className="stat-foot">
                {harvests[0] ? (
                  <strong>{harvests[0].crop}</strong>
                ) : (
                  'Sem colheitas cadastradas'
                )}
              </div>
            </div>
          </div>
          <div
            className={`dashboard-grid ${activeSection === 'Colheitas' || activeSection === 'Analítico' ? 'section-hidden' : ''}`}
          >
            <section
              className={`panel chart-panel ${activeSection !== 'Visão geral' && activeSection !== 'Histórico' ? 'section-hidden' : ''}`}
            >
              <div className="panel-heading">
                <div>
                  <h2>Umidade do solo</h2>
                  <p>Últimas 24 horas</p>
                </div>
                <select
                  className="select-button"
                  value={historyRange}
                  onChange={(event) => setHistoryRange(event.target.value)}
                  aria-label="Período do histórico"
                >
                  <option value="24">24 horas</option>
                  <option value="168">7 dias</option>
                  <option value="720">30 dias</option>
                </select>
              </div>
              <div className="chart">
                <div className="chart-area">
                  <ResponsiveContainer width="100%" height={207}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 12, right: 8, bottom: 4, left: 0 }}
                      role="img"
                      aria-label="Gráfico de umidade do solo"
                    >
                      <CartesianGrid stroke="#e8ede7" strokeDasharray="3 3" />
                      <ReferenceArea
                        y1={50}
                        y2={70}
                        fill="#7cae7f"
                        fillOpacity={0.12}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#aab3ac', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 20, 40, 60, 80, 100]}
                        tick={{ fill: '#aab3ac', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${value}%`}
                        width={34}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, 'Umidade']}
                        contentStyle={{
                          border: '1px solid #e4e9e2',
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="soilMoisture"
                        stroke="#3f7a4b"
                        strokeWidth={3}
                        dot={false}
                        activeDot={{ r: 4, fill: '#3f7a4b' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="chart-legend">
                <span>
                  <i className="legend-dot"></i> Umidade registrada
                </span>
                <span>
                  <i className="legend-line"></i> Faixa ideal: 50% - 70%
                </span>
              </div>
            </section>
            <section
              className={`panel irrigation-panel ${activeSection !== 'Visão geral' && activeSection !== 'Irrigação' ? 'section-hidden' : ''}`}
            >
              <div className="panel-heading">
                <div>
                  <h2>Irrigação</h2>
                  <p>Controle do sistema</p>
                </div>
                <span
                  className={irrigationOn ? 'toggle-label on' : 'toggle-label'}
                >
                  {irrigationOn ? 'Ligada' : 'Desligada'}
                </span>
              </div>
              <div
                className={
                  irrigationOn ? 'water-visual running' : 'water-visual'
                }
              >
                <div className="water-circle">
                  <Droplets size={28} className="drop" />
                </div>
                <div className="ripple ripple-one"></div>
                <div className="ripple ripple-two"></div>
              </div>
              <div className="irrigation-state">
                <strong>{statusLabel}</strong>
                <span>Último ciclo: hoje, 06:15 · 8 min</span>
              </div>
              <button
                className={
                  irrigationOn ? 'irrigation-button stop' : 'irrigation-button'
                }
                onClick={toggleIrrigation}
                disabled={irrigationPending || !status}
              >
                {irrigationOn ? <Square size={12} /> : <Play size={12} />}
                {irrigationPending
                  ? 'Enviando comando...'
                  : irrigationOn
                    ? 'Desligar irrigação'
                    : 'Ligar irrigação'}
              </button>
              {status?.irrigation.mode === 'manual' && (
                <button
                  className="text-button automatic-button"
                  onClick={resumeAutomatic}
                  disabled={irrigationPending}
                >
                  Retomar modo automático
                </button>
              )}
            </section>
          </div>
          <section
            className={`panel harvest-panel ${activeSection !== 'Visão geral' && activeSection !== 'Colheitas' ? 'section-hidden' : ''}`}
          >
            <div className="panel-heading">
              <div>
                <h2>{canManageHarvests && activeSection === 'Colheitas' ? 'Gestão de colheitas' : 'Próximas colheitas'}</h2>
                <p>{canManageHarvests && activeSection === 'Colheitas' ? 'Produção, estoque e distribuição da horta' : 'Organize a distribuição dos alimentos'}</p>
              </div>
              {activeSection === 'Visão geral' ? (
                <button
                  className="text-button"
                  onClick={() => setActiveSection('Colheitas')}
                >
                  Ver calendário <span>→</span>
                </button>
              ) : (
                <select
                  className="select-button"
                  value={harvestFilter}
                  onChange={(event) =>
                    setHarvestFilter(event.target.value as 'all' | 'available')
                  }
                  aria-label="Filtrar colheitas"
                >
                  <option value="all">Todas</option>
                  <option value="available">Disponíveis</option>
                </select>
              )}
            </div>
            {activeSection === 'Colheitas' && (
              <div className="harvest-calendar" aria-label="Calendário operacional">
                <div className="calendar-heading">
                  <div>
                    <strong>{calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</strong>
                    <span>Plantios e colheitas previstas</span>
                  </div>
                  <div className="calendar-controls">
                    <button className="text-button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Mês anterior">‹</button>
                    <button className="text-button" onClick={() => setCalendarMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</button>
                    <button className="text-button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Próximo mês">›</button>
                  </div>
                </div>
                {calendarLoading && <div className="loading-state">Carregando agenda...</div>}
                {!calendarLoading && !calendarEvents.length && <div className="empty-state">Nenhum plantio ou colheita previsto neste mês.</div>}
                {!calendarLoading && calendarEvents.length > 0 && (
                  <div className="calendar-events">
                    {calendarEvents.map((event) => (
                      <div className={`calendar-event ${event.type}`} key={`${event.harvestId}-${event.type}-${event.date}`}>
                        <time dateTime={event.date}>{new Date(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</time>
                        <div><strong>{event.crop}</strong><span>{event.type === 'planting' ? 'Plantio' : 'Colheita prevista'} · {event.quantity} {event.unit || 'unidade'}</span></div>
                        <span className="status-pill upcoming">{event.status === 'cancelled' ? 'Cancelada' : event.type === 'planting' ? 'Planejado' : 'Operação'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {canManageHarvests && activeSection === 'Colheitas' && harvestMetrics && (
              <div className="harvest-metrics" aria-label="Indicadores de colheitas">
                <div><strong>{harvestMetrics.harvests}</strong><span>Colheitas</span></div>
                <div><strong>{harvestMetrics.produced}</strong><span>Produzidas</span></div>
                <div><strong>{harvestMetrics.available}</strong><span>Disponíveis</span></div>
                <div><strong>{harvestMetrics.reserved}</strong><span>Reservadas</span></div>
                <div><strong>{harvestMetrics.delivered}</strong><span>Entregues</span></div>
              </div>
            )}
            {canManageHarvests && activeSection === 'Colheitas' && (
              <div className="harvest-admin-tabs" role="tablist" aria-label="Módulos de gestão de colheitas">
                <button className={harvestAdminTab === 'production' ? 'active' : ''} onClick={() => setHarvestAdminTab('production')} role="tab" aria-selected={harvestAdminTab === 'production'}>Produção e estoque</button>
                <button className={harvestAdminTab === 'reservations' ? 'active' : ''} onClick={() => setHarvestAdminTab('reservations')} role="tab" aria-selected={harvestAdminTab === 'reservations'}>Reservas da comunidade ({adminReservations.filter((item) => item.status === 'active').length})</button>
              </div>
            )}
            {(!canManageHarvests || activeSection !== 'Colheitas' || harvestAdminTab === 'production') && <div className="harvest-list">
              {filteredHarvests.map((harvest) => (
                <div
                  className="harvest-row"
                  key={harvest.id || `${harvest.crop}-${harvest.harvestDate}`}
                >
                  <div className="crop-avatar">{harvest.crop.charAt(0)}</div>
                  <div className="crop-info">
                    <strong>{harvest.crop}</strong>
                    <span>
                      {formatDate(harvest.harvestDate)} ·{' '}
                      {(harvest.availableQuantity ?? harvest.quantity) || 'A definir'} {harvest.unit || 'unidade'}
                    </span>
                  </div>
                  <span
                    className={
                      harvest.available
                        ? 'status-pill ready'
                        : 'status-pill upcoming'
                    }
                  >
                    {harvest.status === 'planned' ? 'Planejada' : harvest.status === 'growing' ? 'Em cultivo' : harvest.status === 'ready' ? 'Pronta' : harvest.status === 'cancelled' ? 'Cancelada' : harvest.available ? 'Disponível' : 'Reservada'}
                  </span>
                  {canManageHarvests && activeSection === 'Colheitas' && (
                    <div className="harvest-actions">
                      <select
                        className="select-button"
                        value={harvest.status || 'available'}
                        onChange={(event) => void changeHarvestStatus(harvest, event.target.value)}
                        aria-label={`Status de ${harvest.crop}`}
                      >
                        <option value="planned">Planejada</option>
                        <option value="growing">Em cultivo</option>
                        <option value="ready">Pronta</option>
                        <option value="available">Disponível</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                      <button className="text-button" onClick={() => openHarvestForm(harvest)}>Editar</button>
                      <button className="text-button danger-text" onClick={() => void deleteHarvest(harvest)}>Excluir</button>
                    </div>
                  )}
                  {!canManageHarvests && activeSection === 'Colheitas' && harvest.available && (
                    <>
                      <input
                        className="quantity-input"
                        type="number"
                        min="1"
                        max={harvest.availableQuantity ?? harvest.quantity}
                        value={reservationQuantities[harvest.id || ''] ?? ''}
                        placeholder="1"
                        onChange={(event) => setReservationQuantities((current) => ({ ...current, [harvest.id || '']: event.target.value }))}
                        aria-label={`Quantidade de ${harvest.crop}`}
                      />
                      <button
                        className="reserve-button"
                        onClick={() => reserveHarvest(harvest)}
                        disabled={reservingId === harvest.id}
                      >
                        {reservingId === harvest.id ? 'Reservando...' : 'Reservar'}
                      </button>
                    </>
                  )}
                </div>
              ))}
              {!filteredHarvests.length && (
                <div className="empty-state">Nenhuma colheita encontrada.</div>
              )}
            </div>}
            {canManageReservations && activeSection === 'Colheitas' && harvestAdminTab === 'reservations' && (
              <div className="reservation-management">
                <div className="panel-heading">
                  <div>
                    <h2>Reservas da comunidade</h2>
                    <p>Consulte quem reservou, quantidade e situação de cada pedido.</p>
                  </div>
                  <div className="reservation-toolbar">
                    <select className="select-button" value={reservationView} onChange={(event) => setReservationView(event.target.value as 'active' | 'history')} aria-label="Filtrar reservas">
                      <option value="active">Ativas</option>
                      <option value="history">Histórico</option>
                    </select>
                    <button className="text-button" onClick={() => void loadDashboard()}>Atualizar</button>
                  </div>
                </div>
                <div className="reservation-list">
                  {visibleAdminReservations.map((reservation) => (
                    <div className="reservation-row" key={reservation._id}>
                      <div>
                        <strong>{reservation.harvestId?.crop || reservation.harvestCode}</strong>
                        <span>{reservation.userId?.fullName || 'Usuário'} · {reservation.userId?.email || 'e-mail indisponível'}</span>
                      </div>
                      <span>{reservation.quantity} {reservation.harvestId?.unit || 'unidade'}</span>
                      <span className={`status-pill ${reservation.status === 'active' ? 'healthy' : reservation.status === 'delivered' ? 'ready' : 'upcoming'}`}>
                        {reservation.status === 'active' ? 'Ativa' : reservation.status === 'delivered' ? 'Entregue' : reservation.status === 'cancelled' ? 'Cancelada' : 'Expirada'}
                      </span>
                      {reservation.status === 'active' && (
                        <div className="user-actions">
                          <button className="reserve-button" onClick={() => void changeReservationStatus(reservation, 'delivered')}>Confirmar entrega</button>
                          <button className="text-button danger-text" onClick={() => void changeReservationStatus(reservation, 'cancelled')}>Cancelar</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!visibleAdminReservations.length && <div className="empty-state">{reservationView === 'active' ? 'Nenhuma reserva ativa.' : 'Nenhum registro no histórico.'}</div>}
                </div>
              </div>
            )}
          </section>
          <footer className="page-footer">
            <span>
              <span className="footer-leaf">✦</span> Cultivando juntos, colhendo
              futuro.
            </span>
            <span>Horta Norte · Piloto comunitário</span>
          </footer>
        </section>
      </main>
      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form
            className="modal"
            onSubmit={addHarvest}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setShowForm(false)}
            >
              ×
            </button>
            <p className="eyebrow">GESTÃO DE PRODUÇÃO</p>
            <h2>{editingHarvest ? 'Editar colheita' : 'Nova colheita'}</h2>
            {harvestFormError && <div className="form-error" role="alert">{harvestFormError}</div>}
            <label>
              Cultura
              <input
                name="crop"
                value={newCrop}
                onChange={(event) => {
                  setNewCrop(event.target.value);
                  if (harvestFormError) setHarvestFormError('');
                }}
                placeholder="Ex.: Manjericão"
                autoComplete="off"
                required
              />
            </label>
            <label>
              Categoria
              <select value={newCategory} onChange={(event) => setNewCategory(event.target.value)}>
                <option value="leafy">Folhosas</option>
                <option value="vegetable">Legumes</option>
                <option value="fruit">Frutas</option>
                <option value="herb">Temperos</option>
                <option value="medicinal">Medicinais</option>
                <option value="other">Outros</option>
              </select>
            </label>
            <label>
              Data prevista da colheita
              <input
                type="datetime-local"
                value={newDate}
                onChange={(event) => setNewDate(event.target.value)}
                required
              />
            </label>
            <label>
              Data do plantio (real ou prevista)
              <input
                type="datetime-local"
                value={newPlantingDate}
                onChange={(event) => setNewPlantingDate(event.target.value)}
              />
              <small>O plantio pode estar no passado ou no futuro, mas nunca depois da colheita.</small>
            </label>
            <label>
              Quantidade
              <input
                type="number"
                min="1"
                step="1"
                value={newQuantity}
                onChange={(event) => setNewQuantity(event.target.value)}
                placeholder="Ex.: 24"
                required
              />
            </label>
            <label>
              Unidade
              <select value={newUnit} onChange={(event) => setNewUnit(event.target.value)}>
                <option value="unidade">Unidades</option>
                <option value="kg">Quilogramas (kg)</option>
                <option value="maço">Maços</option>
                <option value="caixa">Caixas</option>
              </select>
            </label>
            <label>
              Status inicial
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)}>
                <option value="planned">Planejada</option>
                <option value="growing">Em cultivo</option>
                <option value="ready">Pronta</option>
                <option value="available">Disponível</option>
              </select>
            </label>
            <label>
              Observações
              <textarea value={newNotes} onChange={(event) => setNewNotes(event.target.value)} placeholder="Cultivo orgânico, lote, cuidados..." rows={3} />
            </label>
            <button className="primary-button" type="submit">
              {editingHarvest ? 'Salvar alterações' : 'Cadastrar colheita'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
