"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Phase = "lobby" | "question" | "reveal" | "debrief" | "scores";

interface Question {
  question: string;
  choices: [string, string, string, string];
  correctIndex: number;
  note?: string;
}

interface ApiTeam {
  id: string;
  name: string;
  lastSeen: number;
  isBot?: boolean;
  answers: Record<string, { choiceIndex: number; responseSeconds: number } | number>;
}

interface ApiState {
  phase: Phase;
  questionIndex: number;
  totalQuestions: number;
  timerEnabled: boolean;
  timerDuration: number;
  timerStartedAt: number | null;
  teams: ApiTeam[];
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

// Délai déterministe par robot (3–9 s) basé sur l'id
function botDelay(teamId: string): number {
  let h = 0;
  for (let i = 0; i < teamId.length; i++) h = (h * 31 + teamId.charCodeAt(i)) & 0xffff;
  return 3 + (h % 7);
}

// Choix déterministe par robot & question (0–3)
function botChoice(teamId: string, questionIndex: number): number {
  const s = teamId + String(questionIndex);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h % 4;
}

const TEST_QUESTIONS: Question[] = [
  {
    question: "Quelle est la capitale de l'Australie ?",
    choices: ["Sydney", "Melbourne", "Canberra", "Brisbane"],
    correctIndex: 2,
    note: "Beaucoup pensent que c'est Sydney, mais Canberra est la capitale fédérale depuis 1913, choisie comme compromis entre Sydney et Melbourne.",
  },
  {
    question: "Combien d'os compte le corps humain adulte ?",
    choices: ["106", "206", "306", "406"],
    correctIndex: 1,
    note: "Un adulte possède 206 os. À la naissance on en a environ 270, mais beaucoup fusionnent avec la croissance.",
  },
  {
    question: "En quelle année l'homme a-t-il marché sur la Lune pour la première fois ?",
    choices: ["1965", "1967", "1969", "1972"],
    correctIndex: 2,
    note: "Neil Armstrong et Buzz Aldrin ont posé le pied sur la Lune le 20 juillet 1969, lors de la mission Apollo 11.",
  },
];

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState("");
  const [authError, setAuthError] = useState("");
  const [state, setState] = useState<ApiState | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [gotoIndex, setGotoIndex] = useState("");

  // Timer
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timerDuration, setTimerDuration] = useState(30);
  const [timerSaved, setTimerSaved] = useState(false);
  const [timerDurationInput, setTimerDurationInput] = useState("30");
  const timerInitRef = useRef(false);

  // Générateur IA
  const [genCount, setGenCount] = useState(3);
  const [genTopic, setGenTopic] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState("");
  const [genPreview, setGenPreview] = useState<Question[]>([]);

  // Bots — tracking des réponses déjà envoyées par cette session
  const botSubmittedRef = useRef<Set<string>>(new Set());
  const lastQuestionIndexRef = useRef<number>(-1);

  const poll = useCallback(async () => {
    if (!authed) return;
    try {
      const res = await fetch("/api/state");
      const data: ApiState = await res.json();
      setState(data);

      // Initialise les réglages timer une seule fois depuis le serveur
      if (!timerInitRef.current) {
        timerInitRef.current = true;
        setTimerEnabled(data.timerEnabled ?? false);
        const dur = data.timerDuration ?? 30;
        setTimerDuration(dur);
        setTimerDurationInput(String(dur));
      }

      // Réinitialise le tracking bots au changement de question
      if (data.questionIndex !== lastQuestionIndexRef.current) {
        lastQuestionIndexRef.current = data.questionIndex;
        botSubmittedRef.current = new Set();
      }

      // Auto-réponse des bots
      if (data.phase === "question" && data.timerStartedAt) {
        const elapsed = (Date.now() - data.timerStartedAt) / 1000;
        for (const team of data.teams) {
          if (!team.isBot) continue;
          const key = `${team.id}:${data.questionIndex}`;
          if (botSubmittedRef.current.has(key)) continue;
          if (team.answers[String(data.questionIndex)] !== undefined) {
            botSubmittedRef.current.add(key);
            continue;
          }
          const delay = botDelay(team.id);
          if (elapsed >= delay) {
            botSubmittedRef.current.add(key);
            post("answer", {
              teamId: team.id,
              questionIndex: data.questionIndex,
              choiceIndex: botChoice(team.id, data.questionIndex),
            });
          }
        }
      }
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

  async function handleGenerate() {
    setGenLoading(true);
    setGenError("");
    setGenPreview([]);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: genCount, topic: genTopic }),
      });
      const data = await res.json();
      if (!res.ok) { setGenError(data.error ?? "Erreur"); return; }
      setGenPreview(data.questions ?? []);
    } catch {
      setGenError("Erreur réseau");
    } finally {
      setGenLoading(false);
    }
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

  function addQuestion() { setQuestions((prev) => [...prev, emptyQuestion()]); }

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
  const realTeams = teams.filter((t) => !t.isBot);
  const botTeams = teams.filter((t) => t.isBot);

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

      {/* Équipes réelles */}
      <Section title={`Équipes (${realTeams.length})`}>
        {realTeams.length === 0 && <p style={{ color: "#aaa" }}>Aucune équipe connectée</p>}
        {realTeams.map((t) => {
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

      {/* Robots */}
      <Section title={`Robots de test (${botTeams.length})`}>
        <p style={{ color: "#666", fontSize: 12, marginBottom: 10 }}>
          Les robots répondent automatiquement 3–9 s après le début de chaque question. Ils apparaissent sur l'écran animateur et dans les scores.
        </p>
        {botTeams.map((t) => {
          const hasAnswered = t.answers[String(questionIndex)] !== undefined;
          return (
            <div key={t.id} style={styles.teamRow}>
              <span style={{ color: "#aaa", fontSize: 18 }}>🤖</span>
              <span style={{ color: "#bbb", flex: 1, fontSize: 14 }}>{t.name}</span>
              {phase === "question" && (
                <span style={{ fontSize: 12, color: hasAnswered ? "#4caf50" : "#888" }}>
                  {hasAnswered ? "✓ répondu" : "en attente…"}
                </span>
              )}
              <button onClick={() => post("admin-reset-team", { teamId: t.id })} style={styles.dangerBtn}>
                Supprimer
              </button>
            </div>
          );
        })}
        <button
          onClick={() => post("admin-add-bot")}
          style={{ ...styles.btn, background: "#263238", color: "#90a4ae", marginTop: botTeams.length > 0 ? 10 : 0 }}
        >
          + Ajouter un robot
        </button>
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

      {/* Timer */}
      <Section title="Chronomètre">
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div
            onClick={() => setTimerEnabled((v) => !v)}
            style={{ width: 48, height: 26, borderRadius: 13, cursor: "pointer", transition: "background 0.2s", flexShrink: 0, background: timerEnabled ? "#4caf50" : "#333", position: "relative" }}
          >
            <div style={{ position: "absolute", top: 3, left: timerEnabled ? 25 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
          <span style={{ color: timerEnabled ? "#4caf50" : "#888", fontWeight: 600, fontSize: 14 }}>
            {timerEnabled ? "Activé" : "Désactivé"}
          </span>

          {timerEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#aaa", fontSize: 14 }}>Durée :</span>
              <input
                type="number" min={5} max={300}
                value={timerDurationInput}
                onChange={(e) => setTimerDurationInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseInt(timerDurationInput);
                  const clamped = isNaN(parsed) ? 30 : Math.min(300, Math.max(5, parsed));
                  setTimerDuration(clamped);
                  setTimerDurationInput(String(clamped));
                }}
                style={{ ...styles.textInput, width: 64, textAlign: "center", flexShrink: 0 }}
              />
              <span style={{ color: "#aaa", fontSize: 14 }}>secondes</span>
            </div>
          )}

          <button
            onClick={async () => {
              await post("admin-save-settings", { timerEnabled, timerDuration });
              setTimerSaved(true);
              setTimeout(() => setTimerSaved(false), 3000);
            }}
            style={{ ...styles.btn, background: "#7e57c2", color: "#fff" }}
          >
            Enregistrer
          </button>
          {timerSaved && <span style={{ color: "#4caf50", fontSize: 14 }}>✓ Sauvegardé</span>}
        </div>
        <p style={{ color: "#555", fontSize: 12, marginTop: 10 }}>
          {timerEnabled
            ? `Les équipes auront ${timerDuration}s pour répondre. Score dégressif : 10 pts si réponse instantanée, ~15% de moins par seconde d'attente, minimum 1 pt si correct.`
            : "Sans chronomètre : 1 point par bonne réponse."}
        </p>
      </Section>

      {/* Générateur IA */}
      <Section title="Générateur de questions IA">
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14 }}>
          <div>
            <label style={styles.label}>Nombre</label>
            <input
              type="number" min={1} max={10}
              value={genCount}
              onChange={(e) => setGenCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 3)))}
              style={{ ...styles.textInput, width: 64, textAlign: "center" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={styles.label}>Thème <span style={{ color: "#555", fontWeight: 400 }}>(optionnel)</span></label>
            <input
              type="text"
              value={genTopic}
              onChange={(e) => setGenTopic(e.target.value)}
              placeholder="ex : cinéma, sport, géographie…"
              style={{ ...styles.textInput, width: "100%" }}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={genLoading}
            style={{ ...styles.btn, background: genLoading ? "#333" : "#f5c518", color: "#000", opacity: genLoading ? 0.6 : 1 }}
          >
            {genLoading ? "Génération…" : "✨ Générer"}
          </button>
        </div>

        {genError && <p style={{ color: "#e53935", fontSize: 13, marginBottom: 10 }}>{genError}</p>}

        {genPreview.length > 0 && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
              {genPreview.map((q, i) => (
                <div key={i} style={{ background: "#0d0d1a", borderRadius: 8, padding: "12px 14px", border: "1px solid #2a2a3e" }}>
                  <p style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{q.question}</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {q.choices.map((c, ci) => (
                      <span key={ci} style={{
                        padding: "3px 10px", borderRadius: 6, fontSize: 12,
                        background: ci === q.correctIndex ? "#1b3a1b" : "#1e1e2e",
                        color: ci === q.correctIndex ? "#69f0ae" : "#aaa",
                        border: `1px solid ${ci === q.correctIndex ? "#4caf50" : "#333"}`,
                      }}>
                        {LETTERS[ci]} — {c}
                      </span>
                    ))}
                  </div>
                  {q.note && <p style={{ color: "#666", fontSize: 12, marginTop: 6, fontStyle: "italic" }}>{q.note}</p>}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => { setQuestions((prev) => [...prev, ...genPreview]); setGenPreview([]); }}
                style={{ ...styles.btn, background: "#4caf50", color: "#000" }}
              >
                + Ajouter au quiz ({genPreview.length} question{genPreview.length > 1 ? "s" : ""})
              </button>
              <button
                onClick={() => setGenPreview([])}
                style={{ ...styles.btn, background: "#2a2a3e", color: "#aaa" }}
              >
                Ignorer
              </button>
            </div>
          </div>
        )}
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
                Débrief <span style={{ color: "#555", fontWeight: 400 }}>(optionnel)</span>
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
          <button
            onClick={() => {
              if (questions.length > 0 && !confirm("Remplacer les questions actuelles par 3 questions de test ?")) return;
              setQuestions(TEST_QUESTIONS);
            }}
            style={{ ...styles.btn, background: "#37474f", color: "#90a4ae" }}
          >
            Charger questions de test
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
  dangerBtn: { padding: "4px 10px", borderRadius: 6, border: "none", background: "#3a1a1a", color: "#e53935", fontSize: 13, cursor: "pointer" },
  iconBtn: { padding: "4px 8px", borderRadius: 6, border: "none", background: "#2a2a3e", color: "#aaa", fontSize: 14, cursor: "pointer" },
  teamRow: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e1e30" },
  label: { display: "block", color: "#888", fontSize: 12, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 },
  textareaSmall: { width: "100%", background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#fff", fontSize: 14, padding: "10px 12px", resize: "vertical", boxSizing: "border-box", fontFamily: "system-ui, sans-serif" },
  textInput: { flex: 1, background: "#1a1a2e", border: "1px solid #2a2a3e", borderRadius: 8, color: "#fff", fontSize: 14, padding: "8px 12px", boxSizing: "border-box" },
};
