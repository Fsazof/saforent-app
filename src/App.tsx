import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight, CalendarClock, CheckCircle2, RotateCcw, X } from 'lucide-react';
import { LoginView } from './components/LoginView';
import { Navbar } from './components/Navbar';
import { OwnerDashboard } from './components/OwnerDashboard';
import { TenantDashboard } from './components/TenantDashboard';
import { useFinancialAiDiagnosis } from './hooks/useFinancialAiDiagnosis';
import { useSaforentStore } from './hooks/useSaforentStore';
import { DEFAULT_SIMULATED_DATE, formatSpanishDate } from './utils/formatters';

export default function App() {
  const {
    state,
    loginAs,
    switchDemoTenant,
    logout,
    resetDemo,
    addProperty,
    updatePropertyStatus,
    updatePropertyLegalData,
    updatePropertyIpcClause,
    updatePropertyLateFee,
    updatePropertyGuarantee,
    updatePropertyCommonExpensesConfig,
    registerSignedContract,
    simulateNextMonth,
    resolveMorosidadAlert,
    dismissAlert,
    submitPaymentReceipt,
    simulateOnlinePayment,
    approvePaymentReceipt,
    reportMaintenance,
    resolveMaintenance,
    attachMonthlyCommonExpense,
    submitCommonExpenseReceipt,
    approveCommonExpenseReceipt,
    clearPendingOwnerNotifications,
  } = useSaforentStore();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ownerTab, setOwnerTab] = useState<'gestion' | 'finanzas'>('gestion');

  const handleNotify = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  const aiDiagnosis = useFinancialAiDiagnosis(state, handleNotify);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div id="top" className="min-h-screen bg-[#F4F5F7] text-[#111827] flex flex-col">
      {!state.session ? (
        <LoginView
          onLogin={(role, email) => {
            loginAs(role, email);
            handleNotify(
              role === 'owner'
                ? 'Sesión iniciada como Propietario (Demo).'
                : 'Sesión iniciada como Arrendatario (Demo).'
            );
          }}
          onResetDemo={resetDemo}
          onNotify={handleNotify}
        />
      ) : (
        <>
          <Navbar
            role={state.session.role}
            onLogout={() => {
              logout();
              setOwnerTab('gestion');
              handleNotify('Sesión cerrada.');
            }}
            onSelectOwnerTab={setOwnerTab}
          />

          {/* Barra contextual de sesión y controles demo debajo del encabezado */}
          <div className="bg-white border-b border-[#E5E7EB]">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#4B5563]">
                <span className="font-medium text-[#111827]">
                  {state.session.role === 'owner' ? 'Vista Propietario' : 'Vista Arrendatario'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{state.session.name}</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline text-[#6B7280]">{state.session.email}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-xs text-[#4B5563] tabular-nums">
                  Fecha: {formatSpanishDate(state.simulatedDate || DEFAULT_SIMULATED_DATE)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextRole = state.session?.role === 'owner' ? 'tenant' : 'owner';
                    loginAs(nextRole);
                    handleNotify(
                      nextRole === 'owner'
                        ? 'Cambiado a Vista Propietario.'
                        : 'Cambiado a Vista Arrendatario.'
                    );
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#14294A] bg-[#F4F5F7] hover:bg-[#E5E7EB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {state.session.role === 'owner'
                      ? 'Ir a Vista Arrendatario'
                      : 'Ir a Vista Propietario'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const result = simulateNextMonth();
                    const details: string[] = [];
                    if (result.autoIpcCount > 0) {
                      details.push(
                        `${result.autoIpcCount} reajuste${result.autoIpcCount === 1 ? '' : 's'} IPC aplicado${result.autoIpcCount === 1 ? '' : 's'}`
                      );
                    }
                    if (result.newOverdueCount > 0) {
                      details.push(
                        `${result.newOverdueCount} nueva${result.newOverdueCount === 1 ? '' : 's'} alerta${result.newOverdueCount === 1 ? '' : 's'} en Urgente`
                      );
                    }
                    handleNotify(
                      details.length > 0
                        ? `Calendario adelantado a ${formatSpanishDate(result.newDate)}: ${details.join(' y ')}.`
                        : `Calendario adelantado a ${formatSpanishDate(result.newDate)}.`
                    );
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#1B5E3A] hover:text-[#154B2E] bg-[#EEF6F1] border border-[#BBF7D0] hover:bg-[#DCFCE7] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Simular paso de 1 mes</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetDemo();
                    handleNotify('Datos de la demo restaurados a su estado inicial.');
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-medium text-[#4B5563] hover:text-[#111827] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Reiniciar Demo</span>
                </button>
              </div>
            </div>
          </div>

          <main className="flex-1 max-w-[1200px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {state.session.role === 'owner' ? (
              <OwnerDashboard
                state={state}
                onAddProperty={addProperty}
                onStatusChange={updatePropertyStatus}
                onUpdateLegalData={updatePropertyLegalData}
                onUpdateIpcClause={updatePropertyIpcClause}
                onUpdateLateFee={updatePropertyLateFee}
                onUpdateGuarantee={updatePropertyGuarantee}
                onUpdateCommonExpensesConfig={updatePropertyCommonExpensesConfig}
                onAttachCommonExpense={attachMonthlyCommonExpense}
                onApproveCommonExpense={approveCommonExpenseReceipt}
                onRegisterSignedContract={registerSignedContract}
                onResolveMorosidad={resolveMorosidadAlert}
                onDismissAlert={dismissAlert}
                onApproveReceipt={approvePaymentReceipt}
                onResolveMaintenance={resolveMaintenance}
                onNotify={handleNotify}
                onClearPendingNotifications={clearPendingOwnerNotifications}
                activeTab={ownerTab}
                onTabChange={setOwnerTab}
                aiDiagnosis={aiDiagnosis}
              />
            ) : (
              <TenantDashboard
                state={state}
                onSwitchDemoTenant={switchDemoTenant}
                onSubmitReceipt={submitPaymentReceipt}
                onSimulateOnlinePayment={simulateOnlinePayment}
                onSubmitCommonExpenseReceipt={submitCommonExpenseReceipt}
                onReportIssue={reportMaintenance}
                onNotify={handleNotify}
              />
            )}
          </main>

          <footer className="border-t border-[#E5E7EB] bg-white mt-auto">
            <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
              <span>Saforent APP · Gestión simple de arriendos en Chile</span>
              <span className="font-mono tabular-nums">
                Guardado local activo · UF ref. ${state.ufValueClp.toLocaleString('es-CL')} (Banco Central / INE)
              </span>
            </div>
          </footer>
        </>
      )}

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 max-w-sm bg-[#14294A] text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 text-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-[#6EE7B7] shrink-0" aria-hidden="true" />
          <span className="flex-1">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            aria-label="Cerrar notificación"
            className="text-white/75 hover:text-white cursor-pointer p-1"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
