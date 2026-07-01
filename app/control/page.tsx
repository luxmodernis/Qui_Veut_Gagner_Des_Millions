"use client";

import { useEffect, useState, useCallback } from "react";
import Timer from "@/app/components/Timer";
import { calcAnswerScore, normalizeAnswer } from "@/lib/score";

type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

interface ApiTeamAnswer { choiceIndex: number; responseSeconds: number }

interface ApiState {
  phase: Phase;
  questionIndex: number;
  totalQuestions: number;
  timerEnabled: boolean;
  timerDuration: number;
  timerStartedAt: number | null;
  teams: { id: string; name: string; lastSeen: number; answers: Record<string, ApiTeamAnswer | number>; score: number }[];
  currentQuestion: {
    question: string;
    choices: string[];
    correctIndex?: number;
    note?: string;
  } | null;
}

interface FullQuestion {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
  note?: string;
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
  const [manualTeamId, setManualTeamId] = useState<string | null>(null);
  const [allQuestions, setAllQuestions] = useState<FullQuestion[] | null>(null);

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

  useEffect(() => {
    if (!authed || state?.phase !== "scores" || allQuestions) return;
    fetch("/api/questions")
      .then((r) => r.json())
      .then((q: FullQuestion[]) => setAllQuestions(Array.isArray(q) ? q : null))
      .catch(() => {});
  }, [authed, state?.phase, allQuestions]);

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
          {totalQuestions === 0
            ? "Aucune question enregistrée"
            : (phase === "lobby" || phase === "scores")
              ? `${totalQuestions} question${totalQuestions > 1 ? "s" : ""} prête${totalQuestions > 1 ? "s" : ""}`
              : `Question ${questionIndex + 1}/${totalQuestions}`}
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
        <p style={{ color: "#aaa", fontSize: 12, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>
          Équipes — {answeredCount}/{teams.length} ont répondu
        </p>
        {phase === "question" && (
          <p style={{ color: "#555", fontSize: 11, marginBottom: 10 }}>
            Si une équipe n'apparaît pas comme ayant répondu, cliquez sur « Ajouter » pour enregistrer sa réponse manuellement.
          </p>
        )}
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
                ) : phase === "question" ? (
                  <button
                    onClick={() => setManualTeamId(t.id)}
                    style={{
                      padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                      background: "#1e1e2e", color: "#888", border: "1px solid #333", cursor: "pointer",
                    }}
                  >
                    + Ajouter
                  </button>
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

      {/* Récapitulatif de fin */}
      {phase === "scores" && (
        <ScoresRecap teams={teams} questions={allQuestions} timerEnabled={timerEnabled} />
      )}

      {/* Actions */}
      <div style={styles.actions}>
        {phase === "lobby" && (
          <Btn onClick={async () => { const r = await post("host-start"); if (!r.ok) alert(r.error); }} color="#f5c518" label="▶ Démarrer" />
        )}
        {phase === "question" && <Btn onClick={() => post("host-reveal")} color="#f5c518" label="Révéler la réponse" />}
        {phase === "reveal" && currentQuestion?.note && <Btn onClick={() => post("host-debrief")} color="#7e57c2" label="Afficher le débrief" />}
        {(phase === "reveal" || phase === "debrief") && (
          <Btn onClick={() => post("host-next")} color="#42a5f5"
            label={questionIndex + 1 >= totalQuestions ? "Voir les scores" : "Question suivante →"} />
        )}
      </div>

      {/* Arrêt anticipé */}
      {phase === "question" && (
        <div style={{ ...styles.actions, marginTop: 10, background: "#241414", border: "1px solid #4a2a2a" }}>
          <Btn
            onClick={() => {
              if (confirm("Arrêter le quiz maintenant et afficher le classement final ? Les questions restantes ne seront pas posées."))
                post("host-scores");
            }}
            color="#e57373"
            label="⏹ Arrêter le quiz et afficher le classement"
          />
        </div>
      )}

      {/* Popup réponse manuelle */}
      {manualTeamId && currentQuestion && (
        <ManualAnswerModal
          teamName={teams.find((t) => t.id === manualTeamId)?.name ?? ""}
          question={currentQuestion}
          onPick={async (choiceIndex) => {
            const r = await post("host-set-answer", { teamId: manualTeamId, choiceIndex });
            if (!r.ok) alert(r.error);
            setManualTeamId(null);
          }}
          onClose={() => setManualTeamId(null)}
        />
      )}
    </div>
  );
}

function ManualAnswerModal({
  teamName, question, onPick, onClose,
}: {
  teamName: string;
  question: { question: string; choices: string[] };
  onPick: (choiceIndex: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#1a1a2e", borderRadius: 12, padding: 20, maxWidth: 420, width: "100%" }}>
        <p style={{ color: "#f5c518", fontWeight: 700, marginBottom: 4 }}>{teamName}</p>
        <p style={{ color: "#ddd", fontSize: 14, marginBottom: 16 }}>{question.question}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {question.choices.map((c, i) => (
            <button
              key={i}
              onClick={() => onPick(i)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8,
                border: "none", background: CHOICE_COLORS[i] + "33", color: "#fff", fontSize: 14,
                cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ background: CHOICE_COLORS[i], borderRadius: 6, padding: "2px 8px", fontWeight: 700, fontSize: 13, minWidth: 24, textAlign: "center" }}>
                {LETTERS[i]}
              </span>
              {c}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ marginTop: 14, width: "100%", padding: 10, borderRadius: 8, border: "1px solid #333", background: "transparent", color: "#888", cursor: "pointer" }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function ScoresRecap({
  teams, questions, timerEnabled,
}: {
  teams: ApiState["teams"];
  questions: FullQuestion[] | null;
  timerEnabled: boolean;
}) {
  if (!questions) {
    return (
      <div style={{ ...styles.section, textAlign: "center", color: "#888", fontSize: 13 }}>
        Chargement du récapitulatif…
      </div>
    );
  }

  const ranked = [...teams].sort((a, b) => b.score - a.score);
  const teamCorrectCount = (t: ApiState["teams"][number]) =>
    questions.reduce((acc, q, qi) => {
      const raw = t.answers[String(qi)];
      if (raw === undefined) return acc;
      const idx = typeof raw === "number" ? raw : raw.choiceIndex;
      return acc + (idx === q.correctIndex ? 1 : 0);
    }, 0);

  const questionStats = questions.map((q, qi) => {
    let correct = 0;
    let answered = 0;
    let timeSum = 0;
    let timeCount = 0;
    for (const t of teams) {
      const raw = t.answers[String(qi)];
      if (raw === undefined) continue;
      answered++;
      const answer = normalizeAnswer(raw);
      if (answer.choiceIndex === q.correctIndex) {
        correct++;
        if (timerEnabled && answer.responseSeconds > 0) { timeSum += answer.responseSeconds; timeCount++; }
      }
    }
    return { question: q.question, correct, answered, avgTime: timeCount > 0 ? timeSum / timeCount : null };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={styles.section}>
        <p style={{ color: "#aaa", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          Classement détaillé
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {ranked.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 8, background: "#12121f" }}>
              <span style={{ color: "#666", fontSize: 12, minWidth: 20 }}>#{i + 1}</span>
              <span style={{ color: "#fff", flex: 1, fontSize: 14 }}>{t.name}</span>
              <span style={{ color: "#888", fontSize: 12 }}>{teamCorrectCount(t)}/{questions.length} correctes</span>
              <span style={{ color: "#f5c518", fontWeight: 700, fontSize: 14, minWidth: 60, textAlign: "right" }}>{t.score} pt{t.score > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <p style={{ color: "#aaa", fontSize: 12, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
          Question par question
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {questionStats.map((qs, i) => {
            const pct = teams.length > 0 ? Math.round((qs.correct / teams.length) * 100) : 0;
            return (
              <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "#12121f" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span style={{ color: "#ddd", fontSize: 13, flex: 1 }}>{i + 1}. {qs.question}</span>
                  <span style={{
                    color: pct >= 70 ? "#69f0ae" : pct >= 40 ? "#f5c518" : "#ff8a80",
                    fontWeight: 700, fontSize: 13, whiteSpace: "nowrap",
                  }}>
                    {qs.correct}/{teams.length} ({pct}%)
                  </span>
                </div>
                {qs.avgTime !== null && (
                  <p style={{ color: "#666", fontSize: 11, marginTop: 4 }}>Temps moyen des bonnes réponses : {qs.avgTime.toFixed(1)}s</p>
                )}
              </div>
            );
          })}
        </div>
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
