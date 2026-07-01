import type { QuizState, Question, TeamAnswer } from "./types";

export function normalizeAnswer(raw: TeamAnswer | number): TeamAnswer {
  // support ancienne structure (nombre brut)
  return typeof raw === "number" ? { choiceIndex: raw, responseSeconds: 0 } : raw;
}

// Points pour UNE réponse correcte à une question donnée. Retourne 0 si incorrecte.
export function calcAnswerScore(
  answer: TeamAnswer,
  correctIndex: number,
  timerEnabled: boolean
): number {
  if (answer.choiceIndex !== correctIndex) return 0;
  if (!timerEnabled || answer.responseSeconds <= 0) return 1;
  // Décroissance exponentielle : 10 pts si réponse instantanée, ~15%/seconde,
  // plancher à 1 pt. Indépendant de la durée du timer — favorise nettement
  // la rapidité (1s d'écart = écart net de points).
  return Math.max(1, Math.round(10 * Math.pow(0.85, answer.responseSeconds)));
}

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
    total += calcAnswerScore(normalizeAnswer(raw), q.correctIndex, state.timerEnabled);
  }
  return total;
}
