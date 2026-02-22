import type { EvidenceStrength } from "./rubric";

export type EvidenceItem = {
  domain: string;
  strength: EvidenceStrength;
};

const points: Record<EvidenceStrength, number> = {
  strong: 5,
  moderate: 3,
  weak: 1,
};

export function computeScores(items: EvidenceItem[]) {
  const byDomain = new Map<string, number[]>();

  for (const item of items) {
    const arr = byDomain.get(item.domain) ?? [];
    arr.push(points[item.strength]);
    byDomain.set(item.domain, arr);
  }

  return Array.from(byDomain.entries()).map(([domain, vals]) => {
    const score = vals.reduce((a, b) => a + b, 0) / vals.length;
    const maturity = score >= 4 ? "future_ready" : score >= 2.5 ? "advanced" : "foundation";

    return {
      domain,
      score: Number(score.toFixed(2)),
      maturity,
      evidence_count: vals.length,
    };
  });
}
