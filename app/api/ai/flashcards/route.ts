import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type FlashcardRequest = {
  topic?: string;
  notes?: string;
  count?: number;
  prompt?: string;
};

type ParsedFlashcardRequest = {
  topic: string;
  notes: string;
  count: number;
};

type GeneratedFlashcard = {
  question: string;
  answer: string;
  topic: string;
  difficulty: "facil" | "medio" | "dificil";
  review_days: number;
};

type OpenRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
  };
};

async function getPdfParser() {
  const [{ PDFParse }, { pathToFileURL }, path] = await Promise.all([
    import("pdf-parse"),
    import("node:url"),
    import("node:path"),
  ]);
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );

  PDFParse.setWorker(pathToFileURL(workerPath).href);
  return PDFParse;
}

const flashcardJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    flashcards: {
      type: "array",
      minItems: 4,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          question: {
            type: "string",
            minLength: 12,
          },
          answer: {
            type: "string",
            minLength: 8,
          },
          topic: {
            type: "string",
          },
          difficulty: {
            type: "string",
            enum: ["facil", "medio", "dificil"],
          },
          review_days: {
            type: "number",
            minimum: 1,
            maximum: 7,
          },
        },
        required: ["question", "answer", "topic", "difficulty", "review_days"],
      },
    },
  },
  required: ["flashcards"],
};

function cleanText(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clampCount(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.min(20, Math.max(4, Math.round(numeric)));
}

async function extractFileText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    const PDFParse = await getPdfParser();
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text;
  }

  if (fileName.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  }

  if (fileName.endsWith(".txt") || file.type.startsWith("text/")) {
    return buffer.toString("utf-8");
  }

  return "";
}

async function parseRequest(req: NextRequest): Promise<ParsedFlashcardRequest> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const topic = cleanText(form.get("topic") || form.get("prompt"));
    const notes = cleanText(form.get("notes"));
    const count = clampCount(form.get("count"));
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    const fileTexts = await Promise.all(
      files.map(async (file) => {
        const text = await extractFileText(file);
        return text ? `ARQUIVO: ${file.name}\n${text}` : "";
      })
    );

    return {
      topic,
      count,
      notes: [notes, ...fileTexts].filter(Boolean).join("\n\n").slice(0, 60000),
    };
  }

  const body = (await req.json()) as FlashcardRequest;

  return {
    topic: cleanText(body.topic || body.prompt),
    notes: cleanText(body.notes),
    count: clampCount(body.count),
  };
}

function readableAiError(error: unknown) {
  if (!(error instanceof Error)) return "Erro interno ao chamar a IA.";

  const maybe = error as Error & { status?: number; code?: string };
  const message = error.message.toLowerCase();

  if (maybe.status === 401) {
    return "Chave de IA invalida. Confira OPENROUTER_API_KEY ou OPENAI_API_KEY no .env.local.";
  }

  if (maybe.status === 429 || maybe.code === "insufficient_quota") {
    return "A IA recusou por limite/cota. Se estiver usando OpenRouter gratuito, espere o limite resetar ou troque de modelo; se estiver usando OpenAI, confira billing/creditos.";
  }

  if (
    message.includes("expected pattern") ||
    message.includes("json") ||
    message.includes("schema")
  ) {
    return "A IA gratuita retornou um formato inesperado. Tente novamente ou troque OPENROUTER_MODEL para outro modelo gratuito/disponivel.";
  }

  if (maybe.status && maybe.status >= 500) {
    return "O provedor de IA ficou indisponivel por instantes. Tente de novo.";
  }

  return error.message || "Erro interno ao chamar a IA.";
}

function isModelFallbackError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const maybe = error as Error & { status?: number; code?: string };
  const message = error.message.toLowerCase();

  return (
    maybe.status === 400 ||
    maybe.status === 403 ||
    maybe.status === 404 ||
    maybe.code === "model_not_found" ||
    message.includes("model") ||
    message.includes("not found")
  );
}

function getModelCandidates() {
  return [
    process.env.OPENAI_MODEL,
    process.env.OPENAI_FALLBACK_MODEL,
    "gpt-4.1-nano",
    "gpt-4.1-mini",
    "gpt-4o-mini",
  ].filter((model, index, models): model is string =>
    Boolean(model && models.indexOf(model) === index)
  );
}

function buildMessages(topic: string, notes: string, count: number) {
  return [
    {
      role: "system" as const,
      content:
        "Voce e um professor particular brasileiro criando flashcards de estudo. Gere perguntas claras na frente e respostas objetivas no verso. Nao use multipla escolha. Nao invente fatos quando o contexto for insuficiente; nesse caso, crie cards conceituais seguros e indique o escopo. Responda somente em JSON valido seguindo o schema.",
    },
    {
      role: "user" as const,
      content: `Tema escolhido pelo aluno: ${topic}
Quantidade desejada: ${count}
Contexto do aluno: ${notes || "Sem contexto extra."}

Crie flashcards bons para revisao ativa. Cada resposta deve ser curta, correta e suficiente para o aluno conferir se acertou.`,
    },
  ];
}

function buildOpenRouterMessages(topic: string, notes: string, count: number) {
  return [
    ...buildMessages(topic, notes, count),
    {
      role: "user" as const,
      content:
        'Responda somente com JSON puro, sem markdown, no formato {"flashcards":[{"question":"...","answer":"...","topic":"...","difficulty":"facil","review_days":1}]}.',
    },
  ];
}

function parseJsonObject(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const jsonText =
    firstBrace >= 0 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  return JSON.parse(jsonText) as { flashcards: GeneratedFlashcard[] };
}

function normalizeFlashcards(
  parsed: { flashcards: GeneratedFlashcard[] },
  topic: string,
  count: number
) {
  return parsed.flashcards.slice(0, count).map((card) => ({
    question: cleanText(card.question),
    answer: cleanText(card.answer),
    topic: cleanText(card.topic) || topic,
    difficulty: card.difficulty,
    review_days: Math.min(7, Math.max(1, Math.round(card.review_days || 2))),
  }));
}

async function generateWithOpenRouter(topic: string, notes: string, count: number) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY nao configurada neste ambiente. Na Vercel, adicione a variavel tambem em Preview ou use o dominio de Production."
    );
  }

  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const referer = process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http")
    ? process.env.NEXT_PUBLIC_SITE_URL
    : "http://localhost:3000";

  async function request(useSchema: boolean) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer,
        "X-Title": "MedStudy AI",
      },
      body: JSON.stringify({
        model,
        messages: useSchema
          ? buildMessages(topic, notes, count)
          : buildOpenRouterMessages(topic, notes, count),
        ...(useSchema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "ai_study_flashcards",
                  strict: true,
                  schema: flashcardJsonSchema,
                },
              },
            }
          : {}),
      }),
    });

    const data = (await response.json()) as OpenRouterChatResponse;

    if (!response.ok || data.error) {
      throw new Error(
        data.error?.message ||
          `OpenRouter recusou a requisicao com status ${response.status}.`
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter nao retornou conteudo para os flashcards.");
    }

    return {
      model,
      flashcards: normalizeFlashcards(parseJsonObject(content), topic, count),
    };
  }

  try {
    return await request(true);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const status = (error as Error & { status?: number }).status;
    const shouldRetryWithoutSchema =
      status !== 401 &&
      status !== 429 &&
      !message.includes("quota") &&
      !message.includes("auth") &&
      !message.includes("key");

    if (!shouldRetryWithoutSchema) {
      throw error;
    }

    try {
      return await request(false);
    } catch (retryError) {
      throw new Error(
        retryError instanceof Error
          ? retryError.message
          : "OpenRouter nao conseguiu gerar JSON valido."
      );
    }
  }
}

async function generateWithOpenAI(topic: string, notes: string, count: number) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY nao configurada neste ambiente. Se estiver usando OpenRouter, configure AI_PROVIDER=openrouter e OPENROUTER_API_KEY na Vercel."
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const models = getModelCandidates();
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const response = await openai.responses.create({
        model,
        input: buildMessages(topic, notes, count),
        text: {
          format: {
            type: "json_schema",
            name: "ai_study_flashcards",
            strict: true,
            schema: flashcardJsonSchema,
          },
        },
      });

      return {
        model,
        flashcards: normalizeFlashcards(
          JSON.parse(response.output_text) as { flashcards: GeneratedFlashcard[] },
          topic,
          count
        ),
      };
    } catch (error) {
      lastError = error;
      if (!isModelFallbackError(error)) break;
    }
  }

  throw lastError || new Error("Nenhum modelo OpenAI ficou disponivel.");
}

export async function POST(req: NextRequest) {
  try {
    const { topic, notes, count } = await parseRequest(req);

    if (!topic) {
      return NextResponse.json(
        { error: "Informe um tema para gerar os flashcards." },
        { status: 400 }
      );
    }

    const provider = cleanText(process.env.AI_PROVIDER || "openrouter").toLowerCase();
    const result =
      provider === "openrouter"
        ? await generateWithOpenRouter(topic, notes, count)
        : await generateWithOpenAI(topic, notes, count);

    return NextResponse.json({
      ok: true,
      provider,
      model: result.model,
      flashcards: result.flashcards,
    });
  } catch (error) {
    return NextResponse.json(
      { error: readableAiError(error) },
      { status: 500 }
    );
  }
}
