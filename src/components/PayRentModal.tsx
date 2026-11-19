import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Landmark,
  Upload,
  X,
} from 'lucide-react';
import {
  NewReceiptInput,
  SimulateOnlinePaymentInput,
  SimulateOnlinePaymentResult,
} from '../hooks/useSaforentStore';
import { CommonExpenseRecord, TenantPropertyView } from '../types/saforent';
import {
  addMonthsIsoDate,
  calculateLateFeeSummary,
  DEFAULT_SIMULATED_DATE,
  formatClp,
  formatDailyLateFeeLabel,
  formatSpanishDate,
  formatUf,
  toClp,
  toUf,
} from '../utils/formatters';
import {
  formatIsoDateToPeriodLabel,
  PaymentReceiptPreviewData,
} from '../utils/paymentHistory';
import { buildPaymentReceiptPreview } from '../utils/paymentReceiptPdf';

interface PayRentModalProps {
  property: TenantPropertyView;
  ufValueClp: number;
  simulatedDate?: string;
  pendingCommonExpense?: CommonExpenseRecord | null;
  onClose: () => void;
  onSimulateOnlinePayment: (data: SimulateOnlinePaymentInput) => SimulateOnlinePaymentResult;
  onSubmitManualReceipt: (data: NewReceiptInput) => void;
}

const ONLINE_CHANNELS = [
  'Pago en Línea · Pasarela Simulada',
  'Transferencia Electrónica (Demo)',
  'Tarjeta de Débito / Crédito (Demo)',
] as const;

export function PayRentModal({
  property,
  ufValueClp,
  simulatedDate = DEFAULT_SIMULATED_DATE,
  pendingCommonExpense = null,
  onClose,
  onSimulateOnlinePayment,
  onSubmitManualReceipt,
}: PayRentModalProps) {
  const dailyLateFee = formatDailyLateFeeLabel(property, ufValueClp);
  const lateSummary = calculateLateFeeSummary(property, ufValueClp, simulatedDate);

  const periodOptions = Array.from(
    new Set([
      ...(lateSummary.isOverdue && property.nextPaymentDate
        ? [formatIsoDateToPeriodLabel(property.nextPaymentDate)]
        : []),
      formatIsoDateToPeriodLabel(simulatedDate),
      formatIsoDateToPeriodLabel(addMonthsIsoDate(simulatedDate, 1, 1)),
      formatIsoDateToPeriodLabel(addMonthsIsoDate(simulatedDate, 2, 1)),
    ])
  );

  const [activeTab, setActiveTab] = useState<'online' | 'manual'>('online');
  const [periodLabel, setPeriodLabel] = useState(periodOptions[0] || 'Noviembre 2026');
  const [includeCommonExpense, setIncludeCommonExpense] = useState<boolean>(
    Boolean(property.paysCommonExpenses && pendingCommonExpense)
  );
  const [selectedChannel, setSelectedChannel] = useState<string>(ONLINE_CHANNELS[0]);
  const [copiedBankData, setCopiedBankData] = useState(false);

  // Recibo digital automático generado tras simular pago exitoso
  const [completedDigitalReceipt, setCompletedDigitalReceipt] = useState<{
    result: SimulateOnlinePaymentResult;
    includedGcAmountClp: number;
    includedGcPeriod?: string;
    rentClp: number;
    lateFeeClp: number;
    channelLabel: string;
    periodLabel: string;
  } | null>(null);
  const [receiptPdfUrl, setReceiptPdfUrl] = useState<string | null>(null);

  // Estado Alternativa B — Subir Comprobante Manual
  const [amountStr, setAmountStr] = useState(
    String(lateSummary.isOverdue ? lateSummary.totalDueInRentCurrency : property.rentAmount)
  );
  const [manualMethod, setManualMethod] = useState('Transferencia Bancaria');
  const [referenceCode, setReferenceCode] = useState('');
  const [fileName, setFileName] = useState('comprobante_transferencia_nov.pdf');
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  const rentClp = lateSummary.baseClp;
  const lateFeeClp = lateSummary.isOverdue ? lateSummary.accumulatedClp : 0;
  const activeGcClp =
    property.paysCommonExpenses && pendingCommonExpense && includeCommonExpense
      ? pendingCommonExpense.amountClp
      : 0;
  const totalExactClp = rentClp + lateFeeClp + activeGcClp;

  const ownerBankData = {
    accountHolder: property.ownerName,
    rut: '14.829.410-3',
    bankName: 'Banco Demo Chile',
    accountType: 'Cuenta Corriente',
    accountNumber: '00-418-29501-04',
    email: 'pagos@saforent.cl',
  };

  useEffect(() => {
    if (!completedDigitalReceipt) {
      setReceiptPdfUrl(null);
      return;
    }
    const previewData: PaymentReceiptPreviewData = {
      id: completedDigitalReceipt.result.receiptId,
      concept: 'Arriendo',
      periodLabel: completedDigitalReceipt.periodLabel,
      paymentDateLabel: formatSpanishDate(completedDigitalReceipt.result.submittedAt.slice(0, 10)),
      amountClp: completedDigitalReceipt.rentClp + completedDigitalReceipt.lateFeeClp,
      lateFeeClp:
        completedDigitalReceipt.lateFeeClp > 0 ? completedDigitalReceipt.lateFeeClp : undefined,
      method: completedDigitalReceipt.channelLabel,
      referenceCode: completedDigitalReceipt.result.referenceCode,
      fileName: completedDigitalReceipt.result.fileName,
      status: 'Aprobado',
    };
    const built = buildPaymentReceiptPreview(previewData, property.address, property.commune);
    setReceiptPdfUrl(built.url);
    return () => {
      if (built.revokeOnCleanup) {
        URL.revokeObjectURL(built.url);
      }
    };
  }, [completedDigitalReceipt, property.address, property.commune]);

  const handleCopyBankDetails = async () => {
    const textToCopy = [
      `Titular: ${ownerBankData.accountHolder}`,
      `RUT: ${ownerBankData.rut}`,
      `Banco: ${ownerBankData.bankName}`,
      `Tipo de Cuenta: ${ownerBankData.accountType}`,
      `N° de Cuenta: ${ownerBankData.accountNumber}`,
      `Correo: ${ownerBankData.email}`,
      `Monto a transferir: ${formatClp(totalExactClp)}`,
    ].join('\n');

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const area = document.createElement('textarea');
        area.value = textToCopy;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopiedBankData(true);
      window.setTimeout(() => setCopiedBankData(false), 2600);
    } catch {
      setCopiedBankData(true);
      window.setTimeout(() => setCopiedBankData(false), 2600);
    }
  };

  const handleSimulateOnlinePay = () => {
    const gcIncluded = Boolean(
      property.paysCommonExpenses && pendingCommonExpense && includeCommonExpense
    );
    const result = onSimulateOnlinePayment({
      periodLabel,
      rentAmountClp: rentClp,
      lateFeeClp,
      commonExpenseId: gcIncluded && pendingCommonExpense ? pendingCommonExpense.id : undefined,
      commonExpenseAmountClp:
        gcIncluded && pendingCommonExpense ? pendingCommonExpense.amountClp : 0,
      channelLabel: selectedChannel,
    });

    setCompletedDigitalReceipt({
      result,
      includedGcAmountClp:
        gcIncluded && pendingCommonExpense ? pendingCommonExpense.amountClp : 0,
      includedGcPeriod: gcIncluded && pendingCommonExpense ? pendingCommonExpense.periodLabel : undefined,
      rentClp,
      lateFeeClp,
      channelLabel: selectedChannel,
      periodLabel,
    });
  };

  const handleManualFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setFileDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setFileDataUrl(undefined);
    }
  };

  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(amountStr);
    if (!amount || amount <= 0) {
      setError('Ingresa el monto pagado.');
      return;
    }
    setError('');
    onSubmitManualReceipt({
      periodLabel,
      amount,
      currency: property.currency,
      method: manualMethod,
      referenceCode,
      fileName,
      fileDataUrl,
    });
    onClose();
  };

  const parsedManualAmount = Number(amountStr) || 0;
  const equivLabel =
    property.currency === 'CLP'
      ? formatUf(toUf(parsedManualAmount, 'CLP', ufValueClp))
      : formatClp(toClp(parsedManualAmount, 'UF', ufValueClp));

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pay-rent-modal-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[680px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="pay-rent-modal-title" className="text-lg font-semibold text-[#111827]">
              {completedDigitalReceipt
                ? 'Recibo Digital de Pago en Línea'
                : 'Pagar Arriendo y Multas'}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">
              {property.address}, {property.commune}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de pago"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[84vh] overflow-y-auto">
          {completedDigitalReceipt ? (
            <div className="space-y-5">
              <div className="bg-[#EEF6F1] border border-[#BBF7D0] rounded-xl p-5 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#1B5E3A] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[#154B2E]">
                    Pago en línea procesado y aprobado al instante
                  </p>
                  <p className="text-xs text-[#1B5E3A]">
                    Se generó tu recibo digital automático y ya quedó registrado en el Historial de
                    Pagos y en los gráficos financieros del propietario.
                  </p>
                </div>
              </div>

              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <span className="block text-[#6B7280]">N° Transacción</span>
                    <span className="font-mono font-semibold text-[#111827] text-sm">
                      {completedDigitalReceipt.result.referenceCode}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[#6B7280]">Período</span>
                    <span className="font-semibold text-[#111827] text-sm">
                      {completedDigitalReceipt.periodLabel}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[#6B7280]">Canal de pago</span>
                    <span className="font-medium text-[#111827]">
                      {completedDigitalReceipt.channelLabel}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[#6B7280]">Estado</span>
                    <span className="font-semibold text-[#1B5E3A]">Aprobado al día</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-[#E5E7EB] space-y-1.5 font-mono tabular-nums">
                  <div className="flex justify-between text-[#374151]">
                    <span>Canon de arriendo</span>
                    <span>{formatClp(completedDigitalReceipt.rentClp)}</span>
                  </div>
                  {completedDigitalReceipt.lateFeeClp > 0 && (
                    <div className="flex justify-between text-[#B45309]">
                      <span>Multa por atraso regularizada</span>
                      <span>+{formatClp(completedDigitalReceipt.lateFeeClp)}</span>
                    </div>
                  )}
                  {completedDigitalReceipt.includedGcAmountClp > 0 && (
                    <div className="flex justify-between text-[#374151]">
                      <span>
                        Gasto Común ({completedDigitalReceipt.includedGcPeriod ?? 'Mes'})
                      </span>
                      <span>+{formatClp(completedDigitalReceipt.includedGcAmountClp)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-[#D1D5DB] text-sm font-bold text-[#14294A]">
                    <span>Total pagado</span>
                    <span>{formatClp(completedDigitalReceipt.result.totalPaidClp)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
                {receiptPdfUrl && (
                  <a
                    href={receiptPdfUrl}
                    download={completedDigitalReceipt.result.fileName}
                    className="inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-sm font-medium text-[#14294A] bg-white border border-[#D1D5DB] hover:border-[#14294A] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Descargar Recibo Digital (PDF)</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg transition-colors cursor-pointer"
                >
                  Listo · Ver en Historial de Pagos
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Desglose exacto a pagar hoy */}
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#14294A]">
                    Desglose exacto a pagar hoy
                  </span>
                  <div className="flex items-center gap-2">
                    <label htmlFor="pay-period-select" className="text-xs text-[#6B7280]">
                      Período:
                    </label>
                    <select
                      id="pay-period-select"
                      value={periodLabel}
                      onChange={(e) => setPeriodLabel(e.target.value)}
                      className="px-2.5 py-1 text-xs font-medium text-[#111827] bg-white border border-[#D1D5DB] rounded-md cursor-pointer"
                    >
                      {periodOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#4B5563]">
                      Canon de arriendo vigente
                      {property.currency === 'UF' && (
                        <span className="text-xs text-[#6B7280] font-mono ml-1.5">
                          ({formatUf(property.rentAmount)})
                        </span>
                      )}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#111827]">
                      {formatClp(rentClp)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className={lateSummary.isOverdue ? 'text-[#991B1B] font-medium' : 'text-[#4B5563]'}>
                      Multa por atraso acumulada
                      {lateSummary.isOverdue
                        ? ` (${lateSummary.daysOverdue} día${lateSummary.daysOverdue === 1 ? '' : 's'} · ${dailyLateFee.primary})`
                        : ' (sin atraso)'}
                    </span>
                    <span
                      className={`font-mono tabular-nums font-semibold ${
                        lateSummary.isOverdue ? 'text-[#B91C1C]' : 'text-[#6B7280]'
                      }`}
                    >
                      {lateSummary.isOverdue ? `+${formatClp(lateFeeClp)}` : formatClp(0)}
                    </span>
                  </div>

                  {property.paysCommonExpenses && pendingCommonExpense ? (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="inline-flex items-center gap-2 text-[#374151] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeCommonExpense}
                          onChange={(e) => setIncludeCommonExpense(e.target.checked)}
                          className="w-4 h-4 rounded border-[#D1D5DB] accent-[#14294A] cursor-pointer"
                        />
                        <span>
                          Gasto Común del mes ({pendingCommonExpense.periodLabel})
                          {pendingCommonExpense.status === 'atrasado' && (
                            <span className="text-xs font-semibold text-[#B91C1C] ml-1.5">
                              (Atrasado)
                            </span>
                          )}
                        </span>
                      </label>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          includeCommonExpense ? 'text-[#111827]' : 'text-[#9CA3AF] line-through'
                        }`}
                      >
                        +{formatClp(pendingCommonExpense.amountClp)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3 text-[#6B7280]">
                      <span>
                        Gasto Común del mes (
                        {property.paysCommonExpenses ? 'Al día / sin cobro pendiente' : 'No aplica'})
                      </span>
                      <span className="font-mono tabular-nums">{formatClp(0)}</span>
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-[#D1D5DB] flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-[#111827]">
                      Total exacto a pagar hoy
                    </span>
                    <div className="text-right">
                      <span className="text-lg sm:text-xl font-bold text-[#14294A] font-mono tabular-nums block">
                        {formatClp(totalExactClp)}
                      </span>
                      <span className="text-xs text-[#6B7280] font-mono tabular-nums">
                        Eq. {formatUf(toUf(totalExactClp, 'CLP', ufValueClp))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selector de 2 alternativas simples */}
              <div
                role="tablist"
                aria-label="Alternativas de pago"
                className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1 bg-[#F3F4F6] rounded-lg"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'online'}
                  onClick={() => setActiveTab('online')}
                  className={`min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-2 ${
                    activeTab === 'online'
                      ? 'bg-white text-[#14294A] shadow-xs font-semibold'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Pago en Línea / Transferencia Bancaria</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'manual'}
                  onClick={() => setActiveTab('manual')}
                  className={`min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors cursor-pointer inline-flex items-center justify-center gap-2 ${
                    activeTab === 'manual'
                      ? 'bg-white text-[#14294A] shadow-xs font-semibold'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Subir Comprobante Manual</span>
                </button>
              </div>

              {activeTab === 'online' ? (
                <div className="space-y-4">
                  {/* Datos bancarios del propietario + botón Copiar datos */}
                  <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
                        <span className="text-xs sm:text-sm font-semibold text-[#111827]">
                          Datos bancarios del propietario para transferencia
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyBankDetails}
                        className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                          copiedBankData
                            ? 'bg-[#EEF6F1] text-[#1B5E3A] border-[#BBF7D0]'
                            : 'bg-white text-[#14294A] border-[#D1D5DB] hover:border-[#14294A]'
                        }`}
                      >
                        {copiedBankData ? (
                          <>
                            <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>¡Datos copiados!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Copiar datos</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <span className="block text-[#6B7280]">Titular</span>
                        <span className="font-medium text-[#111827]">
                          {ownerBankData.accountHolder}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[#6B7280]">RUT</span>
                        <span className="font-mono tabular-nums text-[#111827]">
                          {ownerBankData.rut}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[#6B7280]">Banco</span>
                        <span className="font-medium text-[#111827]">
                          {ownerBankData.bankName}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[#6B7280]">Tipo de Cuenta</span>
                        <span className="text-[#111827]">{ownerBankData.accountType}</span>
                      </div>
                      <div>
                        <span className="block text-[#6B7280]">N° de Cuenta</span>
                        <span className="font-mono tabular-nums font-semibold text-[#111827]">
                          {ownerBankData.accountNumber}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[#6B7280]">Correo aviso</span>
                        <span className="text-[#111827] truncate block">{ownerBankData.email}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pasarela simulada en línea */}
                  <div className="bg-[#EEF6F1]/60 border border-[#BBF7D0] rounded-lg p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label
                          htmlFor="online-channel-select"
                          className="block text-xs font-semibold text-[#154B2E]"
                        >
                          Medio para pago en línea inmediato
                        </label>
                        <p className="text-xs text-[#4B5563]">
                          Emite recibo digital automático y actualiza el historial y gráficos al
                          instante.
                        </p>
                      </div>
                      <select
                        id="online-channel-select"
                        value={selectedChannel}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="min-h-[38px] px-3 py-1.5 text-xs font-medium text-[#111827] bg-white border border-[#D1D5DB] rounded-lg cursor-pointer shrink-0"
                      >
                        {ONLINE_CHANNELS.map((ch) => (
                          <option key={ch} value={ch}>
                            {ch}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSimulateOnlinePay}
                        className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>
                          Simular Pago Exitoso en Línea ({formatClp(totalExactClp)})
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="rec-amount"
                        className="block text-xs font-medium text-[#4B5563] mb-1"
                      >
                        Monto transferido ({property.currency})
                      </label>
                      <input
                        id="rec-amount"
                        type="number"
                        step={property.currency === 'UF' ? '0.1' : '1000'}
                        value={amountStr}
                        onChange={(e) => setAmountStr(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg"
                      />
                      <p className="text-xs text-[#6B7280] mt-1 tabular-nums">Eq. {equivLabel}</p>
                    </div>

                    <div>
                      <label
                        htmlFor="rec-method"
                        className="block text-xs font-medium text-[#4B5563] mb-1"
                      >
                        Medio de pago
                      </label>
                      <select
                        id="rec-method"
                        value={manualMethod}
                        onChange={(e) => setManualMethod(e.target.value)}
                        className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg"
                      >
                        <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                        <option value="Khipu / Botón de Pago">Khipu / Botón de Pago</option>
                        <option value="Depósito en Cuenta">Depósito en Cuenta</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="rec-ref"
                      className="block text-xs font-medium text-[#4B5563] mb-1"
                    >
                      N° de operación (opcional)
                    </label>
                    <input
                      id="rec-ref"
                      type="text"
                      value={referenceCode}
                      onChange={(e) => setReferenceCode(e.target.value)}
                      placeholder="Ej. TRF-992014"
                      className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-[#D1D5DB] rounded-lg"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="rec-file"
                      className="block text-xs font-medium text-[#4B5563] mb-1"
                    >
                      Archivo del comprobante (PDF o imagen)
                    </label>
                    <label
                      htmlFor="rec-file"
                      className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Upload className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
                        <span className="text-sm text-[#111827] truncate">{fileName}</span>
                      </div>
                      <span className="text-xs font-medium text-[#14294A] shrink-0">
                        Cambiar archivo
                      </span>
                      <input
                        id="rec-file"
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleManualFileChange}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {error && (
                    <p role="alert" className="text-sm text-[#B91C1C]">
                      {error}
                    </p>
                  )}

                  <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg cursor-pointer"
                    >
                      Enviar Comprobante Manual
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
