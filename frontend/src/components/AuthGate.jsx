import { useState } from 'react';
import { getCurrentUser, loginUser, registerUser, logout } from '../lib/auth';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(getCurrentUser);
  const [mode, setMode] = useState('login'); // login | register
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
      if (mode === 'register') {
        const u = await registerUser(name.trim(), pin);
        setUser(u);
      } else {
        const u = await loginUser(name.trim(), pin);
        setUser(u);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xs">
        {/* Logo */}
        <div className="text-center mb-8">
          <svg className="w-16 h-16 mx-auto mb-3" viewBox="0 0 100 100">
            <rect width="100" height="100" rx="20" fill="#5C6B5A" />
            <text x="50" y="68" fontSize="50" fontFamily="system-ui" fontWeight="700" fill="#F7F5F1" textAnchor="middle">TC</text>
          </svg>
          <p className="text-xl font-bold text-negro">Tag Control</p>
          <p className="text-sm text-tierra">Tu peaje, bajo control</p>
        </div>

        {/* Toggle login/register */}
        <div className="flex bg-cream-dark rounded-xl p-1 mb-5">
          <button
            onClick={() => { setMode('login'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'login' ? 'bg-negro text-cream' : 'text-tierra'
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => { setMode('register'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'register' ? 'bg-negro text-cream' : 'text-tierra'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-tierra mb-1 block">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Raul"
              className="w-full bg-cream-dark rounded-xl px-4 py-3 text-sm text-negro placeholder-hongo focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-tierra mb-1 block">PIN (4 dígitos)</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="****"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              className="w-full bg-cream-dark rounded-xl px-4 py-3 text-sm text-negro placeholder-hongo text-center tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-600 text-xs text-center mb-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-2xl font-bold text-lg text-cream bg-negro active:bg-negro/80 transition-colors"
        >
          {loading ? 'Cargando...' : mode === 'register' ? 'Crear cuenta' : 'Entrar'}
        </button>

        <p className="text-xs text-tierra text-center mt-4">
          {mode === 'login'
            ? '¿Primera vez? Toca "Registrarse" arriba'
            : 'Elige un nombre y PIN que puedas recordar'}
        </p>
      </div>
    </div>
  );
}
