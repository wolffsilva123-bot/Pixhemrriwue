import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { inspectWavBuffer, processWavBuffer, type WavMetadata } from './server/wavProcessor.ts';

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const AUDIO_FILENAME = 'locucao-pix-carlos-henrique.wav';
const AUDIO_FILE_PATH = path.join(PUBLIC_DIR, AUDIO_FILENAME);

const EXACT_VOICEOVER_SCRIPT = `Olá, seja bem-vindo.

Para realizar seu pagamento via Pix, basta clicar no botão copiar chave Pix e depois acessar o aplicativo do seu banco para concluir o pagamento.

O recebedor é Carlos Henrique Gonçalves Araújo e o banco é Mercado Pago.

É simples, rápido e seguro. Obrigado.`;

type SupportedTtsModel = 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';
type SupportedFemaleVoice = 'Kore' | 'Zephyr';

interface GenerateRequestBody {
  voiceName?: string;
  model?: string;
  force?: boolean;
}

interface CachedAudioState {
  metadata: WavMetadata;
  waveform: number[];
  voiceName: SupportedFemaleVoice;
  model: SupportedTtsModel;
  generatedAt: string;
}

let cachedState: CachedAudioState | null = null;
let generationInFlight: Promise<CachedAudioState> | null = null;

function getConfiguredApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY?.trim();
  if (!raw || raw === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return raw;
}

function resolveTtsModel(input?: string): SupportedTtsModel {
  return input === 'gemini-3.8-flash-tts' ? 'gemini-3.8-flash-tts' : 'gemini-3.8-flash-lite-tts';
}

function resolveFemaleVoice(input?: string): SupportedFemaleVoice {
  return input === 'Zephyr' ? 'Zephyr' : 'Kore';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403') || lower.includes('401')) {
    return {
      status: 403,
      message:
        'Chave da API Gemini inválida ou sem permissão. Verifique a chave configurada em Settings > Secrets.',
    };
  }

  if (lower.includes('resource_exhausted') || lower.includes('429')) {
    return {
      status: 429,
      message:
        'Limite temporário de requisições da API atingido. Aguarde alguns segundos e tente novamente.',
    };
  }

  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Modelo de síntese de voz não encontrado. Tente alternar o modelo de geração.',
    };
  }

  return {
    status: 500,
    message: msg || 'Erro inesperado ao gerar a locução em WAV.',
  };
}

async function generatePixVoiceoverWav(
  voiceName: SupportedFemaleVoice,
  model: SupportedTtsModel
): Promise<CachedAudioState> {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY não configurada no servidor. Adicione sua chave em Settings > Secrets para gerar a locução em WAV.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const stylePrompt =
    'Português brasileiro (pt-BR). Voz feminina suave, acolhedora e profissional. ' +
    'Tom natural, simpático e confiável. Velocidade moderada, dicção clara, sem robótica e sem exageros. ' +
    'Sem música de fundo e sem efeitos sonoros. Faça pausas naturais entre os parágrafos, ' +
    'não corte nenhuma palavra e pronuncie com clareza o nome completo "Carlos Henrique Gonçalves Araújo" ' +
    'e o nome do banco "Mercado Pago".';

  let lastError: unknown = null;
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: EXACT_VOICEOVER_SCRIPT,
                speechMetadata: {
                  style: stylePrompt,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('A API retornou uma resposta sem dados de áudio.');
      }

      const rawWavBuffer = Buffer.from(base64Audio, 'base64');
      const processed = processWavBuffer(rawWavBuffer);

      await fs.promises.mkdir(PUBLIC_DIR, { recursive: true });
      await fs.promises.writeFile(AUDIO_FILE_PATH, processed.buffer);

      const state: CachedAudioState = {
        metadata: processed.metadata,
        waveform: processed.waveform,
        voiceName,
        model,
        generatedAt: new Date().toISOString(),
      };
      cachedState = state;
      return state;
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message.toLowerCase() : '';
      const isTransient = msg.includes('429') || msg.includes('500') || msg.includes('503') || msg.includes('timeout');
      if (attempt < maxAttempts && isTransient) {
        await sleep(750 * attempt);
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha ao gerar o arquivo de áudio WAV.');
}

async function readExistingAudioState(): Promise<CachedAudioState | null> {
  if (cachedState && fs.existsSync(AUDIO_FILE_PATH)) {
    return cachedState;
  }

  if (!fs.existsSync(AUDIO_FILE_PATH)) {
    return null;
  }

  try {
    const fileBuffer = await fs.promises.readFile(AUDIO_FILE_PATH);
    const inspected = inspectWavBuffer(fileBuffer);
    const stats = await fs.promises.stat(AUDIO_FILE_PATH);
    const state: CachedAudioState = {
      metadata: inspected.metadata,
      waveform: inspected.waveform,
      voiceName: 'Kore',
      model: 'gemini-3.8-flash-lite-tts',
      generatedAt: stats.mtime.toISOString(),
    };
    cachedState = state;
    return state;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/audio/status', async (_req, res) => {
    const hasApiKey = Boolean(getConfiguredApiKey());
    const existing = await readExistingAudioState();

    if (existing) {
      res.json({
        ready: true,
        hasApiKey,
        filename: AUDIO_FILENAME,
        url: `/${AUDIO_FILENAME}`,
        script: EXACT_VOICEOVER_SCRIPT,
        ...existing,
      });
      return;
    }

    res.json({
      ready: false,
      hasApiKey,
      filename: AUDIO_FILENAME,
      url: `/${AUDIO_FILENAME}`,
      script: EXACT_VOICEOVER_SCRIPT,
    });
  });

  app.post('/api/audio/generate', async (req, res) => {
    const body = (req.body || {}) as GenerateRequestBody;
    const voiceName = resolveFemaleVoice(body.voiceName);
    const model = resolveTtsModel(body.model);
    const force = Boolean(body.force);

    if (!force) {
      const existing = await readExistingAudioState();
      if (existing) {
        res.json({
          ready: true,
          filename: AUDIO_FILENAME,
          url: `/${AUDIO_FILENAME}`,
          script: EXACT_VOICEOVER_SCRIPT,
          ...existing,
        });
        return;
      }
    }

    try {
      if (!generationInFlight) {
        generationInFlight = generatePixVoiceoverWav(voiceName, model).finally(() => {
          generationInFlight = null;
        });
      }

      const state = await generationInFlight;
      res.json({
        ready: true,
        filename: AUDIO_FILENAME,
        url: `/${AUDIO_FILENAME}?v=${encodeURIComponent(state.generatedAt)}`,
        script: EXACT_VOICEOVER_SCRIPT,
        ...state,
      });
    } catch (err) {
      const mapped = extractErrorMessage(err);
      res.status(mapped.status).json({
        ready: false,
        error: mapped.message,
      });
    }
  });

  app.get(`/${AUDIO_FILENAME}`, (_req, res) => {
    if (!fs.existsSync(AUDIO_FILE_PATH)) {
      res.status(404).json({
        error: 'Arquivo de locução WAV ainda não foi gerado.',
      });
      return;
    }

    res.sendFile(AUDIO_FILE_PATH, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-cache',
      },
    });
  });

  app.get('/api/audio/download', (_req, res) => {
    if (!fs.existsSync(AUDIO_FILE_PATH)) {
      res.status(404).json({
        error: 'Arquivo de locução WAV ainda não foi gerado.',
      });
      return;
    }

    res.download(AUDIO_FILE_PATH, AUDIO_FILENAME, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(PUBLIC_DIR));
    app.use(express.static(DIST_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
