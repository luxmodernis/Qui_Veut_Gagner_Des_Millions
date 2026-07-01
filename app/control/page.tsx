"use client";

import { useEffect, useState, useCallback } from "react";
import Timer from "@/app/components/Timer";
import { calcAnswerScore, normalizeAnswer } from "@/lib/score";

type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

interface ApiState {
  phase: Phase;
  questionIndex: number;
  totalQuestions: number;
  timerEnabled: boolean;
  timerDuration: number;
  timerStartedAt: number | null;
  teams: { id: string; name: string; lastSeen: number; answers: Record<string, { choiceIndex: number; responseSeconds: number } | number>; score: number }[];
  currentQuestion: {
    question: string;
    choices: string[];
    correctIndex?: number;
    note?: string;
  } | null;
}

const LETTERS = ["A", "B", "C", "D"];
const CHOICE_COLORS = ["#1565c0", "#6a1b9a", "#2e7d32", "#e65100"];

async function post(action: string, extra = {}) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

export default function ControlPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [state, setState] = useState<ApiState | null>(null);

  const poll = useCallback(async () => {
    if (!authed) return;
    try {
      const res = await fetch("/api/state");
      setState(await res.json());
    } catch {}
  }, [authed]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [poll]);

  async function handleAuth() {
    const res = await post("auth-control", { code });
    if (res.ok) { setAuthed(true); setAuthError(""); }
    else setAuthError("Code incorrect");
  }

  if (!authed) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={{ color: "#f5c518", marginBottom: 24 }}>Animateur</h1>
          <input style={styles.input} type="password" placeholder="Code à 4 chiffres"
            value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()} maxLength={4} autoFocus />
          {authError && <p style={{ color: "#e53935" }}>{authError}</p>}
          <button style={styles.btnYellow} onClick={handleAuth}>Accéder</button>
        </div>
      </div>
    );
  }

  if (!state) return <div style={styles.center}><p style={{ color: "#fff" }}>Chargement…</p></div>;

  const { phase, currentQuestion, questionIndex, totalQuestions, teams,
    timerEnabled, timerDuration, timerStartedAt } = state;
  const now = Date.now();
  const answeredCount = teams.filter(t => t.answers[String(questionIndex)] !== undefined).length;

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <span style={{ color: "#f5c518", fontWeight: 700, fontSize: 18 }}>
          Question {questionIndex + 1}/{totalQuestions}
        </span>
        <span style={{ color: "#aaa" }}>
          Phase : <strong style={{ color: "#fff" }}>{{ lobby: "Salle d'attente", question: "Question", reveal: "Révélation", debrief: "Débrief", scores: "Scores" }[phase]}</strong>
        </span>
        <span style={{ color: "#aaa", fontSize: 14 }}>
          {teams.filter(t => now - t.lastSeen < 5000).length}/{teams.length} actives
        </span>
      </div>

      {/* Question + choix */}
      {currentQuestion && (
        <div style={styles.section}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#aaa", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Question</p>
              <p style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>{currentQuestion.question}</p>
            </div>
            {timerEnabled && timerStartedAt && phase === "question" && (
              <Timer timerStartedAt={timerStartedAt} timerDuration={timerDuration} size="md" />
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {currentQuestion.choices.map((c, i) => {
              const isCorrect = phase !== "question" && currentQuestion.correctIndex === i;
              return (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 8,
                  background: isCorrect ? "#1b3a1b" : CHOICE_COLORS[i] + "22",
                  border: `2px solid ${isCorrect ? "#4caf50" : CHOICE_COLORS[i] + "66"}`,
                }}>
                  <span style={{
                    background: CHOICE_COLORS[i], borderRadius: 6, padding: "2px 8px",
                    fontWeight: 700, fontSize: 13, color: "#fff", minWidth: 24, textAlign: "center",
                  }}>{LETTERS[i]}</span>
                  <span style={{ color: isCorrect ? "#69f0ae" : "#ddd", fontSize: 14, flex: 1 }}>{c}</span>
                  {isCorrect && <span style={{ color: "#4caf50", fontSize: 16 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Débrief */}
      {(phase === "reveal" || phase === "debrief") && currentQuestion?.note && (
        <div style={{ ...styles.section, borderLeft: "3px solid #7e57c2" }}>
          <p style={{ color: "#b39ddb", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Débrief</p>
          <p style={{ color: "#ddd", fontSize: 14, lineHeight: 1.6 }}>{currentQuestion.note}</p>
        </div>
      )}

      {/* Équipes + réponses */}
      <div style={styles.section}>
        <p style={{ color: "#aaa", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          Équipes — {answeredCount}/{teams.length} ont répondu
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {teams.map((t) => {
            const active = now - t.lastSeen < 5000;
            const rawAnswer = t.answers[String(questionIndex)];
            const hasAnswered = rawAnswer !== undefined;
            const answerIndex = rawAnswer === undefined ? undefined : typeof rawAnswer === "number" ? rawAnswer : rawAnswer.choiceIndex;
            const isCorrect = hasAnswered && currentQuestion?.correctIndex === answerIndex;
            const points = isCorrect && rawAnswer !== undefined && currentQuestion?.correctIndex !== undefined
              ? calcAnswerScore(normalizeAnswer(rawAnswer), currentQuestion.correctIndex, timerEnabled)
              : 0;
            const responseSeconds = rawAnswer !== undefined ? normalizeAnswer(rawAnswer).responseSeconds : 0;

            return (
              <div key={t.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderRadius: 8,
                background: "#12121f",
                border: `1px solid ${hasAnswered ? (phase === "question" ? "#333" : isCorrect ? "#4caf50" : "#e53935") : "#222"}`,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#4caf50" : "#555", flexShrink: 0 }} />
                <span style={{ color: "#fff", flex: 1, fontSize: 15 }}>{t.name}</span>
                {hasAnswered ? (
                  <span style={{
                    padding: "3px 10px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                    background: phase === "question"
                      ? "#333"
                      : isCorrect ? "#1b3a1b" : "#3a1b1b",
                    color: phase === "question"
                      ? "#fff"
                      : isCorrect ? "#69f0ae" : "#ff8a80",
                    border: `1px solid ${phase === "question" ? "#555" : isCorrect ? "#4caf50" : "#e53935"}`,
                  }}>
                    {answerIndex !== undefined ? LETTERS[answerIndex] : "?"}
                    {phase !== "question" && (isCorrect ? " ✓" : " ✗")}
                  </span>
                ) : (
                  <span style={{ color: "#555", fontSize: 13, fontStyle: "italic" }}>—</span>
                )}
                {isCorrect && phase !== "question" && (
                  <span style={{ color: "#69f0ae", fontSize: 12, fontWeight: 700, minWidth: 70, textAlign: "right" }}>
                    +{points} pt{points > 1 ? "s" : ""}
                    {timerEnabled && <span style={{ color: "#4a7a4a", fontWeight: 400 }}> ({responseSeconds.toFixed(1)}s)</span>}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        {phase === "lobby" && <Btn onClick={() => post("host-start")} color="#f5c518" label="▶ Démarrer" />}
        {phase === "question" && <Btn onClick={() => post("host-reveal")} color="#f5c518" label="Révéler la réponse" />}
        {phase === "reveal" && currentQuestion?.note && <Btn onClick={() => post("host-debrief")} color="#7e57c2" label="Afficher le débrief" />}
        {(phase === "reveal" || phase === "debrief") && (
          <Btn onClick={() => post("host-next")} color="#42a5f5"
            label={questionIndex + 1 >= totalQuestions ? "Voir les scores" : "Question suivante →"} />
        )}
        {phase === "question" && <Btn onClick={() => post("host-scores")} color="#ef9a9a" label="Forcer les scores" />}
      </div>
    </div>
  );
}

function Btn({ onClick, color, label }: { onClick: () => void; color: string; label: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "12px 24px", borderRadius: 10, border: "none",
      background: color, color: "#000", fontSize: 15, fontWeight: 700, cursor: "pointer",
    }}>
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0d0d1a", padding: "20px 16px", fontFamily: "system-ui, sans-serif" },
  center: { minHeight: "100vh", background: "#0d0d1a", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "#1a1a2e", borderRadius: 12, padding: "32px 24px", maxWidth: 360, width: "100%", textAlign: "center" },
  input: {
    width: "100%", padding: "12px 16px", borderRadius: 8, border: "2px solid #333",
    background: "#0d0d1a", color: "#fff", fontSize: 18, marginBottom: 12,
    textAlign: "center", letterSpacing: 8, boxSizing: "border-box",
  },
  btnYellow: { width: "100%", padding: 12, borderRadius: 8, border: "none", background: "#f5c518", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer", marginTop: 8 },
  topBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16, padding: "10px 16px", background: "#1a1a2e", borderRadius: 10,
  },
  section: { background: "#1a1a2e", borderRadius: 10, padding: "14px 16px", marginBottom: 12 },
  actions: { display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 16px", background: "#1a1a2e", borderRadius: 10 },
};
