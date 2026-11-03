import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { changePassword, clearAuthToken, getCurrentUser, MobileUser, updateCurrentUser } from '../services/api';
import { colors, spacing } from '../styles/theme';
import { HortaBackground } from '../components/HortaBackground';

type Props = { onLogout: () => void };
type EditableField = keyof Pick<MobileUser, 'fullName' | 'email' | 'cpf' | 'phone' | 'birthDate' | 'address' | 'emergencyContact'>;

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  resident: 'Morador',
  volunteer: 'Voluntário',
  collaborator: 'Colaborador',
};
const statusLabels: Record<string, string> = {
  active: 'Ativo',
  pending: 'Aguardando aprovação',
  suspended: 'Suspenso',
  rejected: 'Rejeitado',
};

export function ProfileScreen({ onLogout }: Props) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [form, setForm] = useState<Partial<Record<EditableField, string>>>({});
  const [editing, setEditing] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadProfile = useCallback(async () => {
    setBusy(true);
    try {
      const result = await getCurrentUser();
      setUser(result.user);
      setForm(toForm(result.user));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o perfil.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  function updateField(field: EditableField, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile() {
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      const result = await updateCurrentUser({
        ...form,
        birthDate: form.birthDate ? toApiDate(form.birthDate) : undefined,
      });
      setUser(result.user);
      setForm(toForm(result.user));
      setEditing(false);
      setFeedback('Dados atualizados com sucesso.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar os dados.');
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    setSaving(true);
    setError('');
    setFeedback('');
    try {
      await changePassword(currentPassword, newPassword);
      await clearAuthToken();
      onLogout();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível atualizar a senha.');
    } finally {
      setSaving(false);
    }
  }

  if (busy) {
    return <HortaBackground><SafeAreaView style={styles.center}><ActivityIndicator color={colors.green} /></SafeAreaView></HortaBackground>;
  }

  return (
    <HortaBackground>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.kicker}>MINHA CONTA</Text>
          <Text style={styles.title}>Meu perfil</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {feedback ? <Text style={styles.success}>{feedback}</Text> : null}
          <View style={styles.identityCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user?.fullName)}</Text></View>
            <View style={styles.identityCopy}>
              <Text style={styles.name}>{user?.fullName}</Text>
              <Text style={styles.email}>{user?.email}</Text>
              <View style={styles.badges}>
                <Text style={styles.status}>{statusLabels[user?.status || ''] || user?.status}</Text>
                {user?.roles.map((role) => <Text style={styles.role} key={role}>{roleLabels[role] || role}</Text>)}
              </View>
            </View>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dados pessoais</Text>
            <Pressable onPress={() => { setEditing((current) => !current); setFeedback(''); }}>
              <Text style={styles.action}>{editing ? 'Cancelar' : 'Editar'}</Text>
            </Pressable>
          </View>
          <View style={styles.card}>
            <Field label="Nome completo" value={form.fullName} editable={editing} onChangeText={(value) => updateField('fullName', value)} />
            <Field label="E-mail" value={form.email} editable={editing} keyboardType="email-address" autoCapitalize="none" onChangeText={(value) => updateField('email', value)} />
            <Field label="CPF" value={form.cpf} editable={editing} keyboardType="numeric" onChangeText={(value) => updateField('cpf', value)} />
            <Field label="Telefone" value={form.phone} editable={editing} keyboardType="phone-pad" onChangeText={(value) => updateField('phone', value)} />
            <Field label="Nascimento (DD/MM/AAAA)" value={form.birthDate} editable={editing} onChangeText={(value) => updateField('birthDate', value)} />
            <Field label="Endereço" value={form.address} editable={editing} onChangeText={(value) => updateField('address', value)} />
            <Field label="Contato de emergência" value={form.emergencyContact} editable={editing} onChangeText={(value) => updateField('emergencyContact', value)} />
            {editing ? <Pressable style={styles.primaryButton} onPress={() => void saveProfile()} disabled={saving}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Salvar alterações</Text>}</Pressable> : null}
          </View>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Segurança</Text></View>
          <View style={styles.card}>
            <Pressable style={styles.securityRow} onPress={() => { setPasswordOpen((current) => !current); setError(''); }}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.green} />
              <View style={styles.securityCopy}><Text style={styles.securityTitle}>Alterar senha</Text><Text style={styles.securityText}>A senha atual será necessária.</Text></View>
              <Ionicons name={passwordOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>
            {passwordOpen ? <View><Field label="Senha atual" value={currentPassword} secureTextEntry onChangeText={setCurrentPassword} /><Field label="Nova senha (mínimo 12 caracteres)" value={newPassword} secureTextEntry onChangeText={setNewPassword} /><Pressable style={styles.primaryButton} onPress={() => void savePassword()} disabled={saving}>{saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Atualizar senha</Text>}</Pressable></View> : null}
          </View>
          <Pressable style={styles.logoutButton} onPress={() => { void clearAuthToken(); onLogout(); }}><Ionicons name="log-out-outline" size={19} color={colors.danger} /><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </HortaBackground>
  );
}

function toForm(user: MobileUser): Partial<Record<EditableField, string>> {
  return { fullName: user.fullName, email: user.email, cpf: user.cpf || '', phone: user.phone, birthDate: formatBrazilianDate(user.birthDate), address: user.address, emergencyContact: user.emergencyContact };
}
function initials(name?: string) { return name?.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'; }
function formatBrazilianDate(value?: string) {
  if (!value) return '';
  const date = value.slice(0, 10).split('-');
  return date.length === 3 ? `${date[2]}/${date[1]}/${date[0]}` : value;
}
function toApiDate(value: string) {
  const parts = value.trim().split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}` : value;
}
function Field(props: { label: string; value?: string; editable?: boolean; secureTextEntry?: boolean; keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad'; autoCapitalize?: 'none' | 'sentences'; onChangeText: (value: string) => void }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{props.label}</Text><TextInput {...props} style={[styles.input, !props.editable && styles.readOnly]} value={props.value || ''} placeholderTextColor={colors.muted} /></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, center: { alignItems: 'center', flex: 1, justifyContent: 'center' }, content: { padding: spacing.lg, paddingBottom: 40 },
  kicker: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 31, fontWeight: '800', marginBottom: spacing.lg, marginTop: 8 },
  identityCard: { alignItems: 'center', backgroundColor: colors.mint, borderRadius: 20, flexDirection: 'row', padding: 18 }, avatar: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 35, height: 62, justifyContent: 'center', width: 62 }, avatarText: { color: colors.white, fontSize: 21, fontWeight: '800' }, identityCopy: { flex: 1, marginLeft: 13 }, name: { color: colors.ink, fontSize: 17, fontWeight: '800' }, email: { color: colors.muted, fontSize: 12, marginTop: 3 }, badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 8 }, status: { backgroundColor: colors.deepGreen, borderRadius: 10, color: colors.white, fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4 }, role: { backgroundColor: colors.white, borderRadius: 10, color: colors.green, fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9, marginTop: 24 }, sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' }, action: { color: colors.green, fontSize: 13, fontWeight: '800' }, card: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 17, borderWidth: 1, padding: 15 }, field: { marginBottom: 12 }, fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '700', marginBottom: 5 }, input: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 9, borderWidth: 1, color: colors.ink, fontSize: 13, paddingHorizontal: 11, paddingVertical: 10 }, readOnly: { backgroundColor: '#f8faf6', color: colors.muted }, primaryButton: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 11, justifyContent: 'center', minHeight: 46, marginTop: 4 }, primaryButtonText: { color: colors.white, fontSize: 13, fontWeight: '800' },
  securityRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 3 }, securityCopy: { flex: 1, marginHorizontal: 11 }, securityTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' }, securityText: { color: colors.muted, fontSize: 11, marginTop: 3 }, error: { backgroundColor: colors.dangerBackground, borderRadius: 9, color: colors.danger, fontSize: 12, lineHeight: 17, marginBottom: 12, padding: 10 }, success: { backgroundColor: colors.mint, borderRadius: 9, color: colors.deepGreen, fontSize: 12, lineHeight: 17, marginBottom: 12, padding: 10 }, logoutButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: 26, padding: 12 }, logoutText: { color: colors.danger, fontSize: 13, fontWeight: '800', marginLeft: 7 },
});
