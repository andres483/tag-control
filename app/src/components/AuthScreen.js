import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Linking, Image, ScrollView, Keyboard,
} from 'react-native';
import { signInWithGoogle } from '../lib/googleAuth';

const PRIMARY = '#0F6E56';

export default function AuthScreen({ onLogin, onGoogleLogin, onDemoLogin }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (needsName) {
      Keyboard.dismiss();
      const t = setTimeout(() => nameRef.current?.focus(), 300);
      return () => clearTimeout(t);
    }
  }, [needsName]);

  const emailValid = email.trim().includes('@') || email.trim().toLowerCase() === 'revisor';
  const canSubmit = emailValid && pin.length === 4 && (!needsName || name.trim().length > 0);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const { email: gEmail, name: gName } = await signInWithGoogle();
      const result = await onGoogleLogin(gEmail, gName);
      if (!result) setError('No se pudo iniciar sesión con Google. Intenta de nuevo.');
    } catch (e) {
      if (e?.code !== 'SIGN_IN_CANCELLED') {
        setError('No se pudo conectar con Google. Intenta de nuevo.');
      }
    }
    setGoogleLoading(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 25000)
    );
    try {
      const result = await Promise.race([
        onLogin(email.trim(), pin, needsName ? name.trim() : undefined),
        timeout,
      ]);
      if (result === 'needsName') {
        setNeedsName(true);
        setError('');
      } else if (result === 'connection') {
        setError('Sin conexión. Revisa tu internet e intenta de nuevo.');
      } else if (!result) {
        setError('PIN incorrecto');
      }
    } catch {
      setError('Algo salió mal. Intenta de nuevo.');
    }
    setLoading(false);
  };

  const handleDemo = async () => {
    setDemoLoading(true);
    await onDemoLogin();
    setDemoLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.formContainer}>
          {/* Brand */}
          <Image source={require('../../assets/icon.png')} style={s.icon} />
          <Text style={s.title}>TAGcontrol</Text>
          <Text style={s.subtitle}>¿Cuánto gastaste en peajes este mes?</Text>

          {/* Demo */}
          <TouchableOpacity style={s.demoButton} onPress={handleDemo} disabled={demoLoading}>
            <Text style={s.demoButtonText}>
              {demoLoading ? 'Cargando…' : 'Ver cómo funciona →'}
            </Text>
          </TouchableOpacity>

          {/* Google Sign-In — primary method */}
          <TouchableOpacity
            style={[s.googleButton, googleLoading && s.buttonDisabled]}
            onPress={handleGoogle}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            <GoogleIcon />
            <Text style={s.googleButtonText}>
              {googleLoading ? 'Conectando…' : 'Continuar con Google'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>o usa PIN</Text>
            <View style={s.dividerLine} />
          </View>

          {/* PIN login — alternative */}
          <TextInput
            style={s.input}
            placeholder="Tu correo electrónico"
            placeholderTextColor="#999"
            value={email}
            onChangeText={(v) => { setEmail(v); setNeedsName(false); setError(''); }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
          <TextInput
            style={s.input}
            placeholder="PIN (4 dígitos)"
            placeholderTextColor="#999"
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            returnKeyType={needsName ? 'next' : 'done'}
            onSubmitEditing={needsName ? () => nameRef.current?.focus() : handleSubmit}
          />

          {/* Name field — only for new accounts via PIN */}
          {needsName && (
            <>
              <Text style={s.registerPrompt}>Correo nuevo — ¿cómo te llamamos?</Text>
              <TextInput
                ref={nameRef}
                style={s.input}
                placeholder="Tu nombre"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
            </>
          )}

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.pinButton, !canSubmit && s.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading || !canSubmit}
          >
            <Text style={s.pinButtonText}>
              {loading ? 'Entrando…' : needsName ? 'Crear cuenta' : 'Entrar con PIN'}
            </Text>
          </TouchableOpacity>

          <Text style={s.hint}>
            {needsName
              ? 'Solo lo usamos para mostrarte en tu perfil'
              : '¿Primera vez? Pon tu correo + PIN — se crea sola'}
          </Text>

          <TouchableOpacity onPress={() => Linking.openURL('https://tag-control.vercel.app/privacy')}>
            <Text style={s.privacyLink}>Política de privacidad</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleIcon() {
  return (
    <View style={s.gIconWrapper}>
      <Text style={s.gIconText}>G</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  formContainer: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  icon: { width: 72, height: 72, borderRadius: 18, marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },

  demoButton: {
    width: '100%',
    backgroundColor: '#f0faf6',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  demoButtonText: { fontSize: 15, fontWeight: '600', color: PRIMARY },

  googleButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  gIconWrapper: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gIconText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  googleButtonText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },

  divider: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { fontSize: 12, color: '#bbb', marginHorizontal: 10 },

  registerPrompt: { fontSize: 13, color: '#555', textAlign: 'center', marginBottom: 10, marginTop: 4 },
  input: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
    marginBottom: 12,
  },
  error: { color: '#e53935', fontSize: 13, marginBottom: 8, textAlign: 'center' },
  pinButton: {
    width: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.4 },
  pinButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  hint: { fontSize: 12, color: '#aaa', marginTop: 14, textAlign: 'center' },
  privacyLink: { fontSize: 13, color: '#888', marginTop: 12, textDecorationLine: 'underline' },
});
