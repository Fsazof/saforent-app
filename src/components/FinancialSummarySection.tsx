import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { FileSpreadsheet, Filter } from 'lucide-react';
import {
  CommonExpenseRecord,
  IpcMonthlyPoint,
  MaintenanceExpenseRecord,
  PaymentReceipt,
  Property,
} from '../types/saforent';
import {
  exportFinancialReportXlsx,
  FinancialReportRow,
  FinancialReportTotals,
} from '../utils/exportExcel';
import {
  addMonthsIsoDate,
  calculateLateFeeSummary,
  DEFAULT_SIMULATED_DATE,
  formatClp,
  formatUf,
  toClp,
} from '../utils/formatters';
import { FinancialAiDiagnosisController } from '../hooks/useFinancialAiDiagnosis';
import { FinancialAiDiagnosisCard } from './FinancialAiDiagnosisCard';
import { IndicatorsSourceNotice } from './IndicatorsSourceNotice';

type FinancialMetric = 'income_vs_expenses' | 'net_profit' | 'projected_vs_collected';
type FinancialPeriod = '1m' | '3m' | '6m';
type PropertyFilterValue = 'all' | 'compare' | string;

interface FinancialSummarySectionProps {
  properties: Property[];
  receipts: PaymentReceipt[];
  maintenanceExpenses: MaintenanceExpenseRecord[];
  commonExpenses: CommonExpenseRecord[];
  ufValueClp: number;
  ipcMonthlyHistory?: IpcMonthlyPoint[];
  simulatedDate?: string;
  onNotify?: (message: string) => void;
  aiDiagnosis?: FinancialAiDiagnosisController;
}

interface ChartDatum {
  key: string;
  label: string;
  subLabel?: string;
  incomeClp: number;
  expensesClp: number;
  netProfitClp: number;
  projectedClp: number;
  collectedClp: number;
}

interface OccupancySlice {
  label: string;
  value: number;
  color: string;
}

const SPANISH_MONTH_ABBR = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

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

function shortPropertyLabel(address: string): string {
  const commaIdx = address.indexOf(',');
  const base = commaIdx > 0 ? address.slice(0, commaIdx) : address;
  return base.length > 18 ? `${base.slice(0, 16)}…` : base;
}

function getPropertyRowStatusLabel(prop: Property, offset: number): string {
  if (prop.status === 'Disponible') return 'Disponible';
  if (offset < 0) return 'Pagado (Histórico)';
  if (prop.status === 'Moroso' || prop.paymentStatus === 'atrasado') return 'Moroso';
  if (prop.status === 'En Mantención') return 'En Mantención';
  if (prop.paymentStatus === 'al_dia') return 'Al día';
  if (prop.paymentStatus === 'en_revision') return 'En revisión';
  return 'Pendiente';
}

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

export function FinancialSummarySection({
  properties,
  receipts,
  maintenanceExpenses,
  commonExpenses,
  ufValueClp,
  ipcMonthlyHistory,
  simulatedDate = DEFAULT_SIMULATED_DATE,
  onNotify,
  aiDiagnosis,
}: FinancialSummarySectionProps) {
  const [propertyFilter, setPropertyFilter] = useState<PropertyFilterValue>('all');
  const [metric, setMetric] = useState<FinancialMetric>('income_vs_expenses');
  const [period, setPeriod] = useState<FinancialPeriod>('6m');
  const [hoveredDatum, setHoveredDatum] = useState<ChartDatum | null>(null);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartSvgRef = useRef<SVGSVGElement | null>(null);
  const donutSvgRef = useRef<SVGSVGElement | null>(null);
  const latestIpcPercent = ipcMonthlyHistory?.[0]?.value;

  // Si la propiedad seleccionada ya no existe, volver a 'all'
  const effectivePropertyFilter: PropertyFilterValue =
    propertyFilter === 'all' ||
    propertyFilter === 'compare' ||
    properties.some((p) => p.id === propertyFilter)
      ? propertyFilter
      : 'all';

  const periodMonthsCount = period === '1m' ? 1 : period === '3m' ? 3 : 6;
  const periodLabel =
    period === '1m'
      ? 'Mes actual'
      : period === '3m'
        ? 'Últimos 3 meses'
        : 'Últimos 6 meses';

  const metricLabel =
    metric === 'income_vs_expenses'
      ? 'Ingresos vs. Gastos'
      : metric === 'net_profit'
        ? 'Ganancia Neta'
        : 'Proyectado vs. Recaudado';

  const selectedProperties = useMemo(() => {
    if (effectivePropertyFilter === 'all' || effectivePropertyFilter === 'compare') {
      return properties;
    }
    return properties.filter((p) => p.id === effectivePropertyFilter);
  }, [properties, effectivePropertyFilter]);

  const propertyFilterLabel = useMemo(() => {
    if (effectivePropertyFilter === 'all') return 'Todas (Consolidado)';
    if (effectivePropertyFilter === 'compare') return 'Comparar propiedades entre sí';
    const found = properties.find((p) => p.id === effectivePropertyFilter);
    return found ? `${found.address} (${found.commune})` : 'Todas (Consolidado)';
  }, [properties, effectivePropertyFilter]);

  // Slots mensuales ordenados cronológicamente (del más antiguo al mes de referencia actual)
  const monthSlots = useMemo(() => {
    const slots: {
      offset: number;
      monthKey: string;
      monthAbbr: string;
      monthNameFull: string;
      year: number;
      monthLabel: string;
    }[] = [];

    for (let i = periodMonthsCount - 1; i >= 0; i -= 1) {
      const offset = -i;
      const iso = addMonthsIsoDate(simulatedDate, offset, 1);
      const d = new Date(`${iso}T12:00:00`);
      const mIdx = Number.isNaN(d.getTime()) ? 0 : d.getMonth();
      const year = Number.isNaN(d.getTime()) ? 2026 : d.getFullYear();
      const monthAbbr = SPANISH_MONTH_ABBR[mIdx] ?? 'Mes';
      const monthNameFull = SPANISH_MONTHS_FULL[mIdx] ?? 'Mes';
      slots.push({
        offset,
        monthKey: iso.slice(0, 7),
        monthAbbr,
        monthNameFull,
        year,
        monthLabel: `${monthNameFull} ${year}`,
      });
    }
    return slots;
  }, [simulatedDate, periodMonthsCount]);

  // Filas detalladas del Reporte Mensual Consolidado (ordenadas del mes más reciente al más antiguo)
  const reportRows = useMemo<FinancialReportRow[]>(() => {
    const rows: FinancialReportRow[] = [];
    const reversedSlots = [...monthSlots].reverse();

    for (const slot of reversedSlots) {
      for (const prop of selectedProperties) {
        const isAvailable = prop.status === 'Disponible';
        const contractStartYm = prop.contractStart?.slice(0, 7) || '2020-01';
        const isActiveInMonth = !isAvailable && contractStartYm <= slot.monthKey;

        const baseRentClp = isActiveInMonth
          ? toClp(prop.baseRentAmount ?? prop.rentAmount, prop.currency, ufValueClp)
          : 0;

        let currentRentClp = 0;
        if (isActiveInMonth) {
          if (
            slot.offset < 0 &&
            prop.lastIpcAppliedDate &&
            prop.lastIpcAppliedDate.slice(0, 7) > slot.monthKey
          ) {
            currentRentClp = baseRentClp;
          } else {
            currentRentClp = toClp(prop.rentAmount, prop.currency, ufValueClp);
          }
        }

        // Multas por atraso (activas en mora o ya pagadas en comprobantes aprobados del mes)
        const paidReceiptLateFeeClp = isActiveInMonth
          ? receipts
              .filter(
                (r) =>
                  r.propertyId === prop.id &&
                  r.status === 'aprobado' &&
                  (r.lateFeeClp ?? 0) > 0 &&
                  matchesMonthPeriod(
                    r.periodLabel,
                    r.submittedAt,
                    slot.monthKey,
                    slot.monthNameFull,
                    slot.year
                  )
              )
              .reduce((acc, r) => acc + (r.lateFeeClp ?? 0), 0)
          : 0;

        const activeOverdueLateFeeClp =
          isActiveInMonth && slot.offset === 0
            ? calculateLateFeeSummary(prop, ufValueClp, simulatedDate).accumulatedClp
            : 0;

        const multasClp = Math.max(activeOverdueLateFeeClp, paidReceiptLateFeeClp);

        // Recaudación confirmada
        let recaudadoClp = 0;
        if (isActiveInMonth) {
          if (slot.offset === 0) {
            if (prop.paymentStatus === 'al_dia') {
              recaudadoClp = currentRentClp;
            } else {
              const matchingCurrentReceipts = receipts.filter(
                (r) =>
                  r.propertyId === prop.id &&
                  r.status === 'aprobado' &&
                  matchesMonthPeriod(
                    r.periodLabel,
                    r.submittedAt,
                    slot.monthKey,
                    slot.monthNameFull,
                    slot.year
                  )
              );
              recaudadoClp = matchingCurrentReceipts.reduce(
                (acc, r) => acc + r.amountClpEquivalent,
                0
              );
            }
          } else {
            const matchingHistorical = receipts.filter(
              (r) =>
                r.propertyId === prop.id &&
                r.status === 'aprobado' &&
                matchesMonthPeriod(
                  r.periodLabel,
                  r.submittedAt,
                  slot.monthKey,
                  slot.monthNameFull,
                  slot.year
                )
            );
            recaudadoClp =
              matchingHistorical.length > 0
                ? matchingHistorical.reduce((acc, r) => acc + r.amountClpEquivalent, 0)
                : currentRentClp;
          }
        }

        // Gastos de mantención asumidos por el Propietario en ese mes
        const gastosMantencionClp = maintenanceExpenses
          .filter(
            (exp) =>
              exp.propertyId === prop.id &&
              exp.paidBy === 'Propietario' &&
              exp.date.slice(0, 7) === slot.monthKey
          )
          .reduce((acc, exp) => acc + exp.amountClp, 0);

        // Gastos Comunes del mes (columna informativa separada de ingresos)
        const gastosComunesClp = commonExpenses
          .filter(
            (gc) =>
              gc.propertyId === prop.id &&
              matchesMonthPeriod(
                gc.periodLabel,
                gc.dueDate,
                slot.monthKey,
                slot.monthNameFull,
                slot.year
              )
          )
          .reduce((acc, gc) => acc + gc.amountClp, 0);

        const resultadoNetoClp = currentRentClp + multasClp - gastosMantencionClp;

        rows.push({
          id: `${slot.monthKey}-${prop.id}`,
          monthKey: slot.monthKey,
          monthLabel: slot.monthLabel,
          propertyId: prop.id,
          propertyLabel: `${prop.address} (${prop.commune})`,
          commune: prop.commune,
          statusLabel: getPropertyRowStatusLabel(prop, slot.offset),
          canonBaseClp: baseRentClp,
          montoVigenteClp: currentRentClp,
          recaudadoClp,
          multasClp,
          gastosMantencionClp,
          resultadoNetoClp,
          gastosComunesClp,
        });
      }
    }

    return rows;
  }, [
    monthSlots,
    selectedProperties,
    ufValueClp,
    simulatedDate,
    receipts,
    maintenanceExpenses,
    commonExpenses,
  ]);

  // Totales del período filtrado
  const reportTotals = useMemo<FinancialReportTotals>(() => {
    return reportRows.reduce<FinancialReportTotals>(
      (acc, row) => ({
        canonBaseClp: acc.canonBaseClp + row.canonBaseClp,
        montoVigenteClp: acc.montoVigenteClp + row.montoVigenteClp,
        recaudadoClp: acc.recaudadoClp + row.recaudadoClp,
        multasClp: acc.multasClp + row.multasClp,
        gastosMantencionClp: acc.gastosMantencionClp + row.gastosMantencionClp,
        resultadoNetoClp: acc.resultadoNetoClp + row.resultadoNetoClp,
        gastosComunesClp: acc.gastosComunesClp + row.gastosComunesClp,
      }),
      {
        canonBaseClp: 0,
        montoVigenteClp: 0,
        recaudadoClp: 0,
        multasClp: 0,
        gastosMantencionClp: 0,
        resultadoNetoClp: 0,
        gastosComunesClp: 0,
      }
    );
  }, [reportRows]);

  // Métricas de ocupación (para anillo D3)
  const occupancyMetrics = useMemo(() => {
    const totalCount = selectedProperties.length;
    const occupiedProps = selectedProperties.filter((p) => p.status !== 'Disponible');
    const availableCount = totalCount - occupiedProps.length;
    const occupancyPct = totalCount > 0 ? Math.round((occupiedProps.length / totalCount) * 100) : 0;

    const currentMonthProjectedClp = occupiedProps.reduce(
      (sum, p) => sum + toClp(p.rentAmount, p.currency, ufValueClp),
      0
    );

    const periodProjectedTotalClp = reportTotals.montoVigenteClp + reportTotals.multasClp;
    const collectionRatePct =
      reportTotals.montoVigenteClp > 0
        ? Math.round((reportTotals.recaudadoClp / reportTotals.montoVigenteClp) * 100)
        : 0;

    return {
      totalCount,
      occupiedCount: occupiedProps.length,
      availableCount,
      occupancyPct,
      currentMonthProjectedClp,
      periodProjectedTotalClp,
      collectionRatePct,
    };
  }, [selectedProperties, ufValueClp, reportTotals]);

  // Datos para el gráfico principal D3: por mes ('all' / propiedad única) o por propiedad ('compare')
  const chartData = useMemo<ChartDatum[]>(() => {
    if (effectivePropertyFilter === 'compare') {
      return properties.map((prop) => {
        const propRows = reportRows.filter((r) => r.propertyId === prop.id);
        const incomeClp = propRows.reduce((s, r) => s + r.montoVigenteClp + r.multasClp, 0);
        const expensesClp = propRows.reduce((s, r) => s + r.gastosMantencionClp, 0);
        const netProfitClp = propRows.reduce((s, r) => s + r.resultadoNetoClp, 0);
        const projectedClp = propRows.reduce((s, r) => s + r.montoVigenteClp, 0);
        const collectedClp = propRows.reduce((s, r) => s + r.recaudadoClp, 0);

        return {
          key: prop.id,
          label: shortPropertyLabel(prop.address),
          subLabel: `${prop.commune} · ${prop.status}`,
          incomeClp,
          expensesClp,
          netProfitClp,
          projectedClp,
          collectedClp,
        };
      });
    }

    return monthSlots.map((slot) => {
      const slotRows = reportRows.filter((r) => r.monthKey === slot.monthKey);
      const incomeClp = slotRows.reduce((s, r) => s + r.montoVigenteClp + r.multasClp, 0);
      const expensesClp = slotRows.reduce((s, r) => s + r.gastosMantencionClp, 0);
      const netProfitClp = slotRows.reduce((s, r) => s + r.resultadoNetoClp, 0);
      const projectedClp = slotRows.reduce((s, r) => s + r.montoVigenteClp, 0);
      const collectedClp = slotRows.reduce((s, r) => s + r.recaudadoClp, 0);

      return {
        key: slot.monthKey,
        label: `${slot.monthAbbr} ${String(slot.year).slice(-2)}`,
        subLabel: slot.monthLabel,
        incomeClp,
        expensesClp,
        netProfitClp,
        projectedClp,
        collectedClp,
      };
    });
  }, [effectivePropertyFilter, properties, reportRows, monthSlots]);

  // Limpiar hover si cambian los datos del gráfico
  useEffect(() => {
    setHoveredDatum(null);
  }, [effectivePropertyFilter, metric, period]);

  // Gráfico D3 de anillo de ocupación
  useEffect(() => {
    const svgEl = donutSvgRef.current;
    if (!svgEl) return;

    const size = 112;
    const radius = size / 2;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${size} ${size}`);

    const g = svg.append('g').attr('transform', `translate(${radius}, ${radius})`);

    const slices: OccupancySlice[] =
      occupancyMetrics.totalCount === 0
        ? [{ label: 'Sin propiedades', value: 1, color: '#E5E7EB' }]
        : [
            { label: 'Ocupadas', value: occupancyMetrics.occupiedCount, color: '#1B5E3A' },
            { label: 'Disponibles', value: occupancyMetrics.availableCount, color: '#DBEAFE' },
          ];

    const pie = d3
      .pie<OccupancySlice>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<OccupancySlice>>()
      .innerRadius(37)
      .outerRadius(50)
      .cornerRadius(3);

    g.selectAll('path')
      .data(pie(slices))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 2);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.32em')
      .attr('fill', '#111827')
      .style('font-family', 'var(--font-mono)')
      .style('font-size', '16px')
      .style('font-weight', '700')
      .text(`${occupancyMetrics.occupancyPct}%`);
  }, [
    occupancyMetrics.totalCount,
    occupancyMetrics.occupiedCount,
    occupancyMetrics.availableCount,
    occupancyMetrics.occupancyPct,
  ]);

  // Gráfico D3 principal adaptable a Filtro de Propiedad, Métrica y Período
  useEffect(() => {
    const svgEl = chartSvgRef.current;
    const containerEl = chartContainerRef.current;
    if (!svgEl || !containerEl) return;

    const renderChart = () => {
      const containerWidth = Math.max(containerEl.clientWidth || 520, 280);
      const isCompare = effectivePropertyFilter === 'compare';
      const height = isCompare && containerWidth < 480 ? 245 : 225;
      const margin = {
        top: 16,
        right: 16,
        bottom: isCompare ? 42 : 30,
        left: 56,
      };
      const innerWidth = containerWidth - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      const svg = d3.select(svgEl);
      svg.selectAll('*').remove();
      svg.attr('viewBox', `0 0 ${containerWidth} ${height}`);

      const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

      const x = d3
        .scaleBand<string>()
        .domain(chartData.map((d) => d.key))
        .range([0, innerWidth])
        .padding(chartData.length <= 2 ? 0.5 : 0.34);

      const getMaxVal = () => {
        if (metric === 'income_vs_expenses') {
          return d3.max(chartData, (d) => Math.max(d.incomeClp, d.expensesClp)) || 100000;
        }
        if (metric === 'net_profit') {
          return d3.max(chartData, (d) => Math.max(d.netProfitClp, 0)) || 100000;
        }
        return d3.max(chartData, (d) => Math.max(d.projectedClp, d.collectedClp)) || 100000;
      };

      const getMinVal = () => {
        if (metric === 'net_profit') {
          const minNet = d3.min(chartData, (d) => d.netProfitClp) ?? 0;
          return minNet < 0 ? minNet * 1.15 : 0;
        }
        return 0;
      };

      const maxVal = Math.max(getMaxVal(), 100000);
      const minVal = getMinVal();

      const y = d3.scaleLinear().domain([minVal, maxVal * 1.12]).nice().range([innerHeight, 0]);

      const yTicks = y.ticks(4);
      g.selectAll('.grid-line')
        .data(yTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => y(d))
        .attr('y2', (d) => y(d))
        .attr('stroke', '#E5E7EB')
        .attr('stroke-dasharray', '3,3');

      const yAxis = d3
        .axisLeft(y)
        .ticks(4)
        .tickFormat((val) => {
          const num = Number(val);
          if (num === 0) return '$0';
          const abs = Math.abs(num);
          const sign = num < 0 ? '-' : '';
          if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1).replace('.0', '')}M`;
          return `${sign}$${Math.round(abs / 1000)}k`;
        });

      g.append('g')
        .call(yAxis)
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('.tick line').remove())
        .selectAll('text')
        .attr('fill', '#6B7280')
        .style('font-family', 'var(--font-mono)')
        .style('font-size', '11px');

      const labelByKey = new Map(chartData.map((d) => [d.key, d.label]));
      const xAxisG = g
        .append('g')
        .attr('transform', `translate(0, ${innerHeight})`)
        .call(
          d3
            .axisBottom(x)
            .tickSize(0)
            .tickFormat((key) => labelByKey.get(key) ?? key)
        )
        .call((axis) => axis.select('.domain').attr('stroke', '#E5E7EB'));

      const xTexts = xAxisG
        .selectAll('text')
        .attr('fill', '#4B5563')
        .style('font-size', isCompare ? '11px' : '12px')
        .style('font-weight', '500');

      if (isCompare && containerWidth < 560) {
        xTexts
          .attr('text-anchor', 'end')
          .attr('dx', '-0.4em')
          .attr('dy', '0.5em')
          .attr('transform', 'rotate(-16)');
      } else {
        xTexts.attr('dy', '12px');
      }

      if (metric === 'income_vs_expenses') {
        const subX = d3
          .scaleBand<'income' | 'expense'>()
          .domain(['income', 'expense'])
          .range([0, x.bandwidth()])
          .padding(0.16);

        g.selectAll('.bar-income')
          .data(chartData)
          .enter()
          .append('rect')
          .attr('x', (d) => (x(d.key) ?? 0) + (subX('income') ?? 0))
          .attr('y', (d) => y(d.incomeClp))
          .attr('width', subX.bandwidth())
          .attr('height', (d) => Math.max(0, y(0) - y(d.incomeClp)))
          .attr('rx', 4)
          .attr('fill', '#14294A')
          .style('cursor', 'pointer')
          .on('mouseenter', (_e, d) => setHoveredDatum(d))
          .on('mouseleave', () => setHoveredDatum(null))
          .on('click', (_e, d) => setHoveredDatum(d));

        g.selectAll('.bar-expense')
          .data(chartData)
          .enter()
          .append('rect')
          .attr('x', (d) => (x(d.key) ?? 0) + (subX('expense') ?? 0))
          .attr('y', (d) => y(d.expensesClp))
          .attr('width', subX.bandwidth())
          .attr('height', (d) => Math.max(0, y(0) - y(d.expensesClp)))
          .attr('rx', 4)
          .attr('fill', '#D97706')
          .style('cursor', 'pointer')
          .on('mouseenter', (_e, d) => setHoveredDatum(d))
          .on('mouseleave', () => setHoveredDatum(null))
          .on('click', (_e, d) => setHoveredDatum(d));
      } else if (metric === 'net_profit') {
        g.selectAll('.bar-net')
          .data(chartData)
          .enter()
          .append('rect')
          .attr('x', (d) => x(d.key) ?? 0)
          .attr('y', (d) => (d.netProfitClp >= 0 ? y(d.netProfitClp) : y(0)))
          .attr('width', x.bandwidth())
          .attr('height', (d) => Math.abs(y(0) - y(d.netProfitClp)))
          .attr('rx', 4)
          .attr('fill', (d) => (d.netProfitClp >= 0 ? '#1B5E3A' : '#B91C1C'))
          .style('cursor', 'pointer')
          .on('mouseenter', (_e, d) => setHoveredDatum(d))
          .on('mouseleave', () => setHoveredDatum(null))
          .on('click', (_e, d) => setHoveredDatum(d));

        if (!isCompare && chartData.length > 1) {
          const lineGen = d3
            .line<ChartDatum>()
            .x((d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
            .y((d) => y(d.netProfitClp))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(chartData)
            .attr('fill', 'none')
            .attr('stroke', '#14294A')
            .attr('stroke-width', 2)
            .attr('d', lineGen);

          g.selectAll('.point-net')
            .data(chartData)
            .enter()
            .append('circle')
            .attr('cx', (d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
            .attr('cy', (d) => y(d.netProfitClp))
            .attr('r', 4)
            .attr('fill', '#FFFFFF')
            .attr('stroke', '#14294A')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', (_e, d) => setHoveredDatum(d))
            .on('mouseleave', () => setHoveredDatum(null))
            .on('click', (_e, d) => setHoveredDatum(d));
        }
      } else {
        // 'projected_vs_collected'
        const currentKey = !isCompare ? chartData[chartData.length - 1]?.key : undefined;

        g.selectAll('.bar-projected')
          .data(chartData)
          .enter()
          .append('rect')
          .attr('x', (d) => x(d.key) ?? 0)
          .attr('y', (d) => y(d.projectedClp))
          .attr('width', x.bandwidth())
          .attr('height', (d) => Math.max(0, y(0) - y(d.projectedClp)))
          .attr('rx', 4)
          .attr('fill', '#E2E8F0')
          .style('cursor', 'pointer')
          .on('mouseenter', (_e, d) => setHoveredDatum(d))
          .on('mouseleave', () => setHoveredDatum(null))
          .on('click', (_e, d) => setHoveredDatum(d));

        g.selectAll('.bar-collected')
          .data(chartData)
          .enter()
          .append('rect')
          .attr('x', (d) => x(d.key) ?? 0)
          .attr('y', (d) => y(d.collectedClp))
          .attr('width', x.bandwidth())
          .attr('height', (d) => Math.max(0, y(0) - y(d.collectedClp)))
          .attr('rx', 4)
          .attr('fill', (d) => (d.key === currentKey ? '#14294A' : '#1B5E3A'))
          .style('cursor', 'pointer')
          .on('mouseenter', (_e, d) => setHoveredDatum(d))
          .on('mouseleave', () => setHoveredDatum(null))
          .on('click', (_e, d) => setHoveredDatum(d));

        if (!isCompare && chartData.length > 1) {
          const lineGen = d3
            .line<ChartDatum>()
            .x((d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
            .y((d) => y(d.collectedClp))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(chartData)
            .attr('fill', 'none')
            .attr('stroke', '#14294A')
            .attr('stroke-width', 2)
            .attr('d', lineGen);

          g.selectAll('.point-collected')
            .data(chartData)
            .enter()
            .append('circle')
            .attr('cx', (d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
            .attr('cy', (d) => y(d.collectedClp))
            .attr('r', 4)
            .attr('fill', '#FFFFFF')
            .attr('stroke', '#14294A')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('mouseenter', (_e, d) => setHoveredDatum(d))
            .on('mouseleave', () => setHoveredDatum(null))
            .on('click', (_e, d) => setHoveredDatum(d));
        }
      }
    };

    renderChart();
    const observer = new ResizeObserver(() => renderChart());
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [chartData, effectivePropertyFilter, metric]);

  const activeDatum = hoveredDatum ?? chartData[chartData.length - 1];

  const handleExportExcel = () => {
    const fileName = exportFinancialReportXlsx({
      rows: reportRows,
      totals: reportTotals,
      propertyFilterLabel,
      metricLabel,
      periodLabel,
      ufValueClp,
      simulatedDate,
    });
    onNotify?.(
      `Planilla Excel ${fileName} descargada (${reportRows.length} fila${reportRows.length === 1 ? '' : 's'}).`
    );
  };

  return (
    <section
      id="resumen-financiero"
      aria-labelledby="resumen-financiero-heading"
      className="space-y-6"
    >
      {aiDiagnosis && <FinancialAiDiagnosisCard controller={aiDiagnosis} />}

      {/* Barra de filtros interactivos en la parte superior de Finanzas */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
            <h2 id="resumen-financiero-heading" className="text-sm font-semibold text-[#111827]">
              Filtros de análisis financiero
            </h2>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#6B7280]">
            UF ref. {formatClp(ufValueClp)}
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-end">
          {/* Filtro de Propiedad */}
          <div className="xl:col-span-3">
            <label
              htmlFor="finanzas-property-filter"
              className="block text-xs font-medium text-[#4B5563] mb-1.5"
            >
              Propiedad
            </label>
            <select
              id="finanzas-property-filter"
              value={effectivePropertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="w-full min-h-[40px] px-3 py-2 text-xs sm:text-sm font-medium text-[#111827] bg-[#F9FAFB] border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A] cursor-pointer"
            >
              <option value="all">Todas (Consolidado)</option>
              <option value="compare">Comparar propiedades entre sí</option>
              <optgroup label="Propiedad específica">
                {properties.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {prop.address} ({prop.commune})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Selector de Métrica */}
          <div className="xl:col-span-5">
            <span className="block text-xs font-medium text-[#4B5563] mb-1.5">
              Métrica en gráficos
            </span>
            <div
              role="group"
              aria-label="Selector de métrica financiera"
              className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-[#F3F4F6] rounded-lg"
            >
              {(
                [
                  { id: 'income_vs_expenses', label: 'Ingresos vs. Gastos' },
                  { id: 'net_profit', label: 'Ganancia Neta' },
                  { id: 'projected_vs_collected', label: 'Proyectado vs. Recaudado' },
                ] as const
              ).map((opt) => {
                const active = metric === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMetric(opt.id)}
                    className={`min-h-[34px] px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-center ${
                      active
                        ? 'bg-white text-[#14294A] shadow-xs font-semibold'
                        : 'text-[#4B5563] hover:text-[#111827]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtro de Período */}
          <div className="xl:col-span-4">
            <span className="block text-xs font-medium text-[#4B5563] mb-1.5">Período</span>
            <div
              role="group"
              aria-label="Filtro de período"
              className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 bg-[#F3F4F6] rounded-lg"
            >
              {(
                [
                  { id: '1m', label: 'Mes actual' },
                  { id: '3m', label: 'Últimos 3 meses' },
                  { id: '6m', label: 'Últimos 6 meses' },
                ] as const
              ).map((opt) => {
                const active = period === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPeriod(opt.id)}
                    className={`min-h-[34px] px-2 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap text-center ${
                      active
                        ? 'bg-white text-[#14294A] shadow-xs font-semibold'
                        : 'text-[#4B5563] hover:text-[#111827]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta principal: KPIs + Anillo D3 de ocupación + Gráfico D3 interactivo */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB]">
        {/* Columna izquierda: Resumen numérico y ocupación */}
        <div className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-[#6B7280]">
                Ingresos acumulados del período ({periodLabel.toLowerCase()})
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-[#14294A] font-mono tabular-nums mt-1">
                {formatClp(occupancyMetrics.periodProjectedTotalClp)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6B7280] font-mono tabular-nums">
                <span>Eq. {formatUf(occupancyMetrics.periodProjectedTotalClp / ufValueClp)}</span>
                <span aria-hidden="true">·</span>
                <span>Base mensual vigente: {formatClp(occupancyMetrics.currentMonthProjectedClp)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5E7EB] grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-[#6B7280]">Resultado Neto período</p>
                <p
                  className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                    reportTotals.resultadoNetoClp >= 0 ? 'text-[#1B5E3A]' : 'text-[#B91C1C]'
                  }`}
                >
                  {formatClp(reportTotals.resultadoNetoClp)}
                </p>
                <p className="text-xs text-[#6B7280] tabular-nums">
                  {occupancyMetrics.collectionRatePct}% canon recaudado
                </p>
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Gastos Mantención (Dueño)</p>
                <p className="text-base font-semibold text-[#B45309] font-mono tabular-nums mt-0.5">
                  {formatClp(reportTotals.gastosMantencionClp)}
                </p>
                <p className="text-xs text-[#6B7280] font-mono tabular-nums">
                  Multas: {formatClp(reportTotals.multasClp)}
                </p>
              </div>
            </div>
          </div>

          {/* Anillo D3 de ocupación */}
          <div className="pt-4 border-t border-[#E5E7EB] flex items-center gap-4">
            <svg
              ref={donutSvgRef}
              className="w-28 h-28 shrink-0"
              role="img"
              aria-label={`Porcentaje de ocupación: ${occupancyMetrics.occupancyPct}%`}
            />
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold text-[#111827]">Ocupación de cartera</p>
              <p className="text-xs text-[#4B5563] tabular-nums">
                {occupancyMetrics.occupiedCount} de {occupancyMetrics.totalCount} propiedades
                arrendadas
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4B5563] pt-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#1B5E3A] inline-block" />
                  <span>Ocupadas ({occupancyMetrics.occupiedCount})</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#DBEAFE] border border-[#93C5FD] inline-block" />
                  <span>Disponibles ({occupancyMetrics.availableCount})</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha: Gráfico D3 según filtro y métrica */}
        <div className="lg:col-span-7 p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                {metricLabel} ·{' '}
                {effectivePropertyFilter === 'compare'
                  ? `Comparativa por propiedad (${periodLabel})`
                  : `${propertyFilterLabel} (${periodLabel})`}
              </h3>
              <p className="text-xs text-[#6B7280] mt-0.5">
                {metric === 'income_vs_expenses' &&
                  'Canon vigente + multas frente a gastos de mantención asumidos por el propietario'}
                {metric === 'net_profit' &&
                  'Resultado neto descontando mantenciones pagadas por el propietario'}
                {metric === 'projected_vs_collected' &&
                  'Canon vigente proyectado frente a pagos confirmados al día'}
              </p>
            </div>

            {activeDatum && (
              <div className="text-right text-xs tabular-nums">
                <p className="font-medium text-[#111827]">
                  {activeDatum.subLabel || activeDatum.label}
                </p>
                {metric === 'income_vs_expenses' && (
                  <p className="text-[#4B5563] font-mono">
                    Ing. {formatClp(activeDatum.incomeClp)} · Gtos.{' '}
                    {formatClp(activeDatum.expensesClp)}
                  </p>
                )}
                {metric === 'net_profit' && (
                  <p className="text-[#1B5E3A] font-semibold font-mono">
                    Neto: {formatClp(activeDatum.netProfitClp)}
                  </p>
                )}
                {metric === 'projected_vs_collected' && (
                  <p className="text-[#4B5563] font-mono">
                    {formatClp(activeDatum.collectedClp)} / {formatClp(activeDatum.projectedClp)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div ref={chartContainerRef} className="w-full min-h-[225px]">
            <svg
              ref={chartSvgRef}
              className="w-full h-[225px] overflow-visible"
              role="img"
              aria-label={`Gráfico D3 de ${metricLabel} para ${propertyFilterLabel}`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#E5E7EB] text-xs text-[#6B7280]">
            <div className="flex flex-wrap items-center gap-4">
              {metric === 'income_vs_expenses' && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#14294A] inline-block" />
                    <span>Ingresos (Canon + Multas)</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706] inline-block" />
                    <span>Gastos Mantención (Propietario)</span>
                  </span>
                </>
              )}
              {metric === 'net_profit' && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#1B5E3A] inline-block" />
                    <span>Resultado Neto Positivo</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#B91C1C] inline-block" />
                    <span>Déficit del período</span>
                  </span>
                </>
              )}
              {metric === 'projected_vs_collected' && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#E2E8F0] inline-block" />
                    <span>Proyectado</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#1B5E3A] inline-block" />
                    <span>Recaudado</span>
                  </span>
                </>
              )}
            </div>
            <span>Pasa el cursor o toca una barra para inspeccionar</span>
          </div>
        </div>
      </div>

      {/* Sección Reporte Mensual Consolidado + Exportación Excel (.xlsx) */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-[#111827]">
              Reporte Mensual Consolidado
            </h3>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-0.5">
              {propertyFilterLabel} · {periodLabel} · {reportRows.length} registro
              {reportRows.length === 1 ? '' : 's'} (los Gastos Comunes y la Garantía Fija no se
              suman al ingreso por arriendo).
            </p>
          </div>

          <button
            type="button"
            disabled={reportRows.length === 0}
            onClick={handleExportExcel}
            className="inline-flex items-center justify-center gap-2 min-h-[42px] px-4 py-2 bg-[#1B5E3A] hover:bg-[#154B2E] disabled:opacity-50 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Descargar Planilla Excel (.xlsx)</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563]">
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap">Mes</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap">Propiedad</th>
                <th className="py-3 px-3.5 font-semibold whitespace-nowrap">Estado</th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  Canon Base
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  Monto Vigente (con IPC)
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  Multas por Atraso
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  Gastos de Mantención (Propietario)
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  Resultado Neto
                </th>
                <th className="py-3 px-3.5 font-semibold text-right whitespace-nowrap">
                  Gastos Comunes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] bg-white">
              {reportRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 px-4 text-center text-sm text-[#6B7280]">
                    No hay registros financieros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                reportRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAFAFB]">
                    <td className="py-2.5 px-3.5 font-medium text-[#111827] whitespace-nowrap">
                      {row.monthLabel}
                    </td>
                    <td className="py-2.5 px-3.5 text-[#111827] min-w-[200px]">
                      {row.propertyLabel}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          row.statusLabel === 'Moroso'
                            ? 'bg-[#FEF2F2] text-[#B91C1C]'
                            : row.statusLabel === 'En Mantención'
                              ? 'bg-[#FFFBEB] text-[#B45309]'
                              : row.statusLabel === 'Disponible'
                                ? 'bg-[#EFF6FF] text-[#1E40AF]'
                                : 'bg-[#EEF6F1] text-[#1B5E3A]'
                        }`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-[#4B5563] whitespace-nowrap">
                      {formatClp(row.canonBaseClp)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums font-semibold text-[#111827] whitespace-nowrap">
                      {formatClp(row.montoVigenteClp)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-[#991B1B] whitespace-nowrap">
                      {row.multasClp > 0 ? `+${formatClp(row.multasClp)}` : formatClp(0)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-[#B45309] whitespace-nowrap">
                      {row.gastosMantencionClp > 0
                        ? `-${formatClp(row.gastosMantencionClp)}`
                        : formatClp(0)}
                    </td>
                    <td
                      className={`py-2.5 px-3.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                        row.resultadoNetoClp >= 0 ? 'text-[#1B5E3A]' : 'text-[#B91C1C]'
                      }`}
                    >
                      {formatClp(row.resultadoNetoClp)}
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-mono tabular-nums text-[#4B5563] whitespace-nowrap">
                      {row.gastosComunesClp > 0 ? formatClp(row.gastosComunesClp) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {reportRows.length > 0 && (
              <tfoot>
                <tr className="bg-[#F9FAFB] border-t-2 border-[#D1D5DB] font-bold">
                  <td colSpan={3} className="py-3 px-3.5 text-[#111827] whitespace-nowrap">
                    TOTALES ({reportRows.length} fila{reportRows.length === 1 ? '' : 's'})
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono tabular-nums text-[#4B5563] whitespace-nowrap">
                    {formatClp(reportTotals.canonBaseClp)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono tabular-nums text-[#111827] whitespace-nowrap">
                    {formatClp(reportTotals.montoVigenteClp)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono tabular-nums text-[#991B1B] whitespace-nowrap">
                    {formatClp(reportTotals.multasClp)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono tabular-nums text-[#B45309] whitespace-nowrap">
                    {formatClp(reportTotals.gastosMantencionClp)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono tabular-nums text-[#14294A] whitespace-nowrap">
                    {formatClp(reportTotals.resultadoNetoClp)}
                  </td>
                  <td className="py-3 px-3.5 text-right font-mono tabular-nums text-[#4B5563] whitespace-nowrap">
                    {formatClp(reportTotals.gastosComunesClp)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <IndicatorsSourceNotice
        ufValueClp={ufValueClp}
        latestIpcPercent={latestIpcPercent}
      />
    </section>
  );
}
