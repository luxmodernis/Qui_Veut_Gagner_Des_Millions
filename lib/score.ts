import type { QuizState, Question, TeamAnswer } from "./types";

export function calcTeamScore(
  answers: Record<string, TeamAnswer | number>, // accept old format too
  questions: Question[],
  state: QuizState
): number {
  let total = 0;
  for (const [qIdxStr, raw] of Object.entries(answers)) {
    const qi = parseInt(qIdxStr);
    const q = questions[qi];
    if (!q) continue;

    // support ancienne structure (nombre brut)
    const answer: TeamAnswer =
      typeof raw === "number"
        ? { choiceIndex: raw, responseSeconds: 0 }
        : (raw as TeamAnswer);

    if (answer.choiceIndex !== q.correctIndex) continue;

    if (!state.timerEnabled || answer.responseSeconds <= 0) {
      total += 1;
    } else {
      // 10 pts si réponse immédiate, 1 pt minimum pour une bonne réponse
      const ratio = Math.max(0, 1 - answer.responseSeconds / state.timerDuration);
      total += Math.max(1, Math.round(10 * ratio));
    }
  }
  return total;
}
