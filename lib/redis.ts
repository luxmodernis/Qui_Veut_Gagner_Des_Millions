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
    question: "En quelle année a été créée la marque Erborian ?",
    choices: ["1999", "2005", "2007", "2012"],
    correctIndex: 2,
    note: "Erborian a été fondée en 2007 à Séoul, fruit d'une rencontre entre savoir-faire coréen et expertise française.",
  },
  {
    question: "Quelle plante emblématique est au cœur de la gamme Ginseng de Erborian ?",
    choices: ["Aloe vera", "Bambou", "Ginseng rouge", "Camelia"],
    correctIndex: 2,
    note: "Le ginseng rouge de Corée est utilisé depuis des siècles en médecine traditionnelle asiatique pour ses propriétés revitalisantes et anti-âge.",
  },
  {
    question: "Le BB Crème d'Erborian est inspiré d'un concept beauté originel. De quel pays vient-il ?",
    choices: ["Japon", "France", "Chine", "Corée du Sud"],
    correctIndex: 3,
    note: "Le BB Crème (Blemish Balm) est un incontournable de la routine beauté coréenne, utilisé à l'origine par les dermatologues pour protéger la peau après les interventions.",
  },
  {
    question: "Quelle est la signification du mot « Erborian » ?",
    choices: [
      "Herboriste en latin",
      "Contraction de « herbe » et « Corée »",
      "Nom d'une fleur coréenne",
      "Mot coréen pour « peau parfaite »",
    ],
    correctIndex: 1,
    note: "Erborian vient de la contraction des mots « herbe » et « Corée » — une promesse de nature et d'efficacité inspirée de la tradition coréenne.",
  },
];
