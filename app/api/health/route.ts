import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function hasValue(value: string | undefined) {
  return Boolean(value && value.length > 8 && !value.includes("missing"));
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const hasSupabase = Boolean(
    supabaseUrl?.startsWith("https://") && hasValue(supabaseKey)
  );

  let supabaseTable = "not_checked";
  let supabaseError = "";

  if (hasSupabase) {
    const { error } = await supabaseAdmin
      .from("studyagent_app_state")
      .select("key")
      .limit(1);

    supabaseTable = error ? "error" : "ok";
    supabaseError = error?.message || "";
  }

  return NextResponse.json({
    ok: true,
    env: {
      aiProvider: process.env.AI_PROVIDER || "openai",
      hasOpenRouterKey: hasValue(process.env.OPENROUTER_API_KEY),
      openRouterModel: process.env.OPENROUTER_MODEL || "",
      hasOpenAiKey: hasValue(process.env.OPENAI_API_KEY),
      hasSupabaseUrl: Boolean(supabaseUrl?.startsWith("https://")),
      hasSupabaseServiceKey: hasValue(supabaseKey),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "",
    },
    supabase: {
      configured: hasSupabase,
      table: supabaseTable,
      error: supabaseError,
    },
  });
}

export async function POST() {
  if (!hasValue(process.env.OPENROUTER_API_KEY)) {
    return NextResponse.json(
      { ok: false, error: "OPENROUTER_API_KEY ausente." },
      { status: 500 }
    );
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
      "X-Title": "MedStudy AI",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "openrouter/free",
      messages: [{ role: "user", content: "Responda apenas ok" }],
      max_tokens: 20,
    }),
  });

  const text = await response.text();

  return NextResponse.json({
    ok: response.ok,
    status: response.status,
    sample: text.slice(0, 500),
  });
}
