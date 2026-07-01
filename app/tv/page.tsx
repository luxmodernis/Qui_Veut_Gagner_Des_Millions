"use client";

import { useEffect, useState, useCallback } from "react";
import Timer from "@/app/components/Timer";

type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

interface ApiState {
  phase: Phase;
  questionIndex: number;
  totalQuestions: number;
  timerEnabled: boolean;
  timerDuration: number;
  timerStartedAt: number | null;
  teams: { id: string; name: string; lastSeen: number; score: number }[];
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

  const { phase, currentQuestion, questionIndex, totalQuestions, teams,
    timerEnabled, timerDuration, timerStartedAt } = state;

  if (phase === "lobby") {
    return (
      <div style={{ ...styles.root, background: "radial-gradient(ellipse at center, #0d1b4b 0%, #020510 70%)" }}>
        {/* Cercles décoratifs */}
        <div style={styles.ring1} />
        <div style={styles.ring2} />
        <div style={styles.ring3} />

        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Logo */}
          <div style={styles.logoWrap}>
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="58" stroke="#f5c518" strokeWidth="4" />
              <circle cx="60" cy="60" r="44" stroke="#f5c518" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x="60" y="52" textAnchor="middle" fill="#f5c518" fontSize="13" fontWeight="700" fontFamily="system-ui">QUI VEUT</text>
              <text x="60" y="68" textAnchor="middle" fill="#ffffff" fontSize="11" fontFamily="system-ui">GAGNER DES</text>
              <text x="60" y="83" textAnchor="middle" fill="#f5c518" fontSize="13" fontWeight="700" fontFamily="system-ui">MILLIONS ?</text>
            </svg>
          </div>

          <h1 style={styles.logo}>Qui Veut Gagner Des Millions ?</h1>
          <p style={{ color: "#7a8fcc", fontSize: 20, marginBottom: 48, letterSpacing: 2, textTransform: "uppercase" }}>
            {teams.length === 0 ? "En attente des équipes…" : `${teams.length} équipe${teams.length > 1 ? "s" : ""} connectée${teams.length > 1 ? "s" : ""}`}
          </p>

          {teams.length > 0 && (
            <div style={styles.teamGrid}>
              {teams.map((t) => (
                <div key={t.id} style={styles.teamChip}>
                  <span style={styles.teamDot} />
                  {t.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === "scores") {
    const medals = ["🥇", "🥈", "🥉"];
    return (
      <div style={{ ...styles.root, background: "radial-gradient(ellipse at center, #0d1b4b 0%, #020510 70%)" }}>
        <div style={styles.ring1} />
        <div style={styles.ring2} />
        <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <h2 style={{ color: "#f5c518", fontSize: 48, marginBottom: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: 3 }}>Classement final</h2>
          <p style={{ color: "#7a8fcc", fontSize: 18, marginBottom: 48, letterSpacing: 2 }}>Félicitations à toutes les équipes !</p>
          <div style={{ width: "100%" }}>
            {teams.map((t, i) => (
              <div key={t.id} style={{
                ...styles.scoreRow,
                background: i === 0 ? "linear-gradient(90deg, #2a1f00, #1a1a2e)" : "#111827",
                border: i === 0 ? "2px solid #f5c518" : "2px solid #1e293b",
                transform: i === 0 ? "scale(1.03)" : "scale(1)",
                marginBottom: i === 0 ? 20 : 10,
              }}>
                <span style={{ fontSize: 32, minWidth: 50 }}>{medals[i] ?? `#${i + 1}`}</span>
                <span style={{ color: i === 0 ? "#f5c518" : "#fff", fontSize: i === 0 ? 30 : 24, fontWeight: i === 0 ? 800 : 500, flex: 1 }}>{t.name}</span>
                <span style={{ color: i === 0 ? "#f5c518" : "#aaa", fontSize: i === 0 ? 26 : 20, fontWeight: 700 }}>{(t as { score: number }).score} pt{(t as { score: number }).score > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return <div style={styles.root} />;

  if (phase === "question") {
    return (
      <div style={styles.root}>
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 8 }}>
          <div style={styles.questionBadge}>
            Question {questionIndex + 1} / {totalQuestions}
          </div>
          {timerEnabled && timerStartedAt && (
            <Timer timerStartedAt={timerStartedAt} timerDuration={timerDuration} size="lg" />
          )}
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
    overflow: "hidden",
    position: "relative",
  },
  ring1: {
    position: "absolute",
    width: 700,
    height: 700,
    borderRadius: "50%",
    border: "1px solid rgba(245,197,24,0.08)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    pointerEvents: "none",
  },
  ring2: {
    position: "absolute",
    width: 1000,
    height: 1000,
    borderRadius: "50%",
    border: "1px solid rgba(245,197,24,0.05)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    pointerEvents: "none",
  },
  ring3: {
    position: "absolute",
    width: 1300,
    height: 1300,
    borderRadius: "50%",
    border: "1px solid rgba(245,197,24,0.03)",
    top: "50%",
    left: "50%",
    transform: "translate(-50%,-50%)",
    pointerEvents: "none",
  },
  logoWrap: {
    marginBottom: 32,
    filter: "drop-shadow(0 0 30px rgba(245,197,24,0.4))",
  },
  logo: {
    color: "#f5c518",
    fontSize: 52,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 4,
    marginBottom: 12,
    textShadow: "0 0 40px rgba(245,197,24,0.5)",
  },
  teamGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
    maxWidth: 1000,
  },
  teamChip: {
    background: "rgba(245,197,24,0.08)",
    border: "1px solid rgba(245,197,24,0.3)",
    borderRadius: 12,
    padding: "12px 28px",
    color: "#fff",
    fontSize: 22,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#4caf50",
    display: "inline-block",
    boxShadow: "0 0 6px #4caf50",
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
