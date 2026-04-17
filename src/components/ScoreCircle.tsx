import { cn } from "@/lib/utils";

interface ScoreCircleProps {
  score: number;
  maxScore: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { box: 64, stroke: 5, font: "text-sm", label: "text-[10px]" },
  md: { box: 96, stroke: 7, font: "text-lg", label: "text-xs" },
  lg: { box: 144, stroke: 10, font: "text-3xl", label: "text-sm" },
};

export function ScoreCircle({
  score,
  maxScore,
  label,
  size = "md",
  className,
}: ScoreCircleProps) {
  const cfg = SIZES[size];
  const pct = Math.max(0, Math.min(1, maxScore > 0 ? score / maxScore : 0));
  const r = (cfg.box - cfg.stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);

  const tone =
    pct >= 0.85
      ? "stroke-success"
      : pct >= 0.6
        ? "stroke-warning"
        : "stroke-destructive";

  return (
    <div className={cn("inline-flex flex-col items-center gap-1.5", className)}>
      <div className="relative" style={{ width: cfg.box, height: cfg.box }}>
        <svg
          width={cfg.box}
          height={cfg.box}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={cfg.box / 2}
            cy={cfg.box / 2}
            r={r}
            strokeWidth={cfg.stroke}
            className="stroke-secondary"
            fill="none"
          />
          <circle
            cx={cfg.box / 2}
            cy={cfg.box / 2}
            r={r}
            strokeWidth={cfg.stroke}
            strokeLinecap="round"
            className={cn(tone, "transition-all duration-700")}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-display font-bold tabular-nums", cfg.font)}>
            {Math.round(score * 10) / 10}
          </span>
          <span className="text-muted-foreground text-[10px] tabular-nums">
            / {maxScore}
          </span>
        </div>
      </div>
      {label && (
        <span className={cn("text-muted-foreground text-center", cfg.label)}>
          {label}
        </span>
      )}
    </div>
  );
}
