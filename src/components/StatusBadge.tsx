import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EvaluationStatus } from "@/types";

interface StatusBadgeProps {
  status: EvaluationStatus | null;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const map = {
    null: {
      label: "Not evaluated",
      icon: Circle,
      classes: "bg-muted text-muted-foreground border-border",
      iconClass: "",
    },
    pending: {
      label: "Pending",
      icon: Circle,
      classes: "bg-muted text-muted-foreground border-border",
      iconClass: "",
    },
    running: {
      label: "Evaluating",
      icon: Loader2,
      classes: "bg-warning/15 text-warning border-warning/30",
      iconClass: "animate-spin",
    },
    completed: {
      label: "Completed",
      icon: CheckCircle2,
      classes: "bg-success/15 text-success border-success/30",
      iconClass: "",
    },
    failed: {
      label: "Failed",
      icon: XCircle,
      classes: "bg-destructive/15 text-destructive border-destructive/30",
      iconClass: "",
    },
  } as const;

  const key = (status ?? "null") as keyof typeof map;
  const cfg = map[key] ?? map.null;
  const Icon = cfg.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        cfg.classes,
        className,
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", cfg.iconClass)} />
      {cfg.label}
    </span>
  );
}
