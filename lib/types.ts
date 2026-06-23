export type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

export interface Question {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
  note?: string;
}

export interface Team {
  name: string;
  answers: Record<string, number>; // questionIndex -> choiceIndex
  lastSeen: number;
}

export interface QuizState {
  phase: Phase;
  questionIndex: number;
  teams: Record<string, Team>;
}
