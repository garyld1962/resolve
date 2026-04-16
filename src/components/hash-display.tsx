"use client";

import { useState } from "react";

function truncate(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

/* Monospace hash display per DESIGN.md §4: truncated to first 8 + last 4 with
   expand on click. Copy-on-click optional; we keep it minimal for M2. */
export function HashDisplay({
  hex,
  tone = "glow",
}: {
  hex: string;
  tone?: "glow" | "mist";
}) {
  const [expanded, setExpanded] = useState(false);
  const toneClass = tone === "glow" ? "text-hash-glow" : "text-silver-mist";
  return (
    <button
      type="button"
      title={hex}
      onClick={() => setExpanded((v) => !v)}
      className={`font-mono text-xs ${toneClass} hover:text-cloud-white transition-colors cursor-pointer break-all text-left`}
    >
      {expanded ? hex : truncate(hex)}
    </button>
  );
}
