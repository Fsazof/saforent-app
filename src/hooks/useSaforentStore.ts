import { useCallback, useEffect, useRef, useState } from 'react';
import { DEMO_TENANT_PROPERTY_ID, INITIAL_DEMO_STATE } from '../data/initialDemoData';
import {
  CommonExpenseRecord,
  CurrencyType,
  ExpenseResponsibility,
  IpcFrequency,
  MaintenanceExpenseRecord,
  MaintenanceReport,
  PaymentReceipt,
  PendingOwnerNotification,
  Property,
  PropertyStatus,
  SaforentState,
  UrgentAlert,
  UserRole,
} from '../types/saforent';
import { triggerOwnerBrowserNotification } from '../utils/browserNotifications';
import {
  computeAccumulatedIpcPercent,
  FALLBACK_IPC_HISTORY,
  getLocalChileEconomicIndicators,
  getMonthsForIpcClause,
} from '../utils/economicIndicators';
import {
  addMonthsIsoDate,
  calculateIpcAdjustedRent,
  DEFAULT_SIMULATED_DATE,
  formatClp,
  formatSpanishDate,
  formatUf,
  toClp,
  toUf,
} from '../utils/formatters';

const STORAGE_KEY = 'saforent_app_state_v10';

function applyAutomaticIpcReajustes(
  baseState: SaforentState,
  targetDate: string
): { nextState: SaforentState; autoIpcCount: number } {
  const history =
    baseState.ipcMonthlyHistory && baseState.ipcMonthlyHistory.length > 0
      ? baseState.ipcMonthlyHistory
      : FALLBACK_IPC_HISTORY;

  let autoIpcCount = 0;
  let nextAlerts = [...baseState.alerts];

  const nextProperties = baseState.properties.map((prop) => {
    const baseRent = prop.baseRentAmount ?? prop.rentAmount;
    if (prop.status === 'Disponible') {
      return { ...prop, baseRentAmount: baseRent };
    }

    let updated: Property = { ...prop, baseRentAmount: baseRent };
    const freqMonths = getMonthsForIpcClause(updated.ipcClause);

    if (freqMonths > 0 && updated.nextIpcDate && updated.nextIpcDate <= targetDate) {
      let guard = 0;
      while (updated.nextIpcDate <= targetDate && guard < 12) {
        guard += 1;
        const pct =
          updated.pendingIpcPercent ?? computeAccumulatedIpcPercent(history, freqMonths);
        const adjustedRent = calculateIpcAdjustedRent(
          updated.rentAmount,
          updated.currency,
          pct
        );
        const triggeredDate = updated.nextIpcDate;
        const nextDueIpc = addMonthsIsoDate(triggeredDate, freqMonths, 1);

        updated = {
          ...updated,
          baseRentAmount: baseRent,
          rentAmount: adjustedRent,
          pendingIpcPercent: null,
          lastIpcAppliedDate: triggeredDate,
          lastIpcAppliedPercent: pct,
          nextIpcDate: nextDueIpc,
        };
        autoIpcCount += 1;

        const baseLabel =
          updated.currency === 'CLP' ? formatClp(baseRent) : formatUf(baseRent);
        const newLabel =
          updated.currency === 'CLP' ? formatClp(adjustedRent) : formatUf(adjustedRent);

        nextAlerts = nextAlerts.filter(
          (a) => !(a.propertyId === updated.id && a.type === 'ipc')
        );
        nextAlerts.unshift({
          id: `alert-ipc-auto-${updated.id}-${triggeredDate}`,
          propertyId: updated.id,
          type: 'ipc',
          title: `Reajuste IPC ${updated.ipcClause.toLowerCase()} aplicado automáticamente (+${pct.toLocaleString('es-CL')}%) · ${updated.commune}`,
          description: `Plazo cumplido el ${formatSpanishDate(triggeredDate)}. Canon Base fijo: ${baseLabel} → Nuevo Monto Vigente a Pagar: ${newLabel}. ${updated.tenantName} ya fue notificado del nuevo monto a pagar este mes.`,
          createdAt: `${targetDate}T09:00:00`,
          severity: 'media',
          ipcPercent: pct,
          autoApplied: true,
        });
      }
    }

    return updated;
  });

  if (autoIpcCount === 0) {
    return {
      nextState: {
        ...baseState,
        properties: nextProperties,
      },
      autoIpcCount: 0,
    };
  }

  return {
    nextState: {
      ...baseState,
      properties: nextProperties,
      alerts: nextAlerts,
    },
    autoIpcCount,
  };
}

function normalizeState(rawState: SaforentState): SaforentState {
  const refDate = rawState.simulatedDate || DEFAULT_SIMULATED_DATE;
  const cleaned: SaforentState = {
    ...INITIAL_DEMO_STATE,
    ...rawState,
    simulatedDate: refDate,
    ipcMonthlyHistory:
      Array.isArray(rawState.ipcMonthlyHistory) && rawState.ipcMonthlyHistory.length > 0
        ? rawState.ipcMonthlyHistory
        : FALLBACK_IPC_HISTORY,
    properties: rawState.properties.map((p) => ({
      ...p,
      baseRentAmount: p.baseRentAmount ?? p.rentAmount,
    })),
    alerts: Array.isArray(rawState.alerts)
      ? rawState.alerts.filter((a) => !(a.type === 'ipc' && !a.autoApplied))
      : INITIAL_DEMO_STATE.alerts,
    maintenanceExpenses: Array.isArray(rawState.maintenanceExpenses)
      ? rawState.maintenanceExpenses
      : INITIAL_DEMO_STATE.maintenanceExpenses,
    commonExpenses: Array.isArray(rawState.commonExpenses)
      ? rawState.commonExpenses
      : INITIAL_DEMO_STATE.commonExpenses,
  };

  return applyAutomaticIpcReajustes(cleaned, refDate).nextState;
}

function loadInitialState(): SaforentState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return applyAutomaticIpcReajustes(
        INITIAL_DEMO_STATE,
        INITIAL_DEMO_STATE.simulatedDate || DEFAULT_SIMULATED_DATE
      ).nextState;
    }
    const parsed = JSON.parse(raw) as SaforentState;
    if (!parsed || !Array.isArray(parsed.properties)) {
      return applyAutomaticIpcReajustes(
        INITIAL_DEMO_STATE,
        INITIAL_DEMO_STATE.simulatedDate || DEFAULT_SIMULATED_DATE
      ).nextState;
    }
    return normalizeState(parsed);
  } catch {
    return applyAutomaticIpcReajustes(
      INITIAL_DEMO_STATE,
      INITIAL_DEMO_STATE.simulatedDate || DEFAULT_SIMULATED_DATE
    ).nextState;
  }
}

export interface NewPropertyInput {
  address: string;
  commune: string;
  rolSii: string;
  cbrsFoja: string;
  cbrsNumero: string;
  cbrsAnio?: string;
  cbrsConservador: string;
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  currency: CurrencyType;
  rentAmount: number;
  paymentDay: number;
  ipcClause: IpcFrequency;
  pendingIpcPercent?: number | null;
  guaranteeCurrency?: CurrencyType;
  guaranteeAmount?: number;
  lateFeeCurrency?: CurrencyType;
  lateFeeDailyAmount?: number;
  paysCommonExpenses?: boolean;
  commonExpenseReferenceClp?: number;
  contractNotes: string;
}

export interface RegisterSignedContractInput {
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  currency: CurrencyType;
  rentAmount: number;
  paymentDay: number;
  ipcClause: IpcFrequency;
  guaranteeCurrency: CurrencyType;
  guaranteeAmount: number;
  lateFeeCurrency: CurrencyType;
  lateFeeDailyAmount: number;
  paysCommonExpenses?: boolean;
  commonExpenseReferenceClp?: number;
  signedContractFileName: string;
  signedContractDataUrl?: string;
  contractNotes?: string;
}

export interface UpdateLegalDataInput {
  rolSii: string;
  cbrsFoja: string;
  cbrsNumero: string;
  cbrsAnio: string;
  cbrsConservador: string;
}

export interface NewReceiptInput {
  periodLabel: string;
  amount: number;
  currency: CurrencyType;
  method: string;
  referenceCode: string;
  fileName: string;
  fileDataUrl?: string;
}

export interface SimulateOnlinePaymentInput {
  periodLabel: string;
  rentAmountClp: number;
  lateFeeClp: number;
  commonExpenseId?: string;
  commonExpenseAmountClp?: number;
  channelLabel: string;
}

export interface SimulateOnlinePaymentResult {
  receiptId: string;
  referenceCode: string;
  fileName: string;
  totalPaidClp: number;
  submittedAt: string;
}

export interface NewMaintenanceInput {
  responsibility: ExpenseResponsibility;
  category: string;
  urgency: 'Alta' | 'Media';
  description: string;
  photoName?: string;
  expenseItem?: string;
  expenseAmountClp?: number;
  receiptFileName?: string;
}

export interface ResolveMaintenanceInput {
  itemDetail: string;
  amountClp: number;
  receiptFileName: string;
}

export interface NewCommonExpenseInput {
  periodLabel: string;
  amountClp: number;
  dueDate: string;
  billFileName: string;
  billDataUrl?: string;
}

export interface SubmitCommonExpenseReceiptInput {
  method: string;
  referenceCode: string;
  fileName: string;
  fileDataUrl?: string;
}

export interface SimulateMonthResult {
  newDate: string;
  autoIpcCount: number;
  newOverdueCount: number;
}

export function useSaforentStore() {
  const [state, setState] = useState<SaforentState>(() => loadInitialState());
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors in restricted sandboxes
    }
  }, [state]);

  // Carga directa desde la tabla interna integrada de indicadores UF / IPC de Chile (sin llamadas externas)
  useEffect(() => {
    const snapshot = getLocalChileEconomicIndicators();
    setState((prev) => {
      const refDate = prev.simulatedDate || DEFAULT_SIMULATED_DATE;
      const withIndicators: SaforentState = {
        ...prev,
        ufValueClp: snapshot.ufValueClp,
        ufUpdatedDate: snapshot.ufDate,
        indicatorSource: snapshot.source,
        ipcMonthlyHistory: snapshot.ipcMonthlyHistory,
      };
      return applyAutomaticIpcReajustes(withIndicators, refDate).nextState;
    });
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const external = JSON.parse(event.newValue) as SaforentState;
        if (!external || !Array.isArray(external.properties)) return;
        setState((prev) => ({
          ...normalizeState(external),
          session: prev.session,
        }));
      } catch {
        // Ignore malformed storage payload
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const loginAs = useCallback((role: UserRole, customEmail?: string) => {
    setState((prev) => {
      const tenantProp =
        prev.properties.find(
          (p) => p.id === DEMO_TENANT_PROPERTY_ID && p.status !== 'Disponible'
        ) ??
        prev.properties.find((p) => p.status !== 'Disponible') ??
        prev.properties[0];

      if (role === 'owner') {
        return {
          ...prev,
          session: {
            role: 'owner',
            name: 'Rodrigo Valdivia',
            email: customEmail?.trim() || 'rodrigo.valdivia@saforent.cl',
          },
        };
      }
      return {
        ...prev,
        session: {
          role: 'tenant',
          name: tenantProp?.tenantName || 'Camila Rojas',
          email: customEmail?.trim() || tenantProp?.tenantEmail || 'camila.rojas@correo.cl',
          linkedPropertyId: tenantProp?.id,
        },
      };
    });
  }, []);

  const switchDemoTenant = useCallback((propertyId: string) => {
    setState((prev) => {
      const targetProp = prev.properties.find(
        (p) => p.id === propertyId && p.status !== 'Disponible'
      );
      if (!targetProp || !prev.session || prev.session.role !== 'tenant') {
        return prev;
      }
      return {
        ...prev,
        session: {
          ...prev.session,
          name: targetProp.tenantName,
          email: targetProp.tenantEmail || prev.session.email,
          linkedPropertyId: targetProp.id,
        },
      };
    });
  }, []);

  const logout = useCallback(() => {
    setState((prev) => ({
      ...prev,
      session: null,
    }));
  }, []);

  const resetDemo = useCallback(() => {
    setState((prev) => {
      const baseReset: SaforentState = {
        ...INITIAL_DEMO_STATE,
        ufValueClp: prev.ufValueClp,
        ufUpdatedDate: prev.ufUpdatedDate ?? INITIAL_DEMO_STATE.ufUpdatedDate,
        indicatorSource: prev.indicatorSource ?? INITIAL_DEMO_STATE.indicatorSource,
        ipcMonthlyHistory: prev.ipcMonthlyHistory ?? INITIAL_DEMO_STATE.ipcMonthlyHistory,
        session: prev.session
          ? prev.session.role === 'owner'
            ? {
                role: 'owner',
                name: 'Rodrigo Valdivia',
                email: 'rodrigo.valdivia@saforent.cl',
              }
            : {
                role: 'tenant',
                name: 'Camila Rojas',
                email: 'camila.rojas@correo.cl',
                linkedPropertyId: DEMO_TENANT_PROPERTY_ID,
              }
          : null,
      };
      return applyAutomaticIpcReajustes(
        baseReset,
        baseReset.simulatedDate || DEFAULT_SIMULATED_DATE
      ).nextState;
    });
  }, []);

  const addProperty = useCallback((input: NewPropertyInput) => {
    const id = `prop-${Date.now()}`;
    const refDate = stateRef.current.simulatedDate || DEFAULT_SIMULATED_DATE;
    const nextPaymentDate = addMonthsIsoDate(refDate, 1, input.paymentDay);
    const contractStart = refDate;
    const contractEnd = addMonthsIsoDate(refDate, 12);
    const ipcMonths = getMonthsForIpcClause(input.ipcClause) || 12;
    const nextIpcDate = addMonthsIsoDate(refDate, ipcMonths, 1);

    const newProperty: Property = {
      id,
      address: input.address.trim(),
      commune: input.commune.trim(),
      rolSii: input.rolSii.trim(),
      cbrsFoja: input.cbrsFoja.trim(),
      cbrsNumero: input.cbrsNumero.trim(),
      cbrsAnio: input.cbrsAnio?.trim() || refDate.slice(0, 4),
      cbrsConservador: input.cbrsConservador.trim() || 'CBR Santiago',
      ownerName: 'Rodrigo Valdivia',
      tenantName: input.tenantName?.trim() || 'Sin arrendatario asignado',
      tenantEmail: input.tenantEmail?.trim() || '',
      tenantPhone: input.tenantPhone?.trim() || '',
      currency: input.currency,
      baseRentAmount: input.rentAmount,
      rentAmount: input.rentAmount,
      paymentDay: input.paymentDay,
      nextPaymentDate,
      paymentStatus: 'pendiente',
      status: 'Disponible',
      ipcClause: input.ipcClause,
      nextIpcDate,
      pendingIpcPercent: null,
      contractStart,
      contractEnd,
      guaranteeMonths: 1,
      guaranteeCurrency: input.guaranteeCurrency ?? input.currency,
      guaranteeAmount:
        input.guaranteeAmount !== undefined ? input.guaranteeAmount : input.rentAmount,
      lateFeeCurrency: input.lateFeeCurrency ?? 'CLP',
      lateFeeDailyAmount:
        input.lateFeeDailyAmount !== undefined ? input.lateFeeDailyAmount : 4000,
      paysCommonExpenses: Boolean(input.paysCommonExpenses),
      commonExpenseReferenceClp: input.paysCommonExpenses
        ? Math.max(0, Math.round(input.commonExpenseReferenceClp ?? 0))
        : 0,
      contractNotes: input.contractNotes.trim() || 'Propiedad disponible para arriendo en Chile.',
    };

    setState((prev) => ({
      ...prev,
      properties: [newProperty, ...prev.properties],
    }));
  }, []);

  const updatePropertyStatus = useCallback((propertyId: string, status: PropertyStatus) => {
    setState((prev) => ({
      ...prev,
      properties: prev.properties.map((p) => (p.id === propertyId ? { ...p, status } : p)),
    }));
  }, []);

  const updatePropertyLegalData = useCallback(
    (propertyId: string, input: UpdateLegalDataInput) => {
      setState((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                rolSii: input.rolSii.trim(),
                cbrsFoja: input.cbrsFoja.trim(),
                cbrsNumero: input.cbrsNumero.trim(),
                cbrsAnio: input.cbrsAnio.trim(),
                cbrsConservador: input.cbrsConservador.trim() || 'CBR Santiago',
              }
            : p
        ),
      }));
    },
    []
  );

  const updatePropertyIpcClause = useCallback((propertyId: string, ipcClause: IpcFrequency) => {
    setState((prev) => {
      const refDate = prev.simulatedDate || DEFAULT_SIMULATED_DATE;
      const months = getMonthsForIpcClause(ipcClause) || 12;
      const nextIpcDate = addMonthsIsoDate(refDate, months, 1);
      return {
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId ? { ...p, ipcClause, nextIpcDate } : p
        ),
      };
    });
  }, []);

  const registerSignedContract = useCallback(
    (propertyId: string, input: RegisterSignedContractInput) => {
      const refDate = stateRef.current.simulatedDate || DEFAULT_SIMULATED_DATE;
      const nowIso = new Date().toISOString();
      const contractStart = refDate;
      const contractEnd = addMonthsIsoDate(refDate, 12);
      const nextPaymentDate = addMonthsIsoDate(refDate, 1, input.paymentDay);
      const ipcMonths = getMonthsForIpcClause(input.ipcClause) || 12;
      const nextIpcDate = addMonthsIsoDate(refDate, ipcMonths, 1);

      setState((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                tenantName: input.tenantName.trim(),
                tenantEmail: input.tenantEmail.trim(),
                tenantPhone: input.tenantPhone.trim(),
                currency: input.currency,
                baseRentAmount: input.rentAmount,
                rentAmount: input.rentAmount,
                paymentDay: input.paymentDay,
                nextPaymentDate,
                paymentStatus: 'pendiente',
                ipcClause: input.ipcClause,
                nextIpcDate,
                pendingIpcPercent: null,
                lastIpcAppliedDate: undefined,
                lastIpcAppliedPercent: undefined,
                contractStart,
                contractEnd,
                guaranteeCurrency: input.guaranteeCurrency,
                guaranteeAmount: input.guaranteeAmount,
                lateFeeCurrency: input.lateFeeCurrency,
                lateFeeDailyAmount: input.lateFeeDailyAmount,
                paysCommonExpenses:
                  input.paysCommonExpenses !== undefined
                    ? input.paysCommonExpenses
                    : p.paysCommonExpenses,
                commonExpenseReferenceClp:
                  input.paysCommonExpenses
                    ? Math.max(
                        0,
                        Math.round(
                          input.commonExpenseReferenceClp ?? p.commonExpenseReferenceClp ?? 0
                        )
                      )
                    : 0,
                signedContractFileName:
                  input.signedContractFileName.trim() || 'contrato_firmado_notario.pdf',
                signedContractDataUrl: input.signedContractDataUrl,
                signedContractUploadedAt: nowIso,
                contractNotes:
                  input.contractNotes?.trim() ||
                  p.contractNotes ||
                  'Contrato firmado ante notario registrado en plataforma.',
                status: 'Activo',
              }
            : p
        ),
      }));
    },
    []
  );

  const updatePropertyLateFee = useCallback(
    (propertyId: string, lateFeeCurrency: CurrencyType, lateFeeDailyAmount: number) => {
      setState((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                lateFeeCurrency,
                lateFeeDailyAmount,
              }
            : p
        ),
      }));
    },
    []
  );

  const updatePropertyGuarantee = useCallback(
    (propertyId: string, guaranteeCurrency: CurrencyType, guaranteeAmount: number) => {
      setState((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                guaranteeCurrency,
                guaranteeAmount,
              }
            : p
        ),
      }));
    },
    []
  );

  const simulateNextMonth = useCallback((): SimulateMonthResult => {
    const prev = stateRef.current;
    const currentRef = prev.simulatedDate || DEFAULT_SIMULATED_DATE;
    const newDate = addMonthsIsoDate(currentRef, 1);

    // 1. Reajuste automático por IPC cuando se cumple la frecuencia pactada
    const { nextState: afterIpcState, autoIpcCount } = applyAutomaticIpcReajustes(prev, newDate);

    let newOverdueCount = 0;
    let nextAlerts = [...afterIpcState.alerts];

    const nextProperties = afterIpcState.properties.map((prop) => {
      const baseRent = prop.baseRentAmount ?? prop.rentAmount;
      if (prop.status === 'Disponible') {
        return { ...prop, baseRentAmount: baseRent };
      }

      const updated: Property = { ...prop, baseRentAmount: baseRent };

      // 2. Avance de ciclo mensual de pagos y detección automática de morosidad
      if (updated.nextPaymentDate && updated.nextPaymentDate <= newDate) {
        if (updated.paymentStatus === 'al_dia') {
          return {
            ...updated,
            paymentStatus: 'pendiente' as const,
            nextPaymentDate: addMonthsIsoDate(updated.nextPaymentDate, 1, updated.paymentDay),
          };
        }
        if (updated.paymentStatus === 'pendiente' || updated.paymentStatus === 'atrasado') {
          if (updated.status !== 'En Mantención') {
            updated.status = 'Moroso';
          }
          updated.paymentStatus = 'atrasado';

          const alreadyHasMorosidad = nextAlerts.some(
            (a) => a.propertyId === updated.id && a.type === 'morosidad'
          );
          if (!alreadyHasMorosidad) {
            const rentLabel =
              updated.currency === 'CLP'
                ? formatClp(updated.rentAmount)
                : formatUf(updated.rentAmount);
            newOverdueCount += 1;
            nextAlerts.unshift({
              id: `alert-moroso-auto-${updated.id}-${newDate}`,
              propertyId: updated.id,
              type: 'morosidad',
              title: `Pago atrasado · ${updated.address}`,
              description: `${updated.tenantName} registra vencimiento impago el ${formatSpanishDate(updated.nextPaymentDate)} (Monto vigente: ${rentLabel}).`,
              createdAt: `${newDate}T09:05:00`,
              severity: 'alta',
            });
          }
        }
      }

      return updated;
    });

    const nextCommonExpenses = (afterIpcState.commonExpenses ?? []).map((exp) => {
      if (exp.status === 'pendiente' && exp.dueDate && exp.dueDate <= newDate) {
        const prop = nextProperties.find((p) => p.id === exp.propertyId);
        const alreadyHasAlert = nextAlerts.some(
          (a) => a.type === 'gasto_comun' && a.relatedRecordId === exp.id
        );
        if (!alreadyHasAlert && prop) {
          newOverdueCount += 1;
          nextAlerts.unshift({
            id: `alert-gc-atraso-${exp.id}-${newDate}`,
            propertyId: exp.propertyId,
            type: 'gasto_comun',
            title: `Gasto Común atrasado (${exp.periodLabel}) · ${prop.commune}`,
            description: `${prop.tenantName} mantiene impago el gasto común por ${formatClp(exp.amountClp)} (vencimiento ${formatSpanishDate(exp.dueDate)}).`,
            createdAt: `${newDate}T09:10:00`,
            severity: 'alta',
            relatedRecordId: exp.id,
          });
        }
        return { ...exp, status: 'atrasado' as const };
      }
      return exp;
    });

    setState({
      ...afterIpcState,
      simulatedDate: newDate,
      properties: nextProperties,
      alerts: nextAlerts,
      commonExpenses: nextCommonExpenses,
    });

    return { newDate, autoIpcCount, newOverdueCount };
  }, []);

  const resolveMorosidadAlert = useCallback((propertyId: string, alertId: string) => {
    const nowIso = new Date().toISOString();
    setState((prev) => {
      const refDate = prev.simulatedDate || DEFAULT_SIMULATED_DATE;
      const targetProp = prev.properties.find((p) => p.id === propertyId);
      let nextReceipts = prev.receipts.map((r) =>
        r.propertyId === propertyId && r.status === 'en_revision'
          ? { ...r, status: 'aprobado' as const }
          : r
      );

      if (targetProp) {
        const dueMonthIso = targetProp.nextPaymentDate || refDate;
        const parsed = new Date(`${dueMonthIso}T12:00:00`);
        const spanishMonths = [
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
        const periodLabel = Number.isNaN(parsed.getTime())
          ? 'Período regularizado'
          : `${spanishMonths[parsed.getMonth()]} ${parsed.getFullYear()}`;
        const hasReceiptForPeriod = nextReceipts.some(
          (r) =>
            r.propertyId === propertyId &&
            r.status === 'aprobado' &&
            r.periodLabel.toLowerCase() === periodLabel.toLowerCase()
        );
        if (!hasReceiptForPeriod) {
          const amountClp = toClp(targetProp.rentAmount, targetProp.currency, prev.ufValueClp);
          nextReceipts = [
            {
              id: `rec-reg-${Date.now()}`,
              propertyId,
              periodLabel,
              amount: targetProp.rentAmount,
              currency: targetProp.currency,
              amountClpEquivalent: amountClp,
              method: 'Regularización confirmada por Propietario',
              referenceCode: `REG-${Math.floor(100000 + Math.random() * 900000)}`,
              fileName: `comprobante_regularizado_${dueMonthIso.slice(0, 7)}.pdf`,
              submittedAt: `${refDate}T12:00:00`,
              status: 'aprobado',
            },
            ...nextReceipts,
          ];
        }
      }

      return {
        ...prev,
        properties: prev.properties.map((p) => {
          if (p.id !== propertyId) return p;
          const nextDue =
            p.nextPaymentDate <= refDate
              ? addMonthsIsoDate(refDate, 1, p.paymentDay)
              : p.nextPaymentDate;
          return {
            ...p,
            status: 'Activo',
            paymentStatus: 'al_dia',
            nextPaymentDate: nextDue,
          };
        }),
        receipts: nextReceipts,
        alerts: prev.alerts.filter((a) => a.id !== alertId),
      };
    });
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setState((prev) => ({
      ...prev,
      alerts: prev.alerts.filter((a) => a.id !== alertId),
    }));
  }, []);

  const submitPaymentReceipt = useCallback((propertyId: string, input: NewReceiptInput) => {
    const receiptId = `rec-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setState((prev) => {
      const prop = prev.properties.find((p) => p.id === propertyId);
      if (!prop) return prev;

      const amountClpEquivalent = toClp(input.amount, input.currency, prev.ufValueClp);
      const receipt: PaymentReceipt = {
        id: receiptId,
        propertyId,
        periodLabel: input.periodLabel,
        amount: input.amount,
        currency: input.currency,
        amountClpEquivalent,
        method: input.method,
        referenceCode:
          input.referenceCode.trim() || `TRF-${Math.floor(100000 + Math.random() * 900000)}`,
        fileName: input.fileName || 'comprobante_transferencia.pdf',
        fileDataUrl: input.fileDataUrl,
        submittedAt: nowIso,
        status: 'en_revision',
      };

      const formattedAmount =
        input.currency === 'CLP' ? formatClp(input.amount) : formatUf(input.amount);

      const newAlert: UrgentAlert = {
        id: `alert-rec-${Date.now()}`,
        propertyId,
        type: 'comprobante',
        title: `Comprobante de pago por validar · ${prop.commune}`,
        description: `${prop.tenantName} subió comprobante de ${formattedAmount} (${input.periodLabel} · Ref. ${receipt.referenceCode}).`,
        createdAt: nowIso,
        severity: 'media',
        relatedRecordId: receiptId,
      };

      const ownerNotif: PendingOwnerNotification = {
        id: `notif-${receiptId}`,
        title: `Nuevo comprobante de pago · ${prop.commune}`,
        body: `${prop.tenantName} subió un comprobante por ${formattedAmount} (${input.periodLabel}).`,
        tag: `saforent-receipt-${receiptId}`,
        createdAt: nowIso,
      };

      triggerOwnerBrowserNotification(ownerNotif);

      return {
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId ? { ...p, paymentStatus: 'en_revision' } : p
        ),
        receipts: [receipt, ...prev.receipts],
        alerts: [newAlert, ...prev.alerts],
        pendingOwnerNotifications: [...(prev.pendingOwnerNotifications ?? []), ownerNotif],
      };
    });
  }, []);

  const simulateOnlinePayment = useCallback(
    (propertyId: string, input: SimulateOnlinePaymentInput): SimulateOnlinePaymentResult => {
      const now = Date.now();
      const receiptId = `rec-onl-${now}`;
      const referenceCode = `ONL-${Math.floor(100000 + Math.random() * 900000)}`;
      const slugPeriod = input.periodLabel
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
      const fileName = `recibo_pago_en_linea_${slugPeriod || 'mes'}.pdf`;
      const nowIso = new Date().toISOString();
      const rentPlusFineClp = Math.max(
        0,
        Math.round(input.rentAmountClp + Math.max(0, input.lateFeeClp))
      );
      const gcAmountClp = input.commonExpenseId
        ? Math.max(0, Math.round(input.commonExpenseAmountClp ?? 0))
        : 0;
      const totalPaidClp = rentPlusFineClp + gcAmountClp;

      setState((prev) => {
        const prop = prev.properties.find((p) => p.id === propertyId);
        if (!prop) return prev;

        const refDate = prev.simulatedDate || DEFAULT_SIMULATED_DATE;
        const paidInPropCurrency =
          prop.currency === 'UF' ? toUf(rentPlusFineClp, 'CLP', prev.ufValueClp) : rentPlusFineClp;

        const receipt: PaymentReceipt = {
          id: receiptId,
          propertyId,
          periodLabel: input.periodLabel,
          amount: paidInPropCurrency,
          currency: prop.currency,
          amountClpEquivalent: rentPlusFineClp,
          lateFeeClp: input.lateFeeClp > 0 ? Math.round(input.lateFeeClp) : undefined,
          method: input.channelLabel,
          referenceCode,
          fileName,
          submittedAt: nowIso,
          status: 'aprobado',
        };

        const nextCommonExpenses = (prev.commonExpenses ?? []).map((exp) => {
          if (input.commonExpenseId && exp.id === input.commonExpenseId) {
            return {
              ...exp,
              status: 'pagado' as const,
              receiptFileName: `recibo_gc_en_linea_${slugPeriod || 'mes'}.pdf`,
              receiptReferenceCode: referenceCode,
              receiptMethod: input.channelLabel,
              receiptSubmittedAt: nowIso,
              paidAt: nowIso,
            };
          }
          return exp;
        });

        const nextAlerts = prev.alerts.filter((a) => {
          if (a.propertyId !== propertyId) return true;
          if (a.type === 'morosidad' || a.type === 'comprobante') return false;
          if (
            input.commonExpenseId &&
            a.type === 'gasto_comun' &&
            a.relatedRecordId === input.commonExpenseId
          ) {
            return false;
          }
          return true;
        });

        const ownerNotif: PendingOwnerNotification = {
          id: `notif-onl-${now}`,
          title: `Pago en línea recibido · ${prop.commune}`,
          body: `${prop.tenantName} pagó ${formatClp(totalPaidClp)} vía ${input.channelLabel} (${input.periodLabel} · Ref. ${referenceCode}).`,
          tag: `saforent-online-${receiptId}`,
          createdAt: nowIso,
        };
        triggerOwnerBrowserNotification(ownerNotif);

        return {
          ...prev,
          properties: prev.properties.map((p) => {
            if (p.id !== propertyId) return p;
            const nextDue =
              p.nextPaymentDate <= refDate
                ? addMonthsIsoDate(refDate, 1, p.paymentDay)
                : p.nextPaymentDate;
            return {
              ...p,
              paymentStatus: 'al_dia',
              status: p.status === 'Moroso' ? 'Activo' : p.status,
              nextPaymentDate: nextDue,
            };
          }),
          receipts: [receipt, ...prev.receipts],
          commonExpenses: nextCommonExpenses,
          alerts: nextAlerts,
          pendingOwnerNotifications: [...(prev.pendingOwnerNotifications ?? []), ownerNotif],
        };
      });

      return {
        receiptId,
        referenceCode,
        fileName,
        totalPaidClp,
        submittedAt: nowIso,
      };
    },
    []
  );

  const approvePaymentReceipt = useCallback(
    (propertyId: string, receiptId?: string, alertId?: string) => {
      setState((prev) => {
        const refDate = prev.simulatedDate || DEFAULT_SIMULATED_DATE;
        return {
          ...prev,
          properties: prev.properties.map((p) => {
            if (p.id !== propertyId) return p;
            const nextDue =
              p.nextPaymentDate <= refDate
                ? addMonthsIsoDate(refDate, 1, p.paymentDay)
                : p.nextPaymentDate;
            return {
              ...p,
              paymentStatus: 'al_dia',
              status: p.status === 'Moroso' ? 'Activo' : p.status,
              nextPaymentDate: nextDue,
            };
          }),
          receipts: prev.receipts.map((r) =>
            receiptId
              ? r.id === receiptId
                ? { ...r, status: 'aprobado' }
                : r
              : r.propertyId === propertyId && r.status === 'en_revision'
                ? { ...r, status: 'aprobado' }
                : r
          ),
          alerts: prev.alerts.filter((a) =>
            alertId
              ? a.id !== alertId
              : !(a.propertyId === propertyId && (a.type === 'comprobante' || a.type === 'morosidad'))
          ),
        };
      });
    },
    []
  );

  const reportMaintenance = useCallback((propertyId: string, input: NewMaintenanceInput) => {
    const maintId = `maint-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const todayIso = (stateRef.current.simulatedDate || nowIso.slice(0, 10)).slice(0, 10);

    setState((prev) => {
      const prop = prev.properties.find((p) => p.id === propertyId);
      if (!prop) return prev;

      if (input.responsibility === 'arrendatario') {
        const itemLabel = (input.expenseItem || input.description).trim();
        const amountClp = Math.max(0, Math.round(input.expenseAmountClp || 0));
        const receiptFile = input.receiptFileName?.trim() || 'boleta_arreglo_menor.pdf';
        const reportDescription = input.description.trim()
          ? `${itemLabel} — ${input.description.trim()}`
          : itemLabel;

        const report: MaintenanceReport = {
          id: maintId,
          propertyId,
          category: input.category,
          urgency: 'Media',
          responsibility: 'arrendatario',
          description: reportDescription,
          reportedAt: nowIso,
          status: 'resuelta',
          resolvedAt: nowIso,
        };

        const expenseRecord: MaintenanceExpenseRecord = {
          id: `exp-${Date.now()}`,
          propertyId,
          maintenanceReportId: maintId,
          date: todayIso,
          itemDetail: itemLabel,
          paidBy: 'Arrendatario',
          amountClp,
          receiptFileName: receiptFile,
        };

        const infoAlert: UrgentAlert = {
          id: `alert-maint-${Date.now()}`,
          propertyId,
          type: 'averia',
          title: `Arreglo menor asumido por arrendatario · ${prop.commune}`,
          description: `${prop.tenantName} registró y resolvió "${itemLabel}" (${formatClp(amountClp)} · Comprobante: ${receiptFile}).`,
          createdAt: nowIso,
          severity: 'media',
          relatedRecordId: maintId,
          resolvedByTenant: true,
        };

        const ownerNotif: PendingOwnerNotification = {
          id: `notif-${maintId}`,
          title: `Arreglo menor informado · ${prop.commune}`,
          body: `${prop.tenantName} asumió y resolvió "${itemLabel}" (${formatClp(amountClp)}).`,
          tag: `saforent-averia-${maintId}`,
          createdAt: nowIso,
        };
        triggerOwnerBrowserNotification(ownerNotif);

        return {
          ...prev,
          maintenanceReports: [report, ...prev.maintenanceReports],
          maintenanceExpenses: [expenseRecord, ...(prev.maintenanceExpenses ?? [])],
          alerts: [infoAlert, ...prev.alerts],
          pendingOwnerNotifications: [...(prev.pendingOwnerNotifications ?? []), ownerNotif],
        };
      }

      const report: MaintenanceReport = {
        id: maintId,
        propertyId,
        category: input.category,
        urgency: input.urgency,
        responsibility: 'propietario',
        description: input.description.trim(),
        photoName: input.photoName,
        reportedAt: nowIso,
        status: 'pendiente',
      };

      const newAlert: UrgentAlert = {
        id: `alert-maint-${Date.now()}`,
        propertyId,
        type: 'averia',
        title: `Avería reportada: ${input.category} · ${prop.commune}`,
        description: `${prop.tenantName} reportó (${input.urgency}): ${input.description.trim()}`,
        createdAt: nowIso,
        severity: input.urgency === 'Alta' ? 'alta' : 'media',
        relatedRecordId: maintId,
      };

      let nextNotifications = prev.pendingOwnerNotifications ?? [];
      if (input.urgency === 'Alta') {
        const ownerNotif: PendingOwnerNotification = {
          id: `notif-${maintId}`,
          title: `Avería crítica reportada · ${prop.commune}`,
          body: `${prop.tenantName} reportó falla crítica en ${input.category}: ${input.description.trim()}`,
          tag: `saforent-averia-${maintId}`,
          createdAt: nowIso,
        };
        triggerOwnerBrowserNotification(ownerNotif);
        nextNotifications = [...nextNotifications, ownerNotif];
      }

      return {
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId ? { ...p, status: 'En Mantención' } : p
        ),
        maintenanceReports: [report, ...prev.maintenanceReports],
        alerts: [newAlert, ...prev.alerts],
        pendingOwnerNotifications: nextNotifications,
      };
    });
  }, []);

  const resolveMaintenance = useCallback(
    (
      propertyId: string,
      reportId?: string,
      alertId?: string,
      resolution?: ResolveMaintenanceInput
    ) => {
      const nowIso = new Date().toISOString();
      const todayIso = (stateRef.current.simulatedDate || nowIso.slice(0, 10)).slice(0, 10);

      setState((prev) => {
        const matchedReport = prev.maintenanceReports.find((m) =>
          reportId
            ? m.id === reportId
            : m.propertyId === propertyId && m.status !== 'resuelta'
        );

        const nextExpenses = [...(prev.maintenanceExpenses ?? [])];
        if (resolution) {
          nextExpenses.unshift({
            id: `exp-${Date.now()}`,
            propertyId,
            maintenanceReportId: matchedReport?.id ?? reportId,
            date: todayIso,
            itemDetail:
              resolution.itemDetail.trim() ||
              matchedReport?.description ||
              'Reparación de mantención',
            paidBy: 'Propietario',
            amountClp: Math.max(0, Math.round(resolution.amountClp)),
            receiptFileName: resolution.receiptFileName.trim() || 'boleta_reparacion.pdf',
          });
        }

        return {
          ...prev,
          properties: prev.properties.map((p) =>
            p.id === propertyId && p.status === 'En Mantención' ? { ...p, status: 'Activo' } : p
          ),
          maintenanceReports: prev.maintenanceReports.map((m) =>
            reportId
              ? m.id === reportId
                ? { ...m, status: 'resuelta', resolvedAt: nowIso }
                : m
              : m.propertyId === propertyId && m.status !== 'resuelta'
                ? { ...m, status: 'resuelta', resolvedAt: nowIso }
                : m
          ),
          maintenanceExpenses: nextExpenses,
          alerts: prev.alerts.filter((a) =>
            alertId ? a.id !== alertId : !(a.propertyId === propertyId && a.type === 'averia')
          ),
        };
      });
    },
    []
  );

  const updatePropertyCommonExpensesConfig = useCallback(
    (propertyId: string, paysCommonExpenses: boolean, commonExpenseReferenceClp: number) => {
      setState((prev) => ({
        ...prev,
        properties: prev.properties.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                paysCommonExpenses,
                commonExpenseReferenceClp: paysCommonExpenses
                  ? Math.max(0, Math.round(commonExpenseReferenceClp))
                  : 0,
              }
            : p
        ),
      }));
    },
    []
  );

  const attachMonthlyCommonExpense = useCallback(
    (propertyId: string, input: NewCommonExpenseInput) => {
      const id = `gc-${Date.now()}`;
      const nowIso = new Date().toISOString();

      setState((prev) => {
        const prop = prev.properties.find((p) => p.id === propertyId);
        if (!prop) return prev;
        const refDate = prev.simulatedDate || DEFAULT_SIMULATED_DATE;
        const isOverdue = Boolean(input.dueDate && input.dueDate < refDate);

        const newRecord: CommonExpenseRecord = {
          id,
          propertyId,
          periodLabel: input.periodLabel.trim(),
          amountClp: Math.max(0, Math.round(input.amountClp)),
          dueDate: input.dueDate,
          billFileName: input.billFileName.trim() || 'colilla_gasto_comun.pdf',
          billDataUrl: input.billDataUrl,
          createdAt: nowIso,
          status: isOverdue ? 'atrasado' : 'pendiente',
        };

        const extraAlerts: UrgentAlert[] = [];
        if (isOverdue) {
          extraAlerts.push({
            id: `alert-gc-atraso-${id}`,
            propertyId,
            type: 'gasto_comun',
            title: `Gasto Común atrasado (${newRecord.periodLabel}) · ${prop.commune}`,
            description: `${prop.tenantName} tiene gasto común vencido el ${formatSpanishDate(newRecord.dueDate)} por ${formatClp(newRecord.amountClp)}.`,
            createdAt: nowIso,
            severity: 'alta',
            relatedRecordId: id,
          });
        }

        return {
          ...prev,
          properties: prev.properties.map((p) =>
            p.id === propertyId ? { ...p, paysCommonExpenses: true } : p
          ),
          commonExpenses: [newRecord, ...(prev.commonExpenses ?? [])],
          alerts: [...extraAlerts, ...prev.alerts],
        };
      });
    },
    []
  );

  const submitCommonExpenseReceipt = useCallback(
    (propertyId: string, expenseId: string, input: SubmitCommonExpenseReceiptInput) => {
      const nowIso = new Date().toISOString();

      setState((prev) => {
        const prop = prev.properties.find((p) => p.id === propertyId);
        const targetExpense = (prev.commonExpenses ?? []).find((e) => e.id === expenseId);
        if (!prop || !targetExpense) return prev;

        const refCode =
          input.referenceCode.trim() || `TRF-${Math.floor(100000 + Math.random() * 900000)}`;
        const fileName = input.fileName.trim() || 'comprobante_gasto_comun.pdf';

        const newAlert: UrgentAlert = {
          id: `alert-gc-rec-${Date.now()}`,
          propertyId,
          type: 'gasto_comun',
          title: `Comprobante de Gasto Común por validar (${targetExpense.periodLabel}) · ${prop.commune}`,
          description: `${prop.tenantName} subió comprobante de ${formatClp(targetExpense.amountClp)} (Ref. ${refCode} · ${fileName}).`,
          createdAt: nowIso,
          severity: 'media',
          relatedRecordId: expenseId,
        };

        const ownerNotif: PendingOwnerNotification = {
          id: `notif-gc-${expenseId}-${Date.now()}`,
          title: `Comprobante de Gasto Común · ${prop.commune}`,
          body: `${prop.tenantName} pagó ${formatClp(targetExpense.amountClp)} (${targetExpense.periodLabel}).`,
          tag: `saforent-gc-${expenseId}`,
          createdAt: nowIso,
        };
        triggerOwnerBrowserNotification(ownerNotif);

        return {
          ...prev,
          commonExpenses: (prev.commonExpenses ?? []).map((e) =>
            e.id === expenseId
              ? {
                  ...e,
                  status: 'en_revision',
                  receiptFileName: fileName,
                  receiptDataUrl: input.fileDataUrl,
                  receiptReferenceCode: refCode,
                  receiptMethod: input.method,
                  receiptSubmittedAt: nowIso,
                }
              : e
          ),
          alerts: [
            newAlert,
            ...prev.alerts.filter(
              (a) => !(a.type === 'gasto_comun' && a.relatedRecordId === expenseId)
            ),
          ],
          pendingOwnerNotifications: [...(prev.pendingOwnerNotifications ?? []), ownerNotif],
        };
      });
    },
    []
  );

  const approveCommonExpenseReceipt = useCallback(
    (propertyId: string, expenseId?: string, alertId?: string) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        commonExpenses: (prev.commonExpenses ?? []).map((e) => {
          if (expenseId ? e.id === expenseId : e.propertyId === propertyId && e.status !== 'pagado') {
            return { ...e, status: 'pagado', paidAt: nowIso };
          }
          return e;
        }),
        alerts: prev.alerts.filter((a) =>
          alertId
            ? a.id !== alertId
            : !(a.type === 'gasto_comun' && (expenseId ? a.relatedRecordId === expenseId : a.propertyId === propertyId))
        ),
      }));
    },
    []
  );

  const clearPendingOwnerNotifications = useCallback(() => {
    setState((prev) => {
      if (!prev.pendingOwnerNotifications || prev.pendingOwnerNotifications.length === 0) {
        return prev;
      }
      return {
        ...prev,
        pendingOwnerNotifications: [],
      };
    });
  }, []);

  return {
    state,
    loginAs,
    switchDemoTenant,
    logout,
    resetDemo,
    addProperty,
    updatePropertyStatus,
    updatePropertyLegalData,
    updatePropertyIpcClause,
    updatePropertyLateFee,
    updatePropertyGuarantee,
    updatePropertyCommonExpensesConfig,
    registerSignedContract,
    simulateNextMonth,
    resolveMorosidadAlert,
    dismissAlert,
    submitPaymentReceipt,
    simulateOnlinePayment,
    approvePaymentReceipt,
    reportMaintenance,
    resolveMaintenance,
    attachMonthlyCommonExpense,
    submitCommonExpenseReceipt,
    approveCommonExpenseReceipt,
    clearPendingOwnerNotifications,
  };
}
