import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { Eye, EyeOff, Lock, Mail, Sparkles, User } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { ThemeToggle } from './ThemeToggle';

type AuthMode = 'login' | 'register' | 'reset';

function translateAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos. Verifica tus datos e intenta de nuevo.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo. Inicia sesión en su lugar.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/invalid-email':
      return 'Por favor ingresa un correo electrónico válido.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Se cerró la ventana de Google antes de completar el ingreso.';
    case 'auth/popup-blocked':
      return 'Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes e intenta nuevamente.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera unos minutos antes de volver a intentarlo.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'El inicio de sesión con correo y contraseña aún no está habilitado en Firebase Authentication. Actívalo en Firebase Console (Authentication → Sign-in method → Correo/Contraseña) o entra rápido con Google.';
    case 'auth/network-request-failed':
      return 'Sin conexión a internet. Verifica tu red e intenta de nuevo.';
    default:
      return err instanceof Error && err.message
        ? err.message
        : 'No fue posible completar la autenticación. Intenta de nuevo.';
  }
}

export const AuthGate: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Ingresa tu correo electrónico.');
      return;
    }

    if (mode !== 'reset' && password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else if (mode === 'register') {
        const cleanName = displayName.trim();
        if (!cleanName) {
          setErrorMsg('Ingresa tu nombre o el nombre de tu taller.');
          setSubmitting(false);
          return;
        }
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(cred.user, { displayName: cleanName });
      } else {
        await sendPasswordResetEmail(auth, cleanEmail);
        setInfoMsg(
          'Si el correo está registrado, enviamos un enlace para restablecer tu contraseña.'
        );
      }
    } catch (err) {
      setErrorMsg(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setSubmitting(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setErrorMsg(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F2] text-[#3B281E] flex flex-col relative overflow-hidden">
      {/* Ondas decorativas */}
      <div
        className="pointer-events-none fixed -bottom-32 right-[-8%] w-[520px] h-[360px] rounded-[50%] bg-[#F0DFD3]/65 blur-[1px] z-0"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -top-24 -left-24 w-[360px] h-[360px] rounded-full bg-[#EAD5C6]/50 z-0"
        aria-hidden="true"
      />

      {/* Botón de tema en esquina superior */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-5 pt-5 flex justify-end">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-[#FDFBFA] border border-[#EDE2D8] rounded-3xl p-7 sm:p-8 shadow-[0_14px_40px_rgba(92,62,46,0.08)]">
          {/* Logo Dinemelly */}
          <div className="text-center mb-6">
            <svg
              viewBox="0 0 36 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-9 h-8 mx-auto"
              aria-hidden="true"
            >
              <rect x="2" y="13" width="7.5" height="13" rx="2.2" fill="#9E7358" />
              <rect x="13.5" y="7" width="7.5" height="19" rx="2.2" fill="#9E7358" />
              <rect x="25" y="2" width="7.5" height="24" rx="2.2" fill="#9E7358" />
            </svg>
            <h1 className="mt-2 font-display text-3xl font-bold text-[#3B281E] tracking-tight">
              Dinemelly
            </h1>
            <p className="mt-1 text-xs text-[#7D6659]">
              Tu negocio, en orden · Cada cuenta guarda su propio taller en la nube
            </p>
          </div>

          {/* Selector Iniciar sesión / Crear cuenta */}
          {mode !== 'reset' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F4E7DE] rounded-xl mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-white text-[#3B281E] shadow-xs'
                    : 'text-[#6B5447] hover:text-[#3B281E]'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-white text-[#3B281E] shadow-xs'
                    : 'text-[#6B5447] hover:text-[#3B281E]'
                }`}
              >
                Crear cuenta
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C] leading-relaxed">
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-[#E6F0E4] border border-[#C5DEC1] text-xs text-[#2D5033] leading-relaxed">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#4D3A2F] mb-1.5">
                  Nombre o nombre de tu taller
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8D7668] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ej. Taller Dinemelly"
                    maxLength={120}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#D9D3CA] rounded-xl text-[#3B281E] placeholder-[#9B8578] focus:outline-none focus:border-[#AF8064]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#4D3A2F] mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8D7668] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tucorreo@ejemplo.com"
                  autoComplete="email"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#D9D3CA] rounded-xl text-[#3B281E] placeholder-[#9B8578] focus:outline-none focus:border-[#AF8064]"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-[#4D3A2F]">
                    Contraseña
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('reset');
                        setErrorMsg('');
                        setInfoMsg('');
                      }}
                      className="text-[11px] font-medium text-[#8C634C] hover:text-[#3B281E]"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8D7668] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#D9D3CA] rounded-xl text-[#3B281E] placeholder-[#9B8578] focus:outline-none focus:border-[#AF8064]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8D7668] hover:text-[#3B281E]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-[#AF8064] hover:bg-[#976B51] disabled:opacity-60 rounded-xl transition-colors shadow-[0_6px_14px_rgba(175,128,100,0.25)]"
            >
              {submitting
                ? 'Procesando...'
                : mode === 'login'
                  ? 'Entrar a mi taller'
                  : mode === 'register'
                    ? 'Crear cuenta y empezar desde cero'
                    : 'Enviar enlace de recuperación'}
            </button>

            {mode === 'reset' && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                  setInfoMsg('');
                }}
                className="w-full py-2 text-xs font-medium text-[#7D6659] hover:text-[#3B281E]"
              >
                Volver a iniciar sesión
              </button>
            )}
          </form>

          {mode !== 'reset' && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#EDE2D8]" />
                <span className="text-[11px] font-medium text-[#8D7668]">o acceso rápido</span>
                <div className="h-px flex-1 bg-[#EDE2D8]" />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 text-sm font-semibold text-[#3B281E] bg-white hover:bg-[#F4E7DE] border border-[#D9D3CA] disabled:opacity-60 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.7-5.4 3.7-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z"
                  />
                  <path
                    fill="#34A853"
                    d="M3.4 7.3l3.2 2.3C7.4 7.7 9.5 6.4 12 6.4c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.3 12 2.3c-3.8 0-7.1 2.2-8.6 5z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M12 21.7c2.5 0 4.7-.8 6.3-2.3l-2.9-2.4c-.8.6-1.9 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1l-3.2 2.4c1.5 3.2 4.8 5.4 8.8 5.4z"
                  />
                  <path
                    fill="#4285F4"
                    d="M21.3 12.2c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.4-1.1 2.6-2.1 3.3l2.9 2.4c1.7-1.6 3.1-4 3.1-8z"
                  />
                </svg>
                <span>Continuar rápido con Google</span>
              </button>
            </>
          )}

          <div className="mt-6 pt-4 border-t border-[#EDE2D8] flex items-center justify-center gap-2 text-[11px] text-[#7D6659]">
            <Sparkles className="w-3.5 h-3.5 text-[#AF8064] shrink-0" />
            <span>Tus compras, inventario, clientes y pedidos son privados para tu cuenta.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
