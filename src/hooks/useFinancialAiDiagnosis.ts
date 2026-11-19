import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SaforentState } from '../types/saforent';
import {
  buildPortfolioSnapshot,
  buildPortfolioSnapshotKey,
  FinancialAiDiagnosisResult,
  PortfolioDiagnosticSnapshot,
  requestFinancialAiDiagnosis,
} from '../utils/financialDiagnosis';

export interface FinancialAiDiagnosisController {
  isOpen: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  diagnosis: FinancialAiDiagnosisResult | null;
  generatedAt: string | null;
  snapshot: PortfolioDiagnosticSnapshot;
  generateDiagnosis: () => Promise<void>;
  dismissDiagnosis: () => void;
}

export function useFinancialAiDiagnosis(
  state: SaforentState,
  onNotify?: (message: string) => void
): FinancialAiDiagnosisController {
  const snapshot = useMemo(() => buildPortfolioSnapshot(state), [state]);
  const snapshotKey = useMemo(() => buildPortfolioSnapshotKey(snapshot), [snapshot]);

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<FinancialAiDiagnosisResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const lastAnalyzedKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef(0);

  const runDiagnosis = useCallback(
    async (
      targetSnapshot: PortfolioDiagnosticSnapshot,
      targetKey: string,
      options: { backgroundRefresh: boolean; notifyOnDone: boolean }
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      requestSeqRef.current += 1;
      const currentSeq = requestSeqRef.current;

      setIsOpen(true);
      setError(null);
      if (options.backgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const res = await requestFinancialAiDiagnosis(targetSnapshot, controller.signal);
        if (currentSeq !== requestSeqRef.current) return;
        lastAnalyzedKeyRef.current = targetKey;
        setDiagnosis(res.diagnosis);
        setGeneratedAt(res.generatedAt);
        if (options.notifyOnDone) {
          onNotify?.('Diagnóstico IA generado con los datos actuales de tu cartera.');
        }
      } catch (err) {
        if (controller.signal.aborted || currentSeq !== requestSeqRef.current) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'No se pudo completar el diagnóstico financiero con IA.';
        setError(msg);
      } finally {
        if (currentSeq === requestSeqRef.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [onNotify]
  );

  const generateDiagnosis = useCallback(async () => {
    await runDiagnosis(snapshot, snapshotKey, {
      backgroundRefresh: Boolean(diagnosis),
      notifyOnDone: true,
    });
  }, [runDiagnosis, snapshot, snapshotKey, diagnosis]);

  const dismissDiagnosis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsOpen(false);
    setIsLoading(false);
    setIsRefreshing(false);
    setError(null);
    lastAnalyzedKeyRef.current = null;
  }, []);

  // Recalcular automáticamente si el diagnóstico está abierto y cambian propiedades, pagos o fecha simulada
  useEffect(() => {
    if (!isOpen) return;
    if (lastAnalyzedKeyRef.current === null) return;
    if (snapshotKey === lastAnalyzedKeyRef.current) return;

    const timer = window.setTimeout(() => {
      void runDiagnosis(snapshot, snapshotKey, {
        backgroundRefresh: true,
        notifyOnDone: false,
      });
    }, 200);

    return () => window.clearTimeout(timer);
  }, [isOpen, snapshot, snapshotKey, runDiagnosis]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isOpen,
    isLoading,
    isRefreshing,
    error,
    diagnosis,
    generatedAt,
    snapshot,
    generateDiagnosis,
    dismissDiagnosis,
  };
}
