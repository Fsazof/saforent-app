import { FormEvent, useState } from 'react';
import { Building2, Calculator, Check, FileText, Lock, Pencil, Plus, X } from 'lucide-react';
import { NewCommonExpenseInput, UpdateLegalDataInput } from '../hooks/useSaforentStore';
import {
  CommonExpenseRecord,
  CurrencyType,
  IpcFrequency,
  IpcMonthlyPoint,
  MaintenanceExpenseRecord,
  MaintenanceReport,
  PaymentReceipt,
  Property,
  PropertyStatus,
} from '../types/saforent';
import {
  computeAccumulatedIpcPercent,
  FALLBACK_IPC_HISTORY,
  getMonthsForIpcClause,
} from '../utils/economicIndicators';
import {
  calculateIpcAdjustedRent,
  calculateLateFeeSummary,
  DEFAULT_SIMULATED_DATE,
  formatClp,
  formatDailyLateFeeLabel,
  formatGuaranteeLabel,
  formatRentPrimaryAndSecondary,
  formatSpanishDate,
  formatUf,
  toClp,
  toUf,
} from '../utils/formatters';
import {
  buildPropertyPaymentHistory,
  PaymentReceiptPreviewData,
} from '../utils/paymentHistory';
import { AttachCommonExpenseModal, CommonExpenseSlipModal } from './CommonExpenseModals';
import { IndicatorsSourceNotice } from './IndicatorsSourceNotice';
import { LegalContractModal } from './LegalContractModal';
import { PaymentHistorySection } from './PaymentHistorySection';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { PaymentStatusLabel, PropertyStatusLabel } from './StatusLabel';

interface PropertyDetailModalProps {
  property: Property;
  ufValueClp: number;
  ipcMonthlyHistory?: IpcMonthlyPoint[];
  simulatedDate?: string;
  receipts: PaymentReceipt[];
  maintenanceReports: MaintenanceReport[];
  maintenanceExpenses: MaintenanceExpenseRecord[];
  commonExpenses: CommonExpenseRecord[];
  onClose: () => void;
  onStatusChange: (propertyId: string, status: PropertyStatus) => void;
  onUpdateLegalData: (propertyId: string, data: UpdateLegalDataInput) => void;
  onUpdateIpcClause: (propertyId: string, ipcClause: IpcFrequency) => void;
  onUpdateLateFee: (propertyId: string, currency: CurrencyType, amount: number) => void;
  onUpdateGuarantee: (propertyId: string, currency: CurrencyType, amount: number) => void;
  onUpdateCommonExpensesConfig: (
    propertyId: string,
    paysCommonExpenses: boolean,
    commonExpenseReferenceClp: number
  ) => void;
  onAttachCommonExpense: (propertyId: string, data: NewCommonExpenseInput) => void;
  onApproveCommonExpense: (propertyId: string, expenseId: string) => void;
  onApproveReceipt: (propertyId: string, receiptId: string) => void;
  onRequestResolveMaintenance: (
    propertyId: string,
    reportId: string,
    defaultItemDetail: string
  ) => void;
  onInspectExpenseReceipt: (expense: MaintenanceExpenseRecord) => void;
}

export function PropertyDetailModal({
  property,
  ufValueClp,
  ipcMonthlyHistory = FALLBACK_IPC_HISTORY,
  simulatedDate = DEFAULT_SIMULATED_DATE,
  receipts,
  maintenanceReports,
  maintenanceExpenses,
  commonExpenses,
  onClose,
  onStatusChange,
  onUpdateLegalData,
  onUpdateIpcClause,
  onUpdateLateFee,
  onUpdateGuarantee,
  onUpdateCommonExpensesConfig,
  onAttachCommonExpense,
  onApproveCommonExpense,
  onApproveReceipt,
  onRequestResolveMaintenance,
  onInspectExpenseReceipt,
}: PropertyDetailModalProps) {
  const [editingLegal, setEditingLegal] = useState(false);
  const [rolSii, setRolSii] = useState(property.rolSii);
  const [cbrsFoja, setCbrsFoja] = useState(property.cbrsFoja);
  const [cbrsNumero, setCbrsNumero] = useState(property.cbrsNumero);
  const [cbrsAnio, setCbrsAnio] = useState(property.cbrsAnio ?? '2024');
  const [cbrsConservador, setCbrsConservador] = useState(property.cbrsConservador);

  const [editingLateFee, setEditingLateFee] = useState(false);
  const [lateFeeCurrency, setLateFeeCurrency] = useState<CurrencyType>(
    property.lateFeeCurrency ?? 'CLP'
  );
  const [lateFeeAmountStr, setLateFeeAmountStr] = useState(
    String(property.lateFeeDailyAmount ?? (property.lateFeeCurrency === 'UF' ? 0.1 : 4000))
  );

  const guaranteeInfo = formatGuaranteeLabel(property, ufValueClp);
  const [editingGuarantee, setEditingGuarantee] = useState(false);
  const [guaranteeCurrency, setGuaranteeCurrency] = useState<CurrencyType>(guaranteeInfo.currency);
  const [guaranteeAmountStr, setGuaranteeAmountStr] = useState(String(guaranteeInfo.amount));
  const [showLegalContract, setShowLegalContract] = useState(false);

  const [editingGcConfig, setEditingGcConfig] = useState(false);
  const [paysGcInput, setPaysGcInput] = useState(Boolean(property.paysCommonExpenses));
  const [gcRefStr, setGcRefStr] = useState(
    String(property.commonExpenseReferenceClp ?? 0)
  );
  const [showAttachGcModal, setShowAttachGcModal] = useState(false);
  const [viewingGcSlip, setViewingGcSlip] = useState<CommonExpenseRecord | null>(null);
  const [viewingPaymentReceipt, setViewingPaymentReceipt] =
    useState<PaymentReceiptPreviewData | null>(null);

  const handleSaveLegal = (e: FormEvent) => {
    e.preventDefault();
    if (!rolSii.trim() || !cbrsFoja.trim() || !cbrsNumero.trim()) return;
    onUpdateLegalData(property.id, {
      rolSii,
      cbrsFoja,
      cbrsNumero,
      cbrsAnio,
      cbrsConservador,
    });
    setEditingLegal(false);
  };

  const handleSaveLateFee = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(lateFeeAmountStr);
    if (Number.isNaN(parsed) || parsed < 0) return;
    onUpdateLateFee(property.id, lateFeeCurrency, parsed);
    setEditingLateFee(false);
  };

  const handleSaveGuarantee = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Number(guaranteeAmountStr);
    if (Number.isNaN(parsed) || parsed < 0) return;
    onUpdateGuarantee(property.id, guaranteeCurrency, parsed);
    setEditingGuarantee(false);
  };

  const handleSaveGcConfig = (e: FormEvent) => {
    e.preventDefault();
    const parsed = paysGcInput ? Math.max(0, Math.round(Number(gcRefStr) || 0)) : 0;
    onUpdateCommonExpensesConfig(property.id, paysGcInput, parsed);
    setEditingGcConfig(false);
  };

  const baseRentAmount = property.baseRentAmount ?? property.rentAmount;
  const baseRentDisplay = formatRentPrimaryAndSecondary(
    baseRentAmount,
    property.currency,
    ufValueClp
  );
  const rentDisplay = formatRentPrimaryAndSecondary(
    property.rentAmount,
    property.currency,
    ufValueClp
  );
  const dailyLateFee = formatDailyLateFeeLabel(property, ufValueClp);
  const lateSummary = calculateLateFeeSummary(property, ufValueClp, simulatedDate);
  const latestIpcPercent = ipcMonthlyHistory[0]?.value;
  const periodMonths = getMonthsForIpcClause(property.ipcClause);
  const accumulatedPeriodIpc =
    periodMonths > 0 ? computeAccumulatedIpcPercent(ipcMonthlyHistory, periodMonths) : 0;
  const projectedRent =
    periodMonths > 0
      ? calculateIpcAdjustedRent(property.rentAmount, property.currency, accumulatedPeriodIpc)
      : property.rentAmount;
  const projectedLabel =
    property.currency === 'CLP' ? formatClp(projectedRent) : formatUf(projectedRent);

  const statuses: PropertyStatus[] = ['Disponible', 'Activo', 'Moroso', 'En Mantención'];

  const paymentHistoryRows = buildPropertyPaymentHistory({
    property,
    receipts,
    commonExpenses,
    ufValueClp,
    simulatedDate,
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-property-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[820px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#6B7280]">{property.commune}</p>
            <h2 id="detail-property-title" className="text-lg font-semibold text-[#111827] mt-0.5">
              {property.address}
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {property.status !== 'Disponible' && (
              <button
                type="button"
                onClick={() => setShowLegalContract(true)}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Ver Contrato Legal</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle"
              className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-5 border-b border-[#E5E7EB]">
            <div>
              <p className="text-xs text-[#6B7280]">Monto Vigente a Pagar</p>
              <p className="text-base font-semibold text-[#111827] font-mono tabular-nums mt-0.5">
                {rentDisplay.primary}
              </p>
              <p className="text-xs text-[#6B7280] font-mono tabular-nums">{rentDisplay.secondary}</p>
              <p className="text-xs text-[#4B5563] font-mono tabular-nums mt-1">
                Canon Base (fijo): {baseRentDisplay.primary}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Garantía Fija (en resguardo)</p>
              <p className="text-base font-semibold text-[#14294A] font-mono tabular-nums mt-0.5">
                {guaranteeInfo.primary}
              </p>
              <p className="text-xs text-[#6B7280] font-mono tabular-nums">
                {guaranteeInfo.secondary} · {property.status === 'Disponible' ? 'Pactada' : 'Recibida'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Arrendatario</p>
              <p className="text-sm font-medium text-[#111827] mt-0.5">{property.tenantName}</p>
              <p className="text-xs text-[#6B7280]">{property.tenantEmail}</p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Estado y Pago</p>
              <div className="mt-1 space-y-1">
                <PropertyStatusLabel status={property.status} />
                <div>
                  <PaymentStatusLabel status={property.paymentStatus} />
                </div>
              </div>
            </div>
          </div>

          <div className="pb-5 border-b border-[#E5E7EB]">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className="text-xs font-medium text-[#6B7280]">
                Antecedentes legales e inscripción (solo Propietario)
              </p>
              {!editingLegal && (
                <button
                  type="button"
                  onClick={() => {
                    setRolSii(property.rolSii);
                    setCbrsFoja(property.cbrsFoja);
                    setCbrsNumero(property.cbrsNumero);
                    setCbrsAnio(property.cbrsAnio ?? '2024');
                    setCbrsConservador(property.cbrsConservador);
                    setEditingLegal(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Editar datos legales</span>
                </button>
              )}
            </div>

            {editingLegal ? (
              <form
                onSubmit={handleSaveLegal}
                className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3.5 space-y-3"
              >
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div>
                    <label htmlFor="edit-rol" className="block text-xs text-[#4B5563] mb-1">
                      Rol SII
                    </label>
                    <input
                      id="edit-rol"
                      type="text"
                      required
                      value={rolSii}
                      onChange={(e) => setRolSii(e.target.value)}
                      className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono bg-white border border-[#D1D5DB] rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-foja" className="block text-xs text-[#4B5563] mb-1">
                      Foja CBRS
                    </label>
                    <input
                      id="edit-foja"
                      type="text"
                      required
                      value={cbrsFoja}
                      onChange={(e) => setCbrsFoja(e.target.value)}
                      className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono bg-white border border-[#D1D5DB] rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-num" className="block text-xs text-[#4B5563] mb-1">
                      Número CBRS
                    </label>
                    <input
                      id="edit-num"
                      type="text"
                      required
                      value={cbrsNumero}
                      onChange={(e) => setCbrsNumero(e.target.value)}
                      className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono bg-white border border-[#D1D5DB] rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-anio" className="block text-xs text-[#4B5563] mb-1">
                      Año CBRS
                    </label>
                    <input
                      id="edit-anio"
                      type="text"
                      value={cbrsAnio}
                      onChange={(e) => setCbrsAnio(e.target.value)}
                      className="w-full min-h-[36px] px-2.5 py-1 text-xs font-mono bg-white border border-[#D1D5DB] rounded-md"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="edit-cbr" className="block text-xs text-[#4B5563] mb-1">
                      Conservador
                    </label>
                    <input
                      id="edit-cbr"
                      type="text"
                      value={cbrsConservador}
                      onChange={(e) => setCbrsConservador(e.target.value)}
                      className="w-full min-h-[36px] px-2.5 py-1 text-xs bg-white border border-[#D1D5DB] rounded-md"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingLegal(false)}
                    className="min-h-[34px] px-3 py-1 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-md cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="min-h-[34px] px-3 py-1 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-md cursor-pointer"
                  >
                    Guardar datos legales
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                <div>
                  <span className="block text-xs text-[#6B7280]">Rol SII</span>
                  <span className="font-mono tabular-nums text-[#111827]">{property.rolSii}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#6B7280]">Foja CBRS</span>
                  <span className="font-mono tabular-nums text-[#111827]">{property.cbrsFoja}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#6B7280]">Número CBRS</span>
                  <span className="font-mono tabular-nums text-[#111827]">{property.cbrsNumero}</span>
                </div>
                <div>
                  <span className="block text-xs text-[#6B7280]">Año CBRS</span>
                  <span className="font-mono tabular-nums text-[#111827]">
                    {property.cbrsAnio || '—'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-[#6B7280]">Conservador</span>
                  <span className="text-[#111827]">{property.cbrsConservador}</span>
                </div>
              </div>
            )}

            <div className="mt-3 text-xs text-[#4B5563] flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span>Inicio: {formatSpanishDate(property.contractStart)}</span>
              <span aria-hidden="true">·</span>
              <span>Término: {formatSpanishDate(property.contractEnd)}</span>
              <span aria-hidden="true">·</span>
              <span>Día de pago: {property.paymentDay} de cada mes</span>
              <span aria-hidden="true">·</span>
              <label htmlFor="detail-ipc-clause" className="inline-flex items-center gap-1.5">
                <span>Frecuencia IPC:</span>
                <select
                  id="detail-ipc-clause"
                  value={property.ipcClause}
                  onChange={(e) => {
                    const nextFreq = e.target.value as IpcFrequency;
                    onUpdateIpcClause(property.id, nextFreq);
                  }}
                  className="px-2 py-0.5 text-xs font-medium text-[#111827] bg-white border border-[#D1D5DB] rounded cursor-pointer"
                >
                  <option value="Mensual">Mensual</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                  <option value="Reajuste directo en UF">Reajuste directo en UF</option>
                </select>
              </label>
              {property.ipcClause !== 'Reajuste directo en UF' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Próximo reajuste: {formatSpanishDate(property.nextIpcDate)}</span>
                </>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="text-[#6B7280]">Multa diaria por atraso en pagos: </span>
                  <span className="font-semibold text-[#111827] font-mono tabular-nums">
                    {dailyLateFee.primary}
                  </span>
                  <span className="text-[#6B7280] font-mono tabular-nums ml-1.5">
                    ({dailyLateFee.secondary})
                  </span>
                </div>
                {!editingLateFee && (
                  <button
                    type="button"
                    onClick={() => {
                      setLateFeeCurrency(property.lateFeeCurrency ?? 'CLP');
                      setLateFeeAmountStr(
                        String(
                          property.lateFeeDailyAmount ??
                            (property.lateFeeCurrency === 'UF' ? 0.1 : 4000)
                        )
                      );
                      setEditingLateFee(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Editar multa</span>
                  </button>
                )}
              </div>

              {editingLateFee && (
                <form
                  onSubmit={handleSaveLateFee}
                  className="mt-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 flex flex-wrap items-center gap-2.5"
                >
                  <div className="inline-flex p-0.5 bg-[#E5E7EB]/60 rounded-md shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (lateFeeCurrency === 'CLP') return;
                        const val = Number(lateFeeAmountStr) || 0;
                        setLateFeeAmountStr(
                          lateFeeAmountStr === '0.1' || val <= 0
                            ? '4000'
                            : String(toClp(val, 'UF', ufValueClp))
                        );
                        setLateFeeCurrency('CLP');
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded cursor-pointer ${
                        lateFeeCurrency === 'CLP'
                          ? 'bg-white text-[#14294A] shadow-xs'
                          : 'text-[#4B5563]'
                      }`}
                    >
                      CLP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (lateFeeCurrency === 'UF') return;
                        const val = Number(lateFeeAmountStr) || 0;
                        setLateFeeAmountStr(
                          lateFeeAmountStr === '4000' || val <= 0
                            ? '0.1'
                            : String(toUf(val, 'CLP', ufValueClp))
                        );
                        setLateFeeCurrency('UF');
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded cursor-pointer ${
                        lateFeeCurrency === 'UF'
                          ? 'bg-white text-[#14294A] shadow-xs'
                          : 'text-[#4B5563]'
                      }`}
                    >
                      UF
                    </button>
                  </div>
                  <input
                    aria-label="Monto multa diaria"
                    type="number"
                    step={lateFeeCurrency === 'UF' ? '0.05' : '500'}
                    min="0"
                    value={lateFeeAmountStr}
                    onChange={(e) => setLateFeeAmountStr(e.target.value)}
                    className="w-32 min-h-[34px] px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-md"
                  />
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setEditingLateFee(false)}
                      className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-md cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-md cursor-pointer"
                    >
                      Guardar multa
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-[#E5E7EB]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="text-[#6B7280]">Garantía Fija en resguardo: </span>
                  <span className="font-semibold text-[#14294A] font-mono tabular-nums">
                    {guaranteeInfo.primary}
                  </span>
                  <span className="text-[#6B7280] font-mono tabular-nums ml-1.5">
                    ({guaranteeInfo.secondary})
                  </span>
                  <span className="text-[#6B7280] ml-1.5">
                    · No es ingreso mensual ni se reajusta por IPC
                  </span>
                </div>
                {!editingGuarantee && (
                  <button
                    type="button"
                    onClick={() => {
                      setGuaranteeCurrency(guaranteeInfo.currency);
                      setGuaranteeAmountStr(String(guaranteeInfo.amount));
                      setEditingGuarantee(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Editar garantía</span>
                  </button>
                )}
              </div>

              {editingGuarantee && (
                <form
                  onSubmit={handleSaveGuarantee}
                  className="mt-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 flex flex-wrap items-center gap-2.5"
                >
                  <div className="inline-flex p-0.5 bg-[#E5E7EB]/60 rounded-md shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (guaranteeCurrency === 'CLP') return;
                        const val = Number(guaranteeAmountStr) || 0;
                        setGuaranteeAmountStr(
                          val > 0 ? String(toClp(val, 'UF', ufValueClp)) : '0'
                        );
                        setGuaranteeCurrency('CLP');
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded cursor-pointer ${
                        guaranteeCurrency === 'CLP'
                          ? 'bg-white text-[#14294A] shadow-xs'
                          : 'text-[#4B5563]'
                      }`}
                    >
                      CLP
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (guaranteeCurrency === 'UF') return;
                        const val = Number(guaranteeAmountStr) || 0;
                        setGuaranteeAmountStr(
                          val > 0 ? String(toUf(val, 'CLP', ufValueClp)) : '0'
                        );
                        setGuaranteeCurrency('UF');
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded cursor-pointer ${
                        guaranteeCurrency === 'UF'
                          ? 'bg-white text-[#14294A] shadow-xs'
                          : 'text-[#4B5563]'
                      }`}
                    >
                      UF
                    </button>
                  </div>
                  <input
                    aria-label="Monto Garantía Fija"
                    type="number"
                    step={guaranteeCurrency === 'UF' ? '0.1' : '1000'}
                    min="0"
                    value={guaranteeAmountStr}
                    onChange={(e) => setGuaranteeAmountStr(e.target.value)}
                    className="w-36 min-h-[34px] px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setGuaranteeCurrency(property.currency);
                      setGuaranteeAmountStr(String(property.rentAmount));
                    }}
                    className="text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
                  >
                    Usar 1 mes de arriendo
                  </button>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => setEditingGuarantee(false)}
                      className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-md cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-md cursor-pointer"
                    >
                      Guardar garantía
                    </button>
                  </div>
                </form>
              )}
            </div>

            {lateSummary.isOverdue && (
              <div className="mt-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3.5 text-xs space-y-1.5">
                <p className="font-semibold text-[#991B1B]">
                  Morosidad activa · {lateSummary.daysOverdue} día
                  {lateSummary.daysOverdue === 1 ? '' : 's'} de atraso
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono tabular-nums text-[#7F1D1D]">
                  <span>Canon base: {formatClp(lateSummary.baseClp)}</span>
                  <span>+ Multa acumulada: {formatClp(lateSummary.accumulatedClp)}</span>
                  <span className="font-bold text-[#991B1B]">
                    = Total hoy: {formatClp(lateSummary.totalDueClp)}
                  </span>
                </div>
              </div>
            )}

            {property.contractNotes && (
              <p className="mt-2 text-xs text-[#6B7280]">{property.contractNotes}</p>
            )}
          </div>

          <div className="pb-5 border-b border-[#E5E7EB]">
            <p className="text-xs font-medium text-[#6B7280] mb-2">Cambiar estado de propiedad</p>
            <div className="flex flex-wrap gap-2">
              {statuses.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onStatusChange(property.id, st)}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    property.status === st
                      ? 'bg-[#14294A] text-white border-[#14294A]'
                      : 'bg-white text-[#374151] border-[#D1D5DB] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="pb-5 border-b border-[#E5E7EB] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-[#1B5E3A]" aria-hidden="true" />
                <p className="text-sm font-medium text-[#111827]">
                  Reajuste automático por IPC (Canon Base fijo: {baseRentDisplay.primary})
                </p>
              </div>
              {property.lastIpcAppliedDate && property.lastIpcAppliedPercent !== undefined && (
                <span className="text-xs font-mono text-[#1B5E3A] tabular-nums">
                  Último reajuste: +{property.lastIpcAppliedPercent.toLocaleString('es-CL')}% (
                  {formatSpanishDate(property.lastIpcAppliedDate)})
                </span>
              )}
            </div>
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="block text-[#6B7280]">Canon Base (fijo e inalterable)</span>
                <span className="text-sm font-semibold text-[#111827] font-mono tabular-nums mt-0.5 block">
                  {baseRentDisplay.primary}
                </span>
              </div>
              <div>
                <span className="block text-[#6B7280]">Monto Vigente a Pagar</span>
                <span className="text-sm font-semibold text-[#14294A] font-mono tabular-nums mt-0.5 block">
                  {rentDisplay.primary}
                </span>
              </div>
              <div>
                {periodMonths > 0 ? (
                  <>
                    <span className="block text-[#6B7280]">
                      Próximo reajuste automático ({formatSpanishDate(property.nextIpcDate)})
                    </span>
                    <span className="text-sm font-semibold text-[#1B5E3A] font-mono tabular-nums mt-0.5 block">
                      Est. {projectedLabel} (+{accumulatedPeriodIpc.toLocaleString('es-CL')}%)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-[#6B7280]">Modalidad de reajuste</span>
                    <span className="text-sm font-medium text-[#111827] mt-0.5 block">
                      Reajuste diario automático en UF
                    </span>
                  </>
                )}
              </div>
            </div>
            <IndicatorsSourceNotice
              ufValueClp={ufValueClp}
              latestIpcPercent={latestIpcPercent}
              compact
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-[#111827] mb-2">Comprobantes de pago</p>
              {receipts.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No hay comprobantes registrados aún.</p>
              ) : (
                <ul className="divide-y divide-[#E5E7EB]">
                  {receipts.map((rec) => (
                    <li key={rec.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#111827]">{rec.periodLabel}</p>
                        <p className="text-xs text-[#6B7280] tabular-nums">
                          {rec.currency === 'CLP' ? formatClp(rec.amount) : formatUf(rec.amount)} ·{' '}
                          {rec.fileName}
                        </p>
                      </div>
                      {rec.status === 'en_revision' ? (
                        <button
                          type="button"
                          onClick={() => onApproveReceipt(property.id, rec.id)}
                          className="inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 text-xs font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg cursor-pointer shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Validar</span>
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-[#1B5E3A]">Aprobado</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-[#111827] mb-2">Averías y mantención</p>
              {maintenanceReports.length === 0 ? (
                <p className="text-xs text-[#6B7280]">Sin averías reportadas.</p>
              ) : (
                <ul className="divide-y divide-[#E5E7EB]">
                  {maintenanceReports.map((rep) => (
                    <li key={rep.id} className="py-2.5 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#111827]">
                          {rep.category} ({rep.urgency})
                        </p>
                        <p className="text-xs text-[#6B7280] line-clamp-2">{rep.description}</p>
                      </div>
                      {rep.status !== 'resuelta' ? (
                        <button
                          type="button"
                          onClick={() =>
                            onRequestResolveMaintenance(
                              property.id,
                              rep.id,
                              `${rep.category}: ${rep.description}`
                            )
                          }
                          className="min-h-[34px] px-2.5 py-1 text-xs font-medium text-[#14294A] bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6] rounded-lg cursor-pointer shrink-0"
                        >
                          Marcar resuelta
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-[#1B5E3A] shrink-0">Resuelta</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Módulo de Gastos Comunes Mensuales */}
          <section
            aria-labelledby="common-expenses-title"
            className="pt-5 border-t border-[#E5E7EB] space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
                  <h3
                    id="common-expenses-title"
                    className="text-sm font-semibold text-[#111827]"
                  >
                    Gastos Comunes Mensuales
                  </h3>
                </div>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  {property.paysCommonExpenses
                    ? `Activos · Monto referencial: ${
                        property.commonExpenseReferenceClp
                          ? `${formatClp(property.commonExpenseReferenceClp)} / mes`
                          : 'Variable sin referencia fija'
                      }`
                    : 'No aplica en esta propiedad'}
                  {' · '}
                  No se suman a ingresos de arriendo en Finanzas.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!editingGcConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      setPaysGcInput(Boolean(property.paysCommonExpenses));
                      setGcRefStr(String(property.commonExpenseReferenceClp ?? 0));
                      setEditingGcConfig(true);
                    }}
                    className="inline-flex items-center gap-1 min-h-[36px] px-2.5 py-1 text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Configurar</span>
                  </button>
                )}
                {(property.status !== 'Disponible' || property.paysCommonExpenses) && (
                  <button
                    type="button"
                    onClick={() => setShowAttachGcModal(true)}
                    className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Anexar Gasto Común del Mes</span>
                  </button>
                )}
              </div>
            </div>

            {editingGcConfig && (
              <form
                onSubmit={handleSaveGcConfig}
                className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 flex flex-wrap items-center gap-3"
              >
                <span className="text-xs font-medium text-[#4B5563]">
                  ¿Paga Gastos Comunes?
                </span>
                <div className="inline-flex p-0.5 bg-[#E5E7EB]/60 rounded-md shrink-0">
                  <button
                    type="button"
                    onClick={() => setPaysGcInput(true)}
                    className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                      paysGcInput ? 'bg-white text-[#14294A] shadow-xs' : 'text-[#4B5563]'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaysGcInput(false)}
                    className={`px-2.5 py-1 text-xs font-medium rounded cursor-pointer ${
                      !paysGcInput ? 'bg-white text-[#14294A] shadow-xs' : 'text-[#4B5563]'
                    }`}
                  >
                    No
                  </button>
                </div>

                {paysGcInput && (
                  <div className="flex items-center gap-2">
                    <label htmlFor="edit-gc-ref" className="text-xs text-[#4B5563]">
                      Ref. mensual (CLP):
                    </label>
                    <input
                      id="edit-gc-ref"
                      type="number"
                      min="0"
                      step="1000"
                      value={gcRefStr}
                      onChange={(e) => setGcRefStr(e.target.value)}
                      className="w-32 min-h-[34px] px-2.5 py-1 text-xs font-mono tabular-nums bg-white border border-[#D1D5DB] rounded-md"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingGcConfig(false)}
                    className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-md cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="min-h-[32px] px-2.5 py-1 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-md cursor-pointer"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}

            {commonExpenses.length === 0 ? (
              <p className="text-xs text-[#6B7280] py-1">
                No hay colillas de gastos comunes anexadas aún para esta propiedad.
              </p>
            ) : (
              <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563]">
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap">Mes</th>
                        <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                          Monto exacto
                        </th>
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap">Vencimiento</th>
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap">Colilla</th>
                        <th className="py-2.5 px-3 font-medium whitespace-nowrap">Estado</th>
                        <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                          Acción
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] bg-white">
                      {commonExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-[#FAFAFB]">
                          <td className="py-2.5 px-3 font-medium text-[#111827] whitespace-nowrap">
                            {exp.periodLabel}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#111827] whitespace-nowrap">
                            {formatClp(exp.amountClp)}
                          </td>
                          <td className="py-2.5 px-3 text-[#4B5563] whitespace-nowrap">
                            {formatSpanishDate(exp.dueDate)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setViewingGcSlip(exp)}
                              className="inline-flex items-center gap-1 text-[#14294A] hover:underline underline-offset-4 font-medium cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>Ver colilla</span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {exp.status === 'pagado' && (
                              <span className="font-medium text-[#1B5E3A]">Pagado</span>
                            )}
                            {exp.status === 'en_revision' && (
                              <span className="font-medium text-[#14294A]">En revisión</span>
                            )}
                            {exp.status === 'pendiente' && (
                              <span className="font-medium text-[#B45309]">Pendiente</span>
                            )}
                            {exp.status === 'atrasado' && (
                              <span className="font-medium text-[#B91C1C]">Atrasado</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            {exp.status === 'pagado' ? (
                              <span className="text-[#6B7280] font-mono">
                                {exp.receiptReferenceCode || 'Validado'}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onApproveCommonExpense(property.id, exp.id)}
                                className="inline-flex items-center gap-1 min-h-[30px] px-2.5 py-1 text-xs font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-md cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>
                                  {exp.status === 'en_revision' ? 'Validar pago' : 'Marcar pagado'}
                                </span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {/* Sección privada visible únicamente en Vista Propietario */}
          {(() => {
            const totalExpensesClp = maintenanceExpenses.reduce(
              (acc, item) => acc + item.amountClp,
              0
            );
            const ownerTotalClp = maintenanceExpenses
              .filter((e) => e.paidBy === 'Propietario')
              .reduce((acc, item) => acc + item.amountClp, 0);
            const tenantTotalClp = maintenanceExpenses
              .filter((e) => e.paidBy === 'Arrendatario')
              .reduce((acc, item) => acc + item.amountClp, 0);

            return (
              <section
                aria-labelledby="private-expenses-title"
                className="pt-5 border-t border-[#E5E7EB] space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
                      <h3
                        id="private-expenses-title"
                        className="text-sm font-semibold text-[#111827]"
                      >
                        Historial Privado de Gastos y Mantenciones
                      </h3>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      Uso exclusivo del propietario · No visible para el arrendatario.
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="block text-xs text-[#6B7280]">Total acumulado</span>
                    <span className="text-base font-bold text-[#111827] font-mono tabular-nums">
                      {formatClp(totalExpensesClp)}
                    </span>
                  </div>
                </div>

                {maintenanceExpenses.length === 0 ? (
                  <p className="text-xs text-[#6B7280] py-3">
                    No hay gastos de mantención o arreglos registrados en esta propiedad.
                  </p>
                ) : (
                  <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563]">
                            <th className="py-2.5 px-3 font-medium whitespace-nowrap">Fecha</th>
                            <th className="py-2.5 px-3 font-medium">Ítem / Arreglo</th>
                            <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                              Quién pagó
                            </th>
                            <th className="py-2.5 px-3 font-medium text-right whitespace-nowrap">
                              Monto (CLP)
                            </th>
                            <th className="py-2.5 px-3 font-medium whitespace-nowrap">
                              Comprobante
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E7EB] bg-white">
                          {maintenanceExpenses.map((exp) => (
                            <tr key={exp.id} className="hover:bg-[#FAFAFB]">
                              <td className="py-2.5 px-3 text-[#4B5563] font-mono tabular-nums whitespace-nowrap">
                                {formatSpanishDate(exp.date.slice(0, 10))}
                              </td>
                              <td className="py-2.5 px-3 text-[#111827] font-medium min-w-[180px]">
                                {exp.itemDetail}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={
                                    exp.paidBy === 'Propietario'
                                      ? 'font-medium text-[#14294A]'
                                      : 'font-medium text-[#1B5E3A]'
                                  }
                                >
                                  {exp.paidBy}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#111827] whitespace-nowrap">
                                {formatClp(exp.amountClp)}
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => onInspectExpenseReceipt(exp)}
                                  className="inline-flex items-center gap-1 text-[#14294A] hover:underline underline-offset-4 font-medium cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span className="max-w-[160px] truncate">
                                    {exp.receiptFileName}
                                  </span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                            <td colSpan={3} className="py-2.5 px-3 text-[#4B5563]">
                              <span className="font-semibold text-[#111827]">
                                Total acumulado de gastos
                              </span>
                              <span className="ml-2 text-[#6B7280] font-mono tabular-nums">
                                (Propietario: {formatClp(ownerTotalClp)} · Arrendatario:{' '}
                                {formatClp(tenantTotalClp)})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#14294A] whitespace-nowrap">
                              {formatClp(totalExpensesClp)}
                            </td>
                            <td className="py-2.5 px-3" />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            );
          })()}
          {/* Historial de Pagos de Arriendo y Gastos Comunes (claramente separado del historial de mantención) */}
          <section
            aria-labelledby="owner-payment-history-title"
            className="pt-5 border-t border-[#E5E7EB]"
          >
            <PaymentHistorySection
              viewerRole="owner"
              headingId="owner-payment-history-title"
              title="Historial de Pagos de Arriendo y Gastos Comunes"
              rows={paymentHistoryRows}
              onViewReceipt={(rec) => setViewingPaymentReceipt(rec)}
            />
          </section>
        </div>
      </div>

      {showLegalContract && (
        <LegalContractModal
          property={property}
          ufValueClp={ufValueClp}
          latestIpcPercent={latestIpcPercent}
          onClose={() => setShowLegalContract(false)}
        />
      )}

      {showAttachGcModal && (
        <AttachCommonExpenseModal
          propertyAddress={property.address}
          propertyCommune={property.commune}
          referenceAmountClp={property.commonExpenseReferenceClp}
          simulatedDate={simulatedDate}
          onClose={() => setShowAttachGcModal(false)}
          onSubmit={(data) => onAttachCommonExpense(property.id, data)}
        />
      )}

      {viewingGcSlip && (
        <CommonExpenseSlipModal
          expense={viewingGcSlip}
          propertyAddress={property.address}
          propertyCommune={property.commune}
          onClose={() => setViewingGcSlip(null)}
        />
      )}

      {viewingPaymentReceipt && (
        <PaymentReceiptModal
          receipt={viewingPaymentReceipt}
          propertyAddress={property.address}
          propertyCommune={property.commune}
          onClose={() => setViewingPaymentReceipt(null)}
        />
      )}
    </div>
  );
}
