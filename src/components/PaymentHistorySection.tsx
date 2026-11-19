import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Eye, Receipt } from 'lucide-react';
import { formatClp } from '../utils/formatters';
import {
  PaymentHistoryConcept,
  PaymentHistoryRow,
  PaymentReceiptPreviewData,
} from '../utils/paymentHistory';

interface PaymentHistorySectionProps {
  viewerRole: 'owner' | 'tenant';
  headingId: string;
  title: string;
  rows: PaymentHistoryRow[];
  onViewReceipt: (receipt: PaymentReceiptPreviewData) => void;
}

type ConceptFilter = 'Todos' | PaymentHistoryConcept;

export function PaymentHistorySection({
  viewerRole,
  headingId,
  title,
  rows,
  onViewReceipt,
}: PaymentHistorySectionProps) {
  const [conceptFilter, setConceptFilter] = useState<ConceptFilter>('Todos');

  const filteredRows = useMemo(() => {
    if (conceptFilter === 'Todos') return rows;
    return rows.filter((r) => r.concept === conceptFilter);
  }, [rows, conceptFilter]);

  const approvedTotalClp = useMemo(
    () =>
      filteredRows
        .filter((r) => r.status === 'Aprobado')
        .reduce((acc, r) => acc + r.amountPaidClp, 0),
    [filteredRows]
  );

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === 'Pendiente de Validar').length,
    [rows]
  );

  const overdueCount = useMemo(
    () => rows.filter((r) => r.status === 'Atrasado/Multa').length,
    [rows]
  );

  // Último comprobante efectivamente subido (ordenado por fecha de envío más reciente)
  const latestUploadedRow = useMemo(() => {
    const uploaded = rows.filter((r) => r.receiptPreview !== null);
    if (uploaded.length === 0) return null;
    return [...uploaded].sort((a, b) =>
      b.sortTimestamp.localeCompare(a.sortTimestamp)
    )[0];
  }, [rows]);

  const renderStatusCell = (row: PaymentHistoryRow) => {
    if (row.status === 'Aprobado') {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-[#1B5E3A] whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Aprobado</span>
        </span>
      );
    }
    if (row.status === 'Pendiente de Validar') {
      return (
        <span className="inline-flex items-center gap-1.5 font-medium text-[#B45309] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Pendiente de Validar</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-[#B91C1C] whitespace-nowrap">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span>Atrasado/Multa</span>
      </span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
            <h3 id={headingId} className="text-sm sm:text-base font-semibold text-[#111827]">
              {title}
            </h3>
          </div>
          <p className="text-xs text-[#6B7280] mt-0.5 tabular-nums">
            Total aprobado ({conceptFilter.toLowerCase()}):{' '}
            <span className="font-mono font-semibold text-[#111827]">
              {formatClp(approvedTotalClp)}
            </span>
            {pendingCount > 0 && ` · ${pendingCount} pendiente${pendingCount === 1 ? '' : 's'} de validar`}
            {overdueCount > 0 && ` · ${overdueCount} atraso${overdueCount === 1 ? '' : 's'} con multa`}
          </p>
        </div>

        <div
          role="group"
          aria-label="Filtrar historial de pagos por concepto"
          className="inline-flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-lg self-start sm:self-auto shrink-0"
        >
          {(['Todos', 'Arriendo', 'Gasto Común'] as const).map((tab) => {
            const active = conceptFilter === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => setConceptFilter(tab)}
                className={`min-h-[32px] px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-white text-[#14294A] shadow-xs font-semibold'
                    : 'text-[#4B5563] hover:text-[#111827]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {viewerRole === 'tenant' && latestUploadedRow && (
        <div
          className={`rounded-lg border px-3.5 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 ${
            latestUploadedRow.status === 'Aprobado'
              ? 'bg-[#EEF6F1] border-[#BBF7D0] text-[#154B2E]'
              : 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {latestUploadedRow.status === 'Aprobado' ? (
              <CheckCircle2 className="w-4 h-4 text-[#1B5E3A] shrink-0" aria-hidden="true" />
            ) : (
              <Clock className="w-4 h-4 text-[#B45309] shrink-0" aria-hidden="true" />
            )}
            <span>
              Último comprobante subido ({latestUploadedRow.concept} ·{' '}
              <span className="font-semibold">{latestUploadedRow.periodLabel}</span>):{' '}
              <span className="font-semibold">
                {latestUploadedRow.status === 'Aprobado'
                  ? 'Aprobado por el propietario'
                  : 'Pendiente de Validar por el propietario'}
              </span>
            </span>
          </div>
          {latestUploadedRow.receiptPreview && (
            <button
              type="button"
              onClick={() => onViewReceipt(latestUploadedRow.receiptPreview!)}
              className="font-semibold underline underline-offset-4 cursor-pointer whitespace-nowrap"
            >
              Ver último comprobante
            </button>
          )}
        </div>
      )}

      {filteredRows.length === 0 ? (
        <p className="text-xs text-[#6B7280] py-3">
          No hay pagos ni comprobantes registrados aún para esta propiedad.
        </p>
      ) : (
        <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563]">
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Mes/Período</th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Concepto</th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Fecha de Pago</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right whitespace-nowrap">
                    Monto Pagado (CLP)
                  </th>
                  <th className="py-2.5 px-3.5 font-semibold whitespace-nowrap">Estado</th>
                  <th className="py-2.5 px-3.5 font-semibold text-right whitespace-nowrap">
                    Comprobante
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] bg-white">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-2.5 px-3.5 font-medium text-[#111827] whitespace-nowrap">
                      {row.periodLabel}
                    </td>
                    <td className="py-2.5 px-3.5 text-[#374151] whitespace-nowrap">
                      <span
                        className={
                          row.concept === 'Arriendo'
                            ? 'font-medium text-[#14294A]'
                            : 'font-medium text-[#4B5563]'
                        }
                      >
                        {row.concept}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-[#4B5563] font-mono tabular-nums whitespace-nowrap">
                      {row.paymentDateLabel}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                      {row.status === 'Atrasado/Multa' ? (
                        <div>
                          <span className="font-semibold text-[#B91C1C]">
                            {formatClp(row.amountPaidClp)}
                          </span>
                          {row.owedBreakdownLabel && (
                            <span className="block text-[11px] text-[#991B1B]">
                              {row.owedBreakdownLabel}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div>
                          <span className="font-semibold text-[#111827]">
                            {formatClp(row.amountPaidClp)}
                          </span>
                          {row.lateFeeClp && row.lateFeeClp > 0 ? (
                            <span className="block text-[11px] text-[#B45309]">
                              Incl. multa +{formatClp(row.lateFeeClp)}
                            </span>
                          ) : null}
                          {row.secondaryAmountLabel && (
                            <span className="block text-[11px] text-[#6B7280]">
                              ({row.secondaryAmountLabel})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">{renderStatusCell(row)}</td>
                    <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                      {row.receiptPreview ? (
                        <button
                          type="button"
                          onClick={() => onViewReceipt(row.receiptPreview!)}
                          className="inline-flex items-center gap-1.5 min-h-[32px] px-2.5 py-1 text-xs font-medium text-[#14294A] bg-white border border-[#D1D5DB] hover:border-[#14294A] hover:bg-[#F9FAFB] rounded-md transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>Ver Comprobante</span>
                        </button>
                      ) : (
                        <span className="text-[#9CA3AF]">Sin comprobante</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
