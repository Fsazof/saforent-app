export type UserRole = 'owner' | 'tenant';

export type PropertyStatus = 'Disponible' | 'Activo' | 'Moroso' | 'En Mantención';

export type CurrencyType = 'CLP' | 'UF';

export type PaymentMonthStatus = 'al_dia' | 'pendiente' | 'en_revision' | 'atrasado';

export type AlertType = 'morosidad' | 'comprobante' | 'averia' | 'ipc' | 'gasto_comun';

export type ExpenseResponsibility = 'arrendatario' | 'propietario';

export type CommonExpenseStatus = 'pendiente' | 'en_revision' | 'pagado' | 'atrasado';

export type IpcFrequency =
  | 'Mensual'
  | 'Trimestral'
  | 'Semestral'
  | 'Anual'
  | 'Reajuste directo en UF';

export type IndicatorSource = 'respaldo_local';

export interface IpcMonthlyPoint {
  date: string;
  value: number;
}

export interface UserSession {
  role: UserRole;
  name: string;
  email: string;
  linkedPropertyId?: string;
}

export interface Property {
  id: string;
  address: string;
  commune: string;
  rolSii: string;
  cbrsFoja: string;
  cbrsNumero: string;
  cbrsAnio?: string;
  cbrsConservador: string;
  ownerName: string;
  tenantName: string;
  tenantEmail: string;
  tenantPhone: string;
  currency: CurrencyType;
  baseRentAmount?: number;
  rentAmount: number;
  paymentDay: number;
  nextPaymentDate: string;
  paymentStatus: PaymentMonthStatus;
  status: PropertyStatus;
  ipcClause: IpcFrequency;
  nextIpcDate: string;
  pendingIpcPercent: number | null;
  lastIpcAppliedDate?: string;
  lastIpcAppliedPercent?: number;
  contractStart: string;
  contractEnd: string;
  guaranteeMonths: number;
  guaranteeCurrency?: CurrencyType;
  guaranteeAmount?: number;
  lateFeeCurrency?: CurrencyType;
  lateFeeDailyAmount?: number;
  paysCommonExpenses?: boolean;
  commonExpenseReferenceClp?: number;
  contractNotes: string;
  signedContractFileName?: string;
  signedContractDataUrl?: string;
  signedContractUploadedAt?: string;
}

export type TenantPropertyView = Omit<
  Property,
  | 'rolSii'
  | 'cbrsFoja'
  | 'cbrsNumero'
  | 'cbrsAnio'
  | 'cbrsConservador'
  | 'signedContractFileName'
  | 'signedContractDataUrl'
  | 'signedContractUploadedAt'
>;

export interface UrgentAlert {
  id: string;
  propertyId: string;
  type: AlertType;
  title: string;
  description: string;
  createdAt: string;
  severity: 'alta' | 'media';
  relatedRecordId?: string;
  ipcPercent?: number;
  autoApplied?: boolean;
  resolvedByTenant?: boolean;
}

export interface PaymentReceipt {
  id: string;
  propertyId: string;
  periodLabel: string;
  amount: number;
  currency: CurrencyType;
  amountClpEquivalent: number;
  lateFeeClp?: number;
  method: string;
  referenceCode: string;
  fileName: string;
  fileDataUrl?: string;
  submittedAt: string;
  status: 'en_revision' | 'aprobado' | 'rechazado';
}

export interface MaintenanceReport {
  id: string;
  propertyId: string;
  category: string;
  urgency: 'Alta' | 'Media';
  responsibility?: ExpenseResponsibility;
  description: string;
  photoName?: string;
  reportedAt: string;
  status: 'pendiente' | 'en_curso' | 'resuelta';
  resolvedAt?: string;
}

export interface MaintenanceExpenseRecord {
  id: string;
  propertyId: string;
  maintenanceReportId?: string;
  date: string;
  itemDetail: string;
  paidBy: 'Propietario' | 'Arrendatario';
  amountClp: number;
  receiptFileName: string;
}

export interface CommonExpenseRecord {
  id: string;
  propertyId: string;
  periodLabel: string;
  amountClp: number;
  dueDate: string;
  billFileName: string;
  billDataUrl?: string;
  createdAt: string;
  status: CommonExpenseStatus;
  receiptFileName?: string;
  receiptDataUrl?: string;
  receiptReferenceCode?: string;
  receiptMethod?: string;
  receiptSubmittedAt?: string;
  paidAt?: string;
}

export interface PendingOwnerNotification {
  id: string;
  title: string;
  body: string;
  tag: string;
  createdAt: string;
}

export interface SaforentState {
  session: UserSession | null;
  ufValueClp: number;
  ufUpdatedDate?: string;
  indicatorSource?: IndicatorSource;
  ipcMonthlyHistory?: IpcMonthlyPoint[];
  simulatedDate?: string;
  properties: Property[];
  alerts: UrgentAlert[];
  receipts: PaymentReceipt[];
  maintenanceReports: MaintenanceReport[];
  maintenanceExpenses: MaintenanceExpenseRecord[];
  commonExpenses: CommonExpenseRecord[];
  pendingOwnerNotifications?: PendingOwnerNotification[];
}
