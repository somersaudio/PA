"use client";

import { useState, useEffect } from "react";

const TOTAL_SECONDS = 120;
const RADIUS = 36;
const STROKE = 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function GenerationTimer({
  startTime,
  active,
}: {
  startTime: number;
  active: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 200);

    return () => clearInterval(interval);
  }, [active, startTime]);

  useEffect(() => {
    if (!active) setElapsed(0);
  }, [active]);

  const progress = Math.min(elapsed / TOTAL_SECONDS, 1);
  const offset = CIRCUMFERENCE * (1 - progress);
  const done = progress >= 1;

  if (!active) return null;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="relative">
        <svg width={RADIUS * 2 + STROKE * 2} height={RADIUS * 2 + STROKE * 2}>
          <circle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            fill="none"
            stroke="hsl(0, 0%, 25%)"
            strokeWidth={STROKE}
          />
          <circle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            fill="none"
            stroke={done ? "hsl(142, 70%, 50%)" : "hsl(210, 100%, 60%)"}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${RADIUS + STROKE} ${RADIUS + STROKE})`}
            style={{ transition: "stroke-dashoffset 0.3s ease, stroke 0.3s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`h-3 w-3 rounded-full ${done ? "bg-green-400" : "bg-blue-400 animate-pulse"}`} />
        </div>
      </div>
      <span className="text-xs text-muted-foreground">
        Generating on Suno
      </span>
    </div>
  );
}
