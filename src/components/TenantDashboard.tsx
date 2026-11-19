import { useMemo, useState } from 'react';
import { Building2, Calendar, Eye, FileText, Receipt, Upload, Users, Wrench } from 'lucide-react';
import { DEMO_TENANT_PROPERTY_ID } from '../data/initialDemoData';
import {
  NewMaintenanceInput,
  NewReceiptInput,
  SimulateOnlinePaymentInput,
  SimulateOnlinePaymentResult,
  SubmitCommonExpenseReceiptInput,
} from '../hooks/useSaforentStore';
import { CommonExpenseRecord, Property, SaforentState, TenantPropertyView } from '../types/saforent';
import {
  calculateLateFeeSummary,
  formatClp,
  formatDailyLateFeeLabel,
  formatGuaranteeLabel,
  formatRentPrimaryAndSecondary,
  formatSpanishDate,
  formatUf,
} from '../utils/formatters';
import {
  buildPropertyPaymentHistory,
  PaymentReceiptPreviewData,
} from '../utils/paymentHistory';
import { CommonExpenseSlipModal, UploadCommonExpenseReceiptModal } from './CommonExpenseModals';
import { PaymentHistorySection } from './PaymentHistorySection';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { PayRentModal } from './PayRentModal';
import { PaymentStatusLabel, PropertyStatusLabel } from './StatusLabel';
import { ContractConditionsModal, ReportIssueModal } from './TenantModals';

interface TenantDashboardProps {
  state: SaforentState;
  onSwitchDemoTenant: (propertyId: string) => void;
  onSubmitReceipt: (propertyId: string, data: NewReceiptInput) => void;
  onSimulateOnlinePayment: (
    propertyId: string,
    data: SimulateOnlinePaymentInput
  ) => SimulateOnlinePaymentResult;
  onSubmitCommonExpenseReceipt: (
    propertyId: string,
    expenseId: string,
    data: SubmitCommonExpenseReceiptInput
  ) => void;
  onReportIssue: (propertyId: string, data: NewMaintenanceInput) => void;
  onNotify: (message: string) => void;
}

interface DemoTenantOption {
  propertyId: string;
  tenantName: string;
  address: string;
  statusLabel: string;
}

function formatDemoTenantStatusLabel(prop: Pick<Property, 'status' | 'paymentStatus'>): string {
  if (prop.status === 'Moroso') return 'Moroso';
  if (prop.status === 'En Mantención') return 'En Mantención';
  if (prop.paymentStatus === 'al_dia') return 'Al día';
  if (prop.paymentStatus === 'en_revision') return 'En revisión';
  if (prop.paymentStatus === 'atrasado') return 'Moroso';
  return 'Activo · Pago pendiente';
}

export function TenantDashboard({
  state,
  onSwitchDemoTenant,
  onSubmitReceipt,
  onSimulateOnlinePayment,
  onSubmitCommonExpenseReceipt,
  onReportIssue,
  onNotify,
}: TenantDashboardProps) {
  const [activeModal, setActiveModal] = useState<'contrato' | 'pagar' | 'averia' | null>(
    null
  );
  const [viewingSlipExpense, setViewingSlipExpense] = useState<CommonExpenseRecord | null>(null);
  const [uploadingGcExpense, setUploadingGcExpense] = useState<CommonExpenseRecord | null>(null);
  const [viewingPaymentReceipt, setViewingPaymentReceipt] =
    useState<PaymentReceiptPreviewData | null>(null);

  const demoTenantOptions: DemoTenantOption[] = useMemo(
    () =>
      state.properties
        .filter((p) => p.status !== 'Disponible')
        .map((p) => ({
          propertyId: p.id,
          tenantName: p.tenantName,
          address: p.address,
          statusLabel: formatDemoTenantStatusLabel(p),
        })),
    [state.properties]
  );

  const property: TenantPropertyView | undefined = useMemo(() => {
    const occupied = state.properties.filter((p) => p.status !== 'Disponible');
    const linkedId = state.session?.linkedPropertyId ?? DEMO_TENANT_PROPERTY_ID;
    const raw =
      occupied.find((p) => p.id === linkedId) ??
      occupied[0];
    if (!raw) return undefined;
    const {
      rolSii: _rol,
      cbrsFoja: _foja,
      cbrsNumero: _num,
      cbrsAnio: _anio,
      cbrsConservador: _cbr,
      signedContractFileName: _file,
      signedContractDataUrl: _dataUrl,
      signedContractUploadedAt: _uploadedAt,
      ...operationalOnly
    } = raw;
    return operationalOnly;
  }, [state.properties, state.session]);

  const myReceipts = useMemo(
    () => (property ? state.receipts.filter((r) => r.propertyId === property.id) : []),
    [state.receipts, property]
  );

  const myIssues = useMemo(
    () => (property ? state.maintenanceReports.filter((m) => m.propertyId === property.id) : []),
    [state.maintenanceReports, property]
  );

  const myCommonExpenses = useMemo(
    () =>
      property
        ? (state.commonExpenses ?? []).filter((gc) => gc.propertyId === property.id)
        : [],
    [state.commonExpenses, property]
  );

  const paymentHistoryRows = useMemo(
    () =>
      property
        ? buildPropertyPaymentHistory({
            property,
            receipts: myReceipts,
            commonExpenses: myCommonExpenses,
            ufValueClp: state.ufValueClp,
            simulatedDate: state.simulatedDate,
          })
        : [],
    [property, myReceipts, myCommonExpenses, state.ufValueClp, state.simulatedDate]
  );

  if (!property) {
    return (
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-8 text-center">
        <p className="text-sm text-[#4B5563]">No hay una propiedad asociada a esta cuenta.</p>
      </div>
    );
  }

  const baseRentDisplay = formatRentPrimaryAndSecondary(
    property.baseRentAmount ?? property.rentAmount,
    property.currency,
    state.ufValueClp
  );
  const rentDisplay = formatRentPrimaryAndSecondary(
    property.rentAmount,
    property.currency,
    state.ufValueClp
  );
  const guaranteeInfo = formatGuaranteeLabel(property, state.ufValueClp);
  const dailyLateFee = formatDailyLateFeeLabel(property, state.ufValueClp);
  const lateSummary = calculateLateFeeSummary(
    property,
    state.ufValueClp,
    state.simulatedDate
  );
  const latestIpcPercent = state.ipcMonthlyHistory?.[0]?.value;
  const pendingCommonExpense =
    myCommonExpenses.find((gc) => gc.status === 'pendiente' || gc.status === 'atrasado') ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
            Mi Arriendo
          </h1>
          <p className="text-sm text-[#4B5563] mt-1">
            Consulta tu propiedad arrendada, fecha de pago y envía comprobantes o solicitudes al instante.
          </p>
        </div>

        {demoTenantOptions.length > 0 && (
          <div className="bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
            <label
              htmlFor="demo-tenant-selector"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14294A] whitespace-nowrap"
            >
              <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Viendo perfil como (Demo):</span>
            </label>
            <select
              id="demo-tenant-selector"
              value={property.id}
              onChange={(e) => {
                const nextId = e.target.value;
                const chosen = demoTenantOptions.find((opt) => opt.propertyId === nextId);
                setActiveModal(null);
                setViewingSlipExpense(null);
                setUploadingGcExpense(null);
                setViewingPaymentReceipt(null);
                onSwitchDemoTenant(nextId);
                if (chosen) {
                  onNotify(`Perfil cambiado a ${chosen.tenantName} (${chosen.address}).`);
                }
              }}
              className="min-h-[38px] max-w-full sm:max-w-[360px] px-3 py-1.5 text-xs sm:text-sm font-medium text-[#111827] bg-[#F9FAFB] border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A] cursor-pointer"
            >
              {demoTenantOptions.map((opt) => (
                <option key={opt.propertyId} value={opt.propertyId}>
                  {opt.tenantName} — {opt.address} ({opt.statusLabel})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Resumen de la propiedad arrendada y fecha de pago */}
      <section
        id="resumen-arriendo"
        aria-labelledby="resumen-arriendo-heading"
        className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-[#6B7280]">{property.commune}</p>
            <h2 id="resumen-arriendo-heading" className="text-xl font-bold text-[#111827] mt-0.5">
              {property.address}
            </h2>
          </div>
          <div className="flex flex-col sm:items-end gap-1">
            <PropertyStatusLabel status={property.status} />
            <PaymentStatusLabel status={property.paymentStatus} />
          </div>
        </div>

        <div className="pt-5 border-t border-[#E5E7EB] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          <div>
            <p className="text-xs text-[#6B7280]">Monto Vigente a Pagar</p>
            <p className="text-xl font-bold text-[#111827] font-mono tabular-nums mt-1">
              {rentDisplay.primary}
            </p>
            <p className="text-xs text-[#6B7280] font-mono tabular-nums">{rentDisplay.secondary}</p>
            <p className="text-xs text-[#4B5563] font-mono tabular-nums mt-0.5">
              Canon Base (fijo): {baseRentDisplay.primary}
            </p>
            {property.lastIpcAppliedDate && property.lastIpcAppliedPercent !== undefined && (
              <p className="text-xs font-medium text-[#1B5E3A] mt-1">
                Reajuste IPC automático (+{property.lastIpcAppliedPercent.toLocaleString('es-CL')}%) aplicado el{' '}
                {formatSpanishDate(property.lastIpcAppliedDate)}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-[#6B7280]">Garantía Fija</p>
            <p className="text-xl font-bold text-[#14294A] font-mono tabular-nums mt-1">
              {guaranteeInfo.primary}
            </p>
            <p className="text-xs text-[#6B7280] font-mono tabular-nums">
              {guaranteeInfo.secondary} · En resguardo
            </p>
          </div>

          <div>
            <p className="text-xs text-[#6B7280]">Próxima fecha de pago</p>
            <p className="text-xl font-bold text-[#14294A] mt-1 inline-flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#1B5E3A] shrink-0" aria-hidden="true" />
              <span>{formatSpanishDate(property.nextPaymentDate)}</span>
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Día {property.paymentDay} de cada mes
            </p>
          </div>

          <div>
            <p className="text-xs text-[#6B7280]">Multa diaria por atraso</p>
            <p className="text-base font-bold text-[#111827] font-mono tabular-nums mt-1">
              {dailyLateFee.primary}
            </p>
            <p className="text-xs text-[#6B7280] font-mono tabular-nums">
              {dailyLateFee.secondary} si pasa la fecha
            </p>
          </div>

          <div>
            <p className="text-xs text-[#6B7280]">Propietario y contrato</p>
            <p className="text-base font-semibold text-[#111827] mt-1">{property.ownerName}</p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Reajuste: {property.ipcClause} · Vigente hasta {formatSpanishDate(property.contractEnd)}
            </p>
          </div>
        </div>

        {lateSummary.isOverdue && (
          <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#991B1B]">
                Pago en estado Moroso · {lateSummary.daysOverdue} día
                {lateSummary.daysOverdue === 1 ? '' : 's'} de atraso
              </p>
              <span className="text-xs font-mono tabular-nums text-[#B91C1C]">
                Tarifa pactada: {dailyLateFee.primary}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[#FECACA] text-sm">
              <div>
                <span className="block text-xs text-[#7F1D1D]">Canon base</span>
                <span className="font-semibold text-[#111827] font-mono tabular-nums">
                  {formatClp(lateSummary.baseClp)}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#7F1D1D]">
                  + Multa acumulada ({lateSummary.daysOverdue} días)
                </span>
                <span className="font-semibold text-[#B91C1C] font-mono tabular-nums">
                  +{formatClp(lateSummary.accumulatedClp)}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#7F1D1D]">= Total a pagar hoy</span>
                <span className="text-base font-bold text-[#991B1B] font-mono tabular-nums">
                  {formatClp(lateSummary.totalDueClp)}
                </span>
                <span className="block text-xs text-[#7F1D1D] font-mono tabular-nums">
                  Eq. {formatUf(lateSummary.totalDueUf)}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Tarjeta de Gasto Común del Mes (si la propiedad tiene gastos comunes activos) */}
      {property.paysCommonExpenses &&
        (() => {
          const currentGc = myCommonExpenses[0];
          const olderGc = myCommonExpenses.slice(1);
          const statusBadge = (status: CommonExpenseRecord['status']) => {
            if (status === 'pagado') {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEF6F1] text-[#1B5E3A] border border-[#BBF7D0]">
                  Pagado
                </span>
              );
            }
            if (status === 'en_revision') {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#14294A] border border-[#BFDBFE]">
                  En revisión
                </span>
              );
            }
            if (status === 'atrasado') {
              return (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]">
                  Atrasado
                </span>
              );
            }
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]">
                Pendiente
              </span>
            );
          };

          return (
            <section
              id="gasto-comun-mes"
              aria-labelledby="gasto-comun-heading"
              className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-[#F4F5F7] text-[#14294A] inline-flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2
                      id="gasto-comun-heading"
                      className="text-lg font-semibold text-[#111827]"
                    >
                      Gasto Común del Mes
                    </h2>
                    <p className="text-xs text-[#6B7280]">
                      Monto mensual variable según boleta del edificio / condominio
                      {property.commonExpenseReferenceClp
                        ? ` · Referencia pactada: ${formatClp(property.commonExpenseReferenceClp)}`
                        : ''}
                    </p>
                  </div>
                </div>
                {currentGc && statusBadge(currentGc.status)}
              </div>

              {!currentGc ? (
                <p className="text-sm text-[#4B5563]">
                  El propietario aún no ha anexado la colilla de gasto común de este período.
                </p>
              ) : (
                <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                    <div>
                      <span className="block text-xs text-[#6B7280]">Período anexado</span>
                      <span className="text-sm font-semibold text-[#111827]">
                        {currentGc.periodLabel}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-[#6B7280]">Monto exacto a pagar</span>
                      <span className="text-lg font-bold text-[#14294A] font-mono tabular-nums">
                        {formatClp(currentGc.amountClp)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs text-[#6B7280]">Fecha límite</span>
                      <span className="text-sm font-medium text-[#111827]">
                        {formatSpanishDate(currentGc.dueDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setViewingSlipExpense(currentGc)}
                      className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs sm:text-sm font-medium text-[#14294A] bg-white border border-[#D1D5DB] hover:border-[#14294A] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Ver colilla</span>
                    </button>

                    {(currentGc.status === 'pendiente' || currentGc.status === 'atrasado') && (
                      <button
                        type="button"
                        onClick={() => setUploadingGcExpense(currentGc)}
                        className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Subir Comprobante Gasto Común</span>
                      </button>
                    )}

                    {currentGc.status === 'en_revision' && (
                      <span className="text-xs font-medium text-[#14294A]">
                        Comprobante enviado ({currentGc.receiptFileName}) · Esperando validación
                      </span>
                    )}

                    {currentGc.status === 'pagado' && (
                      <span className="text-xs font-medium text-[#1B5E3A] font-mono">
                        Pagado al día
                        {currentGc.receiptReferenceCode
                          ? ` · Ref. ${currentGc.receiptReferenceCode}`
                          : ''}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {olderGc.length > 0 && (
                <div className="pt-2 border-t border-[#E5E7EB]">
                  <p className="text-xs font-medium text-[#6B7280] mb-2">
                    Historial de Gastos Comunes anteriores
                  </p>
                  <ul className="divide-y divide-[#E5E7EB]">
                    {olderGc.map((exp) => (
                      <li
                        key={exp.id}
                        className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-medium text-[#111827]">{exp.periodLabel}</span>
                          <span className="font-mono tabular-nums font-semibold text-[#111827]">
                            {formatClp(exp.amountClp)}
                          </span>
                          <span className="text-[#6B7280]">
                            Venc. {formatSpanishDate(exp.dueDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {statusBadge(exp.status)}
                          <button
                            type="button"
                            onClick={() => setViewingSlipExpense(exp)}
                            className="text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
                          >
                            Ver colilla
                          </button>
                          {(exp.status === 'pendiente' || exp.status === 'atrasado') && (
                            <button
                              type="button"
                              onClick={() => setUploadingGcExpense(exp)}
                              className="text-xs font-medium text-[#1B5E3A] hover:underline underline-offset-4 cursor-pointer"
                            >
                              Subir comprobante
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })()}

      {/* 3 Acciones simples del Arrendatario */}
      <section id="acciones-arrendatario" aria-labelledby="acciones-heading" className="space-y-3">
        <h2 id="acciones-heading" className="text-lg font-semibold text-[#111827]">
          Gestiones rápidas
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#F4F5F7] text-[#14294A] inline-flex items-center justify-center mb-3">
                <FileText className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[#111827]">Contrato vigente</h3>
              <p className="text-sm text-[#4B5563] mt-1">
                Consulta los montos pactados, fechas de pago, cláusula IPC y deberes vigentes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('contrato')}
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#14294A] hover:bg-[#1D3A66] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Ver Condiciones de mi Contrato
            </button>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#EEF6F1] text-[#1B5E3A] inline-flex items-center justify-center mb-3">
                <Receipt className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[#111827]">Pago de arriendo y multas</h3>
              <p className="text-sm text-[#4B5563] mt-1">
                Paga en línea con acceso a tu banco o sube un comprobante de transferencia manual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('pagar')}
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#1B5E3A] hover:bg-[#154B2E] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Pagar Arriendo y Multas
            </button>
          </div>

          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between gap-4">
            <div>
              <div className="w-10 h-10 rounded-lg bg-[#F4F5F7] text-[#14294A] inline-flex items-center justify-center mb-3">
                <Wrench className="w-5 h-5" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[#111827]">Soporte y mantención</h3>
              <p className="text-sm text-[#4B5563] mt-1">
                Informa fallas de gasfitería, electricidad o climatización directamente al propietario.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveModal('averia')}
              className="w-full min-h-[44px] px-4 py-2.5 bg-[#14294A] hover:bg-[#1D3A66] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
            >
              Reportar Avería
            </button>
          </div>
        </div>
      </section>

      {/* Historial de Pagos sincronizado en vivo */}
      <section
        id="historial-pagos"
        aria-labelledby="tenant-payment-history-title"
        className="bg-white border border-[#E5E7EB] rounded-xl p-6"
      >
        <PaymentHistorySection
          viewerRole="tenant"
          headingId="tenant-payment-history-title"
          title="Historial de Pagos"
          rows={paymentHistoryRows}
          onViewReceipt={(rec) => setViewingPaymentReceipt(rec)}
        />
      </section>

      {/* Historial de averías reportadas */}
      <section
        id="actividad-arrendatario"
        aria-labelledby="actividad-heading"
        className="space-y-4"
      >
        <h2 id="actividad-heading" className="text-lg font-semibold text-[#111827]">
          Averías y mantenciones reportadas
        </h2>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          {myIssues.length === 0 ? (
            <p className="text-xs text-[#6B7280]">No tienes reportes de avería activos.</p>
          ) : (
            <ul className="divide-y divide-[#E5E7EB]">
              {myIssues.map((rep) => (
                <li key={rep.id} className="py-2.5 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[#6B7280] tabular-nums">
                      {formatSpanishDate(rep.reportedAt.slice(0, 10))}
                    </p>
                    <p className="text-sm text-[#111827] mt-0.5">{rep.description}</p>
                  </div>
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      rep.status === 'resuelta' ? 'text-[#1B5E3A]' : 'text-[#B45309]'
                    }`}
                  >
                    {rep.status === 'resuelta' ? 'Resuelto' : 'Pendiente'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {activeModal === 'contrato' && (
        <ContractConditionsModal
          property={property}
          ufValueClp={state.ufValueClp}
          latestIpcPercent={latestIpcPercent}
          simulatedDate={state.simulatedDate}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'pagar' && (
        <PayRentModal
          property={property}
          ufValueClp={state.ufValueClp}
          simulatedDate={state.simulatedDate}
          pendingCommonExpense={pendingCommonExpense}
          onClose={() => setActiveModal(null)}
          onSimulateOnlinePayment={(data) => {
            const result = onSimulateOnlinePayment(property.id, data);
            onNotify(
              `Pago en línea por ${formatClp(result.totalPaidClp)} aprobado. Recibo ${result.referenceCode} guardado en tu Historial de Pagos.`
            );
            return result;
          }}
          onSubmitManualReceipt={(data) => {
            onSubmitReceipt(property.id, data);
            onNotify(
              'Comprobante enviado como Pendiente de Validar. El Propietario ya lo ve en "Urgente a resolver".'
            );
          }}
        />
      )}

      {activeModal === 'averia' && (
        <ReportIssueModal
          onClose={() => setActiveModal(null)}
          onSubmit={(data) => {
            onReportIssue(property.id, data);
            onNotify(
              data.responsibility === 'arrendatario'
                ? 'Arreglo menor registrado como resuelto e informado al Propietario.'
                : 'Avería reportada. La propiedad pasó a En Mantención y se envió alerta al Propietario.'
            );
          }}
        />
      )}

      {viewingSlipExpense && (
        <CommonExpenseSlipModal
          expense={viewingSlipExpense}
          propertyAddress={property.address}
          propertyCommune={property.commune}
          onClose={() => setViewingSlipExpense(null)}
        />
      )}

      {uploadingGcExpense && (
        <UploadCommonExpenseReceiptModal
          expense={uploadingGcExpense}
          propertyAddress={property.address}
          propertyCommune={property.commune}
          onClose={() => setUploadingGcExpense(null)}
          onSubmit={(data) => {
            onSubmitCommonExpenseReceipt(property.id, uploadingGcExpense.id, data);
            onNotify(
              `Comprobante de Gasto Común (${uploadingGcExpense.periodLabel}) enviado al Propietario para su validación.`
            );
          }}
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
