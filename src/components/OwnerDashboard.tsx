import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Bell,
  BellOff,
  BellRing,
  Building2,
  CheckCircle2,
  FileCheck2,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { FinancialAiDiagnosisController } from '../hooks/useFinancialAiDiagnosis';
import {
  NewCommonExpenseInput,
  NewPropertyInput,
  RegisterSignedContractInput,
  ResolveMaintenanceInput,
  UpdateLegalDataInput,
} from '../hooks/useSaforentStore';
import {
  CurrencyType,
  IpcFrequency,
  Property,
  PropertyStatus,
  SaforentState,
  UrgentAlert,
} from '../types/saforent';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  isOwnerNotificationsEnabled,
  requestBrowserNotificationPermission,
  setOwnerNotificationsEnabled,
  triggerOwnerBrowserNotification,
} from '../utils/browserNotifications';
import {
  calculateLateFeeSummary,
  formatClp,
  formatDailyLateFeeLabel,
  formatRelativeTimestamp,
  formatRentPrimaryAndSecondary,
  toClp,
} from '../utils/formatters';
import { AddPropertyModal } from './AddPropertyModal';
import { FinancialSummarySection } from './FinancialSummarySection';
import { PropertyDetailModal } from './PropertyDetailModal';
import { RegisterSignedContractModal } from './RegisterSignedContractModal';
import { ResolveMaintenanceModal } from './ResolveMaintenanceModal';
import { PaymentStatusLabel, PropertyStatusLabel } from './StatusLabel';

interface OwnerDashboardProps {
  state: SaforentState;
  onAddProperty: (input: NewPropertyInput) => void;
  onStatusChange: (propertyId: string, status: PropertyStatus) => void;
  onUpdateLegalData: (propertyId: string, input: UpdateLegalDataInput) => void;
  onUpdateIpcClause: (propertyId: string, ipcClause: IpcFrequency) => void;
  onUpdateLateFee: (propertyId: string, currency: CurrencyType, amount: number) => void;
  onUpdateGuarantee: (propertyId: string, currency: CurrencyType, amount: number) => void;
  onUpdateCommonExpensesConfig: (
    propertyId: string,
    paysCommonExpenses: boolean,
    commonExpenseReferenceClp: number
  ) => void;
  onAttachCommonExpense: (propertyId: string, input: NewCommonExpenseInput) => void;
  onApproveCommonExpense: (propertyId: string, expenseId?: string, alertId?: string) => void;
  onRegisterSignedContract: (propertyId: string, input: RegisterSignedContractInput) => void;
  onResolveMorosidad: (propertyId: string, alertId: string) => void;
  onDismissAlert: (alertId: string) => void;
  onApproveReceipt: (propertyId: string, receiptId?: string, alertId?: string) => void;
  onResolveMaintenance: (
    propertyId: string,
    reportId?: string,
    alertId?: string,
    resolution?: ResolveMaintenanceInput
  ) => void;
  onNotify: (message: string) => void;
  onClearPendingNotifications: () => void;
  activeTab: 'gestion' | 'finanzas';
  onTabChange: (tab: 'gestion' | 'finanzas') => void;
  aiDiagnosis: FinancialAiDiagnosisController;
}

type StatusFilter = 'Todas' | PropertyStatus;
type SortOption = 'default' | 'rent_desc' | 'rent_asc';

interface ResolvingMaintTarget {
  propertyId: string;
  propertyAddress: string;
  propertyCommune: string;
  reportId?: string;
  alertId?: string;
  defaultItemDetail: string;
}

export function OwnerDashboard({
  state,
  onAddProperty,
  onStatusChange,
  onUpdateLegalData,
  onUpdateIpcClause,
  onUpdateLateFee,
  onUpdateGuarantee,
  onUpdateCommonExpensesConfig,
  onAttachCommonExpense,
  onApproveCommonExpense,
  onRegisterSignedContract,
  onResolveMorosidad,
  onDismissAlert,
  onApproveReceipt,
  onResolveMaintenance,
  onNotify,
  onClearPendingNotifications,
  activeTab,
  onTabChange,
  aiDiagnosis,
}: OwnerDashboardProps) {
  const [filter, setFilter] = useState<StatusFilter>('Todas');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [registeringContractPropertyId, setRegisteringContractPropertyId] = useState<string | null>(
    null
  );
  const [resolvingMaintTarget, setResolvingMaintTarget] = useState<ResolvingMaintTarget | null>(
    null
  );
  const [notifPermission, setNotifPermission] = useState<BrowserNotificationPermission>(() =>
    getBrowserNotificationPermission()
  );
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => isOwnerNotificationsEnabled());

  useEffect(() => {
    const pending = state.pendingOwnerNotifications;
    if (!pending || pending.length === 0) return;

    pending.forEach((item) => {
      triggerOwnerBrowserNotification(item);
    });

    const latest = pending[pending.length - 1];
    onNotify(`Aviso nuevo: ${latest.title}`);
    onClearPendingNotifications();
  }, [state.pendingOwnerNotifications, onNotify, onClearPendingNotifications]);

  const handleNotificationAction = async () => {
    if (notifPermission === 'unsupported') {
      onNotify(
        'Tu navegador o vista actual no soporta notificaciones del sistema. Las alertas seguirán apareciendo en "Urgente a resolver".'
      );
      return;
    }

    if (notifPermission === 'denied') {
      onNotify(
        'Las notificaciones están bloqueadas en el navegador. Habilítalas en el candado de la barra de direcciones para recibir avisos.'
      );
      return;
    }

    if (notifPermission === 'default') {
      const result = await requestBrowserNotificationPermission();
      setNotifPermission(result);
      if (result === 'granted') {
        setNotifEnabled(true);
        triggerOwnerBrowserNotification({
          title: 'Avisos activados en Saforent APP',
          body: 'Te notificaremos cuando un arrendatario suba un comprobante o reporte una avería crítica.',
          tag: 'saforent-welcome-notif',
        });
        onNotify('Notificaciones del navegador activadas para el Propietario.');
      } else if (result === 'denied') {
        onNotify('Permiso de notificaciones denegado en el navegador.');
      }
      return;
    }

    const next = !notifEnabled;
    setOwnerNotificationsEnabled(next);
    setNotifEnabled(next);
    if (next) {
      triggerOwnerBrowserNotification({
        title: 'Notificaciones reanudadas',
        body: 'Recibirás avisos al recibir comprobantes o averías críticas.',
        tag: 'saforent-resumed-notif',
      });
    }
    onNotify(next ? 'Notificaciones del navegador activadas.' : 'Notificaciones del navegador pausadas.');
  };

  const selectedProperty = useMemo(
    () => state.properties.find((p) => p.id === selectedPropertyId) ?? null,
    [state.properties, selectedPropertyId]
  );

  const registeringContractProperty = useMemo(
    () => state.properties.find((p) => p.id === registeringContractPropertyId) ?? null,
    [state.properties, registeringContractPropertyId]
  );

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = state.properties.filter((prop) => {
      if (filter !== 'Todas' && prop.status !== filter) return false;
      if (!q) return true;
      return (
        prop.address.toLowerCase().includes(q) ||
        prop.commune.toLowerCase().includes(q) ||
        prop.tenantName.toLowerCase().includes(q) ||
        prop.rolSii.toLowerCase().includes(q) ||
        prop.cbrsNumero.toLowerCase().includes(q)
      );
    });

    if (sortBy === 'default') return list;

    return [...list].sort((a, b) => {
      const clpA = toClp(a.rentAmount, a.currency, state.ufValueClp);
      const clpB = toClp(b.rentAmount, b.currency, state.ufValueClp);
      return sortBy === 'rent_desc' ? clpB - clpA : clpA - clpB;
    });
  }, [state.properties, state.ufValueClp, filter, searchQuery, sortBy]);

  const filterTabs: StatusFilter[] = [
    'Todas',
    'Disponible',
    'Activo',
    'Moroso',
    'En Mantención',
  ];

  const renderAlertIcon = (alert: UrgentAlert) => {
    switch (alert.type) {
      case 'morosidad':
        return <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" aria-hidden="true" />;
      case 'averia':
        return <Wrench className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />;
      case 'ipc':
        return <TrendingUp className="w-4 h-4 text-[#1B5E3A] shrink-0 mt-0.5" aria-hidden="true" />;
      case 'comprobante':
        return <FileCheck2 className="w-4 h-4 text-[#14294A] shrink-0 mt-0.5" aria-hidden="true" />;
      case 'gasto_comun':
        return (
          <Building2
            className={`w-4 h-4 shrink-0 mt-0.5 ${
              alert.severity === 'alta' ? 'text-[#B91C1C]' : 'text-[#14294A]'
            }`}
            aria-hidden="true"
          />
        );
    }
  };

  const getAlertCategoryLabel = (alert: UrgentAlert) => {
    switch (alert.type) {
      case 'morosidad':
        return 'Morosidad';
      case 'averia':
        return 'Avería reportada';
      case 'ipc':
        return 'Reajuste IPC';
      case 'comprobante':
        return 'Comprobante por validar';
      case 'gasto_comun': {
        const matchedExpense = (state.commonExpenses ?? []).find(
          (e) => e.id === alert.relatedRecordId
        );
        return matchedExpense?.status === 'en_revision'
          ? 'Gasto Común por validar'
          : 'Gasto Común atrasado';
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Menú de dos pestañas en la parte superior de la Vista Propietario */}
      <div className="border-b border-[#E5E7EB]">
        <div
          role="tablist"
          aria-label="Secciones del propietario"
          className="grid grid-cols-2 sm:inline-flex gap-1 sm:gap-2"
        >
          <button
            type="button"
            role="tab"
            id="tab-gestion"
            aria-selected={activeTab === 'gestion'}
            aria-controls="panel-gestion"
            onClick={() => onTabChange('gestion')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap text-center ${
              activeTab === 'gestion'
                ? 'border-[#14294A] text-[#14294A]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-[#D1D5DB]'
            }`}
          >
            Gestión y Propiedades
          </button>
          <button
            type="button"
            role="tab"
            id="tab-finanzas"
            aria-selected={activeTab === 'finanzas'}
            aria-controls="panel-finanzas"
            onClick={() => onTabChange('finanzas')}
            className={`min-h-[44px] px-4 sm:px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap text-center ${
              activeTab === 'finanzas'
                ? 'border-[#14294A] text-[#14294A]'
                : 'border-transparent text-[#6B7280] hover:text-[#111827] hover:border-[#D1D5DB]'
            }`}
          >
            Finanzas
          </button>
        </div>
      </div>

      {/* Encabezado de vista y acciones */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827]">
            {activeTab === 'gestion' ? 'Gestión y Propiedades' : 'Finanzas'}
          </h1>
          <p className="text-sm text-[#4B5563] mt-1">
            {activeTab === 'gestion'
              ? 'Supervisa alertas críticas, reajustes por IPC y antecedentes legales de tus propiedades.'
              : 'Visualiza ingresos mensuales proyectados, ocupación de cartera y tendencia de pagos.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleNotificationAction}
            className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14294A] ${
              notifPermission === 'granted' && notifEnabled
                ? 'bg-[#EEF6F1] text-[#1B5E3A] border-[#BBF7D0] hover:bg-[#DCFCE7]'
                : 'bg-white text-[#14294A] border-[#D1D5DB] hover:bg-[#F9FAFB] hover:border-[#14294A]'
            }`}
          >
            {notifPermission === 'granted' && notifEnabled ? (
              <>
                <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Avisos activos</span>
              </>
            ) : notifPermission === 'default' ? (
              <>
                <BellRing className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Activar avisos</span>
              </>
            ) : (
              <>
                <BellOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {notifPermission === 'granted' ? 'Avisos pausados' : 'Avisos bloqueados'}
                </span>
              </>
            )}
          </button>

          {activeTab === 'gestion' ? (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#14294A] hover:bg-[#1D3A66] text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14294A]"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>+ Sumar Propiedad</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={aiDiagnosis.isLoading || aiDiagnosis.isRefreshing}
              onClick={() => void aiDiagnosis.generateDiagnosis()}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 bg-[#14294A] hover:bg-[#1D3A66] disabled:opacity-70 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14294A]"
            >
              <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {aiDiagnosis.isLoading || aiDiagnosis.isRefreshing
                  ? 'Analizando Cartera...'
                  : 'Generar Diagnóstico IA'}
              </span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'gestion' ? (
        <div id="panel-gestion" role="tabpanel" aria-labelledby="tab-gestion" className="space-y-8">
      {/* Sección Superior: Urgente a resolver */}
      <section id="urgente" aria-labelledby="urgente-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 id="urgente-heading" className="text-lg font-semibold text-[#111827]">
              Urgente a resolver
            </h2>
            <p className="text-sm text-[#6B7280]">
              Pagos atrasados, comprobantes por aprobar, averías reportadas y avisos de reajuste IPC.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#6B7280] shrink-0">
            {state.alerts.length} pendiente{state.alerts.length === 1 ? '' : 's'}
          </span>
        </div>

        {state.alerts.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex items-center gap-3 text-sm text-[#1B5E3A]">
            <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span>Todo está al día. No tienes alertas pendientes en este momento.</span>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#E5E7EB]">
            {state.alerts.map((alert) => {
              const prop = state.properties.find((p) => p.id === alert.propertyId);
              return (
                <div
                  key={alert.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[#FAFAFB] transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {renderAlertIcon(alert)}
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6B7280]">
                        <span
                          className={`font-medium ${
                            alert.severity === 'alta' ? 'text-[#B91C1C]' : 'text-[#14294A]'
                          }`}
                        >
                          {getAlertCategoryLabel(alert)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTimestamp(alert.createdAt)}</span>
                        {prop && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">Rol {prop.rolSii}</span>
                          </>
                        )}
                      </div>
                      <h3 className="text-sm sm:text-base font-semibold text-[#111827]">
                        {alert.title}
                      </h3>
                      <p className="text-sm text-[#4B5563]">{alert.description}</p>
                      {alert.type === 'morosidad' &&
                        prop &&
                        (() => {
                          const late = calculateLateFeeSummary(
                            prop,
                            state.ufValueClp,
                            state.simulatedDate
                          );
                          const daily = formatDailyLateFeeLabel(prop, state.ufValueClp);
                          if (!late.isOverdue) return null;
                          return (
                            <p className="text-xs font-mono tabular-nums text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] rounded-md px-2.5 py-1.5 inline-block mt-1">
                              {late.daysOverdue} día{late.daysOverdue === 1 ? '' : 's'} de atraso ·
                              Multa acumulada +{formatClp(late.accumulatedClp)} ({daily.primary}) ·
                              Total a cobrar hoy:{' '}
                              <span className="font-bold">{formatClp(late.totalDueClp)}</span>
                            </p>
                          );
                        })()}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 pl-7 lg:pl-0">
                    {alert.type === 'morosidad' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onNotify(
                              `Recordatorio de pago enviado a ${prop?.tenantName ?? 'inquilino'}.`
                            );
                          }}
                          className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-[#14294A] bg-white border border-[#D1D5DB] hover:border-[#14294A] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Enviar Recordatorio
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onResolveMorosidad(alert.propertyId, alert.id);
                            onNotify('Pago regularizado y propiedad marcada como Activa.');
                          }}
                          className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Marcar Pagado
                        </button>
                      </>
                    )}

                    {alert.type === 'comprobante' && (
                      <button
                        type="button"
                        onClick={() => {
                          onApproveReceipt(alert.propertyId, alert.relatedRecordId, alert.id);
                          onNotify('Comprobante aprobado. Arriendo actualizado a Pagado al día.');
                        }}
                        className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Aprobar Comprobante
                      </button>
                    )}

                    {alert.type === 'gasto_comun' &&
                      (() => {
                        const matchedExpense = (state.commonExpenses ?? []).find(
                          (e) => e.id === alert.relatedRecordId
                        );
                        if (matchedExpense?.status === 'en_revision') {
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                onApproveCommonExpense(
                                  alert.propertyId,
                                  alert.relatedRecordId,
                                  alert.id
                                );
                                onNotify('Comprobante de gasto común validado y marcado como Pagado.');
                              }}
                              className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Aprobar Gasto Común
                            </button>
                          );
                        }
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                onNotify(
                                  `Recordatorio de Gasto Común enviado a ${prop?.tenantName ?? 'arrendatario'}.`
                                );
                              }}
                              className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-[#14294A] bg-white border border-[#D1D5DB] hover:border-[#14294A] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Enviar Recordatorio
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                onApproveCommonExpense(
                                  alert.propertyId,
                                  alert.relatedRecordId,
                                  alert.id
                                );
                                onNotify('Gasto Común regularizado y marcado como Pagado.');
                              }}
                              className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                            >
                              Marcar Pagado
                            </button>
                          </>
                        );
                      })()}

                    {alert.type === 'averia' &&
                      (alert.resolvedByTenant ? (
                        <button
                          type="button"
                          onClick={() => {
                            onDismissAlert(alert.id);
                            onNotify('Aviso de arreglo menor confirmado y archivado.');
                          }}
                          className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-[#1B5E3A] bg-[#EEF6F1] border border-[#BBF7D0] hover:bg-[#DCFCE7] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Confirmar visto
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const matchedReport = state.maintenanceReports.find(
                              (m) => m.id === alert.relatedRecordId
                            );
                            setResolvingMaintTarget({
                              propertyId: alert.propertyId,
                              propertyAddress: prop?.address ?? 'Propiedad',
                              propertyCommune: prop?.commune ?? '',
                              reportId: alert.relatedRecordId,
                              alertId: alert.id,
                              defaultItemDetail:
                                matchedReport?.description || alert.title,
                            });
                          }}
                          className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Marcar como Resuelta
                        </button>
                      ))}

                    {alert.type === 'ipc' && (
                      <button
                        type="button"
                        onClick={() => {
                          onDismissAlert(alert.id);
                          onNotify('Aviso informativo de reajuste IPC descartado.');
                        }}
                        className="min-h-[38px] px-3.5 py-2 text-xs font-medium text-[#1B5E3A] bg-[#EEF6F1] border border-[#BBF7D0] hover:bg-[#DCFCE7] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Entendido / Descartar
                      </button>
                    )}

                    {prop && (
                      <button
                        type="button"
                        onClick={() => setSelectedPropertyId(prop.id)}
                        className="min-h-[38px] px-3 py-2 text-xs font-medium text-[#4B5563] hover:text-[#14294A] transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <span>Ver ficha</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Listado de Propiedades */}
      <section id="propiedades" aria-labelledby="propiedades-heading" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 id="propiedades-heading" className="text-lg font-semibold text-[#111827]">
              Mis Propiedades
            </h2>
            <p className="text-sm text-[#6B7280]">
              Datos legales (Rol SII y CBRS), arrendatario, monto en CLP/UF y estado actual.
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search
              className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar dirección, inquilino o Rol..."
              aria-label="Buscar propiedades"
              className="w-full min-h-[40px] pl-9 pr-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
            />
          </div>
        </div>

        {/* Barra de filtros por estado y ordenamiento por monto */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-3 sm:p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtrar por estado"
            className="flex flex-wrap items-center gap-1.5"
          >
            {filterTabs.map((tab) => {
              const count =
                tab === 'Todas'
                  ? state.properties.length
                  : state.properties.filter((p) => p.status === tab).length;
              const active = filter === tab;
              return (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#14294A] text-white border-[#14294A]'
                      : 'bg-[#F9FAFB] text-[#374151] border-[#E5E7EB] hover:border-[#CBD5E1] hover:text-[#111827]'
                  }`}
                >
                  {tab} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <label
              htmlFor="sort-rent"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] whitespace-nowrap"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#14294A] shrink-0" aria-hidden="true" />
              <span>Ordenar:</span>
            </label>
            <select
              id="sort-rent"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#111827] bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A] cursor-pointer"
            >
              <option value="default">Orden predeterminado</option>
              <option value="rent_desc">Monto arriendo: Mayor a menor</option>
              <option value="rent_asc">Monto arriendo: Menor a mayor</option>
            </select>

            {(filter !== 'Todas' || sortBy !== 'default' || searchQuery.trim() !== '') && (
              <button
                type="button"
                onClick={() => {
                  setFilter('Todas');
                  setSortBy('default');
                  setSearchQuery('');
                }}
                className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {filteredProperties.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-10 text-center space-y-3">
            <p className="text-sm text-[#4B5563]">
              No hay propiedades que coincidan con el filtro o búsqueda actual.
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter('Todas');
                setSortBy('default');
                setSearchQuery('');
              }}
              className="min-h-[40px] px-4 py-2 text-sm font-medium text-[#14294A] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer"
            >
              Mostrar todas las propiedades
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredProperties.map((prop: Property) => {
              const rent = formatRentPrimaryAndSecondary(
                prop.rentAmount,
                prop.currency,
                state.ufValueClp
              );
              return (
                <article
                  key={prop.id}
                  className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-[#CBD5E1] transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#6B7280]">{prop.commune}</p>
                        <h3 className="text-base font-semibold text-[#111827] mt-0.5 leading-snug">
                          {prop.address}
                        </h3>
                      </div>
                      <PropertyStatusLabel status={prop.status} />
                    </div>

                    <div className="text-xs text-[#4B5563] flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-mono tabular-nums">Rol SII: {prop.rolSii}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Foja {prop.cbrsFoja} / N° {prop.cbrsNumero}
                        {prop.cbrsAnio ? ` · Año ${prop.cbrsAnio}` : ''} ({prop.cbrsConservador})
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E5E7EB] space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-[#6B7280]">Inquilino</p>
                        <p className="text-sm font-medium text-[#111827]">{prop.tenantName}</p>
                        <div className="mt-1">
                          {prop.status === 'Disponible' ? (
                            <span className="text-xs font-medium text-[#1E40AF]">
                              Vacante · Lista para arrendar
                            </span>
                          ) : (
                            <PaymentStatusLabel status={prop.paymentStatus} />
                          )}
                        </div>
                        {(prop.status === 'Moroso' || prop.paymentStatus === 'atrasado') &&
                          (() => {
                            const late = calculateLateFeeSummary(
                              prop,
                              state.ufValueClp,
                              state.simulatedDate
                            );
                            if (!late.isOverdue) return null;
                            return (
                              <p className="mt-1.5 text-xs font-mono tabular-nums text-[#991B1B]">
                                {late.daysOverdue} días de atraso · Multa +
                                {formatClp(late.accumulatedClp)}
                              </p>
                            );
                          })()}
                      </div>

                      <div className="text-right">
                        <p className="text-base font-bold text-[#111827] font-mono tabular-nums">
                          {rent.primary}
                        </p>
                        <p className="text-xs text-[#6B7280] font-mono tabular-nums">
                          {rent.secondary}
                        </p>
                        {prop.baseRentAmount !== undefined &&
                          prop.baseRentAmount !== prop.rentAmount && (
                            <p className="text-xs text-[#4B5563] font-mono tabular-nums mt-0.5">
                              Canon Base:{' '}
                              {
                                formatRentPrimaryAndSecondary(
                                  prop.baseRentAmount,
                                  prop.currency,
                                  state.ufValueClp
                                ).primary
                              }
                            </p>
                          )}
                        {(prop.status === 'Moroso' || prop.paymentStatus === 'atrasado') &&
                          (() => {
                            const late = calculateLateFeeSummary(
                              prop,
                              state.ufValueClp,
                              state.simulatedDate
                            );
                            if (!late.isOverdue) return null;
                            return (
                              <p className="text-xs font-semibold text-[#991B1B] font-mono tabular-nums mt-0.5">
                                Total hoy: {formatClp(late.totalDueClp)}
                              </p>
                            );
                          })()}
                        <button
                          type="button"
                          onClick={() => setSelectedPropertyId(prop.id)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
                        >
                          <span>Gestionar propiedad e IPC</span>
                          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {prop.status === 'Disponible' && (
                      <div className="pt-3 border-t border-[#E5E7EB]">
                        <button
                          type="button"
                          onClick={() => setRegisteringContractPropertyId(prop.id)}
                          className="w-full min-h-[40px] px-3.5 py-2 bg-[#14294A] hover:bg-[#1D3A66] text-white text-xs sm:text-sm font-medium rounded-lg transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>Registrar Contrato Firmado</span>
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
        </div>
      ) : (
        <div id="panel-finanzas" role="tabpanel" aria-labelledby="tab-finanzas">
          <FinancialSummarySection
            properties={state.properties}
            receipts={state.receipts}
            maintenanceExpenses={state.maintenanceExpenses ?? []}
            commonExpenses={state.commonExpenses ?? []}
            ufValueClp={state.ufValueClp}
            ipcMonthlyHistory={state.ipcMonthlyHistory}
            simulatedDate={state.simulatedDate}
            onNotify={onNotify}
            aiDiagnosis={aiDiagnosis}
          />
        </div>
      )}

      {showAddModal && (
        <AddPropertyModal
          ufValueClp={state.ufValueClp}
          onClose={() => setShowAddModal(false)}
          onSubmit={(input) => {
            onAddProperty(input);
            onNotify(`Propiedad en ${input.commune} agregada en estado Disponible.`);
          }}
        />
      )}

      {registeringContractProperty && (
        <RegisterSignedContractModal
          property={registeringContractProperty}
          ufValueClp={state.ufValueClp}
          onClose={() => setRegisteringContractPropertyId(null)}
          onSubmit={(propId, input) => {
            onRegisterSignedContract(propId, input);
            onNotify(
              `Contrato firmado registrado para ${input.tenantName}. Propiedad pasó a estado "Activo".`
            );
          }}
        />
      )}

      {selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          ufValueClp={state.ufValueClp}
          ipcMonthlyHistory={state.ipcMonthlyHistory}
          simulatedDate={state.simulatedDate}
          receipts={state.receipts.filter((r) => r.propertyId === selectedProperty.id)}
          maintenanceReports={state.maintenanceReports.filter(
            (m) => m.propertyId === selectedProperty.id
          )}
          maintenanceExpenses={(state.maintenanceExpenses ?? []).filter(
            (e) => e.propertyId === selectedProperty.id
          )}
          commonExpenses={(state.commonExpenses ?? []).filter(
            (e) => e.propertyId === selectedProperty.id
          )}
          onClose={() => setSelectedPropertyId(null)}
          onStatusChange={(id, status) => {
            onStatusChange(id, status);
            onNotify(`Estado actualizado a ${status}.`);
          }}
          onUpdateLegalData={(id, legalInput) => {
            onUpdateLegalData(id, legalInput);
            onNotify('Antecedentes legales actualizados correctamente.');
          }}
          onUpdateIpcClause={(id, nextClause) => {
            onUpdateIpcClause(id, nextClause);
            onNotify(`Periodicidad de reajuste actualizada a ${nextClause}.`);
          }}
          onUpdateLateFee={(id, currency, amount) => {
            onUpdateLateFee(id, currency, amount);
            onNotify('Multa diaria por atraso actualizada correctamente.');
          }}
          onUpdateGuarantee={(id, currency, amount) => {
            onUpdateGuarantee(id, currency, amount);
            onNotify('Garantía Fija actualizada correctamente.');
          }}
          onUpdateCommonExpensesConfig={(id, paysGc, refClp) => {
            onUpdateCommonExpensesConfig(id, paysGc, refClp);
            onNotify('Configuración de Gastos Comunes actualizada.');
          }}
          onAttachCommonExpense={(id, gcInput) => {
            onAttachCommonExpense(id, gcInput);
            onNotify(
              `Gasto Común (${gcInput.periodLabel}) anexado por ${formatClp(gcInput.amountClp)}.`
            );
          }}
          onApproveCommonExpense={(propId, expId) => {
            onApproveCommonExpense(propId, expId);
            onNotify('Pago de Gasto Común validado.');
          }}
          onApproveReceipt={(propId, recId) => {
            onApproveReceipt(propId, recId);
            onNotify('Comprobante validado.');
          }}
          onRequestResolveMaintenance={(propId, repId, defaultDetail) => {
            setResolvingMaintTarget({
              propertyId: propId,
              propertyAddress: selectedProperty.address,
              propertyCommune: selectedProperty.commune,
              reportId: repId,
              defaultItemDetail: defaultDetail,
            });
          }}
          onInspectExpenseReceipt={(expense) => {
            onNotify(
              `Comprobante adjunto: ${expense.receiptFileName} (${formatClp(expense.amountClp)} · ${expense.paidBy}).`
            );
          }}
        />
      )}

      {resolvingMaintTarget && (
        <ResolveMaintenanceModal
          propertyAddress={resolvingMaintTarget.propertyAddress}
          propertyCommune={resolvingMaintTarget.propertyCommune}
          defaultItemDetail={resolvingMaintTarget.defaultItemDetail}
          onClose={() => setResolvingMaintTarget(null)}
          onConfirm={(resolutionData) => {
            onResolveMaintenance(
              resolvingMaintTarget.propertyId,
              resolvingMaintTarget.reportId,
              resolvingMaintTarget.alertId,
              resolutionData
            );
            onNotify(
              `Avería marcada como resuelta y gasto de ${formatClp(resolutionData.amountClp)} guardado en el historial privado.`
            );
          }}
        />
      )}
    </div>
  );
}
