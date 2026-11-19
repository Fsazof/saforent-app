import { SaforentState } from '../types/saforent';
import {
  calculateLateFeeSummary,
  DEFAULT_SIMULATED_DATE,
  toClp,
} from './formatters';

export interface PropertyDiagnosticItem {
  address: string;
  commune: string;
  status: string;
  paymentStatus: string;
  currentRentClp: number;
  baseRentClp: number;
  daysOverdue: number;
  accumulatedFineClp: number;
  ownerMaintenanceMonthClp: number;
  ownerMaintenanceTotalClp: number;
  pendingUrgentMaintenanceCount: number;
}

export interface PortfolioDiagnosticSnapshot {
  simulatedDate: string;
  ufValueClp: number;
  totalProperties: number;
  occupiedCount: number;
  availableCount: number;
  overdueCount: number;
  maintenanceStatusCount: number;
  occupancyRatePct: number;
  currentMonthProjectedRentClp: number;
  currentMonthCollectedRentClp: number;
  collectionRatePct: number;
  totalAccumulatedFinesClp: number;
  currentMonthOwnerMaintenanceClp: number;
  historicalOwnerMaintenanceClp: number;
  currentMonthNetResultClp: number;
  potentialAvailableRentClp: number;
  pendingUrgentMaintenanceTotal: number;
  properties: PropertyDiagnosticItem[];
}

export interface DiagnosticPoint {
  category: string;
  title: string;
  summary: string;
  action: string;
  severity: 'positivo' | 'alerta' | 'critico';
}

export interface FinancialAiDiagnosisResult {
  headline: string;
  healthStatus: 'Saludable' | 'Atención Requerida' | 'Crítico';
  points: DiagnosticPoint[];
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

function matchesMonthPeriod(
  periodLabel: string | undefined,
  isoDate: string | undefined,
  monthKey: string,
  monthNameFull: string,
  year: number
): boolean {
  if (isoDate && isoDate.slice(0, 7) === monthKey) return true;
  if (periodLabel) {
    const normalized = periodLabel.toLowerCase();
    return normalized.includes(monthNameFull.toLowerCase()) && normalized.includes(String(year));
  }
  return false;
}

export function buildPortfolioSnapshot(state: SaforentState): PortfolioDiagnosticSnapshot {
  const simulatedDate = state.simulatedDate || DEFAULT_SIMULATED_DATE;
  const currentMonthKey = simulatedDate.slice(0, 7);
  const refDateObj = new Date(`${simulatedDate}T12:00:00`);
  const monthIdx = Number.isNaN(refDateObj.getTime()) ? 0 : refDateObj.getMonth();
  const year = Number.isNaN(refDateObj.getTime()) ? 2026 : refDateObj.getFullYear();
  const currentMonthName = SPANISH_MONTHS_FULL[monthIdx] ?? 'Mes';

  const ufValueClp = state.ufValueClp;
  const maintenanceExpenses = state.maintenanceExpenses ?? [];
  const maintenanceReports = state.maintenanceReports ?? [];
  const receipts = state.receipts ?? [];

  let occupiedCount = 0;
  let availableCount = 0;
  let overdueCount = 0;
  let maintenanceStatusCount = 0;
  let currentMonthProjectedRentClp = 0;
  let currentMonthCollectedRentClp = 0;
  let totalAccumulatedFinesClp = 0;
  let currentMonthOwnerMaintenanceClp = 0;
  let historicalOwnerMaintenanceClp = 0;
  let potentialAvailableRentClp = 0;
  let pendingUrgentMaintenanceTotal = 0;

  const properties: PropertyDiagnosticItem[] = state.properties.map((prop) => {
    const currentRentClp = toClp(prop.rentAmount, prop.currency, ufValueClp);
    const baseRentClp = toClp(prop.baseRentAmount ?? prop.rentAmount, prop.currency, ufValueClp);
    const isAvailable = prop.status === 'Disponible';

    if (isAvailable) {
      availableCount += 1;
      potentialAvailableRentClp += currentRentClp;
    } else {
      occupiedCount += 1;
      currentMonthProjectedRentClp += currentRentClp;
    }

    if (prop.status === 'Moroso' || prop.paymentStatus === 'atrasado') {
      overdueCount += 1;
    }
    if (prop.status === 'En Mantención') {
      maintenanceStatusCount += 1;
    }

    const lateSummary = isAvailable
      ? { daysOverdue: 0, accumulatedClp: 0 }
      : calculateLateFeeSummary(prop, ufValueClp, simulatedDate);

    const paidCurrentMonthFineClp = !isAvailable
      ? receipts
          .filter(
            (r) =>
              r.propertyId === prop.id &&
              r.status === 'aprobado' &&
              (r.lateFeeClp ?? 0) > 0 &&
              matchesMonthPeriod(
                r.periodLabel,
                r.submittedAt,
                currentMonthKey,
                currentMonthName,
                year
              )
          )
          .reduce((acc, r) => acc + (r.lateFeeClp ?? 0), 0)
      : 0;

    const effectiveFineClp = Math.max(lateSummary.accumulatedClp, paidCurrentMonthFineClp);
    totalAccumulatedFinesClp += effectiveFineClp;

    if (!isAvailable) {
      if (prop.paymentStatus === 'al_dia') {
        currentMonthCollectedRentClp += currentRentClp;
      } else {
        const collectedMatching = receipts
          .filter(
            (r) =>
              r.propertyId === prop.id &&
              r.status === 'aprobado' &&
              matchesMonthPeriod(
                r.periodLabel,
                r.submittedAt,
                currentMonthKey,
                currentMonthName,
                year
              )
          )
          .reduce((acc, r) => acc + r.amountClpEquivalent, 0);
        currentMonthCollectedRentClp += collectedMatching;
      }
    }

    const propOwnerExpenses = maintenanceExpenses.filter(
      (e) => e.propertyId === prop.id && e.paidBy === 'Propietario'
    );
    const ownerMaintenanceTotalClp = propOwnerExpenses.reduce((acc, e) => acc + e.amountClp, 0);
    const ownerMaintenanceMonthClp = propOwnerExpenses
      .filter((e) => e.date.slice(0, 7) === currentMonthKey)
      .reduce((acc, e) => acc + e.amountClp, 0);

    currentMonthOwnerMaintenanceClp += ownerMaintenanceMonthClp;
    historicalOwnerMaintenanceClp += ownerMaintenanceTotalClp;

    const pendingUrgentMaintenanceCount = maintenanceReports.filter(
      (r) =>
        r.propertyId === prop.id &&
        r.responsibility !== 'arrendatario' &&
        r.status !== 'resuelta'
    ).length;
    pendingUrgentMaintenanceTotal += pendingUrgentMaintenanceCount;

    return {
      address: prop.address,
      commune: prop.commune,
      status: prop.status,
      paymentStatus: isAvailable ? 'vacante' : prop.paymentStatus,
      currentRentClp,
      baseRentClp,
      daysOverdue: lateSummary.daysOverdue,
      accumulatedFineClp: effectiveFineClp,
      ownerMaintenanceMonthClp,
      ownerMaintenanceTotalClp,
      pendingUrgentMaintenanceCount,
    };
  });

  const totalProperties = state.properties.length;
  const occupancyRatePct =
    totalProperties > 0 ? Math.round((occupiedCount / totalProperties) * 100) : 0;
  const collectionRatePct =
    currentMonthProjectedRentClp > 0
      ? Math.round((currentMonthCollectedRentClp / currentMonthProjectedRentClp) * 100)
      : 0;
  const currentMonthNetResultClp =
    currentMonthProjectedRentClp + totalAccumulatedFinesClp - currentMonthOwnerMaintenanceClp;

  return {
    simulatedDate,
    ufValueClp,
    totalProperties,
    occupiedCount,
    availableCount,
    overdueCount,
    maintenanceStatusCount,
    occupancyRatePct,
    currentMonthProjectedRentClp,
    currentMonthCollectedRentClp,
    collectionRatePct,
    totalAccumulatedFinesClp,
    currentMonthOwnerMaintenanceClp,
    historicalOwnerMaintenanceClp,
    currentMonthNetResultClp,
    potentialAvailableRentClp,
    pendingUrgentMaintenanceTotal,
    properties,
  };
}

export function buildPortfolioSnapshotKey(snapshot: PortfolioDiagnosticSnapshot): string {
  return JSON.stringify(snapshot);
}

export async function requestFinancialAiDiagnosis(
  snapshot: PortfolioDiagnosticSnapshot,
  signal?: AbortSignal
): Promise<{ diagnosis: FinancialAiDiagnosisResult; generatedAt: string }> {
  const response = await fetch('/api/finanzas/diagnostico', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot }),
    signal,
  });

  let data: { diagnosis?: FinancialAiDiagnosisResult; generatedAt?: string; error?: string } = {};
  try {
    data = (await response.json()) as typeof data;
  } catch {
    // fallback if server returned non-JSON error
  }

  if (!response.ok || !data.diagnosis) {
    throw new Error(
      data.error ||
        `No fue posible generar el diagnóstico financiero con IA (código ${response.status}).`
    );
  }

  return {
    diagnosis: data.diagnosis,
    generatedAt: data.generatedAt || new Date().toISOString(),
  };
}
