import { NextRequest, NextResponse } from "next/server";
import { getState, setState, getQuestions, setQuestions } from "@/lib/redis";
import { getCodeA, getCodeB } from "@/lib/auth";
import type { Phase, Question } from "@/lib/types";

export const runtime = "edge";

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

function authorized(req: NextRequest, code: string): boolean {
  const cookieName = code === getCodeA() ? "auth_control" : "auth_admin";
  return req.cookies.get(cookieName)?.value === code;
}

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req);
  } catch (e) {
    return err(`Erreur serveur : ${e instanceof Error ? e.message : String(e)}`, 500);
  }
}

async function handlePost(req: NextRequest) {
  const body = await req.json();
  const { action } = body as { action: string };

  // ── Team actions ──────────────────────────────────────────────────────────
  if (action === "join") {
    const { teamId, name } = body as { teamId: string; name: string };
    if (!teamId || !name?.trim()) return err("teamId and name required");
    const state = await getState();
    state.teams[teamId] = {
      name: name.trim(),
      answers: state.teams[teamId]?.answers ?? {},
      lastSeen: Date.now(),
    };
    await setState(state);
    return NextResponse.json({ ok: true });
  }

  if (action === "answer") {
    const { teamId, questionIndex, choiceIndex } = body as {
      teamId: string;
      questionIndex: number;
      choiceIndex: number;
    };
    if (!teamId) return err("teamId required");
    const state = await getState();
    if (state.phase !== "question") return err("not in question phase");
    if (state.questionIndex !== questionIndex) return err("wrong question");

    // vérification timer expiré côté serveur
    if (state.timerEnabled && state.timerStartedAt) {
      const elapsed = (Date.now() - state.timerStartedAt) / 1000;
      if (elapsed > state.timerDuration) return err("timer expired");
    }

    const team = state.teams[teamId];
    if (!team) return err("team not found");
    if (team.answers[String(questionIndex)] !== undefined) return err("already answered");

    const responseSeconds =
      state.timerEnabled && state.timerStartedAt
        ? Math.min((Date.now() - state.timerStartedAt) / 1000, state.timerDuration)
        : 0;

    team.answers[String(questionIndex)] = { choiceIndex, responseSeconds };
    team.lastSeen = Date.now();
    await setState(state);
    return NextResponse.json({ ok: true });
  }

  // ── Host actions (code A) ─────────────────────────────────────────────────
  const hostActions = ["host-start", "host-reveal", "host-debrief", "host-next", "host-scores", "host-set-answer"];
  if (hostActions.includes(action)) {
    if (!authorized(req, getCodeA())) return err("unauthorized", 401);
    const state = await getState();
    const questions = await getQuestions();

    if (action === "host-set-answer") {
      const { teamId, choiceIndex } = body as { teamId: string; choiceIndex: number };
      if (state.phase !== "question") return err("Seulement possible pendant la question en cours");
      const team = state.teams[teamId];
      if (!team) return err("Équipe introuvable");
      if (team.answers[String(state.questionIndex)] !== undefined) return err("Cette équipe a déjà une réponse enregistrée");
      if (choiceIndex < 0 || choiceIndex > 3) return err("Choix invalide");
      const responseSeconds = state.timerEnabled && state.timerStartedAt
        ? Math.min((Date.now() - state.timerStartedAt) / 1000, state.timerDuration)
        : 0;
      team.answers[String(state.questionIndex)] = { choiceIndex, responseSeconds };
      await setState(state);
      return NextResponse.json({ ok: true });
    }

    if (action === "host-start") {
      if (questions.length === 0) return err("Aucune question enregistrée — ajoutez et enregistrez des questions dans l'admin avant de démarrer");
      state.phase = "question";
      state.questionIndex = 0;
      state.timerStartedAt = state.timerEnabled ? Date.now() : null;
    } else if (action === "host-reveal") {
      if (state.phase !== "question") return err("wrong phase");
      state.phase = "reveal";
      state.timerStartedAt = null;
    } else if (action === "host-debrief") {
      if (state.phase !== "reveal") return err("wrong phase");
      state.phase = "debrief";
    } else if (action === "host-next") {
      const next = state.questionIndex + 1;
      if (next >= questions.length) {
        state.phase = "scores";
        state.timerStartedAt = null;
      } else {
        state.questionIndex = next;
        state.phase = "question";
        state.timerStartedAt = state.timerEnabled ? Date.now() : null;
      }
    } else if (action === "host-scores") {
      state.phase = "scores";
      state.timerStartedAt = null;
    }

    await setState(state);
    return NextResponse.json({ ok: true });
  }

  // ── Admin actions (code B) ────────────────────────────────────────────────
  const adminActions = [
    "admin-goto", "admin-reset-team", "admin-reset-all", "admin-replay",
    "admin-set-phase", "admin-save-questions", "admin-save-settings",
    "admin-add-bot",
  ];
  if (adminActions.includes(action)) {
    if (!authorized(req, getCodeB())) return err("unauthorized", 401);
    const state = await getState();
    const questions = await getQuestions();

    if (action === "admin-goto") {
      const { questionIndex } = body as { questionIndex: number };
      if (questions.length === 0) return err("Aucune question enregistrée");
      if (questionIndex < 0 || questionIndex >= questions.length) return err("Numéro de question invalide");
      state.questionIndex = questionIndex;
      state.phase = "question";
      state.timerStartedAt = state.timerEnabled ? Date.now() : null;
    } else if (action === "admin-reset-team") {
      const { teamId } = body as { teamId: string };
      delete state.teams[teamId];
    } else if (action === "admin-reset-all") {
      state.phase = "lobby";
      state.questionIndex = 0;
      state.timerStartedAt = null;
      state.teams = {};
    } else if (action === "admin-replay") {
      // Repart au début avec les mêmes équipes, mais efface leurs réponses/scores
      state.phase = "lobby";
      state.questionIndex = 0;
      state.timerStartedAt = null;
      for (const team of Object.values(state.teams)) {
        team.answers = {};
      }
    } else if (action === "admin-set-phase") {
      const { phase } = body as { phase: Phase };
      if (phase === "question" && questions.length === 0) return err("Aucune question enregistrée");
      state.phase = phase;
      if (phase === "question" && state.timerEnabled) {
        state.timerStartedAt = Date.now();
      } else if (phase !== "question") {
        state.timerStartedAt = null;
      }
    } else if (action === "admin-save-questions") {
      const { questions: incoming } = body as { questions: Question[] };
      if (!Array.isArray(incoming)) return err("Format de questions invalide (pas un tableau)");
      for (let i = 0; i < incoming.length; i++) {
        const q = incoming[i];
        if (!q || typeof q.question !== "string" || !q.question.trim()) {
          return err(`Question ${i + 1} : texte manquant ou invalide`);
        }
        if (!Array.isArray(q.choices) || q.choices.length !== 4 || q.choices.some((c) => typeof c !== "string" || !c.trim())) {
          return err(`Question ${i + 1} : il faut exactement 4 propositions non vides`);
        }
        if (typeof q.correctIndex !== "number" || q.correctIndex < 0 || q.correctIndex > 3) {
          return err(`Question ${i + 1} : index de bonne réponse invalide`);
        }
      }
      await setQuestions(incoming);
      // vérifie que l'écriture a bien été prise en compte avant de répondre
      const confirmed = await getQuestions();
      if (confirmed.length !== incoming.length) {
        return err("La sauvegarde n'a pas été confirmée par la base de données — réessayez", 500);
      }
      return NextResponse.json({ ok: true, count: confirmed.length });
    } else if (action === "admin-add-bot") {
      const botCount = Object.values(state.teams).filter((t) => t.isBot).length;
      const botId = `bot_${Date.now()}_${botCount}`;
      state.teams[botId] = {
        name: `🤖 Robot ${botCount + 1}`,
        answers: {},
        lastSeen: Date.now(),
        isBot: true,
      };
    } else if (action === "admin-save-settings") {
      const { timerEnabled, timerDuration } = body as {
        timerEnabled: boolean;
        timerDuration: number;
      };
      state.timerEnabled = timerEnabled;
      state.timerDuration = timerDuration;
    }

    await setState(state);
    return NextResponse.json({ ok: true });
  }

  // ── Auth actions ──────────────────────────────────────────────────────────
  if (action === "auth-control") {
    const { code } = body as { code: string };
    if (code !== getCodeA()) return err("wrong code", 401);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth_control", code, { httpOnly: true, path: "/" });
    return res;
  }

  if (action === "auth-admin") {
    const { code } = body as { code: string };
    if (code !== getCodeB()) return err("wrong code", 401);
    const res = NextResponse.json({ ok: true });
    res.cookies.set("auth_admin", code, { httpOnly: true, path: "/" });
    return res;
  }

  return err("unknown action");
}
