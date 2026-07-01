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
      // Décroissance exponentielle : 10 pts si réponse instantanée, ~15%/seconde,
      // plancher à 1 pt. Indépendant de la durée du timer — favorise nettement
      // la rapidité (1s d'écart = écart net de points).
      const raw = 10 * Math.pow(0.85, answer.responseSeconds);
      total += Math.max(1, Math.round(raw));
    }
  }
  return total;
}
