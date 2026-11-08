import { Ionicons } from '@expo/vector-icons';
import { useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { login, register, requestPasswordRecovery, saveAuthToken } from '../services/api';
import { useTheme, spacing, type ThemeColors } from '../styles/theme';

type Props = { onAuthenticated: () => Promise<void> };
type Mode = 'welcome' | 'login' | 'register' | 'forgot';
type Role = 'resident' | 'volunteer' | 'collaborator';

const roleOptions: { value: Role; label: string; description: string }[] = [
  { value: 'resident', label: 'Morador', description: 'Acompanhe e reserve colheitas.' },
  { value: 'volunteer', label: 'Voluntário', description: 'Participe das atividades da horta.' },
  { value: 'collaborator', label: 'Colaborador', description: 'Apoie a operação e a distribuição.' },
];

export function AuthScreen({ onAuthenticated }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [role, setRole] = useState<Role>('resident');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  function changeMode(nextMode: Mode) {
    setMode(nextMode);
    setError('');
    setMessage('');
  }

  async function submit() {
    setPending(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'login') {
        const result = await login(email.trim(), password);
        await saveAuthToken(result.token);
        await onAuthenticated();
        return;
      }
      if (mode === 'forgot') {
        const result = await requestPasswordRecovery(email.trim());
        setMessage(result.message);
        return;
      }
      const result = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        cpf: cpf.trim(),
        phone: phone.trim(),
        birthDate: toApiDate(birthDate),
        address: address.trim(),
        emergencyContact: emergencyContact.trim(),
        password,
        confirmPassword,
        requestedRole: role,
      });
      setMessage(result.message);
      setMode('login');
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível concluir a operação.');
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}><Ionicons name="leaf" size={24} color={colors.white} /></View>
          <View><Text style={styles.brand}>Horta</Text><Text style={styles.brandStrong}>Comunitária</Text></View>
        </View>

        {mode === 'welcome' ? (
          <>
            <View style={styles.hero}>
              <Text style={styles.kicker}>CUIDAR · PARTICIPAR · COLHER</Text>
              <Text style={styles.title}>Uma horta feita por todos nós.</Text>
              <Text style={styles.subtitle}>
                Monitore a horta, acompanhe as colheitas e participe da comunidade em um só lugar.
              </Text>
              <View style={styles.heroLeaf}><Ionicons name="leaf-outline" size={58} color={colors.green} /></View>
            </View>
            <View style={styles.features}>
              <Feature icon="pulse-outline" title="Acompanhe" text="Veja o estado da horta em tempo real." />
              <Feature icon="basket-outline" title="Participe" text="Consulte e reserve alimentos disponíveis." />
              <Feature icon="people-outline" title="Contribua" text="Escolha seu perfil e faça parte da comunidade." />
            </View>
            <Pressable style={styles.primaryButton} onPress={() => changeMode('login')}>
              <Text style={styles.primaryButtonText}>Entrar na minha conta</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => changeMode('register')}>
              <Text style={styles.secondaryButtonText}>Quero me cadastrar</Text>
            </Pressable>
            <Text style={styles.approvalNote}>
              Novos cadastros passam por uma aprovação do administrador da horta antes do primeiro acesso.
            </Text>
          </>
        ) : (
          <>
            <Pressable style={styles.backButton} onPress={() => changeMode('welcome')}>
              <Ionicons name="arrow-back" size={18} color={colors.green} />
              <Text style={styles.backText}>Voltar</Text>
            </Pressable>
            <Text style={styles.kicker}>{mode === 'login' ? 'ACESSO SEGURO' : mode === 'forgot' ? 'RECUPERAÇÃO DE ACESSO' : 'FAÇA PARTE DA COMUNIDADE'}</Text>
            <Text style={styles.title}>{mode === 'login' ? 'Bem-vindo de volta.' : mode === 'forgot' ? 'Recupere sua senha.' : 'Crie seu cadastro.'}</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Use uma conta aprovada para acessar a horta.'
                : mode === 'forgot'
                  ? 'Informe seu e-mail para receber as instruções de recuperação.'
                : 'Escolha como você quer participar. O administrador analisará sua solicitação.'}
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {message ? <Text style={styles.success}>{message}</Text> : null}
            {mode === 'register' && (
              <>
                <Field label="Nome completo" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
                <Field label="CPF" value={cpf} onChangeText={setCpf} keyboardType="numeric" />
              </>
            )}
            <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            {mode === 'register' && <Field label="Telefone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />}
            {mode !== 'forgot' && <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry />}
            {mode === 'register' && (
              <>
                <Field label="Confirmar senha" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
                <Field label="Data de nascimento (DD/MM/AAAA)" value={birthDate} onChangeText={setBirthDate} />
                <Field label="Endereço" value={address} onChangeText={setAddress} />
                <Field label="Contato de emergência" value={emergencyContact} onChangeText={setEmergencyContact} />
                <Text style={styles.sectionLabel}>Como você quer participar?</Text>
                <View style={styles.roles}>
                  {roleOptions.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.roleCard, role === option.value && styles.roleCardSelected]}
                      onPress={() => setRole(option.value)}
                    >
                      <Ionicons name={role === option.value ? 'radio-button-on' : 'radio-button-off'} size={19} color={role === option.value ? colors.green : colors.muted} />
                      <View style={styles.roleCopy}><Text style={styles.roleTitle}>{option.label}</Text><Text style={styles.roleDescription}>{option.description}</Text></View>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.formHint}>O perfil Administrador não pode ser solicitado pelo cadastro público.</Text>
              </>
            )}
            <Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={pending}>
              {pending ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>{mode === 'login' ? 'Entrar' : mode === 'forgot' ? 'Enviar solicitação' : 'Enviar cadastro'}</Text>}
            </Pressable>
            {mode === 'login' && <Pressable onPress={() => changeMode('forgot')} style={styles.switchButton}><Text style={styles.switchText}>Esqueci minha senha</Text></Pressable>}
            <Pressable onPress={() => changeMode(mode === 'login' || mode === 'forgot' ? 'register' : 'login')} style={styles.switchButton}>
              <Text style={styles.switchText}>{mode === 'login' || mode === 'forgot' ? 'Ainda não tenho conta: cadastrar' : 'Já tenho uma conta: entrar'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Feature({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  const { colors } = useTheme();
  return <View style={createStyles(colors).feature}><Ionicons name={icon} size={22} color={colors.green} /><Text style={createStyles(colors).featureTitle}>{title}</Text><Text style={createStyles(colors).featureText}>{text}</Text></View>;
}

function Field(props: ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...inputProps } = props;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...inputProps} style={styles.input} placeholderTextColor={colors.muted} /></View>;
}

function toApiDate(value: string) {
  const parts = value.trim().split('/');
  return parts.length === 3
    ? `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    : value;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 42, paddingTop: 54 },
  brandRow: { alignItems: 'center', flexDirection: 'row', marginBottom: 34 },
  brandIcon: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 16, height: 48, justifyContent: 'center', marginRight: 11, width: 48 },
  brand: { color: colors.ink, fontSize: 17, fontWeight: '500', lineHeight: 18 },
  brandStrong: { color: colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 18 },
  hero: { backgroundColor: colors.mint, borderRadius: 28, minHeight: 270, overflow: 'hidden', padding: 22 },
  heroLeaf: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.72)', borderRadius: 45, bottom: -8, height: 90, justifyContent: 'center', position: 'absolute', right: 22, width: 90 },
  kicker: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: colors.ink, fontSize: 31, fontWeight: '800', lineHeight: 38, marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 12 },
  features: { gap: 11, marginVertical: 22 },
  feature: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 15, borderWidth: 1, minHeight: 78, padding: 13 },
  featureTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 5 },
  featureText: { color: colors.muted, fontSize: 12, marginTop: 3 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 13, flexDirection: 'row', justifyContent: 'center', minHeight: 52, paddingHorizontal: 18 },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '800', marginRight: 9 },
  secondaryButton: { alignItems: 'center', borderColor: colors.green, borderRadius: 13, borderWidth: 1, marginTop: 11, minHeight: 52, justifyContent: 'center' },
  secondaryButtonText: { color: colors.green, fontSize: 14, fontWeight: '800' },
  approvalNote: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 16, textAlign: 'center' },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 24 },
  backText: { color: colors.green, fontSize: 13, fontWeight: '700' },
  field: { marginTop: 14 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: colors.white, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.ink, fontSize: 14, paddingHorizontal: 14, paddingVertical: 13 },
  error: { backgroundColor: colors.dangerBackground, borderRadius: 9, color: colors.danger, fontSize: 12, lineHeight: 18, marginTop: 17, padding: 11 },
  success: { backgroundColor: colors.mint, borderRadius: 9, color: colors.deepGreen, fontSize: 12, lineHeight: 18, marginTop: 17, padding: 11 },
  sectionLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', marginTop: 22 },
  roles: { gap: 8, marginTop: 9 },
  roleCard: { alignItems: 'center', backgroundColor: colors.white, borderColor: colors.border, borderRadius: 11, borderWidth: 1, flexDirection: 'row', padding: 11 },
  roleCardSelected: { backgroundColor: colors.mint, borderColor: colors.green },
  roleCopy: { flex: 1, marginLeft: 9 },
  roleTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  roleDescription: { color: colors.muted, fontSize: 11, marginTop: 2 },
  formHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginVertical: 14 },
  switchButton: { alignItems: 'center', marginTop: 18, padding: 6 },
  switchText: { color: colors.green, fontSize: 13, fontWeight: '700' },
  });
}
