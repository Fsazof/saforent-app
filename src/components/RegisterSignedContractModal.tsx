import { ChangeEvent, FormEvent, useState } from 'react';
import { FileCheck2, FileText, Upload, X } from 'lucide-react';
import { RegisterSignedContractInput } from '../hooks/useSaforentStore';
import { CurrencyType, IpcFrequency, Property } from '../types/saforent';
import { formatClp, formatUf, toClp, toUf } from '../utils/formatters';

interface RegisterSignedContractModalProps {
  property: Property;
  ufValueClp: number;
  onClose: () => void;
  onSubmit: (propertyId: string, data: RegisterSignedContractInput) => void;
}

export function RegisterSignedContractModal({
  property,
  ufValueClp,
  onClose,
  onSubmit,
}: RegisterSignedContractModalProps) {
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>(property.currency);
  const [rentAmountStr, setRentAmountStr] = useState(String(property.rentAmount));
  const [paymentDay, setPaymentDay] = useState(String(property.paymentDay));
  const [ipcClause, setIpcClause] = useState<IpcFrequency>(property.ipcClause);
  const [guaranteeCurrency, setGuaranteeCurrency] = useState<CurrencyType>(
    property.guaranteeCurrency ?? property.currency
  );
  const [guaranteeAmountStr, setGuaranteeAmountStr] = useState(
    String(
      property.guaranteeAmount ??
        Number((property.rentAmount * (property.guaranteeMonths || 1)).toFixed(2))
    )
  );
  const [lateFeeCurrency, setLateFeeCurrency] = useState<CurrencyType>(
    property.lateFeeCurrency ?? 'CLP'
  );
  const [lateFeeAmountStr, setLateFeeAmountStr] = useState(
    String(
      property.lateFeeDailyAmount ?? (property.lateFeeCurrency === 'UF' ? 0.1 : 4000)
    )
  );
  const [paysCommonExpenses, setPaysCommonExpenses] = useState(
    property.paysCommonExpenses ?? true
  );
  const [commonExpenseRefStr, setCommonExpenseRefStr] = useState(
    String(property.commonExpenseReferenceClp ?? 90000)
  );
  const [signedContractFileName, setSignedContractFileName] = useState('');
  const [signedContractDataUrl, setSignedContractDataUrl] = useState<string | undefined>(
    undefined
  );
  const [contractNotes, setContractNotes] = useState(property.contractNotes || '');
  const [error, setError] = useState('');

  const parsedAmount = Number(rentAmountStr) || 0;
  const parsedLateFee = Number(lateFeeAmountStr);
  const safeLateFee = Number.isFinite(parsedLateFee) && parsedLateFee >= 0 ? parsedLateFee : 0;
  const parsedGuarantee = Number(guaranteeAmountStr);
  const safeGuarantee = Number.isFinite(parsedGuarantee) && parsedGuarantee >= 0 ? parsedGuarantee : 0;

  const equivText =
    parsedAmount > 0
      ? currency === 'CLP'
        ? `Equivalente aprox.: ${formatUf(toUf(parsedAmount, 'CLP', ufValueClp))}`
        : `Equivalente aprox.: ${formatClp(toClp(parsedAmount, 'UF', ufValueClp))}`
      : 'Ingresa un monto válido';

  const lateFeeEquivText =
    safeLateFee > 0
      ? lateFeeCurrency === 'CLP'
        ? `Equivalente aprox.: ${formatUf(toUf(safeLateFee, 'CLP', ufValueClp))} diarios`
        : `Equivalente aprox.: ${formatClp(toClp(safeLateFee, 'UF', ufValueClp))} diarios`
      : 'Sin multa diaria';

  const guaranteeEquivText =
    safeGuarantee > 0
      ? guaranteeCurrency === 'CLP'
        ? `Equivalente aprox.: ${formatUf(toUf(safeGuarantee, 'CLP', ufValueClp))}`
        : `Equivalente aprox.: ${formatClp(toClp(safeGuarantee, 'UF', ufValueClp))}`
      : 'Sin garantía fija definida';

  const handleCurrencyChange = (next: CurrencyType) => {
    if (next === currency) return;
    if (parsedAmount > 0) {
      if (next === 'UF') {
        setRentAmountStr(String(toUf(parsedAmount, 'CLP', ufValueClp)));
      } else {
        setRentAmountStr(String(toClp(parsedAmount, 'UF', ufValueClp)));
      }
    }
    setCurrency(next);
  };

  const handleLateFeeCurrencyChange = (next: CurrencyType) => {
    if (next === lateFeeCurrency) return;
    if (next === 'UF') {
      setLateFeeAmountStr(
        lateFeeAmountStr === '4000' || safeLateFee <= 0
          ? '0.1'
          : String(toUf(safeLateFee, 'CLP', ufValueClp))
      );
    } else {
      setLateFeeAmountStr(
        lateFeeAmountStr === '0.1' || safeLateFee <= 0
          ? '4000'
          : String(toClp(safeLateFee, 'UF', ufValueClp))
      );
    }
    setLateFeeCurrency(next);
  };

  const handleGuaranteeCurrencyChange = (next: CurrencyType) => {
    if (next === guaranteeCurrency) return;
    if (safeGuarantee > 0) {
      if (next === 'UF') {
        setGuaranteeAmountStr(String(toUf(safeGuarantee, 'CLP', ufValueClp)));
      } else {
        setGuaranteeAmountStr(String(toClp(safeGuarantee, 'UF', ufValueClp)));
      }
    }
    setGuaranteeCurrency(next);
  };

  const handleCopyOneMonthRent = () => {
    setGuaranteeCurrency(currency);
    setGuaranteeAmountStr(rentAmountStr || '0');
  };

  const handlePdfChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSignedContractFileName(file.name);
    setError('');

    if (file.size <= 2 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setSignedContractDataUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } else {
      setSignedContractDataUrl(undefined);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) {
      setError('Ingresa el nombre del arrendatario que firmó el contrato.');
      return;
    }
    if (parsedAmount <= 0) {
      setError('El monto mensual del arriendo debe ser mayor a cero.');
      return;
    }
    if (parsedLateFee < 0 || Number.isNaN(parsedLateFee)) {
      setError('La multa diaria por atraso no puede ser negativa.');
      return;
    }
    if (parsedGuarantee < 0 || Number.isNaN(parsedGuarantee)) {
      setError('La Garantía Fija no puede ser negativa.');
      return;
    }
    const parsedCommonExpRef = Number(commonExpenseRefStr);
    if (paysCommonExpenses && (Number.isNaN(parsedCommonExpRef) || parsedCommonExpRef < 0)) {
      setError('El monto referencial de Gastos Comunes no puede ser negativo.');
      return;
    }
    if (!signedContractFileName.trim()) {
      setError('Adjunta el archivo PDF del contrato firmado ante notario.');
      return;
    }
    setError('');
    onSubmit(property.id, {
      tenantName,
      tenantEmail,
      tenantPhone,
      currency,
      rentAmount: parsedAmount,
      paymentDay: Math.min(28, Math.max(1, Number(paymentDay) || 5)),
      ipcClause,
      guaranteeCurrency,
      guaranteeAmount: safeGuarantee,
      lateFeeCurrency,
      lateFeeDailyAmount: safeLateFee,
      paysCommonExpenses,
      commonExpenseReferenceClp: paysCommonExpenses ? Math.round(parsedCommonExpRef || 0) : 0,
      signedContractFileName,
      signedContractDataUrl,
      contractNotes,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="register-contract-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[600px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-[#1B5E3A]" aria-hidden="true" />
            <h2 id="register-contract-title" className="text-lg font-semibold text-[#111827]">
              Registrar Contrato Firmado
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3.5 text-sm">
            <p className="font-medium text-[#111827]">
              {property.address} · {property.commune}
            </p>
            <p className="text-xs text-[#6B7280] font-mono tabular-nums mt-0.5">
              Rol SII: {property.rolSii} · Al guardar pasará automáticamente a estado &quot;Activo&quot;
            </p>
          </div>

          <div>
            <label htmlFor="contract-tenant-name" className="block text-sm font-medium text-[#374151] mb-1">
              Nombre completo / Razón social del arrendatario
            </label>
            <input
              id="contract-tenant-name"
              type="text"
              required
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Ej. Sebastián Morales"
              className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A] focus:ring-1 focus:ring-[#14294A]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="contract-tenant-email" className="block text-xs font-medium text-[#4B5563] mb-1">
                Correo electrónico (opcional)
              </label>
              <input
                id="contract-tenant-email"
                type="email"
                value={tenantEmail}
                onChange={(e) => setTenantEmail(e.target.value)}
                placeholder="nombre@correo.cl"
                className="w-full min-h-[40px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
              />
            </div>

            <div>
              <label htmlFor="contract-tenant-phone" className="block text-xs font-medium text-[#4B5563] mb-1">
                Teléfono (opcional)
              </label>
              <input
                id="contract-tenant-phone"
                type="tel"
                value={tenantPhone}
                onChange={(e) => setTenantPhone(e.target.value)}
                placeholder="+56 9 8123 4567"
                className="w-full min-h-[40px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E5E7EB]">
            <div>
              <span className="block text-xs font-medium text-[#4B5563] mb-1">
                Monto mensual pactado
              </span>
              <div className="flex gap-2">
                <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('CLP')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      currency === 'CLP' ? 'bg-white text-[#14294A] shadow-xs' : 'text-[#4B5563]'
                    }`}
                  >
                    CLP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCurrencyChange('UF')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      currency === 'UF' ? 'bg-white text-[#14294A] shadow-xs' : 'text-[#4B5563]'
                    }`}
                  >
                    UF
                  </button>
                </div>
                <input
                  aria-label="Monto mensual pactado"
                  type="number"
                  step={currency === 'UF' ? '0.1' : '1000'}
                  min="1"
                  required
                  value={rentAmountStr}
                  onChange={(e) => setRentAmountStr(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
              <p className="text-xs text-[#6B7280] mt-1 tabular-nums">{equivText}</p>
            </div>

            <div>
              <label htmlFor="contract-day" className="block text-xs font-medium text-[#4B5563] mb-1">
                Día de pago mensual
              </label>
              <input
                id="contract-day"
                type="number"
                min={1}
                max={28}
                required
                value={paymentDay}
                onChange={(e) => setPaymentDay(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="contract-ipc" className="block text-xs font-medium text-[#4B5563] mb-1">
                Periodicidad de reajuste IPC
              </label>
              <select
                id="contract-ipc"
                value={ipcClause}
                onChange={(e) => setIpcClause(e.target.value as IpcFrequency)}
                className="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
              >
                <option value="Mensual">Mensual por IPC</option>
                <option value="Trimestral">Trimestral por IPC</option>
                <option value="Semestral">Semestral por IPC</option>
                <option value="Anual">Anual por IPC</option>
                <option value="Reajuste directo en UF">Reajuste directo en UF</option>
              </select>
            </div>

            <div>
              <span className="block text-xs font-medium text-[#4B5563] mb-1">
                Multa diaria por atraso
              </span>
              <div className="flex gap-2">
                <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => handleLateFeeCurrencyChange('CLP')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      lateFeeCurrency === 'CLP'
                        ? 'bg-white text-[#14294A] shadow-xs'
                        : 'text-[#4B5563]'
                    }`}
                  >
                    CLP
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLateFeeCurrencyChange('UF')}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      lateFeeCurrency === 'UF'
                        ? 'bg-white text-[#14294A] shadow-xs'
                        : 'text-[#4B5563]'
                    }`}
                  >
                    UF
                  </button>
                </div>
                <input
                  id="contract-late-fee"
                  aria-label="Multa diaria por atraso"
                  type="number"
                  step={lateFeeCurrency === 'UF' ? '0.05' : '500'}
                  min="0"
                  value={lateFeeAmountStr}
                  onChange={(e) => setLateFeeAmountStr(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
              <p className="text-xs text-[#6B7280] mt-1 tabular-nums">{lateFeeEquivText}</p>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <span className="block text-xs font-medium text-[#4B5563]">
                Garantía Fija (en resguardo)
              </span>
              <button
                type="button"
                onClick={handleCopyOneMonthRent}
                className="text-xs font-medium text-[#14294A] hover:underline underline-offset-4 cursor-pointer"
              >
                Usar 1 mes de arriendo
              </button>
            </div>
            <div className="flex gap-2">
              <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => handleGuaranteeCurrencyChange('CLP')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    guaranteeCurrency === 'CLP'
                      ? 'bg-white text-[#14294A] shadow-xs'
                      : 'text-[#4B5563]'
                  }`}
                >
                  CLP
                </button>
                <button
                  type="button"
                  onClick={() => handleGuaranteeCurrencyChange('UF')}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    guaranteeCurrency === 'UF'
                      ? 'bg-white text-[#14294A] shadow-xs'
                      : 'text-[#4B5563]'
                  }`}
                >
                  UF
                </button>
              </div>
              <input
                id="contract-guarantee"
                aria-label="Monto de Garantía Fija"
                type="number"
                step={guaranteeCurrency === 'UF' ? '0.1' : '1000'}
                min="0"
                value={guaranteeAmountStr}
                onChange={(e) => setGuaranteeAmountStr(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
              />
            </div>
            <p className="text-xs text-[#6B7280] mt-1 tabular-nums">
              {guaranteeEquivText} · Separada del arriendo mensual
            </p>
          </div>

          <div className="pt-2 border-t border-[#E5E7EB]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
              <div>
                <span className="block text-xs font-medium text-[#4B5563] mb-1.5">
                  ¿La propiedad paga Gastos Comunes?
                </span>
                <div className="inline-flex p-0.5 bg-[#F3F4F6] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setPaysCommonExpenses(true)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      paysCommonExpenses
                        ? 'bg-white text-[#14294A] shadow-xs'
                        : 'text-[#4B5563]'
                    }`}
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaysCommonExpenses(false)}
                    className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                      !paysCommonExpenses
                        ? 'bg-white text-[#14294A] shadow-xs'
                        : 'text-[#4B5563]'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>

              {paysCommonExpenses && (
                <div>
                  <label
                    htmlFor="contract-gc-ref"
                    className="block text-xs font-medium text-[#4B5563] mb-1"
                  >
                    Monto mensual referencial (CLP)
                  </label>
                  <input
                    id="contract-gc-ref"
                    type="number"
                    min="0"
                    step="1000"
                    value={commonExpenseRefStr}
                    onChange={(e) => setCommonExpenseRefStr(e.target.value)}
                    placeholder="Ej. 90000"
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                  {Number(commonExpenseRefStr) > 0 && (
                    <p className="text-xs text-[#6B7280] font-mono tabular-nums mt-1">
                      Ref. {formatClp(Number(commonExpenseRefStr))} / mes (separado del canon)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-[#E5E7EB]">
            <label
              htmlFor="contract-signed-pdf"
              className="block text-xs font-medium text-[#374151] mb-1.5"
            >
              Contrato firmado ante notario (archivo PDF obligatorio)
            </label>
            <label
              htmlFor="contract-signed-pdf"
              className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-[#CBD5E1] rounded-lg bg-[#F9FAFB] hover:bg-[#F3F4F6] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {signedContractFileName ? (
                  <FileText className="w-4 h-4 text-[#1B5E3A] shrink-0" aria-hidden="true" />
                ) : (
                  <Upload className="w-4 h-4 text-[#14294A] shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm text-[#111827] truncate">
                  {signedContractFileName || 'Seleccionar archivo PDF firmado ante notario...'}
                </span>
              </div>
              <span className="text-xs font-medium text-[#14294A] shrink-0">
                {signedContractFileName ? 'Cambiar PDF' : 'Subir PDF'}
              </span>
              <input
                id="contract-signed-pdf"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
                className="sr-only"
              />
            </label>
            <p className="text-xs text-[#6B7280] mt-1">
              El archivo quedará custodiado en la ficha de la propiedad para visualización y descarga.
            </p>
          </div>

          <div>
            <label htmlFor="contract-notes" className="block text-xs font-medium text-[#4B5563] mb-1">
              Observaciones del contrato (opcional)
            </label>
            <textarea
              id="contract-notes"
              rows={2}
              value={contractNotes}
              onChange={(e) => setContractNotes(e.target.value)}
              placeholder="Ej. Notaría San Martín, Repertorio N° 4.120, incluye estacionamiento y bodega."
              className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#B91C1C]">
              {error}
            </p>
          )}

          <div className="pt-3 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#1B5E3A] hover:bg-[#154B2E] rounded-lg cursor-pointer"
            >
              Guardar y Activar Propiedad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
