import { ExternalLink, ShieldCheck } from 'lucide-react';
import { formatClp } from '../utils/formatters';

interface IndicatorsSourceNoticeProps {
  ufValueClp?: number;
  latestIpcPercent?: number;
  compact?: boolean;
}

export function IndicatorsSourceNotice({
  ufValueClp,
  latestIpcPercent,
  compact = false,
}: IndicatorsSourceNoticeProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280] ${
        compact
          ? 'pt-2.5 border-t border-[#E5E7EB]'
          : 'bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3.5 py-2.5'
      }`}
    >
      <div className="inline-flex items-center gap-1.5 min-w-0">
        <ShieldCheck className="w-3.5 h-3.5 text-[#1B5E3A] shrink-0" aria-hidden="true" />
        <span>Indicadores UF / IPC actualizados (Fuente: Banco Central / INE)</span>
        {ufValueClp !== undefined && (
          <span className="hidden sm:inline font-mono tabular-nums text-[#4B5563]">
            · UF {formatClp(ufValueClp)}
            {latestIpcPercent !== undefined
              ? ` · IPC mes ${latestIpcPercent > 0 ? '+' : ''}${latestIpcPercent.toLocaleString('es-CL')}%`
              : ''}
          </span>
        )}
      </div>

      <a
        href="https://ine.cl"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-[#14294A] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
      >
        <span>Verificar en ine.cl</span>
        <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
      </a>
    </div>
  );
}
