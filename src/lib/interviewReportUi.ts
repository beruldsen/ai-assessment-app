import { CAPABILITIES } from "@/lib/capabilityFramework";

export type ReportTone = "strong" | "mid" | "low";

export function scoreTone(score: number): ReportTone {
  if (score > 3.5) return "strong";
  if (score < 3) return "low";
  return "mid";
}

export function toneClass(score: number) {
  const tone = scoreTone(score);
  if (tone === "strong") return "score-strong";
  if (tone === "low") return "score-low";
  return "score-mid";
}

export function toneLabel(score: number) {
  const tone = scoreTone(score);
  if (tone === "strong") return "Strong";
  if (tone === "low") return "Priority";
  return "Developing";
}

export function radarPoint(idx: number, value: number, total: number, cx: number, cy: number, radius: number) {
  const angle = (Math.PI * 2 * idx) / total - Math.PI / 2;
  const r = (value / 5) * radius;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r, angle };
}

export function splitLabel(text: string, maxLineLength = 18, maxLines = 3) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLineLength) {
      current = next;
      continue;
    }
    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxLineLength));
      current = word.slice(maxLineLength);
    }
    if (lines.length >= maxLines - 1) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

export function labelAnchor(angle: number) {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const cos = Math.cos(normalized);
  if (cos > 0.35) return "start";
  if (cos < -0.35) return "end";
  return "middle";
}

export function orderedCapabilityRows<T extends { capability: string }>(rows: T[]) {
  return CAPABILITIES.map((capability) => rows.find((row) => row.capability === capability)).filter((row): row is T => Boolean(row));
}

export function capabilityShortLabel(capability: string) {
  switch (capability) {
    case "Business Value Discovery & Co-Creation":
      return "Business Value Discovery";
    case "Customer & Internal Influence / Collaboration":
      return "Stakeholder Influence";
    case "Executive Communication, Storytelling & Presence":
      return "Executive Communication";
    case "Strategic Account Thinking":
      return "Strategic Account Thinking";
    case "AI Fluency & Human Trust Advantage":
      return "AI Fluency & Trust";
    case "Technical Credibility & Continuous Learning":
      return "Technical Credibility";
    default:
      return capability;
  }
}
