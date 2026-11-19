import { CommonExpenseRecord } from '../types/saforent';
import { dataUrlToPdfBlobUrl } from './contractPdf';
import { formatClp, formatSpanishDate } from './formatters';

function escapePdfText(input: string): string {
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function toWinAnsiBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code >= 0x20 && code <= 0xff) {
      bytes.push(code);
    } else if (code === 0x2013 || code === 0x2014) {
      bytes.push(0x2d);
    } else {
      bytes.push(0x3f);
    }
  }
  return bytes;
}

function stringToAsciiBytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i += 1) {
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return bytes;
}

export interface CommonExpenseSlipPreview {
  url: string;
  kind: 'image' | 'pdf';
  revokeOnCleanup: boolean;
}

export function buildCommonExpenseSlipPreview(
  expense: CommonExpenseRecord,
  address: string,
  commune: string
): CommonExpenseSlipPreview {
  if (expense.billDataUrl) {
    if (expense.billDataUrl.startsWith('data:image/')) {
      return { url: expense.billDataUrl, kind: 'image', revokeOnCleanup: false };
    }
    if (expense.billDataUrl.startsWith('data:application/pdf')) {
      const converted = dataUrlToPdfBlobUrl(expense.billDataUrl);
      if (converted) {
        return { url: converted, kind: 'pdf', revokeOnCleanup: true };
      }
    }
  }

  const statusLabels: Record<CommonExpenseRecord['status'], string> = {
    pendiente: 'Pendiente de pago',
    en_revision: 'Comprobante en revision',
    pagado: 'Pagado',
    atrasado: 'Atrasado (fuera de plazo)',
  };

  // Nota: por privacidad estricta nunca incluye Rol SII ni datos registrales CBRS
  const lines: string[] = [
    'SAFORENT APP - COLILLA DE GASTOS COMUNES',
    '====================================================================',
    `Archivo adjunto: ${expense.billFileName}`,
    `Propiedad: ${address}, ${commune}`,
    `Periodo cobrado: ${expense.periodLabel}`,
    '--------------------------------------------------------------------',
    `Monto exacto del mes: ${formatClp(expense.amountClp)}`,
    `Fecha limite de pago: ${formatSpanishDate(expense.dueDate)}`,
    `Estado actual: ${statusLabels[expense.status]}`,
    '--------------------------------------------------------------------',
    expense.receiptFileName
      ? `Comprobante arrendatario: ${expense.receiptFileName} (${expense.receiptReferenceCode || 'Sin ref.'})`
      : 'Comprobante arrendatario: Aun no registrado.',
    'Documento emitido por administracion de edificio/condominio para respaldo.',
  ];

  const streamOps: string[] = ['BT', '/F1 11 Tf', '50 760 Td', '16 TL'];
  lines.forEach((line, idx) => {
    const escaped = escapePdfText(line);
    if (idx === 0) {
      streamOps.push('/F2 13 Tf', `(${escaped}) Tj`, '/F1 10 Tf');
    } else {
      streamOps.push(`T* (${escaped}) Tj`);
    }
  });
  streamOps.push('ET');

  const streamBytes = toWinAnsiBytes(streamOps.join('\n'));
  const objects: number[][] = [];
  objects.push(stringToAsciiBytes('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'));
  objects.push(stringToAsciiBytes('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'));
  objects.push(
    stringToAsciiBytes(
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n'
    )
  );
  objects.push([
    ...stringToAsciiBytes(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`),
    ...streamBytes,
    ...stringToAsciiBytes('\nendstream\nendobj\n'),
  ]);
  objects.push(
    stringToAsciiBytes(
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n'
    )
  );
  objects.push(
    stringToAsciiBytes(
      '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n'
    )
  );

  const chunks: number[] = [...stringToAsciiBytes('%PDF-1.4\n')];
  const offsets: number[] = [0];

  objects.forEach((objBytes) => {
    offsets.push(chunks.length);
    chunks.push(...objBytes);
  });

  const xrefOffset = chunks.length;
  chunks.push(...stringToAsciiBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`));
  for (let i = 1; i <= objects.length; i += 1) {
    const padOffset = String(offsets[i]).padStart(10, '0');
    chunks.push(...stringToAsciiBytes(`${padOffset} 00000 n \n`));
  }
  chunks.push(
    ...stringToAsciiBytes(
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
    )
  );

  const pdfBytes = new Uint8Array(chunks);
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  return {
    url: URL.createObjectURL(blob),
    kind: 'pdf',
    revokeOnCleanup: true,
  };
}
