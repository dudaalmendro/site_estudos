import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";
import { pathToFileURL } from "node:url";
import path from "node:path";

export const runtime = "nodejs";

function configurePdfWorker() {
  const workerPath = path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  );

  PDFParse.setWorker(pathToFileURL(workerPath).href);
}

async function extractFileText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    configurePdfWorker();
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text;
  }

  if (fileName.endsWith(".docx")) {
    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  }

  if (fileName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  return "";
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY não configurada.");
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const form = await req.formData();
    const prompt = String(form.get("prompt") || "");
    const files = form.getAll("files") as File[];
    const fileTexts = await Promise.all(
      files.map(async (file) => {
        const text = await extractFileText(file);
        return `ARQUIVO: ${file.name}\n${text}`;
      })
    );

    if (!prompt.trim() && fileTexts.length === 0) {
      throw new Error("Envie um prompt ou arquivo.");
    }

    const response = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input: [
        {
          role: "system",
          content:
            "Você é um agente de estudos. Crie um planejamento prático em português do Brasil. Responda somente no JSON solicitado.",
        },
        {
          role: "user",
          content: `Pedido do aluno:\n${prompt}\n\nConteúdo enviado:\n${fileTexts
            .join("\n\n")
            .slice(0, 60000)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "study_plan",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              intro: { type: "string" },
              tasks: {
                type: "array",
                minItems: 4,
                maxItems: 12,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    details: {
                      type: "array",
                      minItems: 2,
                      maxItems: 5,
                      items: { type: "string" },
                    },
                    review_days: {
                      type: "number",
                      minimum: 1,
                      maximum: 14,
                    },
                  },
                  required: ["title", "details", "review_days"],
                },
              },
            },
            required: ["title", "intro", "tasks"],
          },
        },
      },
    });

    const planData = JSON.parse(response.output_text) as {
      title: string;
      intro: string;
      tasks: Array<{
        title: string;
        details: string[];
        review_days: number;
      }>;
    };

    const tasks = planData.tasks.map((task) => ({
      title: task.title,
      details: task.details,
      review_days: Math.max(1, Math.round(task.review_days)),
    }));

    return NextResponse.json({
      ok: true,
      title: planData.title,
      intro: planData.intro,
      tasks,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 }
    );
  }
}
