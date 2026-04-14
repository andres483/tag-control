import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';

const PRIMARY = '#0F6E56';

export default function AuthScreen({ onLogin }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || pin.length !== 4) return;
    setLoading(true);
    setError('');
    const ok = await onLogin(name.trim(), pin);
    if (!ok) setError('PIN incorrecto');
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <View style={s.iconWrap}>
          <Text style={s.iconText}>TC</Text>
        </View>
        <Text style={s.title}>TAGcontrol</Text>
        <Text style={s.subtitle}>Tu peaje, bajo control</Text>

        <TextInput
          style={s.input}
          placeholder="Tu nombre"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoCorrect={false}
        />
        <TextInput
          style={s.input}
          placeholder="PIN (4 digitos)"
          placeholderTextColor="#999"
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[s.button, (!name.trim() || pin.length !== 4) && s.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !name.trim() || pin.length !== 4}
        >
          <Text style={s.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 24 },
  card: { width: '100%', maxWidth: 340, alignItems: 'center' },
  iconWrap: { width: 64, height: 64, borderRadius: 16, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  iconText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 32 },
  input: { width: '100%', backgroundColor: '#f5f5f5', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#1a1a1a', marginBottom: 12 },
  error: { color: '#e53935', fontSize: 13, marginBottom: 8 },
  button: { width: '100%', backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
