import { NextRequest, NextResponse } from "next/server";
import { getCodeB } from "@/lib/auth";

export const runtime = "edge";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

async function callGroq(apiKey: string, prompt: string, jsonMode: boolean) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      max_tokens: 4096,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null) as
      | { error?: { message?: string; failed_generation?: string } }
      | null;
    // Groq renvoie parfois le JSON généré (invalide/tronqué) dans failed_generation :
    // on tente de le récupérer plutôt que d'échouer directement.
    const salvage = errBody?.error?.failed_generation;
    if (salvage) return { content: salvage, salvaged: true };
    throw new Error(errBody?.error?.message ?? `Erreur Groq (${response.status})`);
  }

  const data = await response.json() as { choices: { message: { content: string } }[] };
  return { content: data.choices[0]?.message?.content ?? "", salvaged: false };
}

// Extrait le premier objet JSON complet trouvé dans une chaîne, en tolérant
// une troncature en fin de texte (referme les accolades/crochets ouverts).
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  if (start === -1) throw new Error("Pas de JSON trouvé");
  let s = text.slice(start);
  try {
    return JSON.parse(s);
  } catch {
    // tente de réparer une troncature simple : coupe au dernier "}" complet
    // d'un objet de question, puis referme le tableau/objet englobant.
    const lastComplete = s.lastIndexOf("},");
    if (lastComplete !== -1) {
      s = s.slice(0, lastComplete + 1) + "]}";
      return JSON.parse(s);
    }
    throw new Error("JSON tronqué et irréparable");
  }
}

export async function POST(req: NextRequest) {
  const adminCode = req.cookies.get("auth_admin")?.value;
  if (adminCode !== getCodeB()) return err("unauthorized", 401);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return err("GROQ_API_KEY manquant dans les variables d'environnement", 500);

  const { count = 3, topic = "", avoid = [] } = await req.json() as { count?: number; topic?: string; avoid?: string[] };
  const n = Math.min(10, Math.max(1, count));

  const topicLine = topic.trim()
    ? `Thème imposé : ${topic.trim()}.`
    : "Thème libre : culture générale variée (géographie, sciences, histoire, art, sport, cinéma, musique, cuisine, nature, technologie…).";

  const avoidLine = avoid.length > 0
    ? `\nN'utilise PAS ces questions déjà posées récemment, ni de reformulation proche : ${avoid.map((q) => `"${q}"`).join(", ")}.`
    : "";

  const seed = Math.floor(Math.random() * 1000000);
  const categories = ["géographie", "histoire", "sciences", "cinéma", "musique", "sport", "cuisine", "art", "nature", "technologie", "littérature", "espace"];
  const shuffled = [...categories].sort(() => Math.random() - 0.5).slice(0, 4);

  const prompt = `Génère ${n} questions de quiz en français, courtes, originales et variées, en t'inspirant si possible de ces catégories : ${shuffled.join(", ")}.
Évite les questions trop classiques ou clichés (capitale de l'Australie, nombre d'os du corps humain, année d'Apollo 11, etc.) — cherche des faits surprenants mais vérifiables.
Garde chaque "note" très courte (une phrase, 20 mots maximum) pour ne pas dépasser la limite de réponse.
${topicLine}${avoidLine}
Identifiant de génération (ignore, sert juste à varier) : ${seed}.
Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans commentaires, sans texte avant ou après.
Format exact (respecte les virgules, les guillemets, les index) :
{"questions":[{"question":"...","choices":["option A","option B","option C","option D"],"correctIndex":2,"note":"explication courte"}]}
Règles : correctIndex est l'index 0-3 de la bonne réponse dans choices. Les mauvaises réponses doivent être plausibles.`;

  let parsed: unknown;
  try {
    const { content } = await callGroq(apiKey, prompt, true);
    parsed = extractJson(content);
  } catch {
    // second essai sans le mode JSON strict de Groq, avec un prompt plus court
    try {
      const shorterPrompt = `Génère ${Math.min(n, 3)} questions de quiz en français courtes et variées. Réponds uniquement en JSON : {"questions":[{"question":"...","choices":["a","b","c","d"],"correctIndex":0,"note":"..."}]}`;
      const { content } = await callGroq(apiKey, shorterPrompt, false);
      parsed = extractJson(content);
    } catch (e2) {
      return err(`La génération a échoué : ${e2 instanceof Error ? e2.message : String(e2)}. Réessaie avec moins de questions.`, 500);
    }
  }

  const questions = Array.isArray(parsed)
    ? parsed
    : (parsed as { questions?: unknown }).questions ?? [];

  if (!Array.isArray(questions) || questions.length === 0) {
    return err("L'IA n'a renvoyé aucune question exploitable — réessaie", 500);
  }

  return NextResponse.json({ questions });
}
