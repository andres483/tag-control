import { useState } from 'react';
import { getCurrentUser, loginUser, registerUser, logout } from '../lib/auth';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(() => {
    try { return getCurrentUser(); } catch { return null; }
  });
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return children({ user, logout: () => { logout(); setUser(null); } });
  }

  const handleSubmit = async () => {
    if (!name.trim() || pin.length !== 4) {
      setError('Escribe tu nombre y un PIN de 4 dígitos');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const u = mode === 'register'
        ? await registerUser(name.trim(), pin)
        : await loginUser(name.trim(), pin);
      setUser(u);
    } catch (err) {
      setError(err.message || 'Error de conexión');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      fontFamily: '-apple-system, BlinkMacSystemFont, SF Pro Display, system-ui, sans-serif',
    }}>
      <div style={{ width: '100%', maxWidth: 340 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18, background: '#2D6A4F',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(45,106,79,0.3)',
          }}>
            <span style={{ color: '#fff', fontSize: 28, fontWeight: 700, fontFamily: 'system-ui' }}>TC</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#212529', margin: '0 0 4px', letterSpacing: '-0.5px' }}>Tag Control</h1>
          <p style={{ fontSize: 15, color: '#6C757D', margin: 0 }}>Tu peaje, bajo control</p>
        </div>

        {/* Toggle */}
        <div style={{
          display: 'flex', background: '#F8F9FA', borderRadius: 12, padding: 3, marginBottom: 24,
        }}>
          {['login', 'register'].map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                background: mode === m ? '#FFFFFF' : 'transparent',
                color: mode === m ? '#212529' : '#6C757D',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {m === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#6C757D', display: 'block', marginBottom: 6 }}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Raul"
              autoFocus
              style={{
                width: '100%', background: '#F8F9FA', border: '1.5px solid #E9ECEF', borderRadius: 12,
                padding: '14px 16px', fontSize: 17, color: '#212529', boxSizing: 'border-box',
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2D6A4F'}
              onBlur={(e) => e.target.style.borderColor = '#E9ECEF'}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#6C757D', display: 'block', marginBottom: 6 }}>PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4 dígitos"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              style={{
                width: '100%', background: '#F8F9FA', border: '1.5px solid #E9ECEF', borderRadius: 12,
                padding: '14px 16px', fontSize: 24, color: '#212529', boxSizing: 'border-box',
                textAlign: 'center', letterSpacing: '0.5em', outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = '#2D6A4F'}
              onBlur={(e) => e.target.style.borderColor = '#E9ECEF'}
            />
          </div>
        </div>

        {error && (
          <p style={{ color: '#DC3545', fontSize: 14, textAlign: 'center', margin: '0 0 16px' }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
            fontSize: 17, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
            background: loading ? '#ADB5BD' : '#2D6A4F', color: '#FFFFFF',
            boxShadow: loading ? 'none' : '0 2px 8px rgba(45,106,79,0.3)',
          }}
        >
          {loading ? 'Cargando...' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
        </button>

        <p style={{ fontSize: 13, color: '#ADB5BD', textAlign: 'center', marginTop: 20 }}>
          {mode === 'login'
            ? '¿Primera vez? Toca "Registrarse"'
            : 'Elige un nombre y PIN fácil de recordar'}
        </p>
      </div>
    </div>
  );
}
