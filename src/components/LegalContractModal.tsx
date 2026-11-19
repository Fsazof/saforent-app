import { useEffect, useState } from 'react';
import { Download, FileText, Lock, X } from 'lucide-react';
import { Property } from '../types/saforent';
import { buildContractPdfBlobUrl } from '../utils/contractPdf';
import {
  formatDailyLateFeeLabel,
  formatGuaranteeLabel,
  formatRentPrimaryAndSecondary,
  formatSpanishDate,
} from '../utils/formatters';
import { IndicatorsSourceNotice } from './IndicatorsSourceNotice';

interface LegalContractModalProps {
  property: Property;
  ufValueClp: number;
  latestIpcPercent?: number;
  onClose: () => void;
}

export function LegalContractModal({
  property,
  ufValueClp,
  latestIpcPercent,
  onClose,
}: LegalContractModalProps) {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = buildContractPdfBlobUrl(property, ufValueClp);
    setPdfBlobUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [property, ufValueClp]);

  const baseRentAmount = property.baseRentAmount ?? property.rentAmount;
  const baseRentInfo = formatRentPrimaryAndSecondary(
    baseRentAmount,
    property.currency,
    ufValueClp
  );
  const rentInfo = formatRentPrimaryAndSecondary(
    property.rentAmount,
    property.currency,
    ufValueClp
  );
  const guaranteeInfo = formatGuaranteeLabel(property, ufValueClp);
  const lateFeeInfo = formatDailyLateFeeLabel(property, ufValueClp);
  const pdfFileName =
    property.signedContractFileName || `contrato_legal_${property.id}.pdf`;

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#111827]/55 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-contract-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[820px] my-auto shadow-xl">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#14294A] shrink-0" aria-hidden="true" />
              <h2 id="legal-contract-title" className="text-lg font-semibold text-[#111827] truncate">
                Contrato Legal Custodiado
              </h2>
            </div>
            <p className="text-xs text-[#6B7280] mt-0.5 truncate">
              {property.address}, {property.commune} · {pdfFileName}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pdfBlobUrl && (
              <a
                href={pdfBlobUrl}
                download={pdfFileName}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Descargar PDF</span>
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar visor legal"
              className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[84vh] overflow-y-auto">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-[#E5E7EB] pb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14294A]">
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Condiciones registradas del contrato firmado</span>
              </span>
              {property.signedContractUploadedAt && (
                <span className="text-xs text-[#6B7280]">
                  Archivado: {formatSpanishDate(property.signedContractUploadedAt.slice(0, 10))}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="block text-[#6B7280]">Arrendatario</span>
                <span className="font-semibold text-[#111827] text-sm">{property.tenantName}</span>
                {property.tenantEmail && (
                  <span className="block text-[#6B7280]">{property.tenantEmail}</span>
                )}
              </div>
              <div>
                <span className="block text-[#6B7280]">Monto Vigente a Pagar</span>
                <span className="font-semibold text-[#111827] text-sm font-mono tabular-nums">
                  {rentInfo.primary}
                </span>
                <span className="block text-[#6B7280] font-mono tabular-nums">
                  Canon Base fijo: {baseRentInfo.primary}
                </span>
              </div>
              <div>
                <span className="block text-[#6B7280]">Garantía Fija (en resguardo)</span>
                <span className="font-semibold text-[#14294A] text-sm font-mono tabular-nums">
                  {guaranteeInfo.primary}
                </span>
                <span className="block text-[#6B7280] font-mono tabular-nums">
                  {guaranteeInfo.secondary}
                </span>
              </div>
              <div>
                <span className="block text-[#6B7280]">Vigencia y pago</span>
                <span className="text-[#111827]">
                  {formatSpanishDate(property.contractStart)} al{' '}
                  {formatSpanishDate(property.contractEnd)}
                </span>
                <span className="block text-[#6B7280]">
                  Pago día {property.paymentDay} · IPC {property.ipcClause}
                </span>
              </div>
              <div>
                <span className="block text-[#6B7280]">Multa diaria por atraso</span>
                <span className="font-medium text-[#111827] font-mono tabular-nums">
                  {lateFeeInfo.primary}
                </span>
                <span className="block text-[#6B7280] font-mono tabular-nums">
                  {lateFeeInfo.secondary}
                </span>
              </div>
              <div>
                <span className="block text-[#6B7280]">Inscripción registral</span>
                <span className="font-mono text-[#111827] tabular-nums">
                  Rol {property.rolSii}
                </span>
                <span className="block font-mono text-[#6B7280] tabular-nums">
                  Foja {property.cbrsFoja} / N° {property.cbrsNumero} ({property.cbrsConservador})
                </span>
              </div>
            </div>

            {property.contractNotes && (
              <p className="text-xs text-[#4B5563] pt-2 border-t border-[#E5E7EB]">
                <span className="font-medium text-[#111827]">Notas: </span>
                {property.contractNotes}
              </p>
            )}

            <IndicatorsSourceNotice
              ufValueClp={ufValueClp}
              latestIpcPercent={latestIpcPercent}
              compact
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[#4B5563]">
                Documento PDF adjunto: <span className="font-mono text-[#111827]">{pdfFileName}</span>
              </p>
              {!property.signedContractDataUrl && (
                <span className="text-xs text-[#6B7280]">
                  Copia legal de respaldo generada para demostración
                </span>
              )}
            </div>
            {pdfBlobUrl && (
              <div className="border border-[#D1D5DB] rounded-lg overflow-hidden bg-[#F3F4F6] h-[360px] sm:h-[420px]">
                <iframe
                  title={`Contrato legal ${property.address}`}
                  src={pdfBlobUrl}
                  className="w-full h-full"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
