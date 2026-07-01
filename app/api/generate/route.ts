import { NextRequest, NextResponse } from "next/server";
import { getCodeB } from "@/lib/auth";

export const runtime = "edge";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const adminCode = req.cookies.get("auth_admin")?.value;
  if (adminCode !== getCodeB()) return err("unauthorized", 401);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return err("ANTHROPIC_API_KEY manquant dans les variables d'environnement", 500);

  const { count = 3, topic = "" } = await req.json() as { count?: number; topic?: string };
  const n = Math.min(10, Math.max(1, count));

  const topicLine = topic.trim()
    ? `Thème imposé : ${topic.trim()}.`
    : "Thème libre : culture générale variée (géographie, sciences, histoire, art, sport…).";

  const prompt = `Génère ${n} questions de quiz en français. ${topicLine}
Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans commentaires, sans texte avant ou après.
Format exact (respecte les virgules, les guillemets, les index) :
[{"question":"...","choices":["option A","option B","option C","option D"],"correctIndex":2,"note":"explication courte de la bonne réponse"}]
Règles : correctIndex est l'index 0-3 de la bonne réponse dans choices. Les mauvaises réponses doivent être plausibles. La note explique brièvement pourquoi c'est la bonne réponse.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return err(`Erreur Anthropic : ${text}`, 500);
  }

  const data = await response.json() as { content: { type: string; text: string }[] };
  const raw = data.content.find((c) => c.type === "text")?.text ?? "[]";

  let questions;
  try {
    questions = JSON.parse(raw);
  } catch {
    return err("Réponse invalide de l'IA — réessaie", 500);
  }

  return NextResponse.json({ questions });
}
