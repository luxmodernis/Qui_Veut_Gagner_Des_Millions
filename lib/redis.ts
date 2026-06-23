import { Redis } from "@upstash/redis";
import type { QuizState, Question } from "./types";

export const redis = new Redis({
  url: (process.env.UPSTASH_REDIS_REST_KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)!,
  token: (process.env.UPSTASH_REDIS_REST_KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)!,
});

const STATE_KEY = "quiz:state";
const QUESTIONS_KEY = "quiz:questions";

export async function getState(): Promise<QuizState> {
  const state = await redis.get<QuizState>(STATE_KEY);
  if (!state) {
    return { phase: "lobby", questionIndex: 0, teams: {} };
  }
  return state;
}

export async function setState(state: QuizState): Promise<void> {
  await redis.set(STATE_KEY, state);
}

export async function getQuestions(): Promise<Question[]> {
  const questions = await redis.get<Question[]>(QUESTIONS_KEY);
  return questions ?? DEFAULT_QUESTIONS;
}

export async function setQuestions(questions: Question[]): Promise<void> {
  await redis.set(QUESTIONS_KEY, questions);
}

const DEFAULT_QUESTIONS: Question[] = [
  {
    question: "Quelle est la capitale de la France ?",
    choices: ["Lyon", "Marseille", "Paris", "Bordeaux"],
    correctIndex: 2,
    note: "Paris est la capitale depuis le XIIe siècle.",
  },
  {
    question: "Combien de côtés a un hexagone ?",
    choices: ["4", "5", "6", "8"],
    correctIndex: 2,
  },
];
