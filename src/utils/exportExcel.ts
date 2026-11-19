import * as XLSX from 'xlsx';

export interface FinancialReportRow {
  id: string;
  monthKey: string;
  monthLabel: string;
  propertyId: string;
  propertyLabel: string;
  commune: string;
  statusLabel: string;
  canonBaseClp: number;
  montoVigenteClp: number;
  recaudadoClp: number;
  multasClp: number;
  gastosMantencionClp: number;
  resultadoNetoClp: number;
  gastosComunesClp: number;
}

export interface FinancialReportTotals {
  canonBaseClp: number;
  montoVigenteClp: number;
  recaudadoClp: number;
  multasClp: number;
  gastosMantencionClp: number;
  resultadoNetoClp: number;
  gastosComunesClp: number;
}

export interface ExportFinancialExcelParams {
  rows: FinancialReportRow[];
  totals: FinancialReportTotals;
  propertyFilterLabel: string;
  metricLabel: string;
  periodLabel: string;
  ufValueClp: number;
  simulatedDate: string;
}

export function exportFinancialReportXlsx({
  rows,
  totals,
  propertyFilterLabel,
  metricLabel,
  periodLabel,
  ufValueClp,
  simulatedDate,
}: ExportFinancialExcelParams): string {
  const headerRowIndex = 5;
  const headers = [
    'Mes',
    'Propiedad',
    'Estado',
    'Canon Base (CLP)',
    'Monto Vigente (con IPC) (CLP)',
    'Multas por Atraso (CLP)',
    'Gastos de Mantención (Propietario) (CLP)',
    'Resultado Neto (CLP)',
    'Gastos Comunes (CLP)',
  ];

  const dataRows = rows.map((row) => [
    row.monthLabel,
    row.propertyLabel,
    row.statusLabel,
    row.canonBaseClp,
    row.montoVigenteClp,
    row.multasClp,
    row.gastosMantencionClp,
    row.resultadoNetoClp,
    row.gastosComunesClp,
  ]);

  const totalsRow = [
    'TOTALES',
    `${rows.length} registro${rows.length === 1 ? '' : 's'}`,
    '',
    totals.canonBaseClp,
    totals.montoVigenteClp,
    totals.multasClp,
    totals.gastosMantencionClp,
    totals.resultadoNetoClp,
    totals.gastosComunesClp,
  ];

  const sheetData: (string | number)[][] = [
    ['SAFORENT APP — REPORTE MENSUAL CONSOLIDADO'],
    ['Propiedad / Vista:', propertyFilterLabel, '', 'Período:', periodLabel],
    ['Métrica en gráficos:', metricLabel, '', 'UF Referencia (CLP):', ufValueClp],
    ['Fecha de corte:', simulatedDate],
    [],
    headers,
    ...dataRows,
    totalsRow,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  // Formato moneda CLP en la celda de UF de referencia y en las columnas numéricas (D..I)
  const ufCellRef = XLSX.utils.encode_cell({ r: 2, c: 4 });
  if (worksheet[ufCellRef]) {
    worksheet[ufCellRef].z = '"$"#,##0';
  }

  const firstDataRow = headerRowIndex + 1;
  const totalsRowIndex = firstDataRow + dataRows.length;
  for (let r = firstDataRow; r <= totalsRowIndex; r += 1) {
    for (let c = 3; c <= 8; c += 1) {
      const cellRef = XLSX.utils.encode_cell({ r, c });
      if (worksheet[cellRef] && typeof worksheet[cellRef].v === 'number') {
        worksheet[cellRef].z = '"$"#,##0';
      }
    }
  }

  // Ajuste automático de ancho de columnas según contenido y encabezados
  const minWidths = [16, 34, 18, 18, 28, 22, 34, 22, 22];
  worksheet['!cols'] = headers.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = firstDataRow; r <= totalsRowIndex; r += 1) {
      const val = sheetData[r]?.[colIdx];
      if (val !== undefined && val !== null) {
        const strLen = typeof val === 'number' ? `$${val.toLocaleString('es-CL')}`.length + 2 : String(val).length;
        if (strLen > maxLen) maxLen = strLen;
      }
    }
    return { wch: Math.max(minWidths[colIdx] ?? 16, Math.min(maxLen + 4, 46)) };
  });

  // Combinar celda del título principal
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Mensual');

  const safeDate = simulatedDate || new Date().toISOString().slice(0, 10);
  const fileName = `saforent_reporte_financiero_${safeDate}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  return fileName;
}
