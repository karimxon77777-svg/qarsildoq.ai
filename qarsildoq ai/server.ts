import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Content } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
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

function cleanTextForSpeech(raw: string): string {
  return raw
    .replace(/\[QIZIQARLI_MALUMOT\]:[\s\S]*/i, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[#*_`~>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 950);
}

function extractFunFact(raw: string): { mainText: string; funFact?: string } {
  const match = raw.match(/\[QIZIQARLI_MALUMOT\]:\s*(.+)/i);
  if (!match) {
    return { mainText: raw.trim() };
  }
  const funFact = match[1].trim();
  const mainText = raw.replace(/\[QIZIQARLI_MALUMOT\]:[\s\S]*/i, '').trim();
  return { mainText, funFact };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'qarsildoq.ai' });
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const {
        messages = [],
        model = 'gemini-4-hydrogen',
        searchGrounding = true,
        imageBase64,
        imageMimeType,
      } = req.body as {
        messages: Array<{ role: 'user' | 'assistant'; text: string }>;
        model?: string;
        searchGrounding?: boolean;
        imageBase64?: string;
        imageMimeType?: string;
      };

      const allowedModels = new Set(['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
      const selectedModel = allowedModels.has(model) ? model : 'gemini-4-hydrogen';

      const ai = getAiClient();

      const systemInstruction = `Siz "Qarsildoq AI" (qarsildoq.ai) — zamonaviy, samimiy, aqlli va jonli 3D ovozli yordamchisiz.
Qoidalar:
1. Foydalanuvchi qaysi tilda murojaat qilsa (asosan o'zbek tilida, shuningdek rus yoki ingliz tilida), o'sha tilda aniq, tushunarli, madaniyatli va foydali javob bering.
2. O'zingizni har doim "Qarsildoq AI" deb tanishtiring.
3. Javoblaringizni ChatGPT va Gemini uslubida chiroyli, o'qishga oson tuzilmada (qisqa paragraflar, ro'yxatlar) yozing.
4. Agar mavzu bo'yicha qisqa va qiziqarli qo'shimcha fakt mos kelsa, javobingizning eng oxirida alohida qatordan quyidagi formatda 1-2 jumlalik qiziqarli ma'lumot qo'shing:
[QIZIQARLI_MALUMOT]: <qisqa va qiziqarli fakt>
5. Keraksiz texnik belgilarsiz, tabiiy va ravon tilda yozing.`;

      const history: Content[] = messages
        .slice(-14)
        .filter((m) => typeof m.text === 'string' && m.text.trim().length > 0)
        .map((m, idx, arr) => {
          const isLastUser = idx === arr.length - 1 && m.role === 'user';
          if (isLastUser && imageBase64 && imageMimeType) {
            return {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: imageMimeType,
                    data: imageBase64,
                  },
                },
                { text: m.text },
              ],
            };
          }
          return {
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.text }],
          };
        });

      const useSearch = Boolean(searchGrounding && selectedModel === 'gemini-4-hydrogen');

      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: history,
        config: {
          systemInstruction,
          ...(selectedModel === 'gemini-4-hydrogen'
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
          ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });

      const rawText = response.text ?? "Kechirasiz, javob tayyorlashda kutilmagan holat yuz berdi.";
      const { mainText, funFact } = extractFunFact(rawText);

      const rawChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];

      for (const chunk of rawChunks) {
        const web = (chunk as { web?: { uri?: string; title?: string } }).web;
        if (web?.uri && !seenUris.has(web.uri)) {
          seenUris.add(web.uri);
          sources.push({
            title: (web.title || web.uri).slice(0, 180),
            uri: web.uri.slice(0, 950),
          });
          if (sources.length >= 6) break;
        }
      }

      res.json({
        text: mainText,
        funFact: funFact || null,
        sources,
        model: selectedModel,
        speechText: cleanTextForSpeech(mainText),
      });
    } catch (error) {
      console.error('Chat API error:', error);
      const message = error instanceof Error ? error.message : 'Server xatoligi';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm' } = req.body as {
        audioBase64?: string;
        mimeType?: string;
      };

      if (!audioBase64) {
        res.status(400).json({ error: 'Audio maʼlumot yuborilmadi.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe the spoken audio accurately into text in the original spoken language (Uzbek, Russian, or English). Return only the transcribed text without extra commentary.',
            },
          ],
        },
      });

      const text = (response.text ?? '').trim();
      res.json({ text });
    } catch (error) {
      console.error('Transcribe API error:', error);
      const message = error instanceof Error ? error.message : 'Ovozni matnga aylantirishda xatolik';
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voiceName = 'Charon' } = req.body as {
        text?: string;
        voiceName?: string;
      };

      if (!text || !text.trim()) {
        res.status(400).json({ error: 'Ovozga aylantirish uchun matn kiritilmadi.' });
        return;
      }

      const allowedVoices = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);
      const selectedVoice = allowedVoices.has(voiceName) ? voiceName : 'Charon';
      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) {
        res.status(400).json({ error: 'Ovoz uchun yaroqli matn topilmadi.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: cleaned,
                speechMetadata: {
                  style: 'Warm, clear, expressive and friendly presenter speaking naturally',
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({ error: 'Ovozli javob yaratilmadi.' });
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (error) {
      console.error('TTS API error:', error);
      const message = error instanceof Error ? error.message : 'TTS xatoligi';
      res.status(500).json({ error: message });
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
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`qarsildoq.ai server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start qarsildoq.ai server:', err);
  process.exit(1);
});
