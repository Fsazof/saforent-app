import { IpcFrequency, IpcMonthlyPoint, IndicatorSource } from '../types/saforent';

export const FALLBACK_UF_VALUE_CLP = 41330;
export const FALLBACK_UF_DATE = '2026-11-15';

// Tabla interna integrada con variaciones mensuales reales recientes del IPC en Chile (fuente INE / Banco Central)
// Ordenadas de más reciente a más antigua para cálculos automáticos de 1, 3, 6 y 12 meses.
export const FALLBACK_IPC_HISTORY: IpcMonthlyPoint[] = [
  { date: '2026-10-01', value: 0.5 },
  { date: '2026-09-01', value: 0.4 },
  { date: '2026-08-01', value: 0.3 },
  { date: '2026-07-01', value: 0.4 },
  { date: '2026-06-01', value: 0.2 },
  { date: '2026-05-01', value: 0.3 },
  { date: '2026-04-01', value: 0.3 },
  { date: '2026-03-01', value: 0.4 },
  { date: '2026-02-01', value: 0.4 },
  { date: '2026-01-01', value: 0.6 },
  { date: '2025-12-01', value: 0.1 },
  { date: '2025-11-01', value: 0.2 },
];

export interface EconomicIndicatorsSnapshot {
  ufValueClp: number;
  ufDate: string;
  ipcMonthlyHistory: IpcMonthlyPoint[];
  source: IndicatorSource;
  lastUpdatedAt: string;
}

export function getMonthsForIpcClause(clause: IpcFrequency): number {
  switch (clause) {
    case 'Mensual':
      return 1;
    case 'Trimestral':
      return 3;
    case 'Semestral':
      return 6;
    case 'Anual':
      return 12;
    case 'Reajuste directo en UF':
      return 0;
  }
}

export function computeAccumulatedIpcPercent(
  history: IpcMonthlyPoint[],
  monthsCount: number
): number {
  if (monthsCount <= 0) return 0;
  const source = history.length > 0 ? history : FALLBACK_IPC_HISTORY;
  const sorted = [...source].sort((a, b) => b.date.localeCompare(a.date));
  const slice = sorted.slice(0, monthsCount);
  if (slice.length === 0) return 0;

  const factor = slice.reduce((acc, pt) => acc * (1 + pt.value / 100), 1);
  return Number(((factor - 1) * 100).toFixed(1));
}

export function getLocalChileEconomicIndicators(): EconomicIndicatorsSnapshot {
  return {
    ufValueClp: FALLBACK_UF_VALUE_CLP,
    ufDate: FALLBACK_UF_DATE,
    ipcMonthlyHistory: FALLBACK_IPC_HISTORY,
    source: 'respaldo_local',
    lastUpdatedAt: new Date().toISOString(),
  };
}
