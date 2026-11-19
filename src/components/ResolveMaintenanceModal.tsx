import { ChangeEvent, FormEvent, useState } from 'react';
import { CheckCircle2, Upload, X } from 'lucide-react';
import { ResolveMaintenanceInput } from '../hooks/useSaforentStore';
import { formatClp } from '../utils/formatters';

interface ResolveMaintenanceModalProps {
  propertyAddress: string;
  propertyCommune: string;
  defaultItemDetail: string;
  onClose: () => void;
  onConfirm: (data: ResolveMaintenanceInput) => void;
}

export function ResolveMaintenanceModal({
  propertyAddress,
  propertyCommune,
  defaultItemDetail,
  onClose,
  onConfirm,
}: ResolveMaintenanceModalProps) {
  const [itemDetail, setItemDetail] = useState(defaultItemDetail);
  const [amountStr, setAmountStr] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFileName(file.name);
      setError('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amountClp = Number(amountStr);
    if (!itemDetail.trim()) {
      setError('Ingresa el detalle del arreglo realizado.');
      return;
    }
    if (!Number.isFinite(amountClp) || amountClp <= 0) {
      setError('Ingresa el monto pagado en CLP por la reparación.');
      return;
    }
    if (!receiptFileName.trim()) {
      setError('Sube la boleta o comprobante de respaldo del gasto.');
      return;
    }
    setError('');
    onConfirm({
      itemDetail: itemDetail.trim(),
      amountClp: Math.round(amountClp),
      receiptFileName: receiptFileName.trim(),
    });
    onClose();
  };

  const parsedAmount = Number(amountStr) || 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resolve-maint-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[520px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#1B5E3A]" aria-hidden="true" />
            <h2 id="resolve-maint-title" className="text-lg font-semibold text-[#111827]">
              Marcar Avería como Resuelta
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3.5 text-sm">
            <p className="font-medium text-[#111827]">
              {propertyAddress} · {propertyCommune}
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Este gasto se guardará únicamente en el Historial Privado de Gastos del Propietario.
            </p>
          </div>

          <div>
            <label htmlFor="res-item" className="block text-xs font-medium text-[#4B5563] mb-1">
              Ítem / detalle de la reparación
            </label>
            <input
              id="res-item"
              type="text"
              required
              value={itemDetail}
              onChange={(e) => setItemDetail(e.target.value)}
              placeholder="Ej. Reparación placa equipo split y recarga refrigerante"
              className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
            />
          </div>

          <div>
            <label htmlFor="res-amount" className="block text-xs font-medium text-[#4B5563] mb-1">
              Monto pagado por la reparación (CLP)
            </label>
            <input
              id="res-amount"
              type="number"
              min="1"
              step="500"
              required
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Ej. 85000"
              className="w-full min-h-[42px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
            />
            {parsedAmount > 0 && (
              <p className="text-xs text-[#6B7280] mt-1 font-mono tabular-nums">
                Total a registrar: {formatClp(parsedAmount)}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="res-receipt" className="block text-xs font-medium text-[#4B5563] mb-1">
              Boleta o comprobante de gasto (obligatorio)
            </label>
            <label
              htmlFor="res-receipt"
              className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Upload className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
                <span className="text-sm text-[#111827] truncate">
                  {receiptFileName || 'Subir boleta, factura o comprobante (PDF/imagen)'}
                </span>
              </div>
              <span className="text-xs font-medium text-[#14294A] shrink-0">
                {receiptFileName ? 'Cambiar' : 'Seleccionar'}
              </span>
              <input
                id="res-receipt"
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
              Confirmar y Guardar Gasto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
