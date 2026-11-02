import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { login, setAuthToken } from '../services/api';
import { colors } from '../styles/theme';

type Props = { onAuthenticated: () => void };

export function AuthScreen({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setError('');
    try {
      const result = await login(email, password);
      setAuthToken(result.token);
      onAuthenticated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao entrar.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Horta Comunitária</Text>
      <Text style={styles.subtitle}>Entre com uma conta aprovada</Text>
      <TextInput autoCapitalize="none" keyboardType="email-address" placeholder="E-mail" value={email} onChangeText={setEmail} style={styles.input} />
      <TextInput secureTextEntry placeholder="Senha" value={password} onChangeText={setPassword} style={styles.input} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable onPress={() => void submit()} disabled={pending} style={styles.button}>
        {pending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Entrar</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  title: { color: colors.green, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: colors.muted, marginBottom: 24 },
  input: { backgroundColor: '#fff', borderColor: colors.border, borderRadius: 10, borderWidth: 1, marginBottom: 12, padding: 14 },
  button: { alignItems: 'center', backgroundColor: colors.green, borderRadius: 10, padding: 14 },
  buttonText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b42318', marginBottom: 12 },
});
