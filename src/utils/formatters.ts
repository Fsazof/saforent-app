import { CurrencyType, Property, TenantPropertyView } from '../types/saforent';

export const DEFAULT_UF_VALUE_CLP = 41330;
export const DEFAULT_SIMULATED_DATE = '2026-11-15';

export function addMonthsIsoDate(isoDate: string, months: number, fixedDay?: number): string {
  const base = new Date(`${isoDate || DEFAULT_SIMULATED_DATE}T12:00:00`);
  if (Number.isNaN(base.getTime())) return isoDate;

  const targetMonthIndex = base.getMonth() + months;
  const targetYear = base.getFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const maxDaysInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const desiredDay = fixedDay ?? base.getDate();
  const clampedDay = Math.min(Math.max(1, desiredDay), maxDaysInMonth);

  const yyyy = String(targetYear).padStart(4, '0');
  const mm = String(normalizedMonth + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatClp(amount: number): string {
  const rounded = Math.round(amount);
  return `$${rounded.toLocaleString('es-CL')}`;
}

export function formatUf(amount: number): string {
  return `${amount.toLocaleString('es-CL', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} UF`;
}

export function toClp(amount: number, currency: CurrencyType, ufValue: number): number {
  if (currency === 'CLP') return Math.round(amount);
  return Math.round(amount * ufValue);
}

export function toUf(amount: number, currency: CurrencyType, ufValue: number): number {
  if (currency === 'UF') return Number(amount.toFixed(2));
  return Number((amount / ufValue).toFixed(2));
}

export function formatRentPrimaryAndSecondary(
  amount: number,
  currency: CurrencyType,
  ufValue: number
): { primary: string; secondary: string } {
  if (currency === 'CLP') {
    return {
      primary: `${formatClp(amount)} / mes`,
      secondary: `Eq. ${formatUf(toUf(amount, 'CLP', ufValue))}`,
    };
  }
  return {
    primary: `${formatUf(amount)} / mes`,
    secondary: `Eq. ${formatClp(toClp(amount, 'UF', ufValue))}`,
  };
}

export function formatGuaranteeLabel(
  property: Pick<
    Property | TenantPropertyView,
    'guaranteeCurrency' | 'guaranteeAmount' | 'currency' | 'rentAmount' | 'guaranteeMonths'
  >,
  ufValue: number
): { primary: string; secondary: string; currency: CurrencyType; amount: number } {
  const currency: CurrencyType = property.guaranteeCurrency ?? property.currency;
  const amount =
    property.guaranteeAmount !== undefined
      ? property.guaranteeAmount
      : Number((property.rentAmount * (property.guaranteeMonths || 1)).toFixed(2));

  if (currency === 'CLP') {
    return {
      primary: formatClp(amount),
      secondary: `Eq. ${formatUf(toUf(amount, 'CLP', ufValue))}`,
      currency,
      amount,
    };
  }
  return {
    primary: formatUf(amount),
    secondary: `Eq. ${formatClp(toClp(amount, 'UF', ufValue))}`,
    currency,
    amount,
  };
}

export function calculateIpcAdjustedRent(
  currentAmount: number,
  currency: CurrencyType,
  ipcPercent: number
): number {
  const factor = 1 + ipcPercent / 100;
  if (currency === 'CLP') {
    return Math.round((currentAmount * factor) / 100) * 100;
  }
  return Number((currentAmount * factor).toFixed(2));
}

export function formatSpanishDate(isoDate: string): string {
  if (!isoDate) return '—';
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  return parsed.toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDailyLateFeeLabel(
  property: Pick<Property | TenantPropertyView, 'lateFeeCurrency' | 'lateFeeDailyAmount'>,
  ufValueClp: number
): { primary: string; secondary: string } {
  const currency: CurrencyType = property.lateFeeCurrency ?? 'CLP';
  const amount = property.lateFeeDailyAmount ?? (currency === 'UF' ? 0.1 : 4000);
  if (currency === 'UF') {
    return {
      primary: `${formatUf(amount)} / día`,
      secondary: `Eq. ${formatClp(toClp(amount, 'UF', ufValueClp))} diarios`,
    };
  }
  return {
    primary: `${formatClp(amount)} / día`,
    secondary: `Eq. ${formatUf(toUf(amount, 'CLP', ufValueClp))} diarios`,
  };
}

export interface LateFeeSummary {
  isOverdue: boolean;
  daysOverdue: number;
  dailyCurrency: CurrencyType;
  dailyAmount: number;
  dailyClp: number;
  accumulatedClp: number;
  accumulatedUf: number;
  baseClp: number;
  totalDueClp: number;
  totalDueUf: number;
  totalDueInRentCurrency: number;
}

export function getOverdueDays(
  property: Pick<
    Property | TenantPropertyView,
    'status' | 'paymentStatus' | 'nextPaymentDate' | 'paymentDay'
  >,
  referenceDateIso: string = DEFAULT_SIMULATED_DATE
): number {
  if (property.status !== 'Moroso' && property.paymentStatus !== 'atrasado') {
    return 0;
  }

  const now = new Date(`${referenceDateIso}T12:00:00`);
  const safeNow = Number.isNaN(now.getTime()) ? new Date() : now;
  const todayStart = new Date(safeNow.getFullYear(), safeNow.getMonth(), safeNow.getDate());
  const due = new Date(`${property.nextPaymentDate}T00:00:00`);

  if (!Number.isNaN(due.getTime()) && todayStart.getTime() > due.getTime()) {
    return Math.max(1, Math.round((todayStart.getTime() - due.getTime()) / 86400000));
  }

  if (safeNow.getDate() > property.paymentDay) {
    return safeNow.getDate() - property.paymentDay;
  }

  return 1;
}

export function calculateLateFeeSummary(
  property: Pick<
    Property | TenantPropertyView,
    | 'status'
    | 'paymentStatus'
    | 'nextPaymentDate'
    | 'paymentDay'
    | 'currency'
    | 'rentAmount'
    | 'lateFeeCurrency'
    | 'lateFeeDailyAmount'
  >,
  ufValueClp: number,
  referenceDateIso: string = DEFAULT_SIMULATED_DATE
): LateFeeSummary {
  const daysOverdue = getOverdueDays(property, referenceDateIso);
  const dailyCurrency: CurrencyType = property.lateFeeCurrency ?? 'CLP';
  const dailyAmount = property.lateFeeDailyAmount ?? (dailyCurrency === 'UF' ? 0.1 : 4000);
  const dailyClp = toClp(dailyAmount, dailyCurrency, ufValueClp);
  const accumulatedClp = daysOverdue * dailyClp;
  const accumulatedUf = toUf(accumulatedClp, 'CLP', ufValueClp);
  const baseClp = toClp(property.rentAmount, property.currency, ufValueClp);
  const totalDueClp = baseClp + accumulatedClp;
  const totalDueUf = toUf(totalDueClp, 'CLP', ufValueClp);
  const totalDueInRentCurrency =
    property.currency === 'CLP' ? totalDueClp : totalDueUf;

  return {
    isOverdue: daysOverdue > 0,
    daysOverdue,
    dailyCurrency,
    dailyAmount,
    dailyClp,
    accumulatedClp,
    accumulatedUf,
    baseClp,
    totalDueClp,
    totalDueUf,
    totalDueInRentCurrency,
  };
}
