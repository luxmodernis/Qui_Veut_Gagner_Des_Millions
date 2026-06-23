"use client";

import { useEffect, useState, useCallback } from "react";

type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

interface Question {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
  note?: string;
}

interface ApiState {
  phase: Phase;
  questionIndex: number;
  totalQuestions: number;
  teams: { id: string; name: string; lastSeen: number }[];
}

const PHASE_LABELS: Record<Phase, string> = {
  lobby: "Salle d'attente",
  question: "Question",
  reveal: "Révélation",
  debrief: "Débrief",
  scores: "Scores",
};
const PHASES: Phase[] = ["lobby", "question", "reveal", "debrief", "scores"];
const LETTERS = ["A", "B", "C", "D"];

async function post(action: string, extra = {}) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

function emptyQuestion(): Question {
  return { question: "", choices: ["", "", "", ""], correctIndex: 0, note: "" };
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [state, setState] = useState<ApiState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [gotoIndex, setGotoIndex] = useState("");

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
    if (!authed) return;
    fetch("/api/questions")
      .then((r) => r.json())
      .then((q: Question[]) => setQuestions(q))
      .catch(() => {});
  }, [authed]);

  async function handleAuth() {
    const res = await post("auth-admin", { code });
    if (res.ok) { setAuthed(true); setAuthError(""); }
    else setAuthError("Code incorrect");
  }

  async function handleSave() {
    setSaveError("");
    // validate
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) { setSaveError(`Question ${i + 1} : texte manquant`); return; }
      for (let j = 0; j < 4; j++) {
        if (!q.choices[j].trim()) { setSaveError(`Question ${i + 1} : proposition ${LETTERS[j]} manquante`); return; }
      }
    }
    const res = await post("admin-save-questions", { questions });
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    else setSaveError(res.error ?? "Erreur serveur");
  }

  function updateQuestion(i: number, field: keyof Question, value: string | number) {
    setQuestions((prev) => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  function updateChoice(qi: number, ci: number, value: string) {
    setQuestions((prev) => prev.map((q, idx) => {
      if (idx !== qi) return q;
      const choices = [...q.choices] as [string, string, string, string];
      choices[ci] = value;
      return { ...q, choices };
    }));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(i: number) {
    if (!confirm(`Supprimer la question ${i + 1} ?`)) return;
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  function moveQuestion(i: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      return next;
    });
  }

  if (!authed) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={{ color: "#ef5350", marginBottom: 24 }}>Admin</h1>
          <input style={styles.pinInput} type="password" placeholder="Code admin"
            value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()} maxLength={4} autoFocus />
          {authError && <p style={{ color: "#e53935", marginBottom: 8 }}>{authError}</p>}
          <button style={{ ...styles.btn, background: "#ef5350", color: "#fff", width: "100%" }} onClick={handleAuth}>
            Accéder
          </button>
        </div>
      </div>
    );
  }

  if (!state) return <div style={styles.center}><p style={{ color: "#fff" }}>Chargement…</p></div>;

  const { phase, questionIndex, totalQuestions, teams } = state;
  const now = Date.now();

  return (
    <div style={styles.page}>
      <h1 style={{ color: "#ef5350", marginBottom: 20, fontSize: 22 }}>Supervision technique</h1>

      {/* État */}
      <Section title="État actuel">
        <p style={{ color: "#fff" }}>
          <strong style={{ color: "#f5c518" }}>{PHASE_LABELS[phase]}</strong>
          {phase !== "lobby" && phase !== "scores" && (
            <span style={{ color: "#aaa" }}> — Question {questionIndex + 1}/{totalQuestions}</span>
          )}
        </p>
      </Section>

      {/* Équipes */}
      <Section title={`Équipes (${teams.length})`}>
        {teams.length === 0 && <p style={{ color: "#aaa" }}>Aucune équipe connectée</p>}
        {teams.map((t) => {
          const active = now - t.lastSeen < 5000;
          return (
            <div key={t.id} style={styles.teamRow}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: active ? "#4caf50" : "#e53935", flexShrink: 0 }} />
              <span style={{ color: "#fff", flex: 1 }}>{t.name}</span>
              <span style={{ color: "#888", fontSize: 12 }}>
                {active ? "actif" : `il y a ${Math.round((now - t.lastSeen) / 1000)}s`}
              </span>
              <button onClick={() => post("admin-reset-team", { teamId: t.id })} style={styles.dangerBtn}>
                Supprimer
              </button>
            </div>
          );
        })}
      </Section>

      {/* Navigation */}
      <Section title="Navigation manuelle">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {PHASES.map((p) => (
            <button key={p} onClick={() => post("admin-set-phase", { phase: p })}
              style={{ ...styles.btn, background: p === phase ? "#ef5350" : "#2a2a3e", color: "#fff", padding: "8px 14px", fontSize: 13 }}>
              {PHASE_LABELS[p]}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input style={{ ...styles.pinInput, width: 80, marginBottom: 0, fontSize: 15, letterSpacing: 0, textAlign: "left", padding: "8px 12px" }}
            type="number" min={1} max={totalQuestions} placeholder="N°"
            value={gotoIndex} onChange={(e) => setGotoIndex(e.target.value)} />
          <button style={{ ...styles.btn, background: "#42a5f5", color: "#000" }}
            onClick={() => post("admin-goto", { questionIndex: parseInt(gotoIndex) - 1 })}>
            Aller à cette question
          </button>
        </div>
      </Section>

      {/* Reset */}
      <Section title="Reset complet">
        <button style={{ ...styles.btn, background: "#e53935", color: "#fff" }}
          onClick={() => { if (confirm("Réinitialiser TOUT le quiz ? Les équipes devront se reconnecter.")) post("admin-reset-all"); }}>
          Tout réinitialiser
        </button>
        <p style={{ color: "#666", fontSize: 12, marginTop: 8 }}>Remet le quiz en salle d'attente, efface toutes les équipes et réponses.</p>
      </Section>

      {/* Éditeur questions */}
      <Section title={`Questions (${questions.length})`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 16 }}>
          {questions.map((q, qi) => (
            <div key={qi} style={{ background: "#0d0d1a", borderRadius: 10, padding: 16, border: "1px solid #2a2a3e" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ color: "#f5c518", fontWeight: 700, fontSize: 14 }}>Question {qi + 1}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {qi > 0 && <button onClick={() => moveQuestion(qi, -1)} style={styles.iconBtn}>↑</button>}
                  {qi < questions.length - 1 && <button onClick={() => moveQuestion(qi, 1)} style={styles.iconBtn}>↓</button>}
                  <button onClick={() => removeQuestion(qi)} style={{ ...styles.iconBtn, color: "#e53935" }}>✕</button>
                </div>
              </div>

              <label style={styles.label}>Intitulé de la question</label>
              <textarea style={styles.textareaSmall} rows={2}
                value={q.question} onChange={(e) => updateQuestion(qi, "question", e.target.value)}
                placeholder="Saisissez la question…" />

              <label style={styles.label}>Propositions (cochez la bonne réponse)</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {q.choices.map((c, ci) => (
                  <div key={ci} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => updateQuestion(qi, "correctIndex", ci)}
                      style={{
                        width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, flexShrink: 0,
                        background: q.correctIndex === ci ? "#4caf50" : "#2a2a3e",
                        color: q.correctIndex === ci ? "#000" : "#888",
                      }}
                    >
                      {LETTERS[ci]}
                    </button>
                    <input style={styles.textInput} value={c}
                      onChange={(e) => updateChoice(qi, ci, e.target.value)}
                      placeholder={`Proposition ${LETTERS[ci]}…`} />
                  </div>
                ))}
              </div>

              <label style={{ ...styles.label, marginTop: 12 }}>
                Débrief <span style={{ color: "#555", fontWeight: 400 }}>(optionnel — affiché après la révélation)</span>
              </label>
              <textarea style={styles.textareaSmall} rows={2}
                value={q.note ?? ""} onChange={(e) => updateQuestion(qi, "note", e.target.value)}
                placeholder="Anecdote ou explication…" />
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={addQuestion} style={{ ...styles.btn, background: "#2a2a3e", color: "#fff" }}>
            + Ajouter une question
          </button>
          <button onClick={handleSave} style={{ ...styles.btn, background: "#4caf50", color: "#000" }}>
            Enregistrer les questions
          </button>
          {saved && <span style={{ color: "#4caf50", fontSize: 14 }}>✓ Sauvegardé</span>}
          {saveError && <span style={{ color: "#e53935", fontSize: 13 }}>{saveError}</span>}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 14 }}>
      <p style={{ color: "#aaa", fontSize: 12, marginBottom: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{title}</p>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0d0d1a", padding: "24px 16px", fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" },
  center: { minHeight: "100vh", background: "#0d0d1a", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "#1a1a2e", borderRadius: 12, padding: "32px 24px", maxWidth: 360, width: "100%", textAlign: "center" },
  pinInput: { width: "100%", padding: "12px 16px", borderRadius: 8, border: "2px solid #333", background: "#0d0d1a", color: "#fff", fontSize: 18, marginBottom: 12, textAlign: "center", letterSpacing: 8, boxSizing: "border-box" },
  btn: { padding: "10px 18px", borderRadius: 8, border: "none", fontSize: 14, fontWeight: 700, cursor: "pointer" },
  dangerBtn: { padding: "4px 10px", borderRadius: 6, border: "none", background: "#3a1a1a", color: "#e53935", fontSize: 13, cursor: "pointer", border2: "1px solid #e5393533" } as React.CSSProperties,
  iconBtn: { padding: "4px 8px", borderRadius: 6, border: "none", background: "#2a2a3e", color: "#aaa", fontSize: 14, cursor: "pointer" },
  teamRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e1e30" },
  label: { display: "block", color: "#888", fontSize: 12, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  textareaSmall: { width: "100%", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#fff", fontSize: 14, padding: "10px 12px", resize: "vertical", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  textInput: { flex: 1, background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#fff", fontSize: 14, padding: "8px 12px", boxSizing: "border-box" },
};
