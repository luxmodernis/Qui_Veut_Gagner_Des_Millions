export type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

export interface Question {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
  note?: string;
}

export interface TeamAnswer {
  choiceIndex: number;
  responseSeconds: number; // temps de réponse depuis le début du timer (0 si pas de timer)
}

export interface Team {
  name: string;
  answers: Record<string, TeamAnswer>; // questionIndex -> answer
  lastSeen: number;
  isBot?: boolean;
}

export interface QuizState {
  phase: Phase;
  questionIndex: number;
  timerEnabled: boolean;
  timerDuration: number;    // secondes
  timerStartedAt: number | null; // timestamp ms — remis à null entre les questions
  teams: Record<string, Team>;
  // Instantané des questions au démarrage de la partie en cours : garantit que
  // le score et le récap restent cohérents même si l'admin modifie la banque
  // de questions pendant que la partie est en cours. Remis à null au reset/replay.
  playedQuestions: Question[] | null;
}
