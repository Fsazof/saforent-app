import { SaforentState } from '../types/saforent';
import {
  computeAccumulatedIpcPercent,
  FALLBACK_IPC_HISTORY,
  getMonthsForIpcClause,
} from './economicIndicators';
import {
  calculateIpcAdjustedRent,
  calculateLateFeeSummary,
  DEFAULT_SIMULATED_DATE,
  formatClp,
  formatSpanishDate,
  formatUf,
  toClp,
} from './formatters';

export interface PropertyDiagnosticItem {
  id: string;
  address: string;
  commune: string;
  tenantName: string;
  status: string;
  paymentStatus: string;
  currentRentClp: number;
  baseRentClp: number;
  daysOverdue: number;
  accumulatedFineClp: number;
  totalOverdueDueClp: number;
  ownerMaintenanceMonthClp: number;
  ownerMaintenanceTotalClp: number;
  pendingUrgentMaintenanceCount: number;
  ipcClause: string;
  nextIpcDate: string;
  daysUntilNextIpc: number | null;
  estimatedNextIpcPercent: number;
  estimatedNextIpcIncreaseClp: number;
  ipcAppliedThisMonth: boolean;
  lastIpcAppliedPercent?: number;
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
  activeOverdueFinesClp: number;
  currentMonthOwnerMaintenanceClp: number;
  historicalOwnerMaintenanceClp: number;
  currentMonthNetResultClp: number;
  potentialAvailableRentClp: number;
  pendingUrgentMaintenanceTotal: number;
  pendingValidationReceiptsCount: number;
  pendingValidationAmountClp: number;
  upcomingIpcCount: number;
  recentIpcAppliedCount: number;
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

function diffDaysIso(fromIso: string, toIso: string): number | null {
  if (!fromIso || !toIso) return null;
  const fromDate = new Date(`${fromIso}T12:00:00`);
  const toDate = new Date(`${toIso}T12:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
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
  const ipcHistory =
    state.ipcMonthlyHistory && state.ipcMonthlyHistory.length > 0
      ? state.ipcMonthlyHistory
      : FALLBACK_IPC_HISTORY;

  let occupiedCount = 0;
  let availableCount = 0;
  let overdueCount = 0;
  let maintenanceStatusCount = 0;
  let currentMonthProjectedRentClp = 0;
  let currentMonthCollectedRentClp = 0;
  let totalAccumulatedFinesClp = 0;
  let activeOverdueFinesClp = 0;
  let currentMonthOwnerMaintenanceClp = 0;
  let historicalOwnerMaintenanceClp = 0;
  let potentialAvailableRentClp = 0;
  let pendingUrgentMaintenanceTotal = 0;
  let upcomingIpcCount = 0;
  let recentIpcAppliedCount = 0;

  const pendingReceipts = receipts.filter((r) => r.status === 'en_revision');
  const pendingValidationReceiptsCount = pendingReceipts.length;
  const pendingValidationAmountClp = pendingReceipts.reduce(
    (acc, r) => acc + r.amountClpEquivalent,
    0
  );

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
      ? { daysOverdue: 0, accumulatedClp: 0, totalDueClp: 0 }
      : calculateLateFeeSummary(prop, ufValueClp, simulatedDate);

    activeOverdueFinesClp += lateSummary.accumulatedClp;

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

    const ipcMonths = getMonthsForIpcClause(prop.ipcClause);
    const daysUntilNextIpc =
      !isAvailable && ipcMonths > 0 && prop.nextIpcDate
        ? diffDaysIso(simulatedDate, prop.nextIpcDate)
        : null;

    const estimatedNextIpcPercent =
      !isAvailable && ipcMonths > 0
        ? computeAccumulatedIpcPercent(ipcHistory, ipcMonths)
        : 0;

    const projectedNextRent =
      !isAvailable && ipcMonths > 0
        ? toClp(
            calculateIpcAdjustedRent(prop.rentAmount, prop.currency, estimatedNextIpcPercent),
            prop.currency,
            ufValueClp
          )
        : currentRentClp;
    const estimatedNextIpcIncreaseClp = Math.max(0, projectedNextRent - currentRentClp);

    if (daysUntilNextIpc !== null && daysUntilNextIpc >= 0 && daysUntilNextIpc <= 60) {
      upcomingIpcCount += 1;
    }

    const ipcAppliedThisMonth =
      !isAvailable &&
      Boolean(prop.lastIpcAppliedDate && prop.lastIpcAppliedDate.slice(0, 7) === currentMonthKey);
    if (ipcAppliedThisMonth) {
      recentIpcAppliedCount += 1;
    }

    return {
      id: prop.id,
      address: prop.address,
      commune: prop.commune,
      tenantName: prop.tenantName,
      status: prop.status,
      paymentStatus: isAvailable ? 'vacante' : prop.paymentStatus,
      currentRentClp,
      baseRentClp,
      daysOverdue: lateSummary.daysOverdue,
      accumulatedFineClp: effectiveFineClp,
      totalOverdueDueClp: lateSummary.totalDueClp,
      ownerMaintenanceMonthClp,
      ownerMaintenanceTotalClp,
      pendingUrgentMaintenanceCount,
      ipcClause: prop.ipcClause,
      nextIpcDate: prop.nextIpcDate,
      daysUntilNextIpc,
      estimatedNextIpcPercent,
      estimatedNextIpcIncreaseClp,
      ipcAppliedThisMonth,
      lastIpcAppliedPercent: prop.lastIpcAppliedPercent,
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
    activeOverdueFinesClp,
    currentMonthOwnerMaintenanceClp,
    historicalOwnerMaintenanceClp,
    currentMonthNetResultClp,
    potentialAvailableRentClp,
    pendingUrgentMaintenanceTotal,
    pendingValidationReceiptsCount,
    pendingValidationAmountClp,
    upcomingIpcCount,
    recentIpcAppliedCount,
    properties,
  };
}

export function buildPortfolioSnapshotKey(snapshot: PortfolioDiagnosticSnapshot): string {
  return JSON.stringify(snapshot);
}

function formatShortList(items: string[], max = 2): string {
  if (items.length === 0) return '';
  if (items.length <= max) return items.join(' y ');
  const shown = items.slice(0, max).join(', ');
  const extra = items.length - max;
  return `${shown} y ${extra} más`;
}

export function generateLocalFinancialDiagnosis(
  snapshot: PortfolioDiagnosticSnapshot
): FinancialAiDiagnosisResult {
  const overdueProps = snapshot.properties
    .filter((p) => p.status === 'Moroso' || p.paymentStatus === 'atrasado' || p.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const availableProps = snapshot.properties
    .filter((p) => p.status === 'Disponible')
    .sort((a, b) => b.currentRentClp - a.currentRentClp);

  const upcomingIpcProps = snapshot.properties
    .filter(
      (p) =>
        p.status !== 'Disponible' &&
        p.daysUntilNextIpc !== null &&
        p.daysUntilNextIpc >= 0 &&
        p.daysUntilNextIpc <= 60
    )
    .sort((a, b) => (a.daysUntilNextIpc ?? 999) - (b.daysUntilNextIpc ?? 999));

  const recentIpcProps = snapshot.properties.filter((p) => p.ipcAppliedThisMonth);

  const nextScheduledIpcProp = snapshot.properties
    .filter(
      (p) =>
        p.status !== 'Disponible' &&
        p.daysUntilNextIpc !== null &&
        p.daysUntilNextIpc >= 0
    )
    .sort((a, b) => (a.daysUntilNextIpc ?? 999) - (b.daysUntilNextIpc ?? 999))[0];

  const highestMaintMonthProp = [...snapshot.properties]
    .filter((p) => p.ownerMaintenanceMonthClp > 0)
    .sort((a, b) => b.ownerMaintenanceMonthClp - a.ownerMaintenanceMonthClp)[0];

  const highestMaintHistoricalProp = [...snapshot.properties]
    .filter((p) => p.ownerMaintenanceTotalClp > 0)
    .sort((a, b) => b.ownerMaintenanceTotalClp - a.ownerMaintenanceTotalClp)[0];

  const pendingMaintProps = snapshot.properties.filter((p) => p.pendingUrgentMaintenanceCount > 0);

  const maxOverdueDays = overdueProps[0]?.daysOverdue ?? 0;
  const maintRatioPct =
    snapshot.currentMonthProjectedRentClp > 0
      ? Math.round(
          (snapshot.currentMonthOwnerMaintenanceClp / snapshot.currentMonthProjectedRentClp) * 100
        )
      : 0;

  // 1) Estado general de salud de cartera
  let healthStatus: FinancialAiDiagnosisResult['healthStatus'] = 'Saludable';
  if (
    snapshot.overdueCount >= 2 ||
    (snapshot.occupiedCount > 0 && snapshot.collectionRatePct < 60) ||
    snapshot.currentMonthNetResultClp < 0 ||
    maxOverdueDays >= 15
  ) {
    healthStatus = 'Crítico';
  } else if (
    snapshot.overdueCount >= 1 ||
    snapshot.availableCount >= 1 ||
    snapshot.pendingUrgentMaintenanceTotal >= 1 ||
    snapshot.pendingValidationReceiptsCount >= 1 ||
    maintRatioPct >= 15
  ) {
    healthStatus = 'Atención Requerida';
  }

  // 2) Titular ejecutivo dinámico
  const formattedCutDate = formatSpanishDate(snapshot.simulatedDate);
  let headline: string;
  if (snapshot.totalProperties === 0) {
    headline = `Al ${formattedCutDate} no tienes propiedades registradas en cartera. Suma tu primera propiedad para activar proyecciones de ingresos y control de arriendos.`;
  } else if (healthStatus === 'Crítico') {
    headline = `Al ${formattedCutDate}, tu cartera registra ${snapshot.overdueCount} propiedad${snapshot.overdueCount === 1 ? '' : 'es'} en mora (hasta ${maxOverdueDays} días) con recaudación del ${snapshot.collectionRatePct}% y resultado neto de ${formatClp(snapshot.currentMonthNetResultClp)}; se requiere acción inmediata de cobranza.`;
  } else if (healthStatus === 'Atención Requerida') {
    const focusAreas: string[] = [];
    if (snapshot.overdueCount > 0) {
      focusAreas.push(
        `${snapshot.overdueCount} morosidad${snapshot.overdueCount === 1 ? '' : 'es'} activa${snapshot.overdueCount === 1 ? '' : 's'}`
      );
    }
    if (snapshot.availableCount > 0) {
      focusAreas.push(
        `${snapshot.availableCount} unidad${snapshot.availableCount === 1 ? '' : 'es'} disponible${snapshot.availableCount === 1 ? '' : 's'}`
      );
    }
    if (snapshot.pendingUrgentMaintenanceTotal > 0) {
      focusAreas.push(
        `${snapshot.pendingUrgentMaintenanceTotal} avería${snapshot.pendingUrgentMaintenanceTotal === 1 ? '' : 's'} pendiente${snapshot.pendingUrgentMaintenanceTotal === 1 ? '' : 's'}`
      );
    }
    if (snapshot.pendingValidationReceiptsCount > 0) {
      focusAreas.push(
        `${snapshot.pendingValidationReceiptsCount} comprobante${snapshot.pendingValidationReceiptsCount === 1 ? '' : 's'} por validar`
      );
    }
    headline = `Al ${formattedCutDate}, la cartera muestra ${snapshot.occupancyRatePct}% de ocupación y ${formatClp(snapshot.currentMonthNetResultClp)} de resultado neto mensual, con foco prioritario en ${focusAreas.join(', ')}.`;
  } else {
    headline = `Al ${formattedCutDate}, tu cartera opera en estado saludable con ${snapshot.occupancyRatePct}% de ocupación, ${snapshot.collectionRatePct}% del canon recaudado y ${formatClp(snapshot.currentMonthNetResultClp)} de resultado neto mensual.`;
  }

  // 3) Punto 1: Cobranza, Morosidad y Multas Acumuladas
  let point1: DiagnosticPoint;
  if (overdueProps.length > 0) {
    const topOverdue = overdueProps[0];
    const totalOverdueDebtClp = overdueProps.reduce((acc, p) => acc + p.totalOverdueDueClp, 0);
    const overdueLabels = overdueProps.map(
      (p) => `${p.address} (${p.commune}: ${p.daysOverdue} d)`
    );
    point1 = {
      category: 'Morosidad y Cobranza',
      title:
        overdueProps.length === 1
          ? `Atraso de ${topOverdue.daysOverdue} días y +${formatClp(topOverdue.accumulatedFineClp)} en multas`
          : `${overdueProps.length} propiedades en mora por ${formatClp(totalOverdueDebtClp)}`,
      summary: `Recaudación actual en ${snapshot.collectionRatePct}% (${formatClp(snapshot.currentMonthCollectedRentClp)} de ${formatClp(snapshot.currentMonthProjectedRentClp)}). Morosidad activa en ${formatShortList(overdueLabels)}, acumulando ${formatClp(snapshot.activeOverdueFinesClp)} en multas exigibles hoy.`,
      action: `Contactar hoy a ${topOverdue.tenantName} (${topOverdue.address}) desde "Urgente a resolver" cobrando ${formatClp(topOverdue.totalOverdueDueClp)} (canon + multa) o solicitar su pago inmediato desde la Vista Arrendatario.`,
      severity: maxOverdueDays >= 10 || overdueProps.length >= 2 ? 'critico' : 'alerta',
    };
  } else if (snapshot.pendingValidationReceiptsCount > 0) {
    point1 = {
      category: 'Ingresos y Cobranza',
      title: `${snapshot.pendingValidationReceiptsCount} comprobante${snapshot.pendingValidationReceiptsCount === 1 ? '' : 's'} por validar (${formatClp(snapshot.pendingValidationAmountClp)})`,
      summary: `No registras propiedades morosas al ${formattedCutDate}. La recaudación confirmada alcanza ${snapshot.collectionRatePct}% (${formatClp(snapshot.currentMonthCollectedRentClp)} de ${formatClp(snapshot.currentMonthProjectedRentClp)}), con ${formatClp(snapshot.pendingValidationAmountClp)} esperando tu aprobación.`,
      action: `Revisar y aprobar el comprobante pendiente en la bandeja "Urgente a resolver" para reflejar el 100% de recaudación en los gráficos y el reporte mensual.`,
      severity: 'alerta',
    };
  } else {
    const fineNote =
      snapshot.totalAccumulatedFinesClp > 0
        ? ` Además, regularizaste ${formatClp(snapshot.totalAccumulatedFinesClp)} en multas cobradas durante el mes.`
        : '';
    point1 = {
      category: 'Ingresos y Cobranza',
      title: `Cartera sin morosidad · ${snapshot.collectionRatePct}% recaudado al día`,
      summary: `Todas las propiedades arrendadas (${snapshot.occupiedCount}) están al día con ${formatClp(snapshot.currentMonthCollectedRentClp)} recaudados (Eq. ${formatUf(snapshot.currentMonthCollectedRentClp / snapshot.ufValueClp)}) y resultado neto de ${formatClp(snapshot.currentMonthNetResultClp)}.${fineNote}`,
      action: `Mantener la recaudación al día descargando el Reporte Mensual Consolidado en Excel y reservando ${formatClp(Math.round(Math.max(0, snapshot.currentMonthNetResultClp) * 0.1))} (10% del neto) como fondo de contingencia.`,
      severity: 'positivo',
    };
  }

  // 4) Punto 2: Gastos de Mantención y Salud Operativa
  let point2: DiagnosticPoint;
  if (snapshot.currentMonthOwnerMaintenanceClp > 0 || snapshot.pendingUrgentMaintenanceTotal > 0) {
    const focusProp = highestMaintMonthProp ?? pendingMaintProps[0] ?? highestMaintHistoricalProp;
    const pendingText =
      snapshot.pendingUrgentMaintenanceTotal > 0
        ? ` Existen ${snapshot.pendingUrgentMaintenanceTotal} avería${snapshot.pendingUrgentMaintenanceTotal === 1 ? '' : 's'} de cargo del propietario sin resolver (${formatShortList(pendingMaintProps.map((p) => p.address))}).`
        : '';
    const spendText =
      snapshot.currentMonthOwnerMaintenanceClp > 0
        ? `Este mes asumiste ${formatClp(snapshot.currentMonthOwnerMaintenanceClp)} en mantenciones (${maintRatioPct}% del canon proyectado; acumulado histórico ${formatClp(snapshot.historicalOwnerMaintenanceClp)}), liderado por ${highestMaintMonthProp ? `${highestMaintMonthProp.address} (${formatClp(highestMaintMonthProp.ownerMaintenanceMonthClp)})` : 'tu cartera activa'}.`
        : `Este mes no registras egresos ejecutados (histórico ${formatClp(snapshot.historicalOwnerMaintenanceClp)}), pero hay reparaciones pendientes que impactarán el margen neto.`;

    point2 = {
      category: 'Gastos de Mantención',
      title:
        snapshot.pendingUrgentMaintenanceTotal > 0
          ? `${snapshot.pendingUrgentMaintenanceTotal} avería${snapshot.pendingUrgentMaintenanceTotal === 1 ? '' : 's'} pendiente${snapshot.pendingUrgentMaintenanceTotal === 1 ? '' : 's'} y ${formatClp(snapshot.currentMonthOwnerMaintenanceClp)} en gastos del mes`
          : `Mantenciones absorben el ${maintRatioPct}% del canon mensual (${formatClp(snapshot.currentMonthOwnerMaintenanceClp)})`,
      summary: `${spendText}${pendingText}`,
      action:
        snapshot.pendingUrgentMaintenanceTotal > 0 && pendingMaintProps[0]
          ? `Resolver la avería pendiente en ${pendingMaintProps[0].address} desde "Urgente a resolver" y registrar la boleta en el historial privado para mantener actualizado el resultado neto.`
          : focusProp
            ? `Auditar el historial privado de gastos en ${focusProp.address} (${focusProp.commune}) y evaluar mantención preventiva semestral para acotar egresos bajo el 10% del arriendo.`
            : `Mantener el control de boletas de reparación en cada ficha para descontar correctamente los gastos en tu balance neto.`,
      severity:
        maintRatioPct >= 20 || snapshot.pendingUrgentMaintenanceTotal >= 2 ? 'critico' : 'alerta',
    };
  } else {
    point2 = {
      category: 'Gastos de Mantención',
      title: 'Sin gastos de mantención este mes ni averías pendientes',
      summary: `No registras egresos de mantención de cargo del propietario durante este mes (acumulado histórico: ${formatClp(snapshot.historicalOwnerMaintenanceClp)}) ni alertas estructurales pendientes${highestMaintHistoricalProp ? `; el mayor historial acumulado corresponde a ${highestMaintHistoricalProp.address} (${formatClp(highestMaintHistoricalProp.ownerMaintenanceTotalClp)})` : ''}.`,
      action: `Aprovechar el margen limpio actual (${formatClp(snapshot.currentMonthNetResultClp)} netos) para programar revisiones preventivas de calefont y gasfitería antes del próximo cambio de estación.`,
      severity: 'positivo',
    };
  }

  // 5) Punto 3: Propiedades Disponibles (Vacancia) y Reajustes IPC Próximos / Aplicados
  let point3: DiagnosticPoint;
  if (availableProps.length > 0) {
    const topAvailable = availableProps[0];
    const availableLabels = availableProps.map(
      (p) => `${p.address} (${p.commune}: ${formatClp(p.currentRentClp)}/mes)`
    );
    const ipcSuffix =
      upcomingIpcProps.length > 0
        ? ` Además, ${upcomingIpcProps[0].address} tendrá reajuste IPC (${upcomingIpcProps[0].ipcClause}) el ${formatSpanishDate(upcomingIpcProps[0].nextIpcDate)} (+${upcomingIpcProps[0].estimatedNextIpcPercent.toLocaleString('es-CL')}% est.).`
        : recentIpcProps.length > 0
          ? ` En paralelo, este mes se aplicó reajuste IPC automático en ${recentIpcProps.length} contrato${recentIpcProps.length === 1 ? '' : 's'}.`
          : '';

    point3 = {
      category: 'Vacancia e IPC',
      title: `${availableProps.length} propiedad${availableProps.length === 1 ? '' : 'es'} disponible${availableProps.length === 1 ? '' : 's'} (${formatClp(snapshot.potentialAvailableRentClp)}/mes sin generar)`,
      summary: `Tu ocupación es del ${snapshot.occupancyRatePct}% (${snapshot.occupiedCount} de ${snapshot.totalProperties}). La vacancia en ${formatShortList(availableLabels)} representa un potencial no percibido de ${formatClp(snapshot.potentialAvailableRentClp)} mensuales.${ipcSuffix}`,
      action: `Priorizar la colocación de ${topAvailable.address} (${topAvailable.commune}) y usar "Registrar Contrato Firmado" para elevar el ingreso mensual proyectado a ${formatClp(snapshot.currentMonthProjectedRentClp + snapshot.potentialAvailableRentClp)}.`,
      severity: availableProps.length >= 2 || snapshot.occupancyRatePct < 70 ? 'critico' : 'alerta',
    };
  } else if (upcomingIpcProps.length > 0) {
    const nextIpc = upcomingIpcProps[0];
    const totalEstimatedIncreaseClp = upcomingIpcProps.reduce(
      (acc, p) => acc + p.estimatedNextIpcIncreaseClp,
      0
    );
    const ipcList = upcomingIpcProps.map(
      (p) =>
        `${p.address} (${formatSpanishDate(p.nextIpcDate)}, +${p.estimatedNextIpcPercent.toLocaleString('es-CL')}%)`
    );
    point3 = {
      category: 'Ocupación y Próximo IPC',
      title: `100% ocupación · ${upcomingIpcProps.length} reajuste${upcomingIpcProps.length === 1 ? '' : 's'} IPC próximo${upcomingIpcProps.length === 1 ? '' : 's'} (+${formatClp(totalEstimatedIncreaseClp)}/mes est.)`,
      summary: `Tienes el 100% de tu cartera arrendada (${snapshot.occupiedCount}/${snapshot.totalProperties}). En los próximos 60 días vencen reajustes automáticos en ${formatShortList(ipcList)}, proyectando un alza mensual estimada de +${formatClp(totalEstimatedIncreaseClp)}.`,
      action: `Anticipar el aviso a ${nextIpc.tenantName} (${nextIpc.address}) antes del ${formatSpanishDate(nextIpc.nextIpcDate)} para asegurar el pago puntual del nuevo canon reajustado por IPC (${nextIpc.ipcClause}).`,
      severity: 'positivo',
    };
  } else if (recentIpcProps.length > 0) {
    const firstRecent = recentIpcProps[0];
    const totalDiffFromBaseClp = recentIpcProps.reduce(
      (acc, p) => acc + Math.max(0, p.currentRentClp - p.baseRentClp),
      0
    );
    point3 = {
      category: 'Ocupación y Reajuste IPC',
      title: `100% ocupación · IPC automático aplicado en ${recentIpcProps.length} contrato${recentIpcProps.length === 1 ? '' : 's'}`,
      summary: `Toda tu cartera está arrendada (${snapshot.occupiedCount}/${snapshot.totalProperties}) y este mes se ejecutó el reajuste IPC automático en ${formatShortList(recentIpcProps.map((p) => `${p.address} (+${(p.lastIpcAppliedPercent ?? 0).toLocaleString('es-CL')}%)`))}, sumando ${formatClp(totalDiffFromBaseClp)} sobre el canon base original.`,
      action: `Verificar en el Historial de Pagos que ${firstRecent.tenantName} (${firstRecent.address}) transfiera el nuevo canon vigente de ${formatClp(firstRecent.currentRentClp)} en su próximo vencimiento.`,
      severity: 'positivo',
    };
  } else {
    const nextIpcInfo = nextScheduledIpcProp
      ? ` El próximo reajuste IPC programado corresponde a ${nextScheduledIpcProp.address} el ${formatSpanishDate(nextScheduledIpcProp.nextIpcDate)} (${nextScheduledIpcProp.ipcClause}).`
      : ' Tus contratos en UF se reajustan automáticamente según el valor diario de la UF.';
    point3 = {
      category: 'Ocupación y Proyección IPC',
      title: `Ocupación plena (100%) con ${formatClp(snapshot.currentMonthProjectedRentClp)} mensuales`,
      summary: `Las ${snapshot.occupiedCount} propiedades de tu cartera están activas sin vacancia, generando ${formatClp(snapshot.currentMonthProjectedRentClp)} / mes (Eq. ${formatUf(snapshot.currentMonthProjectedRentClp / snapshot.ufValueClp)}).${nextIpcInfo}`,
      action: `Utilizar el filtro "Comparar propiedades entre sí" en Finanzas para evaluar la rentabilidad neta individual y planificar renovaciones con 60 días de anticipación.`,
      severity: 'positivo',
    };
  }

  return {
    headline,
    healthStatus,
    points: [point1, point2, point3],
  };
}
