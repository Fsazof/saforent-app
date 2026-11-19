import { FormEvent, useState } from 'react';
import { ArrowRight, KeyRound, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';
import { UserRole } from '../types/saforent';

interface LoginViewProps {
  onLogin: (role: UserRole, email?: string) => void;
  onResetDemo: () => void;
  onNotify: (message: string) => void;
}

export function LoginView({ onLogin, onResetDemo, onNotify }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Ingresa un correo y una contraseña, o utiliza un acceso rápido de demostración.');
      return;
    }
    setError('');
    const normalized = email.trim().toLowerCase();
    const detectedRole: UserRole = normalized.includes('arrend') || normalized.includes('camila')
      ? 'tenant'
      : 'owner';
    onLogin(detectedRole, email.trim());
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col justify-between px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-[1040px] w-full mx-auto flex items-center justify-between">
        <span className="font-display text-xl font-bold tracking-tight text-[#14294A] whitespace-nowrap">
          Saforent APP
        </span>
        <button
          type="button"
          onClick={() => {
            onResetDemo();
            onNotify('Datos de demostración restaurados a su estado inicial.');
          }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4B5563] hover:text-[#14294A] transition-colors cursor-pointer py-2 px-3 rounded-lg hover:bg-white/80 whitespace-nowrap"
        >
          <RotateCcw className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Reiniciar Demo</span>
        </button>
      </div>

      <main className="max-w-[1040px] w-full mx-auto my-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <section className="lg:col-span-6 space-y-6">
          <p className="text-sm font-medium text-[#1B5E3A]">
            Gestión de arriendos en Chile · CLP, UF e IPC
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#111827] leading-[1.15]">
            Tus arriendos, contratos y pagos bajo control en un solo lugar.
          </h1>
          <p className="text-base text-[#4B5563] leading-relaxed max-w-[52ch]">
            Administra propiedades con respaldo de Rol SII y CBRS, calcula reajustes por IPC en segundos y coordina comprobantes o mantenciones directo con tu arrendatario.
          </p>

          <div className="pt-2 border-t border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#374151]">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#1B5E3A] mt-0.5 shrink-0" aria-hidden="true" />
              <span>Alertas priorizadas de morosidad, averías y reajuste IPC</span>
            </div>
            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-[#14294A] mt-0.5 shrink-0" aria-hidden="true" />
              <span>Vistas de Propietario y Arrendatario sincronizadas en tiempo real</span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(17,24,39,0.04)]">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[#111827]">Iniciar sesión</h2>
              <p className="text-sm text-[#6B7280] mt-1">
                Ingresa con tus credenciales o prueba el flujo completo con los accesos demo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[#374151] mb-1.5">
                  Correo electrónico
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nombre@correo.cl"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-white border border-[#D1D5DB] rounded-lg text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#14294A] focus:ring-1 focus:ring-[#14294A]"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-[#374151] mb-1.5">
                  Contraseña
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-white border border-[#D1D5DB] rounded-lg text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#14294A] focus:ring-1 focus:ring-[#14294A]"
                />
              </div>

              {error && (
                <p role="alert" className="text-sm text-[#B91C1C]">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#14294A] hover:bg-[#1D3A66] text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14294A]"
              >
                <span>Ingresar</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E5E7EB]" />
              <span className="text-xs font-medium text-[#6B7280] whitespace-nowrap">
                Accesos rápidos de demostración
              </span>
              <div className="h-px flex-1 bg-[#E5E7EB]" />
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onLogin('owner')}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#14294A] hover:bg-[#1D3A66] text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14294A]"
              >
                <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Ingresar como Propietario (Demo)</span>
              </button>

              <button
                type="button"
                onClick={() => onLogin('tenant')}
                className="w-full min-h-[44px] px-4 py-2.5 bg-[#1B5E3A] hover:bg-[#154B2E] text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B5E3A]"
              >
                <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Ingresar como Arrendatario (Demo)</span>
              </button>
            </div>

            <p className="mt-4 text-xs text-[#6B7280] leading-relaxed">
              Los cambios realizados en cualquier vista se guardan localmente en tu navegador y se sincronizan al instante entre Propietario y Arrendatario.
            </p>
          </div>
        </section>
      </main>

      <footer className="max-w-[1040px] w-full mx-auto pt-4 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
        <span>Saforent APP · Gestión simple de arriendos en Chile</span>
        <span className="font-mono tabular-nums">UF referencia: $38.240</span>
      </footer>
    </div>
  );
}
