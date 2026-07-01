import { NextResponse } from "next/server";
import { getState, getQuestions } from "@/lib/redis";
import { calcTeamScore } from "@/lib/score";

export const runtime = "edge";

export async function GET() {
  const [state, liveQuestions] = await Promise.all([getState(), getQuestions()]);

  // Utilise l'instantané figé au démarrage de la partie si disponible, pour
  // que le score et le récap restent cohérents même si la banque de questions
  // est modifiée pendant que la partie est en cours.
  const questions = state.playedQuestions ?? liveQuestions;

  const currentQuestion =
    state.phase !== "lobby" && state.phase !== "scores"
      ? (() => {
          const q = questions[state.questionIndex];
          if (!q) return null;
          if (state.phase === "question") {
            const { correctIndex: _c, note: _n, ...safe } = q;
            return safe;
          }
          return q;
        })()
      : null;

  const teams = Object.entries(state.teams).map(([id, t]) => ({
    id,
    name: t.name,
    lastSeen: t.lastSeen,
    isBot: t.isBot ?? false,
    answers: t.answers,
    score: calcTeamScore(t.answers, questions, state),
  }));

  // tri par score décroissant pour la phase scores
  const sortedTeams =
    state.phase === "scores"
      ? [...teams].sort((a, b) => b.score - a.score)
      : teams;

  return NextResponse.json({
    phase: state.phase,
    questionIndex: state.questionIndex,
    totalQuestions: questions.length,
    timerEnabled: state.timerEnabled,
    timerDuration: state.timerDuration,
    timerStartedAt: state.timerStartedAt,
    teams: sortedTeams,
    currentQuestion,
    // n'expose la banque complète (avec bonnes réponses) qu'une fois la partie
    // terminée, pour ne pas divulguer les réponses des questions à venir
    playedQuestions: state.phase === "scores" ? questions : null,
  });
}
