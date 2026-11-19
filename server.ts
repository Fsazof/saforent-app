import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

interface PropertyDiagnosticItem {
  address: string;
  commune: string;
  status: string;
  paymentStatus: string;
  currentRentClp: number;
  baseRentClp: number;
  daysOverdue: number;
  accumulatedFineClp: number;
  ownerMaintenanceMonthClp: number;
  ownerMaintenanceTotalClp: number;
  pendingUrgentMaintenanceCount: number;
}

interface PortfolioDiagnosticSnapshot {
  simulatedDate: string;
  ufValueClp: number;
  totalProperties: number;
  occupiedCount: number;
  availableCount: number;
  overdueCount: number;
  maintenanceStatusCount: number;
  occupancyRatePct: number;
  currentMonthProjectedRentClp: number;
  currentMonthCollectedRentClp: number;
  collectionRatePct: number;
  totalAccumulatedFinesClp: number;
  currentMonthOwnerMaintenanceClp: number;
  historicalOwnerMaintenanceClp: number;
  currentMonthNetResultClp: number;
  potentialAvailableRentClp: number;
  pendingUrgentMaintenanceTotal: number;
  properties: PropertyDiagnosticItem[];
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/finanzas/diagnostico', async (req: Request, res: Response) => {
    const snapshot = req.body?.snapshot as PortfolioDiagnosticSnapshot | undefined;
    if (!snapshot || !Array.isArray(snapshot.properties)) {
      res.status(400).json({
        error: 'Faltan los datos actuales de la cartera de propiedades para generar el diagnóstico.',
      });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(500).json({
        error:
          'No se encontró la clave de Gemini API configurada en el servidor. Verifica la configuración en Settings > Secrets.',
      });
      return;
    }

    const systemInstruction = [
      'Eres un asesor financiero inmobiliario senior en Chile que trabaja dentro de Saforent APP.',
      'Tu tarea es analizar los datos reales de la cartera actual del propietario y entregar un diagnóstico ejecutivo en español de Chile.',
      'Reglas estrictas:',
      '1. Entrega exactamente 3 puntos claros, concretos y accionables para el propietario.',
      '2. Cita cifras reales en pesos chilenos (formato $X.XXX.XXX), porcentajes y direcciones/comunas exactas presentes en el JSON recibido. Nunca inventes propiedades ni montos.',
      '3. Cubre de forma equilibrada: (a) Ingresos, recaudación y resultado neto; (b) Morosidades y multas acumuladas (o estabilidad de pago si no hay morosos); (c) Gastos de mantención asumidos por el propietario y propiedades disponibles / vacancia.',
      '4. Cada punto debe incluir una acción concreta que el propietario pueda ejecutar hoy.',
      '5. Sé directo, profesional y conciso.',
    ].join('\n');

    const promptText = `Analiza el siguiente estado actual de cartera inmobiliaria al ${snapshot.simulatedDate} (UF ref. $${Math.round(snapshot.ufValueClp).toLocaleString('es-CL')}) y genera el diagnóstico ejecutivo en exactamente 3 puntos:\n\n${JSON.stringify(snapshot, null, 2)}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: promptText,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: {
                type: Type.STRING,
                description:
                  'Resumen ejecutivo breve de 1 oración sobre la salud financiera actual de la cartera.',
              },
              healthStatus: {
                type: Type.STRING,
                description: 'Estado general: "Saludable", "Atención Requerida" o "Crítico".',
              },
              points: {
                type: Type.ARRAY,
                description:
                  'Exactamente 3 puntos ejecutivos claros, con cifras reales y accionables.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      description:
                        'Área del punto, ej. "Ingresos y Recaudación", "Morosidad y Multas", "Mantención y Vacancia".',
                    },
                    title: {
                      type: Type.STRING,
                      description: 'Titular breve y directo del hallazgo (máx. 10 palabras).',
                    },
                    summary: {
                      type: Type.STRING,
                      description:
                        'Análisis con datos reales en CLP/UF y propiedades involucradas (1-2 oraciones).',
                    },
                    action: {
                      type: Type.STRING,
                      description: 'Recomendación práctica y accionable para el propietario hoy.',
                    },
                    severity: {
                      type: Type.STRING,
                      description: 'Nivel de prioridad: "positivo", "alerta" o "critico".',
                    },
                  },
                  required: ['category', 'title', 'summary', 'action', 'severity'],
                },
              },
            },
            required: ['headline', 'healthStatus', 'points'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({
          error: 'El servicio de IA devolvió una respuesta vacía. Intenta generar nuevamente.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        headline?: string;
        healthStatus?: string;
        points?: Array<{
          category?: string;
          title?: string;
          summary?: string;
          action?: string;
          severity?: string;
        }>;
      };

      const normalizedPoints = Array.isArray(parsed.points) ? parsed.points.slice(0, 3) : [];
      if (normalizedPoints.length === 0) {
        res.status(502).json({
          error: 'No se pudieron estructurar los 3 puntos del diagnóstico. Intenta nuevamente.',
        });
        return;
      }

      res.json({
        diagnosis: {
          headline: parsed.headline || 'Diagnóstico financiero actual de tu cartera',
          healthStatus:
            parsed.healthStatus === 'Crítico' ||
            parsed.healthStatus === 'Atención Requerida' ||
            parsed.healthStatus === 'Saludable'
              ? parsed.healthStatus
              : snapshot.overdueCount > 0
                ? 'Atención Requerida'
                : 'Saludable',
          points: normalizedPoints.map((pt, index) => ({
            category: pt.category || `Punto ${index + 1}`,
            title: pt.title || 'Hallazgo financiero',
            summary: pt.summary || '',
            action: pt.action || 'Revisar el detalle en el reporte mensual.',
            severity:
              pt.severity === 'critico' || pt.severity === 'alerta' || pt.severity === 'positivo'
                ? pt.severity
                : 'alerta',
          })),
        },
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const errMessage =
        error instanceof Error ? error.message : 'Error inesperado al consultar Gemini API.';
      const statusCode =
        errMessage.includes('PERMISSION_DENIED') || errMessage.includes('403')
          ? 403
          : errMessage.includes('API_KEY_INVALID') || errMessage.includes('400')
            ? 400
            : errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.includes('429')
              ? 429
              : 502;
      res.status(statusCode).json({
        error: `No fue posible generar el diagnóstico con IA (${errMessage}).`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Saforent APP server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
