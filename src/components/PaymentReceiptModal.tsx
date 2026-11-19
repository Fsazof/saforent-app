import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Download, FileText, X } from 'lucide-react';
import { formatClp } from '../utils/formatters';
import { PaymentReceiptPreviewData } from '../utils/paymentHistory';
import {
  buildPaymentReceiptPreview,
  PaymentReceiptPreviewResult,
} from '../utils/paymentReceiptPdf';

interface PaymentReceiptModalProps {
  receipt: PaymentReceiptPreviewData;
  propertyAddress: string;
  propertyCommune: string;
  onClose: () => void;
}

export function PaymentReceiptModal({
  receipt,
  propertyAddress,
  propertyCommune,
  onClose,
}: PaymentReceiptModalProps) {
  const [preview, setPreview] = useState<PaymentReceiptPreviewResult | null>(null);

  useEffect(() => {
    const built = buildPaymentReceiptPreview(receipt, propertyAddress, propertyCommune);
    setPreview(built);
    return () => {
      if (built.revokeOnCleanup) {
        URL.revokeObjectURL(built.url);
      }
    };
  }, [receipt, propertyAddress, propertyCommune]);

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#111827]/55 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-receipt-preview-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[760px] my-auto shadow-xl">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#14294A] shrink-0" aria-hidden="true" />
              <h2
                id="payment-receipt-preview-title"
                className="text-lg font-semibold text-[#111827] truncate"
              >
                Comprobante de {receipt.concept} · {receipt.periodLabel}
              </h2>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">
              {propertyAddress}, {propertyCommune} · {receipt.fileName}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {preview && (
              <a
                href={preview.url}
                download={receipt.fileName}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Descargar</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar comprobante"
              className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="block text-[#6B7280]">Concepto y Período</span>
              <span className="font-semibold text-[#111827] text-sm">
                {receipt.concept} · {receipt.periodLabel}
              </span>
            </div>
            <div>
              <span className="block text-[#6B7280]">Monto pagado</span>
              <span className="font-bold text-[#14294A] text-sm font-mono tabular-nums">
                {formatClp(receipt.amountClp)}
              </span>
              {receipt.lateFeeClp !== undefined && receipt.lateFeeClp > 0 && (
                <span className="block text-[#B45309] font-mono tabular-nums">
                  Incl. multa +{formatClp(receipt.lateFeeClp)}
                </span>
              )}
              {receipt.originalAmountLabel && (
                <span className="block text-[#6B7280] font-mono tabular-nums">
                  ({receipt.originalAmountLabel})
                </span>
              )}
            </div>
            <div>
              <span className="block text-[#6B7280]">Fecha y Medio</span>
              <span className="font-medium text-[#111827] block">{receipt.paymentDateLabel}</span>
              <span className="text-[#6B7280] font-mono">
                {receipt.method} · {receipt.referenceCode || 'S/N'}
              </span>
            </div>
            <div>
              <span className="block text-[#6B7280]">Estado</span>
              {receipt.status === 'Aprobado' && (
                <span className="inline-flex items-center gap-1 font-semibold text-[#1B5E3A] mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Aprobado</span>
                </span>
              )}
              {receipt.status === 'Pendiente de Validar' && (
                <span className="inline-flex items-center gap-1 font-semibold text-[#B45309] mt-0.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Pendiente de Validar</span>
                </span>
              )}
              {receipt.status === 'Atrasado/Multa' && (
                <span className="inline-flex items-center gap-1 font-semibold text-[#B91C1C] mt-0.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Atrasado/Multa</span>
                </span>
              )}
            </div>
          </div>

          {preview &&
            (preview.kind === 'image' ? (
              <div className="border border-[#D1D5DB] rounded-lg overflow-hidden bg-[#F3F4F6] p-3 flex justify-center">
                <img
                  src={preview.url}
                  alt={`Comprobante de ${receipt.concept} ${receipt.periodLabel}`}
                  className="max-h-[420px] object-contain rounded"
                />
              </div>
            ) : (
              <div className="border border-[#D1D5DB] rounded-lg overflow-hidden bg-[#F3F4F6] h-[360px] sm:h-[420px]">
                <iframe
                  title={`Comprobante de ${receipt.concept} ${receipt.periodLabel}`}
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
