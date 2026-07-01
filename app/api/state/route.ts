import { NextResponse } from "next/server";
import { getState, getQuestions } from "@/lib/redis";
import { calcTeamScore } from "@/lib/score";

export const runtime = "edge";

export async function GET() {
  const [state, questions] = await Promise.all([getState(), getQuestions()]);

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
  });
}
