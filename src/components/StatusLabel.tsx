import { AlertTriangle, CheckCircle2, Clock, Home, Wrench } from 'lucide-react';
import { PaymentMonthStatus, PropertyStatus } from '../types/saforent';

export function PropertyStatusLabel({ status }: { status: PropertyStatus }) {
  switch (status) {
    case 'Disponible':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#EFF6FF] border border-[#DBEAFE] text-xs font-medium text-[#1E40AF] whitespace-nowrap">
          <Home className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Disponible</span>
        </span>
      );
    case 'Activo':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1B5E3A] whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Activo</span>
        </span>
      );
    case 'Moroso':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#B91C1C] whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Moroso</span>
        </span>
      );
    case 'En Mantención':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#B45309] whitespace-nowrap">
          <Wrench className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>En Mantención</span>
        </span>
      );
  }
}

export function PaymentStatusLabel({ status }: { status: PaymentMonthStatus }) {
  switch (status) {
    case 'al_dia':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1B5E3A] whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Pagado al día</span>
        </span>
      );
    case 'en_revision':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#14294A] whitespace-nowrap">
          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Comprobante en revisión</span>
        </span>
      );
    case 'pendiente':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#B45309] whitespace-nowrap">
          <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Pago pendiente</span>
        </span>
      );
    case 'atrasado':
      return (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[#B91C1C] whitespace-nowrap">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Pago atrasado</span>
        </span>
      );
  }
}
