import { FormEvent, useState } from 'react';
import { X } from 'lucide-react';
import { NewPropertyInput } from '../hooks/useSaforentStore';
import { CurrencyType, IpcFrequency } from '../types/saforent';
import { formatClp, formatUf, toClp, toUf } from '../utils/formatters';

interface AddPropertyModalProps {
  ufValueClp: number;
  onClose: () => void;
  onSubmit: (data: NewPropertyInput) => void;
}

export function AddPropertyModal({ ufValueClp, onClose, onSubmit }: AddPropertyModalProps) {
  const [address, setAddress] = useState('');
  const [commune, setCommune] = useState('');
  const [rolSii, setRolSii] = useState('');
  const [cbrsFoja, setCbrsFoja] = useState('');
  const [cbrsNumero, setCbrsNumero] = useState('');
  const [cbrsAnio, setCbrsAnio] = useState('2025');
  const [cbrsConservador, setCbrsConservador] = useState('CBR Santiago');
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [currency, setCurrency] = useState<CurrencyType>('CLP');
  const [rentAmountStr, setRentAmountStr] = useState('650000');
  const [paymentDay, setPaymentDay] = useState('5');
  const [ipcClause, setIpcClause] = useState<IpcFrequency>('Anual');
  const [lateFeeCurrency, setLateFeeCurrency] = useState<CurrencyType>('CLP');
  const [lateFeeAmountStr, setLateFeeAmountStr] = useState('4000');
  const [guaranteeCurrency, setGuaranteeCurrency] = useState<CurrencyType>('CLP');
  const [guaranteeAmountStr, setGuaranteeAmountStr] = useState('650000');
  const [paysCommonExpenses, setPaysCommonExpenses] = useState(true);
  const [commonExpenseRefStr, setCommonExpenseRefStr] = useState('90000');
  const [contractNotes, setContractNotes] = useState('');
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
      : 'Sin recargo por atraso';

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !commune.trim() || !rolSii.trim() || !cbrsFoja.trim() || !cbrsNumero.trim()) {
      setError('Completa la dirección, comuna, Rol SII y Foja/Número CBRS.');
      return;
    }
    if (parsedAmount <= 0) {
      setError('El monto del arriendo debe ser mayor a cero.');
      return;
    }
    if (parsedLateFee < 0 || Number.isNaN(parsedLateFee)) {
      setError('La multa diaria por mora no puede ser negativa.');
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
    setError('');
    onSubmit({
      address,
      commune,
      rolSii,
      cbrsFoja,
      cbrsNumero,
      cbrsAnio,
      cbrsConservador,
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
      contractNotes,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#111827]/45 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-property-title"
    >
      <div className="bg-white border border-[#E5E7EB] rounded-xl w-full max-w-[640px] my-auto shadow-lg">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <h2 id="add-property-title" className="text-lg font-semibold text-[#111827]">
            Sumar Propiedad
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="w-10 h-10 inline-flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="prop-address" className="block text-sm font-medium text-[#374151] mb-1">
                Dirección del inmueble
              </label>
              <input
                id="prop-address"
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Av. Apoquindo 4100, Depto 603"
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A] focus:ring-1 focus:ring-[#14294A]"
              />
            </div>
            <div>
              <label htmlFor="prop-commune" className="block text-sm font-medium text-[#374151] mb-1">
                Comuna
              </label>
              <input
                id="prop-commune"
                type="text"
                required
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                placeholder="Ej. Las Condes"
                className="w-full min-h-[42px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A] focus:ring-1 focus:ring-[#14294A]"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB]">
            <p className="text-sm font-medium text-[#111827] mb-3">Antecedentes legales en Chile</p>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div>
                <label htmlFor="prop-rol" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Rol SII
                </label>
                <input
                  id="prop-rol"
                  type="text"
                  required
                  value={rolSii}
                  onChange={(e) => setRolSii(e.target.value)}
                  placeholder="04512-0089"
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
              <div>
                <label htmlFor="prop-foja" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Foja CBRS
                </label>
                <input
                  id="prop-foja"
                  type="text"
                  required
                  value={cbrsFoja}
                  onChange={(e) => setCbrsFoja(e.target.value)}
                  placeholder="42.190"
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
              <div>
                <label htmlFor="prop-numero" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Número CBRS
                </label>
                <input
                  id="prop-numero"
                  type="text"
                  required
                  value={cbrsNumero}
                  onChange={(e) => setCbrsNumero(e.target.value)}
                  placeholder="64.511"
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
              <div>
                <label htmlFor="prop-anio" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Año CBRS
                </label>
                <input
                  id="prop-anio"
                  type="text"
                  value={cbrsAnio}
                  onChange={(e) => setCbrsAnio(e.target.value)}
                  placeholder="2025"
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
              <div>
                <label htmlFor="prop-cbr" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Conservador
                </label>
                <input
                  id="prop-cbr"
                  type="text"
                  value={cbrsConservador}
                  onChange={(e) => setCbrsConservador(e.target.value)}
                  placeholder="CBR Santiago"
                  className="w-full min-h-[40px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB]">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <p className="text-sm font-medium text-[#111827]">Condiciones de arriendo</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#EFF6FF] border border-[#DBEAFE] text-xs font-medium text-[#1E40AF]">
                Estado inicial: Disponible
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <span className="block text-xs font-medium text-[#4B5563] mb-1">Moneda y Canon esperado</span>
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
                    id="prop-rent"
                    aria-label="Monto del arriendo"
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
                <label htmlFor="prop-day" className="block text-xs font-medium text-[#4B5563] mb-1">
                  Día de pago mensual sugerido
                </label>
                <input
                  id="prop-day"
                  type="number"
                  min={1}
                  max={28}
                  value={paymentDay}
                  onChange={(e) => setPaymentDay(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                />
              </div>
            </div>

            <div className="mb-4">
              <span className="block text-xs font-medium text-[#4B5563] mb-1">
                Multa diaria por atraso en pagos
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex gap-2 sm:w-72">
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
                    id="prop-late-fee"
                    aria-label="Multa diaria por atraso"
                    type="number"
                    step={lateFeeCurrency === 'UF' ? '0.05' : '500'}
                    min="0"
                    value={lateFeeAmountStr}
                    onChange={(e) => setLateFeeAmountStr(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                </div>
                <p className="text-xs text-[#6B7280] tabular-nums">{lateFeeEquivText}</p>
              </div>
            </div>

            <div className="mb-4">
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
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex gap-2 sm:w-72">
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
                    id="prop-guarantee"
                    aria-label="Monto de Garantía Fija"
                    type="number"
                    step={guaranteeCurrency === 'UF' ? '0.1' : '1000'}
                    min="0"
                    value={guaranteeAmountStr}
                    onChange={(e) => setGuaranteeAmountStr(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 text-sm font-mono tabular-nums border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                </div>
                <p className="text-xs text-[#6B7280] tabular-nums">
                  {guaranteeEquivText} · No se suma como ingreso mensual ni reajusta IPC
                </p>
              </div>
            </div>

            <div className="mb-4 pt-3 border-t border-[#E5E7EB]">
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
                      htmlFor="prop-gc-ref"
                      className="block text-xs font-medium text-[#4B5563] mb-1"
                    >
                      Monto mensual referencial (CLP)
                    </label>
                    <input
                      id="prop-gc-ref"
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
                        Ref. {formatClp(Number(commonExpenseRefStr))} / mes (variable según colilla)
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#E5E7EB]">
              <p className="text-xs font-medium text-[#6B7280] mb-2">
                Arrendatario (opcional — puedes asignarlo después)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="prop-tenant" className="block text-xs font-medium text-[#4B5563] mb-1">
                    Nombre
                  </label>
                  <input
                    id="prop-tenant"
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Opcional"
                    className="w-full min-h-[40px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                </div>
                <div>
                  <label htmlFor="prop-tenant-email" className="block text-xs font-medium text-[#4B5563] mb-1">
                    Correo
                  </label>
                  <input
                    id="prop-tenant-email"
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="Opcional"
                    className="w-full min-h-[40px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                </div>
                <div>
                  <label htmlFor="prop-tenant-phone" className="block text-xs font-medium text-[#4B5563] mb-1">
                    Teléfono
                  </label>
                  <input
                    id="prop-tenant-phone"
                    type="tel"
                    value={tenantPhone}
                    onChange={(e) => setTenantPhone(e.target.value)}
                    placeholder="Opcional"
                    className="w-full min-h-[40px] px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] space-y-1.5">
            <label htmlFor="prop-ipc-clause" className="block text-xs font-medium text-[#4B5563]">
              Cláusula de reajuste IPC
            </label>
            <select
              id="prop-ipc-clause"
              value={ipcClause}
              onChange={(e) => setIpcClause(e.target.value as IpcFrequency)}
              className="w-full sm:w-72 min-h-[40px] px-3 py-2 text-sm bg-white border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
            >
              <option value="Mensual">Mensual por IPC</option>
              <option value="Trimestral">Trimestral por IPC</option>
              <option value="Semestral">Semestral por IPC</option>
              <option value="Anual">Anual por IPC</option>
              <option value="Reajuste directo en UF">Reajuste directo en UF</option>
            </select>
            <p className="text-xs text-[#6B7280]">
              El reajuste se calculará y aplicará automáticamente al cumplirse el período pactado, manteniendo fijo el Canon Base.
            </p>
          </div>

          <div>
            <label htmlFor="prop-notes" className="block text-xs font-medium text-[#4B5563] mb-1">
              Notas del contrato (opcional)
            </label>
            <textarea
              id="prop-notes"
              rows={2}
              value={contractNotes}
              onChange={(e) => setContractNotes(e.target.value)}
              placeholder="Estacionamiento, bodega, observaciones..."
              className="w-full px-3 py-2 text-sm border border-[#D1D5DB] rounded-lg focus:outline-none focus:border-[#14294A]"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#B91C1C]">
              {error}
            </p>
          )}

          <div className="pt-4 border-t border-[#E5E7EB] flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#374151] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F9FAFB] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 py-2 text-sm font-medium text-white bg-[#14294A] hover:bg-[#1D3A66] rounded-lg transition-colors cursor-pointer"
            >
              Guardar Propiedad
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
