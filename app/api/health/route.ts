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
