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
    if (res.ok) {
      setAuthed(true);
      setAuthError("");
    } else {
      setAuthError("Code incorrect");
    }
  }

  if (!authed) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={{ color: "#f5c518", marginBottom: 24 }}>Animateur</h1>
          <input
            style={styles.input}
            type="password"
            placeholder="Code à 4 chiffres"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            maxLength={4}
            autoFocus
          />
          {authError && <p style={{ color: "#e53935" }}>{authError}</p>}
          <button style={styles.btn} onClick={handleAuth}>Accéder</button>
        </div>
      </div>
    );
  }

  if (!state) return <div style={styles.center}><p style={{ color: "#fff" }}>Chargement…</p></div>;

  const { phase, currentQuestion, questionIndex, totalQuestions, teams } = state;
  const now = Date.now();

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <span style={{ color: "#f5c518", fontWeight: 700, fontSize: 18 }}>
          Animateur — Question {questionIndex + 1}/{totalQuestions}
        </span>
        <span style={{ color: "#aaa" }}>Phase : <strong style={{ color: "#fff" }}>{phase}</strong></span>
      </div>

      {currentQuestion && (
        <div style={styles.section}>
          <p style={{ color: "#aaa", fontSize: 13, marginBottom: 4 }}>Question courante</p>
          <p style={{ color: "#fff", fontSize: 18, fontWeight: 600 }}>{currentQuestion.question}</p>
        </div>
      )}

      <div style={styles.section}>
        <p style={{ color: "#aaa", fontSize: 13, marginBottom: 8 }}>
          Équipes ({teams.length}) — {teams.filter(t => {
            const team = state.teams.find(x => x.id === t.id);
            return (now - (team?.lastSeen ?? 0)) < 5000;
          }).length} actives
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {teams.map((t) => {
            const active = (now - t.lastSeen) < 5000;
            return (
              <div key={t.id} style={{ ...styles.teamTag, borderColor: active ? "#4caf50" : "#555" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: active ? "#4caf50" : "#555", display: "inline-block", marginRight: 6 }} />
                {t.name}
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.actions}>
        {phase === "lobby" && (
          <Btn onClick={() => post("host-start")} color="#f5c518" label="Démarrer le quiz" />
        )}
        {phase === "question" && (
          <Btn onClick={() => post("host-reveal")} color="#f5c518" label="Révéler la réponse" />
        )}
        {phase === "reveal" && currentQuestion?.note && (
          <Btn onClick={() => post("host-debrief")} color="#7e57c2" label="Afficher le débrief" />
        )}
        {(phase === "reveal" || phase === "debrief") && (
          <Btn
            onClick={() => post("host-next")}
            color="#42a5f5"
            label={questionIndex + 1 >= totalQuestions ? "Voir les scores" : "Question suivante"}
          />
        )}
        {phase === "question" && (
          <Btn onClick={() => post("host-scores")} color="#ef9a9a" label="Forcer les scores" />
        )}
      </div>
    </div>
  );
}

function Btn({ onClick, color, label }: { onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 28px",
        borderRadius: 10,
        border: "none",
        background: color,
        color: "#000",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        margin: 4,
      }}
    >
      {label}
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0d0d1a",
    padding: "24px 20px",
    fontFamily: "system-ui, sans-serif",
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
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "2px solid #333",
    background: "#0d0d1a",
    color: "#fff",
    fontSize: 18,
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 8,
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    padding: 12,
    borderRadius: 8,
    border: "none",
    background: "#f5c518",
    color: "#000",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 8,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    padding: "12px 16px",
    background: "#1a1a2e",
    borderRadius: 10,
  },
  section: {
    background: "#1a1a2e",
    borderRadius: 10,
    padding: "16px",
    marginBottom: 16,
  },
  teamTag: {
    padding: "6px 12px",
    borderRadius: 8,
    border: "2px solid",
    color: "#fff",
    fontSize: 14,
    display: "flex",
    alignItems: "center",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    padding: "16px",
    background: "#1a1a2e",
    borderRadius: 10,
  },
};
