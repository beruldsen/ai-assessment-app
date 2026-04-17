import { labelAnchor, orderedCapabilityRows, radarPoint, splitLabel, toneClass } from "@/lib/interviewReportUi";

type RadarScore = {
  capability: string;
  score: number;
};

type Props = {
  scores: RadarScore[];
  size?: number;
  printMode?: boolean;
};

export default function InterviewRadarChart({ scores, size = 420, printMode = false }: Props) {
  const ordered = orderedCapabilityRows(scores);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * (printMode ? 0.25 : 0.28);
  const labelRadius = size * (printMode ? 0.38 : 0.4);
  const levels = [1, 2, 3, 4, 5];

  if (!ordered.length) return null;

  const polygon = ordered
    .map((item, idx) => {
      const point = radarPoint(idx, item.score, ordered.length, cx, cy, radius);
      return `${point.x},${point.y}`;
    })
    .join(" ");

  return (
    <div className="report-radar-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="report-radar" role="img" aria-label="Capability radar chart">
        {levels.map((level) => {
          const ring = ordered
            .map((_, idx) => {
              const point = radarPoint(idx, level, ordered.length, cx, cy, radius);
              return `${point.x},${point.y}`;
            })
            .join(" ");
          return <polygon key={level} points={ring} className="radar-ring" />;
        })}

        {ordered.map((_, idx) => {
          const point = radarPoint(idx, 5, ordered.length, cx, cy, radius);
          return <line key={idx} x1={cx} y1={cy} x2={point.x} y2={point.y} className="radar-axis" />;
        })}

        <polygon points={polygon} className="radar-shape" />

        {ordered.map((item, idx) => {
          const point = radarPoint(idx, item.score, ordered.length, cx, cy, radius);
          const labelPoint = radarPoint(idx, 5, ordered.length, cx, cy, labelRadius);
          const lines = splitLabel(item.capability);
          const anchor = labelAnchor(labelPoint.angle);
          return (
            <g key={item.capability}>
              <circle cx={point.x} cy={point.y} r={5} className={`radar-dot ${toneClass(item.score)}`} />
              <text x={labelPoint.x} y={labelPoint.y} textAnchor={anchor} className="radar-label">
                {lines.map((line, lineIdx) => (
                  <tspan key={lineIdx} x={labelPoint.x} dy={lineIdx === 0 ? 0 : 14}>{line}</tspan>
                ))}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
