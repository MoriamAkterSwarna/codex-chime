import { Link } from "react-router-dom";
import { ExternalLink, Github, Loader2, Play, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import type { ProjectWithEvaluation } from "@/types";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: ProjectWithEvaluation;
  evaluating: boolean;
  onEvaluate: () => void;
}

function gradeFor(total: number | null): { letter: string; tone: string } {
  if (total == null) return { letter: "—", tone: "text-muted-foreground" };
  if (total >= 90) return { letter: "A", tone: "text-success" };
  if (total >= 80) return { letter: "B", tone: "text-success" };
  if (total >= 70) return { letter: "C", tone: "text-warning" };
  if (total >= 60) return { letter: "D", tone: "text-warning" };
  return { letter: "F", tone: "text-destructive" };
}

export function ProjectCard({ project, evaluating, onEvaluate }: ProjectCardProps) {
  const ev = project.evaluation;
  const grade = gradeFor(ev?.total_score ?? null);
  const isRunning = evaluating || ev?.status === "running";

  return (
    <Card className="group glass shadow-card hover:shadow-elegant border-border/60 relative overflow-hidden p-6 transition-all duration-300 hover:-translate-y-0.5">
      <div className="from-primary/5 absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {project.student_name}
          </p>
          <h3 className="font-display mt-1 truncate text-xl font-semibold">
            {project.project_title}
          </h3>
        </div>
        <div className="text-right">
          <div className={cn("font-display text-4xl font-bold leading-none", grade.tone)}>
            {grade.letter}
          </div>
          <div className="text-muted-foreground mt-1 text-[11px] tabular-nums">
            {ev?.total_score != null ? `${ev.total_score}/100` : "—"}
          </div>
        </div>
      </div>

      <div className="relative mt-4 flex items-center gap-2">
        <StatusBadge status={ev?.status ?? null} />
      </div>

      <div className="text-muted-foreground relative mt-5 flex items-center gap-4 text-xs">
        <a
          href={project.live_url}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Live
        </a>
        <a
          href={project.github_repo}
          target="_blank"
          rel="noreferrer"
          className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <Github className="h-3.5 w-3.5" />
          Repo
        </a>
      </div>

      <div className="relative mt-6 flex items-center gap-2">
        <Button
          onClick={onEvaluate}
          disabled={isRunning}
          variant={ev?.status === "completed" ? "secondary" : "default"}
          className="flex-1"
          size="sm"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Evaluating…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {ev?.status === "completed" ? "Re-evaluate" : "Evaluate"}
            </>
          )}
        </Button>
        {ev?.status === "completed" && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/report/${project.id}`}>
              Report
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </Card>
  );
}
