export default function Home() {
  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "#f5c518", fontSize: 36, marginBottom: 32 }}>Qui Veut Gagner Des Millions ?</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 240, margin: "0 auto" }}>
          <a href="/play" style={linkStyle("#f5c518", "#000")}>Équipe → /play</a>
          <a href="/tv" style={linkStyle("#1565c0", "#fff")}>TV → /tv</a>
          <a href="/control" style={linkStyle("#7e57c2", "#fff")}>Animateur → /control</a>
          <a href="/admin" style={linkStyle("#e53935", "#fff")}>Admin → /admin</a>
        </div>
      </div>
    </div>
  );
}

function linkStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: "block",
    padding: "14px 24px",
    borderRadius: 10,
    background: bg,
    color,
    fontWeight: 700,
    fontSize: 16,
    textDecoration: "none",
  };
}
