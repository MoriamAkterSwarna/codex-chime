import { cn } from "@/lib/utils";

interface LighthouseBarProps {
  label: string;
  score: number | null;
}

export function LighthouseBar({ label, score }: LighthouseBarProps) {
  const v = score ?? 0;
  const tone =
    score == null
      ? "bg-muted"
      : v >= 90
        ? "gradient-success"
        : v >= 50
          ? "gradient-warn"
          : "gradient-danger";

  const textTone =
    score == null
      ? "text-muted-foreground"
      : v >= 90
        ? "text-success"
        : v >= 50
          ? "text-warning"
          : "text-destructive";

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn("font-display text-lg font-bold tabular-nums", textTone)}>
          {score == null ? "—" : score}
        </span>
      </div>
      <div className="bg-secondary relative h-2 overflow-hidden rounded-full">
        <div
          className={cn("h-full rounded-full transition-all duration-700", tone)}
          style={{ width: `${score == null ? 0 : v}%` }}
        />
      </div>
    </div>
  );
}
