"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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

function getOrCreateTeamId(): string {
  let id = localStorage.getItem("quiz_team_id");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    localStorage.setItem("quiz_team_id", id);
  }
  return id;
}

async function post(action: string, extra = {}) {
  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

export default function PlayPage() {
  const [teamId] = useState(() =>
    typeof window !== "undefined" ? getOrCreateTeamId() : ""
  );
  const [name, setName] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("quiz_team_name") : null
  );
  const [nameInput, setNameInput] = useState("");
  const [state, setState] = useState<ApiState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const lastQuestionIndex = useRef<number>(-1);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      const data: ApiState = await res.json();
      setState(data);
      // reset selection on new question
      if (data.questionIndex !== lastQuestionIndex.current) {
        lastQuestionIndex.current = data.questionIndex;
        setSelected(null);
        setLocked(false);
      }
      // detect admin reset: back to lobby and our team no longer exists
      if (data.phase === "lobby") {
        const currentId = localStorage.getItem("quiz_team_id");
        const stillExists = data.teams.some((t) => t.id === currentId);
        if (!stillExists && currentId) {
          localStorage.removeItem("quiz_team_id");
          localStorage.removeItem("quiz_team_name");
          setName(null);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [poll]);

  // keep lastSeen alive
  useEffect(() => {
    if (!name) return;
    const ping = () => post("join", { teamId, name });
    ping();
    const id = setInterval(ping, 10000);
    return () => clearInterval(id);
  }, [name, teamId]);

  async function handleJoin() {
    if (!nameInput.trim()) return;
    await post("join", { teamId, name: nameInput.trim() });
    localStorage.setItem("quiz_team_name", nameInput.trim());
    setName(nameInput.trim());
  }

  async function handleAnswer(choiceIndex: number) {
    if (locked || !state) return;
    setSelected(choiceIndex);
  }

  async function handleValidate() {
    if (selected === null || locked || !state) return;
    const res = await post("answer", {
      teamId,
      questionIndex: state.questionIndex,
      choiceIndex: selected,
    });
    if (res.ok) setLocked(true);
  }

  if (!name) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={styles.title}>Rejoindre le quiz</h1>
          <input
            style={styles.input}
            placeholder="Nom de l'équipe"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            autoFocus
          />
          <button style={styles.btn} onClick={handleJoin}>
            Rejoindre
          </button>
        </div>
      </div>
    );
  }

  if (!state) {
    return <div style={styles.center}><p style={{ color: "#fff" }}>Connexion…</p></div>;
  }

  const { phase, currentQuestion, questionIndex, totalQuestions, teams } = state;

  if (phase === "lobby") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2 style={{ color: "#f5c518", marginBottom: 8 }}>Bienvenue, {name} !</h2>
          <p style={{ color: "#ccc" }}>En attente du démarrage…</p>
          <p style={{ color: "#888", marginTop: 16, fontSize: 14 }}>
            {teams.length} équipe{teams.length > 1 ? "s" : ""} connectée{teams.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>
    );
  }

  if (phase === "scores") {
    const myTeam = teams.find((t) => t.id === teamId);
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2 style={{ color: "#f5c518" }}>Quiz terminé !</h2>
          {myTeam && <p style={{ color: "#fff", marginTop: 12 }}>Équipe : {myTeam.name}</p>}
          <p style={{ color: "#aaa", marginTop: 8 }}>Consultez l'écran principal pour les scores.</p>
        </div>
      </div>
    );
  }

  if (phase === "question" && currentQuestion) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <span style={{ color: "#888", fontSize: 13 }}>
            Question {questionIndex + 1} / {totalQuestions}
          </span>
          <span style={{ color: "#f5c518", fontWeight: 600 }}>{name}</span>
        </div>
        <h2 style={styles.question}>{currentQuestion.question}</h2>
        <div style={styles.choices}>
          {currentQuestion.choices.map((c, i) => (
            <button
              key={i}
              onClick={() => handleAnswer(i)}
              disabled={locked}
              style={{
                ...styles.choiceBtn,
                background: selected === i ? "#f5c518" : "#1e1e2e",
                color: selected === i ? "#000" : "#fff",
                opacity: locked && selected !== i ? 0.5 : 1,
              }}
            >
              <span style={styles.letter}>{LETTERS[i]}</span>
              {c}
            </button>
          ))}
        </div>
        {!locked && selected !== null && (
          <button style={styles.validateBtn} onClick={handleValidate}>
            Valider ma réponse
          </button>
        )}
        {locked && (
          <p style={{ color: "#4caf50", textAlign: "center", marginTop: 16 }}>
            Réponse envoyée !
          </p>
        )}
      </div>
    );
  }

  if (phase === "reveal" && currentQuestion) {
    const myAnswer = selected;
    const correct = currentQuestion.correctIndex;
    return (
      <div style={styles.page}>
        <h2 style={styles.question}>{currentQuestion.question}</h2>
        <div style={styles.choices}>
          {currentQuestion.choices.map((c, i) => (
            <div
              key={i}
              style={{
                ...styles.choiceBtn,
                background:
                  i === correct
                    ? "#4caf50"
                    : myAnswer === i
                    ? "#e53935"
                    : "#1e1e2e",
                color: "#fff",
              }}
            >
              <span style={styles.letter}>{LETTERS[i]}</span>
              {c}
            </div>
          ))}
        </div>
        <p style={{ color: myAnswer === correct ? "#4caf50" : "#e53935", textAlign: "center", marginTop: 20, fontWeight: 600, fontSize: 18 }}>
          {myAnswer === correct ? "Bonne réponse !" : myAnswer === null ? "Pas de réponse" : "Mauvaise réponse"}
        </p>
      </div>
    );
  }

  // debrief : on reste sur l'écran reveal, la TV gère le débrief
  if (phase === "debrief") {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <p style={{ color: "#aaa", fontSize: 14 }}>Regardez l'écran principal !</p>
        </div>
      </div>
    );
  }

  return <div style={styles.center}><p style={{ color: "#fff" }}>En attente…</p></div>;
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0d0d1a",
    padding: "20px 16px",
    display: "flex",
    flexDirection: "column",
  },
  center: {
    minHeight: "100vh",
    background: "#0d0d1a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    background: "#1a1a2e",
    borderRadius: 12,
    padding: "32px 24px",
    maxWidth: 420,
    width: "100%",
    textAlign: "center",
  },
  title: { color: "#f5c518", marginBottom: 24, fontSize: 24 },
  input: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 8,
    border: "2px solid #333",
    background: "#0d0d1a",
    color: "#fff",
    fontSize: 16,
    marginBottom: 16,
    boxSizing: "border-box",
  },
  btn: {
    width: "100%",
    padding: "12px",
    borderRadius: 8,
    border: "none",
    background: "#f5c518",
    color: "#000",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  question: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 1.4,
    marginBottom: 24,
    textAlign: "center",
  },
  choices: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  choiceBtn: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 16px",
    borderRadius: 10,
    border: "2px solid #333",
    fontSize: 16,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s",
  },
  letter: {
    background: "rgba(255,255,255,0.15)",
    borderRadius: 6,
    padding: "2px 8px",
    fontWeight: 700,
    fontSize: 14,
    minWidth: 28,
    textAlign: "center",
  },
  validateBtn: {
    marginTop: 20,
    padding: "14px",
    borderRadius: 10,
    border: "none",
    background: "#f5c518",
    color: "#000",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
  },
};
