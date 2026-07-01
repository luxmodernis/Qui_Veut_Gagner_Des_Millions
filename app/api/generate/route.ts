import { NextRequest, NextResponse } from "next/server";
import { getCodeB } from "@/lib/auth";

export const runtime = "edge";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const adminCode = req.cookies.get("auth_admin")?.value;
  if (adminCode !== getCodeB()) return err("unauthorized", 401);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return err("GROQ_API_KEY manquant dans les variables d'environnement", 500);

  const { count = 3, topic = "" } = await req.json() as { count?: number; topic?: string };
  const n = Math.min(10, Math.max(1, count));

  const topicLine = topic.trim()
    ? `Thème imposé : ${topic.trim()}.`
    : "Thème libre : culture générale variée (géographie, sciences, histoire, art, sport…).";

  const prompt = `Génère ${n} questions de quiz en français. ${topicLine}
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaires, sans texte avant ou après.
Format exact (respecte les virgules, les guillemets, les index) :
{"questions":[{"question":"...","choices":["option A","option B","option C","option D"],"correctIndex":2,"note":"explication courte de la bonne réponse"}]}
Règles : correctIndex est l'index 0-3 de la bonne réponse dans choices. Les mauvaises réponses doivent être plausibles. La note explique brièvement pourquoi c'est la bonne réponse.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return err(`Erreur Groq : ${text}`, 500);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  const raw = data.choices[0]?.message?.content ?? "[]";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return err("Réponse invalide de l'IA — réessaie", 500);
  }

  // Le mode JSON de Groq force un objet racine ; on accepte {"questions":[...]} ou directement [...]
  const questions = Array.isArray(parsed)
    ? parsed
    : (parsed as { questions?: unknown }).questions ?? [];

  return NextResponse.json({ questions });
}
