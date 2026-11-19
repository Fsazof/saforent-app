import { LogOut } from 'lucide-react';
import { UserRole } from '../types/saforent';

interface NavbarProps {
  role: UserRole;
  onLogout: () => void;
  onSelectOwnerTab?: (tab: 'gestion' | 'finanzas') => void;
}

export function Navbar({ role, onLogout, onSelectOwnerTab }: NavbarProps) {
  const navLinks =
    role === 'owner'
      ? [
          { href: '#urgente', label: 'Urgente', tab: 'gestion' as const },
          { href: '#propiedades', label: 'Propiedades', tab: 'gestion' as const },
          { href: '#resumen-financiero', label: 'Finanzas', tab: 'finanzas' as const },
        ]
      : [
          { href: '#resumen-arriendo', label: 'Mi Arriendo', tab: undefined },
          { href: '#acciones-arrendatario', label: 'Gestiones', tab: undefined },
          { href: '#actividad-arrendatario', label: 'Historial', tab: undefined },
        ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-xl font-bold tracking-tight text-[#14294A] whitespace-nowrap shrink-0"
        >
          Saforent APP
        </a>

        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4B5563]"
        >
          {navLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => {
                if (item.tab && onSelectOwnerTab) {
                  onSelectOwnerTab(item.tab);
                }
              }}
              className="hover:text-[#14294A] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 py-1"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-medium text-[#14294A] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] hover:border-[#14294A] transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14294A]"
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
