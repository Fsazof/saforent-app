import {
  CommonExpenseRecord,
  PaymentReceipt,
  Property,
  TenantPropertyView,
} from '../types/saforent';
import {
  calculateLateFeeSummary,
  DEFAULT_SIMULATED_DATE,
  formatClp,
  formatSpanishDate,
  formatUf,
  toClp,
} from './formatters';

export type PaymentHistoryConcept = 'Arriendo' | 'Gasto Común';

export type PaymentHistoryStatus =
  | 'Aprobado'
  | 'Pendiente de Validar'
  | 'Atrasado/Multa';

export interface PaymentReceiptPreviewData {
  id: string;
  concept: PaymentHistoryConcept;
  periodLabel: string;
  paymentDateLabel: string;
  amountClp: number;
  lateFeeClp?: number;
  originalAmountLabel?: string;
  method: string;
  referenceCode: string;
  fileName: string;
  fileDataUrl?: string;
  status: PaymentHistoryStatus;
}

export interface PaymentHistoryRow {
  id: string;
  sortPeriodKey: string;
  sortTimestamp: string;
  periodLabel: string;
  concept: PaymentHistoryConcept;
  paymentDateLabel: string;
  amountPaidClp: number;
  lateFeeClp?: number;
  secondaryAmountLabel?: string;
  owedAmountClp?: number;
  owedBreakdownLabel?: string;
  status: PaymentHistoryStatus;
  statusDetail?: string;
  receiptPreview: PaymentReceiptPreviewData | null;
}

const SPANISH_MONTHS_MAP: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

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

export function parsePeriodLabelToYm(periodLabel: string, fallbackIsoDate?: string): string {
  const normalized = periodLabel
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const yearMatch = normalized.match(/\b(20\d{2})\b/);
  const matchedMonthEntry = Object.entries(SPANISH_MONTHS_MAP).find(([name]) =>
    normalized.includes(name)
  );

  if (yearMatch && matchedMonthEntry) {
    const mm = String(matchedMonthEntry[1]).padStart(2, '0');
    return `${yearMatch[1]}-${mm}`;
  }

  if (fallbackIsoDate && /^\d{4}-\d{2}/.test(fallbackIsoDate)) {
    return fallbackIsoDate.slice(0, 7);
  }

  return '2026-01';
}

export function formatIsoDateToPeriodLabel(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Período actual';
  const monthName = SPANISH_MONTHS_FULL[parsed.getMonth()] ?? 'Mes';
  return `${monthName} ${parsed.getFullYear()}`;
}

export function buildPropertyPaymentHistory(params: {
  property: Property | TenantPropertyView;
  receipts: PaymentReceipt[];
  commonExpenses: CommonExpenseRecord[];
  ufValueClp: number;
  simulatedDate?: string;
}): PaymentHistoryRow[] {
  const {
    property,
    receipts,
    commonExpenses,
    ufValueClp,
    simulatedDate = DEFAULT_SIMULATED_DATE,
  } = params;

  const rows: PaymentHistoryRow[] = [];
  const coveredRentYms = new Set<string>();

  // 1. Comprobantes de Arriendo (aprobados o pendientes de validar)
  for (const rec of receipts) {
    if (rec.propertyId !== property.id) continue;

    const sortPeriodKey = parsePeriodLabelToYm(rec.periodLabel, rec.submittedAt);
    if (rec.status === 'aprobado' || rec.status === 'en_revision') {
      coveredRentYms.add(sortPeriodKey);
    }

    const amountClp =
      rec.currency === 'UF'
        ? toClp(rec.amount, 'UF', ufValueClp)
        : Math.round(rec.amountClpEquivalent || rec.amount);

    const status: PaymentHistoryStatus =
      rec.status === 'aprobado'
        ? 'Aprobado'
        : rec.status === 'en_revision'
          ? 'Pendiente de Validar'
          : 'Atrasado/Multa';

    const paymentDateLabel = formatSpanishDate(rec.submittedAt.slice(0, 10));
    const originalAmountLabel =
      rec.currency === 'UF' ? formatUf(rec.amount) : undefined;

    rows.push({
      id: `rent-${rec.id}`,
      sortPeriodKey,
      sortTimestamp: rec.submittedAt,
      periodLabel: rec.periodLabel,
      concept: 'Arriendo',
      paymentDateLabel,
      amountPaidClp: rec.status === 'rechazado' ? 0 : amountClp,
      lateFeeClp: rec.lateFeeClp,
      secondaryAmountLabel: originalAmountLabel,
      status,
      statusDetail:
        rec.status === 'en_revision'
          ? 'Esperando validación del propietario'
          : rec.method,
      receiptPreview: {
        id: rec.id,
        concept: 'Arriendo',
        periodLabel: rec.periodLabel,
        paymentDateLabel,
        amountClp,
        lateFeeClp: rec.lateFeeClp,
        originalAmountLabel,
        method: rec.method,
        referenceCode: rec.referenceCode,
        fileName: rec.fileName,
        fileDataUrl: rec.fileDataUrl,
        status,
      },
    });
  }

  // 2. Arriendo moroso / atrasado si aún no tiene comprobante subido para ese período
  const lateSummary = calculateLateFeeSummary(property, ufValueClp, simulatedDate);
  if (lateSummary.isOverdue && property.status !== 'Disponible') {
    const overdueYm = (property.nextPaymentDate || simulatedDate).slice(0, 7);
    if (!coveredRentYms.has(overdueYm)) {
      const overduePeriodLabel = formatIsoDateToPeriodLabel(
        property.nextPaymentDate || simulatedDate
      );
      rows.push({
        id: `rent-overdue-${property.id}-${overdueYm}`,
        sortPeriodKey: overdueYm,
        sortTimestamp: `${property.nextPaymentDate || simulatedDate}T23:59:59`,
        periodLabel: overduePeriodLabel,
        concept: 'Arriendo',
        paymentDateLabel: `Venc. ${formatSpanishDate(property.nextPaymentDate)}`,
        amountPaidClp: 0,
        owedAmountClp: lateSummary.totalDueClp,
        owedBreakdownLabel: `Adeuda ${formatClp(lateSummary.totalDueClp)} (${lateSummary.daysOverdue}d mora: +${formatClp(lateSummary.accumulatedClp)})`,
        status: 'Atrasado/Multa',
        statusDetail: `${lateSummary.daysOverdue} día${lateSummary.daysOverdue === 1 ? '' : 's'} de atraso`,
        receiptPreview: null,
      });
    }
  }

  // 3. Gastos Comunes (pagados, pendientes de validar o atrasados)
  for (const exp of commonExpenses) {
    if (exp.propertyId !== property.id) continue;
    if (exp.status === 'pendiente') continue;

    const sortPeriodKey = parsePeriodLabelToYm(exp.periodLabel, exp.dueDate);

    if (exp.status === 'atrasado') {
      rows.push({
        id: `gc-overdue-${exp.id}`,
        sortPeriodKey,
        sortTimestamp: `${exp.dueDate || exp.createdAt.slice(0, 10)}T23:50:00`,
        periodLabel: exp.periodLabel,
        concept: 'Gasto Común',
        paymentDateLabel: `Venc. ${formatSpanishDate(exp.dueDate)}`,
        amountPaidClp: 0,
        owedAmountClp: exp.amountClp,
        owedBreakdownLabel: `Adeuda ${formatClp(exp.amountClp)}`,
        status: 'Atrasado/Multa',
        statusDetail: 'Plazo vencido sin comprobante',
        receiptPreview: null,
      });
      continue;
    }

    const status: PaymentHistoryStatus =
      exp.status === 'pagado' ? 'Aprobado' : 'Pendiente de Validar';
    const submittedIso = exp.receiptSubmittedAt || exp.paidAt || exp.createdAt;
    const paymentDateLabel = formatSpanishDate(submittedIso.slice(0, 10));
    const fileName = exp.receiptFileName || exp.billFileName || 'comprobante_gasto_comun.pdf';
    const method = exp.receiptMethod || 'Transferencia Bancaria';
    const referenceCode = exp.receiptReferenceCode || 'Validado';

    rows.push({
      id: `gc-${exp.id}`,
      sortPeriodKey,
      sortTimestamp: submittedIso,
      periodLabel: exp.periodLabel,
      concept: 'Gasto Común',
      paymentDateLabel,
      amountPaidClp: exp.amountClp,
      status,
      statusDetail:
        status === 'Pendiente de Validar'
          ? 'Esperando validación del propietario'
          : method,
      receiptPreview: {
        id: exp.id,
        concept: 'Gasto Común',
        periodLabel: exp.periodLabel,
        paymentDateLabel,
        amountClp: exp.amountClp,
        method,
        referenceCode,
        fileName,
        fileDataUrl: exp.receiptDataUrl,
        status,
      },
    });
  }

  // Ordenar del período más reciente al más antiguo
  rows.sort((a, b) => {
    const periodCmp = b.sortPeriodKey.localeCompare(a.sortPeriodKey);
    if (periodCmp !== 0) return periodCmp;
    const timeCmp = b.sortTimestamp.localeCompare(a.sortTimestamp);
    if (timeCmp !== 0) return timeCmp;
    if (a.concept !== b.concept) {
      return a.concept === 'Arriendo' ? -1 : 1;
    }
    return 0;
  });

  return rows;
}
