"use client";

import { useEffect, useState } from "react";

interface TimerProps {
  timerStartedAt: number | null;
  timerDuration: number; // secondes
  size?: "sm" | "md" | "lg";
  onExpire?: () => void;
}

export default function Timer({ timerStartedAt, timerDuration, size = "md", onExpire }: TimerProps) {
  const [remaining, setRemaining] = useState<number>(timerDuration);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!timerStartedAt) return;
    setExpired(false);

    const tick = () => {
      const elapsed = (Date.now() - timerStartedAt) / 1000;
      const left = Math.max(0, timerDuration - elapsed);
      setRemaining(left);
      if (left <= 0 && !expired) {
        setExpired(true);
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerStartedAt, timerDuration]);

  if (!timerStartedAt) return null;

  const pct = remaining / timerDuration;
  const secs = Math.ceil(remaining);
  const color = pct > 0.5 ? "#4caf50" : pct > 0.25 ? "#f5c518" : "#e53935";

  const sizes = {
    sm: { ring: 48, stroke: 4, font: 14 },
    md: { ring: 72, stroke: 5, font: 22 },
    lg: { ring: 120, stroke: 7, font: 38 },
  };
  const s = sizes[size];
  const r = (s.ring - s.stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;

  return (
    <div style={{ position: "relative", width: s.ring, height: s.ring, flexShrink: 0 }}>
      <svg width={s.ring} height={s.ring} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={s.ring / 2} cy={s.ring / 2} r={r} fill="none" stroke="#333" strokeWidth={s.stroke} />
        <circle
          cx={s.ring / 2} cy={s.ring / 2} r={r} fill="none"
          stroke={color} strokeWidth={s.stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.1s linear, stroke 0.3s" }}
        />
      </svg>
      <span style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        color, fontWeight: 900, fontSize: s.font, fontVariantNumeric: "tabular-nums",
      }}>
        {secs}
      </span>
    </div>
  );
}
