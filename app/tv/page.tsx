"use client";

import { useEffect, useState, useCallback } from "react";

type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

interface ApiState {
  phase: Phase;
  questionIndex: number;
  totalQuestions: number;
  teams: { id: string; name: string; lastSeen: number }[];
  currentQuestion: {
    question: string;
    choices: string[];
    correctIndex?: number;
    note?: string;
  } | null;
}

const LETTERS = ["A", "B", "C", "D"];
const COLORS = ["#1565c0", "#6a1b9a", "#2e7d32", "#e65100"];

export default function TvPage() {
  const [state, setState] = useState<ApiState | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      const data: ApiState = await res.json();
      setState(data);
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [poll]);

  if (!state) return <div style={styles.root} />;

  const { phase, currentQuestion, questionIndex, totalQuestions, teams } = state;

  if (phase === "lobby") {
    return (
      <div style={styles.root}>
        <div style={styles.logoArea}>
          <h1 style={styles.logo}>Qui Veut Gagner Des Millions ?</h1>
          <p style={{ color: "#aaa", fontSize: 22 }}>En attente des équipes…</p>
        </div>
        {teams.length > 0 && (
          <div style={styles.teamGrid}>
            {teams.map((t) => (
              <div key={t.id} style={styles.teamChip}>{t.name}</div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === "scores") {
    return (
      <div style={styles.root}>
        <h2 style={{ color: "#f5c518", fontSize: 42, marginBottom: 40 }}>Scores finaux</h2>
        <div style={{ width: "100%", maxWidth: 700 }}>
          {teams.map((t, i) => (
            <div key={t.id} style={styles.scoreRow}>
              <span style={{ color: "#f5c518", fontSize: 28, minWidth: 40 }}>#{i + 1}</span>
              <span style={{ color: "#fff", fontSize: 28, flex: 1 }}>{t.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!currentQuestion) return <div style={styles.root} />;

  if (phase === "question") {
    return (
      <div style={styles.root}>
        <div style={styles.questionBadge}>
          Question {questionIndex + 1} / {totalQuestions}
        </div>
        <h2 style={styles.questionText}>{currentQuestion.question}</h2>
        <div style={styles.choicesGrid}>
          {currentQuestion.choices.map((c, i) => (
            <div key={i} style={{ ...styles.choiceTile, background: COLORS[i] }}>
              <span style={styles.letterBadge}>{LETTERS[i]}</span>
              <span style={styles.choiceText}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "reveal") {
    const correct = currentQuestion.correctIndex ?? -1;
    return (
      <div style={styles.root}>
        <div style={styles.questionBadge}>
          Question {questionIndex + 1} / {totalQuestions}
        </div>
        <h2 style={styles.questionText}>{currentQuestion.question}</h2>
        <div style={styles.choicesGrid}>
          {currentQuestion.choices.map((c, i) => (
            <div
              key={i}
              style={{
                ...styles.choiceTile,
                background: i === correct ? "#2e7d32" : "#333",
                border: i === correct ? "4px solid #69f0ae" : "4px solid transparent",
                opacity: i === correct ? 1 : 0.45,
              }}
            >
              <span style={styles.letterBadge}>{LETTERS[i]}</span>
              <span style={styles.choiceText}>{c}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "debrief") {
    return (
      <div style={styles.root}>
        <div style={{ maxWidth: 800, textAlign: "center" }}>
          <h3 style={{ color: "#f5c518", fontSize: 32, marginBottom: 24 }}>Le saviez-vous ?</h3>
          <p style={{ color: "#ddd", fontSize: 26, lineHeight: 1.7 }}>
            {currentQuestion.note ?? "Préparez-vous pour la suite…"}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0a0a14",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 48px",
    fontFamily: "system-ui, sans-serif",
  },
  logoArea: { textAlign: "center", marginBottom: 48 },
  logo: {
    color: "#f5c518",
    fontSize: 52,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 16,
  },
  teamGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
    maxWidth: 1000,
  },
  teamChip: {
    background: "#1a1a2e",
    border: "2px solid #333",
    borderRadius: 12,
    padding: "12px 24px",
    color: "#fff",
    fontSize: 22,
  },
  questionBadge: {
    color: "#aaa",
    fontSize: 20,
    marginBottom: 24,
    letterSpacing: 1,
  },
  questionText: {
    color: "#fff",
    fontSize: 38,
    lineHeight: 1.4,
    textAlign: "center",
    maxWidth: 900,
    marginBottom: 48,
  },
  choicesGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 20,
    width: "100%",
    maxWidth: 960,
  },
  choiceTile: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "24px 28px",
    borderRadius: 16,
    transition: "all 0.3s",
  },
  letterBadge: {
    background: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    padding: "6px 14px",
    fontWeight: 900,
    fontSize: 22,
    color: "#fff",
    minWidth: 48,
    textAlign: "center",
  },
  choiceText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: 600,
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "16px 24px",
    background: "#1a1a2e",
    borderRadius: 12,
    marginBottom: 12,
  },
};
