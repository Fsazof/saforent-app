import { ChangeEvent, FormEvent, useState } from 'react';
import { FileText, ShieldCheck, Upload, X } from 'lucide-react';
import { NewMaintenanceInput } from '../hooks/useSaforentStore';
import { ExpenseResponsibility, TenantPropertyView } from '../types/saforent';
import {
  calculateLateFeeSummary,
  DEFAULT_SIMULATED_DATE,
  formatClp,
  formatDailyLateFeeLabel,
  formatGuaranteeLabel,
  formatRentPrimaryAndSecondary,
  formatSpanishDate,
} from '../utils/formatters';
import { IndicatorsSourceNotice } from './IndicatorsSourceNotice';

interface ContractConditionsModalProps {
  property: TenantPropertyView;
  ufValueClp: number;
  latestIpcPercent?: number;
  simulatedDate?: string;
  onClose: () => void;
}

export function ContractConditionsModal({
  property,
  ufValueClp,
  latestIpcPercent,
  simulatedDate = DEFAULT_SIMULATED_DATE,
  onClose,
}: ContractConditionsModalProps) {
  const guaranteeInfo = formatGuaranteeLabel(property, ufValueClp);
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
  const dailyLateFee = formatDailyLateFeeLabel(property, ufValueClp);
  const lateSummary = calculateLateFeeSummary(property, ufValueClp, simulatedDate);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-conditions-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[640px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#14294A]" aria-hidden="true" />
            <h2 id="contract-conditions-title" className="text-lg font-semibold text-[#111827]">
              Condiciones de mi Contrato
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

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="block text-xs text-[#6B7280]">Propiedad arrendada</span>
                <span className="font-medium text-[#111827]">
                  {property.address}, {property.commune}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#6B7280]">Propietario</span>
                <span className="font-medium text-[#111827]">{property.ownerName}</span>
              </div>
              <div>
                <span className="block text-xs text-[#6B7280]">Monto Vigente a Pagar</span>
                <span className="font-semibold text-[#111827] font-mono tabular-nums">
                  {rentInfo.primary}
                </span>
                <span className="block text-xs text-[#6B7280] font-mono tabular-nums">
                  {rentInfo.secondary} · Canon Base fijo: {baseRentInfo.primary}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#6B7280]">Vigencia del contrato</span>
                <span className="text-[#111827]">
                  {formatSpanishDate(property.contractStart)} al{' '}
                  {formatSpanishDate(property.contractEnd)}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#6B7280]">Periodicidad de reajuste IPC</span>
                <span className="text-[#111827]">{property.ipcClause}</span>
              </div>
              <div>
                <span className="block text-xs text-[#6B7280]">Día de pago mensual</span>
                <span className="text-[#111827]">Día {property.paymentDay} de cada mes</span>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="block text-xs text-[#6B7280]">
                    Garantía Fija pactada (en resguardo)
                  </span>
                  <span className="font-semibold text-[#14294A] font-mono tabular-nums">
                    {guaranteeInfo.primary}
                  </span>
                  <span className="block text-xs text-[#6B7280] font-mono tabular-nums">
                    {guaranteeInfo.secondary} · En resguardo
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-[#6B7280]">
                    Multa diaria pactada por atraso
                  </span>
                  <span className="font-semibold text-[#111827] font-mono tabular-nums">
                    {dailyLateFee.primary}
                  </span>
                  <span className="block text-xs text-[#6B7280] font-mono tabular-nums">
                    {dailyLateFee.secondary}
                  </span>
                </div>
              </div>
            </div>

            {lateSummary.isOverdue && (
              <div className="pt-3 border-t border-[#FECACA] bg-[#FEF2F2] -mx-4 -mb-4 p-4 rounded-b-lg text-xs space-y-1">
                <p className="font-semibold text-[#991B1B]">
                  Desglose de pago atrasado hoy ({lateSummary.daysOverdue} días de mora):
                </p>
                <p className="text-[#7F1D1D] font-mono tabular-nums">
                  Canon base {formatClp(lateSummary.baseClp)} + Multa acumulada{' '}
                  {formatClp(lateSummary.accumulatedClp)} = Total{' '}
                  <span className="font-bold">{formatClp(lateSummary.totalDueClp)}</span>
                </p>
              </div>
            )}

            {property.lastIpcAppliedDate && property.lastIpcAppliedPercent !== undefined && (
              <div className="pt-3 border-t border-[#E5E7EB] text-xs text-[#1B5E3A]">
                <span className="font-semibold">Reajuste IPC automático aplicado:</span> +
                {property.lastIpcAppliedPercent.toLocaleString('es-CL')}% el{' '}
                {formatSpanishDate(property.lastIpcAppliedDate)} · Canon Base fijo{' '}
                {baseRentInfo.primary} → Monto Vigente {rentInfo.primary}.
              </div>
            )}

            {property.contractNotes && (
              <p className="pt-2 border-t border-[#E5E7EB] text-xs text-[#6B7280]">
                {property.contractNotes}
              </p>
            )}

            <IndicatorsSourceNotice
              ufValueClp={ufValueClp}
              latestIpcPercent={latestIpcPercent}
              compact
            />
          </div>

          <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
              <ShieldCheck className="w-4 h-4 text-[#1B5E3A] shrink-0" aria-hidden="true" />
              <span>Deberes y compromisos vigentes del arrendatario</span>
            </div>
            <ul className="space-y-1.5 text-xs text-[#4B5563] list-disc pl-4">
              <li>
                Pagar el canon mensual pactado ({rentInfo.primary}) a más tardar el día{' '}
                {property.paymentDay} de cada mes y adjuntar el comprobante en la plataforma.
              </li>
              <li>
                En caso de retraso, aplica la multa diaria pactada de {dailyLateFee.primary}.
              </li>
              <li>
                Asumir arreglos menores de mantención cotidiana y dar aviso oportuno al propietario
                ante fallas mayores o estructurales mediante la opción &quot;Reportar Avería&quot;.
              </li>
              <li>
                La Garantía Fija de {guaranteeInfo.primary} permanece en resguardo hasta el término y
                entrega conforme del inmueble.
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-end pt-2 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReportIssueModalProps {
  onClose: () => void;
  onSubmit: (data: NewMaintenanceInput) => void;
}

export function ReportIssueModal({ onClose, onSubmit }: ReportIssueModalProps) {
  const [responsibility, setResponsibility] = useState<ExpenseResponsibility>('propietario');
  const [category, setCategory] = useState('Gasfitería');
  const [urgency, setUrgency] = useState<'Alta' | 'Media'>('Alta');
  const [description, setDescription] = useState('');
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [expenseItem, setExpenseItem] = useState('');
  const [expenseAmountStr, setExpenseAmountStr] = useState('');
  const [receiptFileName, setReceiptFileName] = useState('');
  const [error, setError] = useState('');

  const handlePhotoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhotoName(file.name);
  };

  const handleReceiptFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFileName(file.name);
      setError('');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (responsibility === 'arrendatario') {
      const amountClp = Number(expenseAmountStr);
      if (!expenseItem.trim()) {
        setError('Ingresa el ítem o detalle del arreglo menor realizado.');
        return;
      }
      if (!Number.isFinite(amountClp) || amountClp <= 0) {
        setError('Ingresa el monto gastado en CLP.');
        return;
      }
      if (!receiptFileName.trim()) {
        setError('Sube la boleta o comprobante de respaldo del gasto.');
        return;
      }
      setError('');
      onSubmit({
        responsibility: 'arrendatario',
        category,
        urgency: 'Media',
        description: description.trim(),
        expenseItem: expenseItem.trim(),
        expenseAmountClp: Math.round(amountClp),
        receiptFileName: receiptFileName.trim(),
      });
      onClose();
      return;
    }

    if (!description.trim()) {
      setError('Describe brevemente el problema para que el propietario pueda coordinar ayuda.');
      return;
    }
    setError('');
    onSubmit({
      responsibility: 'propietario',
      category,
      urgency,
      description: description.trim(),
      photoName,
    });
    onClose();
  };

  const parsedExpense = Number(expenseAmountStr) || 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-modal-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[560px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <h2 id="issue-modal-title" className="text-lg font-semibold text-[#111827]">
            Reportar Avería
          </h2>
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
          <div>
            <span className="block text-xs font-medium text-[#4B5563] mb-2">
              Responsabilidad del gasto
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setResponsibility('arrendatario');
                  setError('');
                }}
                className={`p-3 text-left rounded-lg border transition-colors cursor-pointer ${
                  responsibility === 'arrendatario'
                    ? 'bg-[#EEF6F1] border-[#1B5E3A] text-[#111827]'
                    : 'bg-white border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB]'
                }`}
              >
                <span className="block text-xs font-semibold text-[#111827]">
                  Asumido por mí (Arrendatario)
                </span>
                <span className="block text-xs text-[#4B5563] mt-0.5">
                  Arreglo menor · Se registra resuelto
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setResponsibility('propietario');
                  setError('');
                }}
                className={`p-3 text-left rounded-lg border transition-colors cursor-pointer ${
                  responsibility === 'propietario'
                    ? 'bg-[#EFF6FF] border-[#14294A] text-[#111827]'
                    : 'bg-white border-[#D1D5DB] text-[#374151] hover:bg-[#F9FAFB]'
                }`}
              >
                <span className="block text-xs font-semibold text-[#111827]">
                  Responsabilidad del Propietario
                </span>
                <span className="block text-xs text-[#4B5563] mt-0.5">
                  Arreglo mayor/estructural · Alerta urgente
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="issue-cat" className="block text-xs font-medium text-[#4B5563] mb-1">
                Categoría
              </label>
              <select
                id="issue-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg"
              >
                <option value="Gasfitería">Gasfitería / Filtración</option>
                <option value="Electricidad">Electricidad</option>
                <option value="Climatización / Calefacción">Climatización / Calefacción</option>
                <option value="Cerrajería">Cerrajería / Accesos</option>
                <option value="Electrodomésticos">Electrodomésticos incluidos</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            {responsibility === 'propietario' && (
              <div>
                <span className="block text-xs font-medium text-[#4B5563] mb-1">Urgencia</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['Alta', 'Media'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setUrgency(level)}
                      className={`min-h-[42px] px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                        urgency === level
                          ? 'bg-[#14294A] text-white border-[#14294A]'
                          : 'bg-white text-[#374151] border-[#D1D5DB]'
                      }`}
                    >
                      {level === 'Alta' ? 'Alta (Crítica)' : 'Media'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {responsibility === 'arrendatario' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="issue-exp-item"
                    className="block text-xs font-medium text-[#4B5563] mb-1"
                  >
                    Ítem / detalle del arreglo (obligatorio)
                  </label>
                  <input
                    id="issue-exp-item"
                    type="text"
                    required
                    value={expenseItem}
                    onChange={(e) => setExpenseItem(e.target.value)}
                    placeholder="Ej. Cambio de flexible lavaplatos"
                    className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="issue-exp-amount"
                    className="block text-xs font-medium text-[#4B5563] mb-1"
                  >
                    Monto gastado en CLP (obligatorio)
                  </label>
                  <input
                    id="issue-exp-amount"
                    type="number"
                    min="1"
                    step="500"
                    required
                    value={expenseAmountStr}
                    onChange={(e) => setExpenseAmountStr(e.target.value)}
                    placeholder="Ej. 18500"
                    className="w-full min-h-[42px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                  {parsedExpense > 0 && (
                    <p className="text-xs text-[#6B7280] mt-1 font-mono tabular-nums">
                      {formatClp(parsedExpense)}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="issue-receipt"
                  className="block text-xs font-medium text-[#4B5563] mb-1"
                >
                  Comprobante / boleta de respaldo (obligatorio)
                </label>
                <label
                  htmlFor="issue-receipt"
                  className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Upload className="w-4 h-4 text-[#1B5E3A] shrink-0" aria-hidden="true" />
                    <span className="text-sm text-[#111827] truncate">
                      {receiptFileName || 'Adjuntar boleta o comprobante (PDF o imagen)'}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-[#14294A] shrink-0">
                    {receiptFileName ? 'Cambiar' : 'Seleccionar'}
                  </span>
                  <input
                    id="issue-receipt"
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleReceiptFile}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <label htmlFor="issue-desc" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Observación adicional (opcional)
                </label>
                <textarea
                  id="issue-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej. Se reemplazó pieza dañada y quedó funcionando sin filtraciones."
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="issue-desc" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Descripción de la falla
                </label>
                <textarea
                  id="issue-desc"
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej. Hay una filtración debajo del lavaplatos de la cocina cuando se abre el agua caliente."
                  className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>

              <div>
                <label
                  htmlFor="issue-photo"
                  className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
                >
                  <span className="text-sm text-[#374151] truncate">
                    {photoName ? `Adjunto: ${photoName}` : 'Adjuntar foto de respaldo (opcional)'}
                  </span>
                  <span className="text-xs font-medium text-[#14294A] shrink-0">Seleccionar</span>
                  <input
                    id="issue-photo"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoFile}
                    className="sr-only"
                  />
                </label>
              </div>
            </>
          )}

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
              className={`min-h-[42px] px-5 py-2 text-sm font-medium text-white rounded-lg cursor-pointer ${
                responsibility === 'arrendatario'
                  ? 'bg-[#1B5E3A] hover:bg-[#154B2E]'
                  : 'bg-[#14294A] hover:bg-[#1D3A66]'
              }`}
            >
              {responsibility === 'arrendatario'
                ? 'Registrar Arreglo e Informar'
                : 'Enviar Reporte al Propietario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
