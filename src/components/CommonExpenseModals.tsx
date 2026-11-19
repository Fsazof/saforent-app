import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Building2, Download, FileText, Receipt, Upload, X } from 'lucide-react';
import {
  NewCommonExpenseInput,
  SubmitCommonExpenseReceiptInput,
} from '../hooks/useSaforentStore';
import { CommonExpenseRecord } from '../types/saforent';
import { buildCommonExpenseSlipPreview } from '../utils/commonExpensePdf';
import { DEFAULT_SIMULATED_DATE, formatClp, formatSpanishDate } from '../utils/formatters';

interface AttachCommonExpenseModalProps {
  propertyAddress: string;
  propertyCommune: string;
  referenceAmountClp?: number;
  simulatedDate?: string;
  onClose: () => void;
  onSubmit: (data: NewCommonExpenseInput) => void;
}

const SPANISH_MONTHS_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function getDefaultPeriodLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate || DEFAULT_SIMULATED_DATE}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Noviembre 2026';
  return `${SPANISH_MONTHS_FULL[parsed.getMonth()]} ${parsed.getFullYear()}`;
}

function getDefaultDueDate(isoDate: string): string {
  const base = isoDate || DEFAULT_SIMULATED_DATE;
  return `${base.slice(0, 7)}-20`;
}

export function AttachCommonExpenseModal({
  propertyAddress,
  propertyCommune,
  referenceAmountClp,
  simulatedDate = DEFAULT_SIMULATED_DATE,
  onClose,
  onSubmit,
}: AttachCommonExpenseModalProps) {
  const [periodLabel, setPeriodLabel] = useState(() => getDefaultPeriodLabel(simulatedDate));
  const [amountStr, setAmountStr] = useState(
    referenceAmountClp && referenceAmountClp > 0 ? String(referenceAmountClp) : ''
  );
  const [dueDate, setDueDate] = useState(() => getDefaultDueDate(simulatedDate));
  const [billFileName, setBillFileName] = useState('');
  const [billDataUrl, setBillDataUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  const handleBillFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBillFileName(file.name);
    setError('');
    if (file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setBillDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setBillDataUrl(undefined);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amountClp = Number(amountStr);
    if (!periodLabel.trim()) {
      setError('Indica el mes correspondiente al gasto común.');
      return;
    }
    if (!Number.isFinite(amountClp) || amountClp <= 0) {
      setError('Ingresa el monto exacto cobrado este mes en CLP.');
      return;
    }
    if (!dueDate) {
      setError('Selecciona la fecha límite de pago.');
      return;
    }
    if (!billFileName.trim()) {
      setError('Adjunta la colilla o boleta del edificio o condominio.');
      return;
    }
    setError('');
    onSubmit({
      periodLabel: periodLabel.trim(),
      amountClp: Math.round(amountClp),
      dueDate,
      billFileName: billFileName.trim(),
      billDataUrl,
    });
    onClose();
  };

  const parsedAmount = Number(amountStr) || 0;

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#111827]/55 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="attach-gc-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[540px] my-auto shadow-xl">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#14294A] shrink-0" aria-hidden="true" />
            <h2 id="attach-gc-title" className="text-lg font-semibold text-[#111827]">
              Anexar Gasto Común del Mes
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3.5 text-xs text-[#4B5563]">
            <p className="font-semibold text-[#111827] text-sm">
              {propertyAddress}, {propertyCommune}
            </p>
            {referenceAmountClp !== undefined && referenceAmountClp > 0 && (
              <p className="mt-0.5 font-mono tabular-nums">
                Monto referencial configurado: {formatClp(referenceAmountClp)} · Se notificará al
                arrendatario con el monto exacto del mes.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="gc-period" className="block text-xs font-medium text-[#4B5563] mb-1">
                Mes cobrado
              </label>
              <input
                id="gc-period"
                type="text"
                required
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="Ej. Noviembre 2026"
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
              />
            </div>

            <div>
              <label htmlFor="gc-due" className="block text-xs font-medium text-[#4B5563] mb-1">
                Fecha límite de pago
              </label>
              <input
                id="gc-due"
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="gc-amount" className="block text-xs font-medium text-[#4B5563] mb-1">
              Monto exacto cobrado este mes (CLP)
            </label>
            <input
              id="gc-amount"
              type="number"
              min="1"
              step="100"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Ej. 98400"
              className="w-full min-h-[42px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
            />
            {parsedAmount > 0 && (
              <p className="text-xs text-[#6B7280] font-mono tabular-nums mt-1">
                {formatClp(parsedAmount)}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="gc-bill-file" className="block text-xs font-medium text-[#4B5563] mb-1">
              Colilla o boleta del edificio / condominio (PDF o imagen)
            </label>
            <label
              htmlFor="gc-bill-file"
              className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {billFileName ? (
                  <FileText className="w-4 h-4 text-[#1B5E3A] shrink-0" aria-hidden="true" />
                ) : (
                  <Upload className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm text-[#111827] truncate">
                  {billFileName || 'Adjuntar colilla del condominio (PDF o imagen)...'}
                </span>
              </div>
              <span className="text-xs font-medium text-[#14294A] shrink-0">
                {billFileName ? 'Cambiar' : 'Seleccionar'}
              </span>
              <input
                id="gc-bill-file"
                type="file"
                accept=".pdf,image/*"
                onChange={handleBillFileChange}
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
              Guardar y Publicar Gasto Común
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface CommonExpenseSlipModalProps {
  expense: CommonExpenseRecord;
  propertyAddress: string;
  propertyCommune: string;
  onClose: () => void;
}

export function CommonExpenseSlipModal({
  expense,
  propertyAddress,
  propertyCommune,
  onClose,
}: CommonExpenseSlipModalProps) {
  const [preview, setPreview] = useState<{
    url: string;
    kind: 'image' | 'pdf';
    revokeOnCleanup: boolean;
  } | null>(null);

  useEffect(() => {
    const built = buildCommonExpenseSlipPreview(expense, propertyAddress, propertyCommune);
    setPreview(built);
    return () => {
      if (built.revokeOnCleanup) {
        URL.revokeObjectURL(built.url);
      }
    };
  }, [expense, propertyAddress, propertyCommune]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#111827]/55 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gc-slip-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[760px] my-auto shadow-xl">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#14294A] shrink-0" aria-hidden="true" />
              <h2 id="gc-slip-title" className="text-lg font-semibold text-[#111827] truncate">
                Colilla Gasto Común · {expense.periodLabel}
              </h2>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">
              {propertyAddress}, {propertyCommune} · {expense.billFileName}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {preview && (
              <a
                href={preview.url}
                download={expense.billFileName}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Descargar</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar colilla"
              className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="block text-[#6B7280]">Período</span>
              <span className="font-semibold text-[#111827] text-sm">{expense.periodLabel}</span>
            </div>
            <div>
              <span className="block text-[#6B7280]">Monto exacto</span>
              <span className="font-bold text-[#14294A] text-sm font-mono tabular-nums">
                {formatClp(expense.amountClp)}
              </span>
            </div>
            <div>
              <span className="block text-[#6B7280]">Fecha límite</span>
              <span className="font-medium text-[#111827] text-sm">
                {formatSpanishDate(expense.dueDate)}
              </span>
            </div>
          </div>

          {preview &&
            (preview.kind === 'image' ? (
              <div className="border border-[#D1D5DB] rounded-lg overflow-hidden bg-[#F3F4F6] p-3 flex justify-center">
                <img
                  src={preview.url}
                  alt={`Colilla gasto común ${expense.periodLabel}`}
                  className="max-h-[420px] object-contain rounded"
                />
              </div>
            ) : (
              <div className="border border-[#D1D5DB] rounded-lg overflow-hidden bg-[#F3F4F6] h-[360px] sm:h-[420px]">
                <iframe
                  title={`Colilla gasto común ${expense.periodLabel}`}
                  src={preview.url}
                  className="w-full h-full"
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

interface UploadCommonExpenseReceiptModalProps {
  expense: CommonExpenseRecord;
  propertyAddress: string;
  propertyCommune: string;
  onClose: () => void;
  onSubmit: (data: SubmitCommonExpenseReceiptInput) => void;
}

export function UploadCommonExpenseReceiptModal({
  expense,
  propertyAddress,
  propertyCommune,
  onClose,
  onSubmit,
}: UploadCommonExpenseReceiptModalProps) {
  const [method, setMethod] = useState('Transferencia Bancaria');
  const [referenceCode, setReferenceCode] = useState('');
  const [fileName, setFileName] = useState(
    `comprobante_gc_${expense.periodLabel.toLowerCase().replace(/\s+/g, '_')}.pdf`
  );
  const [fileDataUrl, setFileDataUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) {
      setError('Adjunta el archivo del comprobante de pago.');
      return;
    }
    setError('');
    onSubmit({
      method,
      referenceCode,
      fileName: fileName.trim(),
      fileDataUrl,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-gc-receipt-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[520px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#1B5E3A] shrink-0" aria-hidden="true" />
            <h2 id="upload-gc-receipt-title" className="text-lg font-semibold text-[#111827]">
              Subir Comprobante Gasto Común
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3.5 space-y-1 text-xs">
            <p className="font-semibold text-[#111827] text-sm">
              {expense.periodLabel} · {propertyAddress}, {propertyCommune}
            </p>
            <p className="text-[#4B5563]">
              Monto exacto colilla:{' '}
              <span className="font-bold text-[#14294A] font-mono tabular-nums">
                {formatClp(expense.amountClp)}
              </span>{' '}
              · Vence {formatSpanishDate(expense.dueDate)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="gc-rec-method" className="block text-xs font-medium text-[#4B5563] mb-1">
                Medio de pago
              </label>
              <select
                id="gc-rec-method"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg"
              >
                <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                <option value="Portal Comunidad / Edificio">Portal Comunidad / Edificio</option>
                <option value="Webpay / Botón de Pago">Webpay / Botón de Pago</option>
              </select>
            </div>

            <div>
              <label htmlFor="gc-rec-ref" className="block text-xs font-medium text-[#4B5563] mb-1">
                N° de operación (opcional)
              </label>
              <input
                id="gc-rec-ref"
                type="text"
                value={referenceCode}
                onChange={(e) => setReferenceCode(e.target.value)}
                placeholder="Ej. TRF-512098"
                className="w-full min-h-[42px] px-3 py-2 text-sm font-mono border border-[#D1D5DB] rounded-lg"
              />
            </div>
          </div>

          <div>
            <label htmlFor="gc-rec-file" className="block text-xs font-medium text-[#4B5563] mb-1">
              Archivo del comprobante (PDF o imagen)
            </label>
            <label
              htmlFor="gc-rec-file"
              className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Upload className="w-4 h-4 text-[#1B5E3A] shrink-0" aria-hidden="true" />
                <span className="text-sm text-[#111827] truncate">{fileName}</span>
              </div>
              <span className="text-xs font-medium text-[#14294A] shrink-0">Cambiar archivo</span>
              <input
                id="gc-rec-file"
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileChange}
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
              className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg cursor-pointer"
            >
              Enviar Comprobante
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
