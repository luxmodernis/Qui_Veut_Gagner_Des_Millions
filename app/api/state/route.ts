import { NextResponse } from "next/server";
import { getState, getQuestions } from "@/lib/redis";

export const runtime = "edge";

export async function GET() {
  const [state, questions] = await Promise.all([getState(), getQuestions()]);

  const currentQuestion =
    state.phase !== "lobby" && state.phase !== "scores"
      ? (() => {
          const q = questions[state.questionIndex];
          if (!q) return null;
          // hide correctIndex during question phase
          if (state.phase === "question") {
            const { correctIndex: _c, note: _n, ...safe } = q;
            return safe;
          }
          return q;
        })()
      : null;

  return NextResponse.json({
    phase: state.phase,
    questionIndex: state.questionIndex,
    totalQuestions: questions.length,
    teams: Object.entries(state.teams).map(([id, t]) => ({
      id,
      name: t.name,
      lastSeen: t.lastSeen,
      answers: t.answers,
    })),
    currentQuestion,
  });
}
