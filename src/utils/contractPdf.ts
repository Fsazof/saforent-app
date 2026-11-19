import { Property } from '../types/saforent';
import {
  formatClp,
  formatDailyLateFeeLabel,
  formatGuaranteeLabel,
  formatSpanishDate,
  formatUf,
} from './formatters';

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

export function dataUrlToPdfBlobUrl(dataUrl: string): string | null {
  try {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return null;
    const base64 = dataUrl.slice(commaIdx + 1);
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function buildContractPdfBlobUrl(property: Property, ufValueClp: number): string {
  if (property.signedContractDataUrl) {
    const converted = dataUrlToPdfBlobUrl(property.signedContractDataUrl);
    if (converted) return converted;
  }

  const baseAmount = property.baseRentAmount ?? property.rentAmount;
  const baseRentLabel =
    property.currency === 'CLP' ? formatClp(baseAmount) : formatUf(baseAmount);
  const rentLabel =
    property.currency === 'CLP'
      ? formatClp(property.rentAmount)
      : formatUf(property.rentAmount);
  const guarantee = formatGuaranteeLabel(property, ufValueClp);
  const lateFee = formatDailyLateFeeLabel(property, ufValueClp);

  const lines: string[] = [
    'SAFORENT APP - RESPALDO LEGAL DE CONTRATO DE ARRIENDO',
    '====================================================================',
    `Archivo registrado: ${property.signedContractFileName || 'contrato_arriendo_firmado.pdf'}`,
    `Propiedad: ${property.address}, ${property.commune}`,
    `Rol SII: ${property.rolSii} | CBRS: Foja ${property.cbrsFoja} N° ${property.cbrsNumero} (${property.cbrsConservador})`,
    '--------------------------------------------------------------------',
    `Arrendador (Propietario): ${property.ownerName}`,
    `Arrendatario: ${property.tenantName}`,
    `Contacto Arrendatario: ${property.tenantEmail || 'No informado'} | ${property.tenantPhone || 'Sin teléfono'}`,
    '--------------------------------------------------------------------',
    `Canon Base del Contrato (fijo): ${baseRentLabel}`,
    `Monto Vigente a Pagar: ${rentLabel}`,
    `Garantía Fija en resguardo: ${guarantee.primary} (${guarantee.secondary})`,
    `Multa diaria por atraso: ${lateFee.primary} (${lateFee.secondary})`,
    `Día de pago mensual: Día ${property.paymentDay} de cada mes`,
    `Periodicidad reajuste IPC: ${property.ipcClause}`,
    `Vigencia del contrato: ${formatSpanishDate(property.contractStart)} al ${formatSpanishDate(property.contractEnd)}`,
    '--------------------------------------------------------------------',
    `Notas: ${(property.contractNotes || 'Contrato firmado ante notario y custodiado en Saforent APP.').slice(0, 88)}`,
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
  return URL.createObjectURL(blob);
}
