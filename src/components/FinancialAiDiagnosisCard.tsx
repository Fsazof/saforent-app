import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { FinancialAiDiagnosisController } from '../hooks/useFinancialAiDiagnosis';
import { formatClp, formatRelativeTimestamp, formatSpanishDate } from '../utils/formatters';

interface FinancialAiDiagnosisCardProps {
  controller: FinancialAiDiagnosisController;
}

export function FinancialAiDiagnosisCard({ controller }: FinancialAiDiagnosisCardProps) {
  const {
    isOpen,
    isLoading,
    isRefreshing,
    error,
    diagnosis,
    generatedAt,
    snapshot,
    generateDiagnosis,
    dismissDiagnosis,
  } = controller;

  if (!isOpen) return null;

  const healthBadgeStyles =
    diagnosis?.healthStatus === 'Crítico'
      ? 'bg-[#FEF2F2] text-[#B91C1C] border-[#FECACA]'
      : diagnosis?.healthStatus === 'Atención Requerida'
        ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
        : 'bg-[#EEF6F1] text-[#1B5E3A] border-[#BBF7D0]';

  return (
    <section
      aria-labelledby="diagnostico-ia-heading"
      className="bg-white border-2 border-[#14294A] rounded-xl overflow-hidden shadow-xs"
    >
      {/* Encabezado destacado del diagnóstico */}
      <div className="bg-[#F8FAFC] border-b border-[#E5E7EB] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#14294A] text-white flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="diagnostico-ia-heading"
                className="text-sm sm:text-base font-bold text-[#111827]"
              >
                Diagnóstico Ejecutivo IA de Cartera
              </h2>
              {diagnosis && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded ${healthBadgeStyles}`}
                >
                  {diagnosis.healthStatus}
                </span>
              )}
              {isRefreshing && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14294A]">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  <span>Actualizando con datos recientes...</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#6B7280] tabular-nums">
              Corte al {formatSpanishDate(snapshot.simulatedDate)} ·{' '}
              {snapshot.totalProperties} propiedad{snapshot.totalProperties === 1 ? '' : 'es'} analizada
              {snapshot.totalProperties === 1 ? '' : 's'}
              {generatedAt ? ` · Actualizado ${formatRelativeTimestamp(generatedAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            disabled={isLoading || isRefreshing}
            onClick={() => void generateDiagnosis()}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#14294A] bg-white border border-[#D1D5DB] hover:border-[#14294A] rounded-lg transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading || isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            onClick={dismissDiagnosis}
            aria-label="Cerrar diagnóstico IA"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#E5E7EB]/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Franja de indicadores base analizados */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB] bg-white border-b border-[#E5E7EB] text-xs">
        <div className="px-4 py-3">
          <span className="block text-[#6B7280]">Ingresos proyectados mes</span>
          <span className="font-mono tabular-nums font-bold text-[#14294A] text-sm">
            {formatClp(snapshot.currentMonthProjectedRentClp)}
          </span>
          <span className="block text-[#6B7280] tabular-nums">
            Recaudado: {snapshot.collectionRatePct}% ({formatClp(snapshot.currentMonthCollectedRentClp)})
          </span>
        </div>
        <div className="px-4 py-3">
          <span className="block text-[#6B7280]">Morosidad y multas</span>
          <span
            className={`font-mono tabular-nums font-bold text-sm ${
              snapshot.overdueCount > 0 || snapshot.totalAccumulatedFinesClp > 0
                ? 'text-[#B91C1C]'
                : 'text-[#1B5E3A]'
            }`}
          >
            {snapshot.overdueCount} en mora · {formatClp(snapshot.totalAccumulatedFinesClp)}
          </span>
          <span className="block text-[#6B7280]">Multas acumuladas / del mes</span>
        </div>
        <div className="px-4 py-3">
          <span className="block text-[#6B7280]">Mantención (Propietario)</span>
          <span className="font-mono tabular-nums font-bold text-[#B45309] text-sm">
            {formatClp(snapshot.currentMonthOwnerMaintenanceClp)} este mes
          </span>
          <span className="block text-[#6B7280] tabular-nums">
            Histórico: {formatClp(snapshot.historicalOwnerMaintenanceClp)}
            {snapshot.pendingUrgentMaintenanceTotal > 0
              ? ` · ${snapshot.pendingUrgentMaintenanceTotal} pendiente${snapshot.pendingUrgentMaintenanceTotal === 1 ? '' : 's'}`
              : ''}
          </span>
        </div>
        <div className="px-4 py-3">
          <span className="block text-[#6B7280]">Propiedades disponibles</span>
          <span className="font-mono tabular-nums font-bold text-[#111827] text-sm">
            {snapshot.availableCount} disponible{snapshot.availableCount === 1 ? '' : 's'} (
            {snapshot.occupancyRatePct}% ocupación)
          </span>
          <span className="block text-[#6B7280] tabular-nums">
            Potencial vacante: {formatClp(snapshot.potentialAvailableRentClp)} / mes
          </span>
        </div>
      </div>

      {/* Contenido del diagnóstico */}
      <div className="p-5 sm:p-6 space-y-5">
        {isLoading && !diagnosis ? (
          <div className="space-y-4" aria-live="polite">
            <p className="text-sm font-medium text-[#14294A] flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              <span>
                Analizando ingresos, morosidades, multas, gastos de mantención y vacancia...
              </span>
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((slot) => (
                <div
                  key={slot}
                  className="border border-[#E5E7EB] rounded-xl p-4 space-y-3 bg-[#F9FAFB] animate-pulse"
                >
                  <div className="h-4 w-1/2 bg-[#E5E7EB] rounded" />
                  <div className="h-5 w-4/5 bg-[#E5E7EB] rounded" />
                  <div className="h-12 w-full bg-[#E5E7EB] rounded" />
                  <div className="h-10 w-full bg-[#E2E8F0] rounded" />
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2.5 text-sm text-[#991B1B]">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">No se pudo obtener el diagnóstico IA</p>
                <p className="text-xs mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void generateDiagnosis()}
              className="min-h-[38px] px-4 py-2 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg cursor-pointer whitespace-nowrap shrink-0"
            >
              Reintentar análisis
            </button>
          </div>
        ) : diagnosis ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 text-sm sm:text-base font-medium text-[#111827]">
              <TrendingUp className="w-5 h-5 text-[#14294A] shrink-0 mt-0.5" aria-hidden="true" />
              <p>{diagnosis.headline}</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {diagnosis.points.slice(0, 3).map((point, idx) => {
                const isCritical = point.severity === 'critico';
                const isPositive = point.severity === 'positivo';

                const cardBorder = isCritical
                  ? 'border-[#FECACA] bg-[#FEF2F2]/35'
                  : isPositive
                    ? 'border-[#BBF7D0] bg-[#EEF6F1]/40'
                    : 'border-[#FDE68A] bg-[#FFFBEB]/40';

                const numberBg = isCritical
                  ? 'bg-[#B91C1C] text-white'
                  : isPositive
                    ? 'bg-[#1B5E3A] text-white'
                    : 'bg-[#B45309] text-white';

                const actionBox = isCritical
                  ? 'bg-white border-[#FECACA] text-[#991B1B]'
                  : isPositive
                    ? 'bg-white border-[#BBF7D0] text-[#154B2E]'
                    : 'bg-white border-[#FDE68A] text-[#92400E]';

                return (
                  <article
                    key={`${point.category}-${idx}`}
                    className={`border rounded-xl p-4 flex flex-col justify-between gap-3 ${cardBorder}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-6 h-6 rounded-md text-xs font-bold inline-flex items-center justify-center shrink-0 ${numberBg}`}
                          >
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-[#4B5563] truncate">
                            {point.category}
                          </span>
                        </div>
                        {isPositive ? (
                          <CheckCircle2
                            className="w-4 h-4 text-[#1B5E3A] shrink-0"
                            aria-hidden="true"
                          />
                        ) : (
                          <AlertTriangle
                            className={`w-4 h-4 shrink-0 ${
                              isCritical ? 'text-[#B91C1C]' : 'text-[#B45309]'
                            }`}
                            aria-hidden="true"
                          />
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-[#111827] leading-snug">
                        {point.title}
                      </h3>

                      <p className="text-xs sm:text-sm text-[#374151] leading-relaxed">
                        {point.summary}
                      </p>
                    </div>

                    <div className={`border rounded-lg p-3 text-xs space-y-1 ${actionBox}`}>
                      <span className="font-semibold uppercase tracking-wide text-[11px] block">
                        Acción recomendada
                      </span>
                      <p className="font-medium leading-snug flex items-start gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                        <span>{point.action}</span>
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
