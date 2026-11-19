import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SaforentState } from '../types/saforent';
import {
  buildPortfolioSnapshot,
  buildPortfolioSnapshotKey,
  FinancialAiDiagnosisResult,
  generateLocalFinancialDiagnosis,
  PortfolioDiagnosticSnapshot,
} from '../utils/financialDiagnosis';

const ANALYSIS_ANIMATION_MS = 1000;

export interface FinancialAiDiagnosisController {
  isOpen: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  diagnosis: FinancialAiDiagnosisResult | null;
  generatedAt: string | null;
  snapshot: PortfolioDiagnosticSnapshot;
  generateDiagnosis: () => void;
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
  const [diagnosis, setDiagnosis] = useState<FinancialAiDiagnosisResult | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const lastAnalyzedKeyRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearPendingTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runLocalAnalysis = useCallback(
    (
      targetSnapshot: PortfolioDiagnosticSnapshot,
      targetKey: string,
      options: { delayMs: number; backgroundRefresh: boolean; notifyOnDone: boolean }
    ) => {
      clearPendingTimer();
      setIsOpen(true);

      if (options.backgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        const result = generateLocalFinancialDiagnosis(targetSnapshot);
        lastAnalyzedKeyRef.current = targetKey;
        setDiagnosis(result);
        setGeneratedAt(new Date().toISOString());
        setIsLoading(false);
        setIsRefreshing(false);
        if (options.notifyOnDone) {
          onNotify?.('Diagnóstico IA generado con los datos actuales de tu cartera.');
        }
      }, options.delayMs);
    },
    [clearPendingTimer, onNotify]
  );

  const generateDiagnosis = useCallback(() => {
    runLocalAnalysis(snapshot, snapshotKey, {
      delayMs: ANALYSIS_ANIMATION_MS,
      backgroundRefresh: false,
      notifyOnDone: true,
    });
  }, [runLocalAnalysis, snapshot, snapshotKey]);

  const dismissDiagnosis = useCallback(() => {
    clearPendingTimer();
    setIsOpen(false);
    setIsLoading(false);
    setIsRefreshing(false);
    lastAnalyzedKeyRef.current = null;
  }, [clearPendingTimer]);

  // Recalcular automáticamente si el diagnóstico está abierto y cambian propiedades, pagos o fecha simulada
  useEffect(() => {
    if (!isOpen) return;
    if (lastAnalyzedKeyRef.current === null) return;
    if (snapshotKey === lastAnalyzedKeyRef.current) return;

    runLocalAnalysis(snapshot, snapshotKey, {
      delayMs: 350,
      backgroundRefresh: true,
      notifyOnDone: false,
    });
  }, [isOpen, snapshot, snapshotKey, runLocalAnalysis]);

  useEffect(() => {
    return () => {
      clearPendingTimer();
    };
  }, [clearPendingTimer]);

  return {
    isOpen,
    isLoading,
    isRefreshing,
    error: null,
    diagnosis,
    generatedAt,
    snapshot,
    generateDiagnosis,
    dismissDiagnosis,
  };
}
