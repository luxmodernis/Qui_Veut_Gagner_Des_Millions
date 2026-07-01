"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
  const teamIdRef = useRef<string>(
    typeof window !== "undefined" ? getOrCreateTeamId() : ""
  );
  const [teamId] = useState(() => teamIdRef.current);
  const nameRef = useRef<string | null>(
    typeof window !== "undefined" ? localStorage.getItem("quiz_team_name") : null
  );
  const [name, setNameState] = useState<string | null>(nameRef.current);
  const [nameInput, setNameInput] = useState("");
  const [state, setState] = useState<ApiState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [timerExpired, setTimerExpired] = useState(false);
  const lastQuestionIndex = useRef<number>(-1);
  const pingCounterRef = useRef(0);

  function setName(n: string | null) {
    nameRef.current = n;
    setNameState(n);
  }

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      const data: ApiState = await res.json();
      setState(data);

      if (data.questionIndex !== lastQuestionIndex.current) {
        lastQuestionIndex.current = data.questionIndex;
        setSelected(null);
        setLocked(false);
        setTimerExpired(false);
      }

      const currentName = nameRef.current;
      const currentId = teamIdRef.current;
      if (!currentName) return;

      const stillExists = data.teams.some((t) => t.id === currentId);
      if (!stillExists) {
        localStorage.removeItem("quiz_team_id");
        localStorage.removeItem("quiz_team_name");
        teamIdRef.current = Math.random().toString(36).slice(2, 10);
        localStorage.setItem("quiz_team_id", teamIdRef.current);
        setName(null);
        return;
      }

      pingCounterRef.current += 1;
      if (pingCounterRef.current >= 10) {
        pingCounterRef.current = 0;
        post("join", { teamId: currentId, name: currentName });
      }
    } catch {}
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [poll]);

  async function handleJoin() {
    if (!nameInput.trim()) return;
    const currentId = teamIdRef.current;
    localStorage.setItem("quiz_team_id", currentId);
    await post("join", { teamId: currentId, name: nameInput.trim() });
    localStorage.setItem("quiz_team_name", nameInput.trim());
    pingCounterRef.current = 0;
    setName(nameInput.trim());
  }

  async function handleValidate(choiceIndex: number) {
    if (locked || timerExpired || !state) return;
    const res = await post("answer", {
      teamId: teamIdRef.current,
      questionIndex: state.questionIndex,
      choiceIndex,
    });
    if (res.ok) {
      setSelected(choiceIndex);
      setLocked(true);
    }
  }

  if (!name) {
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h1 style={styles.title}>Rejoindre le quiz</h1>
          <input style={styles.input} placeholder="Nom de l'équipe"
            value={nameInput} onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()} autoFocus />
          <button style={styles.btn} onClick={handleJoin}>Rejoindre</button>
        </div>
      </div>
    );
  }

  if (!state) return <div style={styles.center}><p style={{ color: "#fff" }}>Connexion…</p></div>;

  const { phase, currentQuestion, questionIndex, totalQuestions, teams,
    timerEnabled, timerDuration, timerStartedAt } = state;

  const isLocked = locked || timerExpired;

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
    const myRank = myTeam ? teams.findIndex((t) => t.id === teamId) + 1 : null;
    return (
      <div style={styles.center}>
        <div style={styles.card}>
          <h2 style={{ color: "#f5c518" }}>Quiz terminé !</h2>
          {myTeam && (
            <>
              <p style={{ color: "#fff", marginTop: 16, fontSize: 18 }}>{myTeam.name}</p>
              <p style={{ color: "#f5c518", fontSize: 32, fontWeight: 900, marginTop: 8 }}>
                {myTeam.score} pt{myTeam.score > 1 ? "s" : ""}
              </p>
              {myRank && <p style={{ color: "#aaa", marginTop: 8 }}>#{myRank} au classement</p>}
            </>
          )}
          <p style={{ color: "#666", marginTop: 12, fontSize: 13 }}>Consultez l'écran principal pour le classement complet.</p>
        </div>
      </div>
    );
  }

  if (phase === "question" && currentQuestion) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <span style={{ color: "#888", fontSize: 13 }}>Q {questionIndex + 1}/{totalQuestions}</span>
          {timerEnabled && timerStartedAt && (
            <Timer timerStartedAt={timerStartedAt} timerDuration={timerDuration} size="sm"
              onExpire={() => setTimerExpired(true)} />
          )}
          <span style={{ color: "#f5c518", fontWeight: 600, fontSize: 13 }}>{name}</span>
        </div>
        <h2 style={styles.question}>{currentQuestion.question}</h2>
        {timerExpired && !locked && (
          <div style={{ background: "#3a1a1a", border: "1px solid #e53935", borderRadius: 8, padding: "10px 14px", marginBottom: 12, textAlign: "center" }}>
            <p style={{ color: "#e53935", fontSize: 14, fontWeight: 600 }}>Temps écoulé — réponse bloquée</p>
          </div>
        )}
        <div style={styles.choices}>
          {currentQuestion.choices.map((c, i) => (
            <button key={i}
              onClick={() => !isLocked && handleValidate(i)}
              disabled={isLocked}
              style={{
                ...styles.choiceBtn,
                background: selected === i ? "#f5c518" : "#1e1e2e",
                color: selected === i ? "#000" : isLocked && selected !== i ? "#555" : "#fff",
                cursor: isLocked ? "default" : "pointer",
                borderColor: selected === i ? "#f5c518" : "#333",
              }}>
              <span style={styles.letter}>{LETTERS[i]}</span>
              {c}
            </button>
          ))}
        </div>
        {locked && (
          <p style={{ color: "#4caf50", textAlign: "center", marginTop: 16, fontWeight: 600 }}>
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
            <div key={i} style={{
              ...styles.choiceBtn,
              background: i === correct ? "#1b3a1b" : myAnswer === i ? "#3a1b1b" : "#1e1e2e",
              border: `2px solid ${i === correct ? "#4caf50" : myAnswer === i ? "#e53935" : "#333"}`,
              color: "#fff", cursor: "default",
            }}>
              <span style={styles.letter}>{LETTERS[i]}</span>
              {c}
              {i === correct && <span style={{ marginLeft: "auto", color: "#4caf50" }}>✓</span>}
            </div>
          ))}
        </div>
        <p style={{ color: myAnswer === correct ? "#4caf50" : "#e53935", textAlign: "center", marginTop: 20, fontWeight: 700, fontSize: 20 }}>
          {myAnswer === correct ? "Bonne réponse !" : myAnswer === null || timerExpired ? "Pas de réponse" : "Mauvaise réponse"}
        </p>
      </div>
    );
  }

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
  page: { minHeight: "100vh", background: "#0d0d1a", padding: "20px 16px", display: "flex", flexDirection: "column" },
  center: { minHeight: "100vh", background: "#0d0d1a", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { background: "#1a1a2e", borderRadius: 12, padding: "32px 24px", maxWidth: 420, width: "100%", textAlign: "center" },
  title: { color: "#f5c518", marginBottom: 24, fontSize: 24 },
  input: { width: "100%", padding: "12px 16px", borderRadius: 8, border: "2px solid #333", background: "#0d0d1a", color: "#fff", fontSize: 16, marginBottom: 16, boxSizing: "border-box" },
  btn: { width: "100%", padding: "12px", borderRadius: 8, border: "none", background: "#f5c518", color: "#000", fontSize: 16, fontWeight: 700, cursor: "pointer" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  question: { color: "#fff", fontSize: 20, lineHeight: 1.4, marginBottom: 20, textAlign: "center" },
  choices: { display: "flex", flexDirection: "column", gap: 10 },
  choiceBtn: { display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 10, border: "2px solid #333", fontSize: 15, textAlign: "left", transition: "all 0.15s" },
  letter: { background: "rgba(255,255,255,0.15)", borderRadius: 6, padding: "2px 8px", fontWeight: 700, fontSize: 13, minWidth: 26, textAlign: "center" },
};
