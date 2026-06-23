"use client";

import { useEffect, useState, useCallback } from "react";

type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

interface ApiState {
  phase: Phase;
  questionIndex: number;
  totalQuestions: number;
  teams: { id: string; name: string; lastSeen: number }[];
  currentQuestion: null | object;
}

async function post(action: string, extra = {}) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

const PHASES: Phase[] = ["lobby", "question", "reveal", "debrief", "scores"];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [state, setState] = useState<ApiState | null>(null);
  const [questionsJson, setQuestionsJson] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [jsonSaved, setJsonSaved] = useState(false);
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

  // Load questions JSON on auth
  useEffect(() => {
    if (!authed) return;
    fetch("/api/state")
      .then((r) => r.json())
      .then((s: ApiState) => setState(s));
    // We don't have a direct questions endpoint exposed publicly; use admin-save-questions to edit
  }, [authed]);

  async function handleAuth() {
    const res = await post("auth-admin", { code });
    if (res.ok) {
      setAuthed(true);
      setAuthError("");
    } else {
      setAuthError("Code incorrect");
    }
  }

  async function handleSaveQuestions() {
    try {
      const questions = JSON.parse(questionsJson);
      const res = await post("admin-save-questions", { questions });
      if (res.ok) {
        setJsonSaved(true);
        setJsonError("");
        setTimeout(() => setJsonSaved(false), 3000);
      } else {
        setJsonError(res.error ?? "Erreur serveur");
      }
    } catch {
      setJsonError("JSON invalide");
    }
  }

  if (!authed) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={{ color: "#ef5350", marginBottom: 24 }}>Admin</h1>
          <input
            style={styles.input}
            type="password"
            placeholder="Code admin"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            maxLength={4}
            autoFocus
          />
          {authError && <p style={{ color: "#e53935" }}>{authError}</p>}
          <button style={{ ...styles.btn, background: "#ef5350" }} onClick={handleAuth}>
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
      <h1 style={{ color: "#ef5350", marginBottom: 20 }}>Supervision technique</h1>

      {/* Status */}
      <Section title="État actuel">
        <p style={{ color: "#fff" }}>
          Phase : <strong>{phase}</strong> | Question : {questionIndex + 1}/{totalQuestions}
        </p>
      </Section>

      {/* Teams */}
      <Section title={`Équipes (${teams.length})`}>
        {teams.length === 0 && <p style={{ color: "#aaa" }}>Aucune équipe</p>}
        {teams.map((t) => {
          const active = now - t.lastSeen < 5000;
          return (
            <div key={t.id} style={styles.teamRow}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: active ? "#4caf50" : "#e53935", display: "inline-block" }} />
              <span style={{ color: "#fff", flex: 1 }}>{t.name}</span>
              <span style={{ color: "#888", fontSize: 12 }}>
                {active ? "actif" : `il y a ${Math.round((now - t.lastSeen) / 1000)}s`}
              </span>
              <button
                onClick={() => post("admin-reset-team", { teamId: t.id })}
                style={styles.dangerBtn}
              >
                Reset
              </button>
            </div>
          );
        })}
      </Section>

      {/* Navigation */}
      <Section title="Navigation manuelle">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {PHASES.map((p) => (
            <button
              key={p}
              onClick={() => post("admin-set-phase", { phase: p })}
              style={{ ...styles.btn, background: p === phase ? "#ef5350" : "#333", color: "#fff", padding: "8px 14px" }}
            >
              {p}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            style={{ ...styles.input, width: 80, marginBottom: 0 }}
            type="number"
            min={1}
            max={totalQuestions}
            placeholder="N°"
            value={gotoIndex}
            onChange={(e) => setGotoIndex(e.target.value)}
          />
          <button
            style={{ ...styles.btn, background: "#42a5f5", color: "#000" }}
            onClick={() => post("admin-goto", { questionIndex: parseInt(gotoIndex) - 1 })}
          >
            Aller à la question
          </button>
        </div>
      </Section>

      {/* Reset */}
      <Section title="Reset complet">
        <button
          style={{ ...styles.btn, background: "#e53935", color: "#fff" }}
          onClick={() => {
            if (confirm("Réinitialiser TOUT le quiz ?")) post("admin-reset-all");
          }}
        >
          Reset complet (retour lobby)
        </button>
      </Section>

      {/* Questions editor */}
      <Section title="Éditeur de questions (JSON)">
        <p style={{ color: "#aaa", fontSize: 13, marginBottom: 8 }}>
          Collez le JSON des questions ici. Sauvegardé dans Redis sans redéploiement.
        </p>
        <textarea
          style={styles.textarea}
          value={questionsJson}
          onChange={(e) => { setQuestionsJson(e.target.value); setJsonError(""); setJsonSaved(false); }}
          placeholder={`[\n  {\n    "question": "...",\n    "choices": ["A","B","C","D"],\n    "correctIndex": 0,\n    "note": "optionnel"\n  }\n]`}
          rows={14}
        />
        {jsonError && <p style={{ color: "#e53935", marginTop: 4 }}>{jsonError}</p>}
        {jsonSaved && <p style={{ color: "#4caf50", marginTop: 4 }}>Sauvegardé !</p>}
        <button style={{ ...styles.btn, background: "#4caf50", color: "#000", marginTop: 8 }} onClick={handleSaveQuestions}>
          Sauvegarder les questions
        </button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1a1a2e", borderRadius: 10, padding: 16, marginBottom: 16 }}>
      <p style={{ color: "#aaa", fontSize: 13, marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{title}</p>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0d0d1a",
    padding: "24px 20px",
    fontFamily: "system-ui, sans-serif",
    maxWidth: 700,
    margin: "0 auto",
  },
  center: {
    minHeight: "100vh",
    background: "#0d0d1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    background: "#1a1a2e",
    borderRadius: 12,
    padding: "32px 24px",
    maxWidth: 360,
    width: "100%",
    textAlign: "center",
  },
  input: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "2px solid #333",
    background: "#0d0d1a",
    color: "#fff",
    fontSize: 16,
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 4,
    boxSizing: "border-box",
    width: "100%",
  },
  btn: {
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "4px 10px",
    borderRadius: 6,
    border: "none",
    background: "#e53935",
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
  },
  teamRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid #222",
  },
  textarea: {
    width: "100%",
    background: "#0d0d1a",
    border: "2px solid #333",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    fontFamily: "monospace",
    padding: 12,
    resize: "vertical",
    boxSizing: "border-box",
  },
};
