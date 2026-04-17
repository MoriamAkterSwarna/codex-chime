import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  Folder,
  Github,
  Lightbulb,
  Loader2,
  Play,
  Star,
  XCircle,
  GitFork,
} from "lucide-react";
import {
  fetchProjectWithLatestEvaluation,
  pollEvaluation,
  startEvaluation,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { Evaluation, ProjectWithEvaluation } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SiteHeader } from "@/components/SiteHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreCircle } from "@/components/ScoreCircle";
import { LighthouseBar } from "@/components/LighthouseBar";

function gradeFor(total: number | null) {
  if (total == null) return { letter: "—", tone: "text-muted-foreground" };
  if (total >= 90) return { letter: "A", tone: "text-success" };
  if (total >= 80) return { letter: "B", tone: "text-success" };
  if (total >= 70) return { letter: "C", tone: "text-warning" };
  if (total >= 60) return { letter: "D", tone: "text-warning" };
  return { letter: "F", tone: "text-destructive" };
}

const Report = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<ProjectWithEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const load = async () => {
    if (!projectId) return;
    try {
      const d = await fetchProjectWithLatestEvaluation(projectId);
      setData(d);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load report");
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();

    const channel = supabase
      .channel(`evaluations-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evaluations", filter: `project_id=eq.${projectId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleReevaluate = async () => {
    if (!data) return;
    setEvaluating(true);
    try {
      const { evaluationId } = await startEvaluation(
        data.id,
        data.live_url,
        data.github_repo,
      );
      toast.success("Re-evaluation started");
      await load();
      const stop = pollEvaluation(evaluationId, (ev: Evaluation) => {
        if (ev.status === "completed" || ev.status === "failed") {
          load();
          setEvaluating(false);
        }
      });
      // safety stop after 3 minutes
      setTimeout(() => {
        stop();
        setEvaluating(false);
      }, 180_000);
    } catch (e) {
      console.error(e);
      toast.error("Failed to start re-evaluation");
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-6 h-40 w-full rounded-xl" />
          <Skeleton className="mt-6 h-96 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Project not found.</p>
            <Button asChild variant="link" className="mt-4">
              <Link to="/">Back to dashboard</Link>
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const ev = data.evaluation;
  const grade = gradeFor(ev?.total_score ?? null);
  const fb = ev?.ai_feedback;
  const gh = ev?.github_analysis;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </Button>

        {/* Header card */}
        <Card className="glass shadow-card border-border/60 animate-fade-in-up p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                {data.student_name}
              </p>
              <h1 className="font-display mt-1.5 text-3xl font-bold tracking-tight sm:text-4xl">
                {data.project_title}
              </h1>
              <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-4 text-sm">
                <a
                  href={data.live_url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Live site
                </a>
                <a
                  href={data.github_repo}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
                >
                  <Github className="h-4 w-4" />
                  Repository
                </a>
                <StatusBadge status={ev?.status ?? null} />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right">
                <div
                  className={`font-display text-6xl font-bold leading-none ${grade.tone}`}
                >
                  {grade.letter}
                </div>
                <div className="text-muted-foreground mt-2 text-sm tabular-nums">
                  {ev?.total_score != null ? `${ev.total_score} / 100` : "Not scored"}
                </div>
              </div>
              <Button onClick={handleReevaluate} disabled={evaluating}>
                {evaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Re-evaluate
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Score circles */}
          {ev?.status === "completed" && (
            <div className="border-border/60 mt-8 grid grid-cols-2 gap-6 border-t pt-8 sm:grid-cols-4">
              <ScoreCircle
                score={ev.ui_design_score ?? 0}
                maxScore={20}
                label="UI & Design"
                size="md"
              />
              <ScoreCircle
                score={ev.functionality_score ?? 0}
                maxScore={60}
                label="Functionality"
                size="md"
              />
              <ScoreCircle
                score={ev.responsiveness_score ?? 0}
                maxScore={10}
                label="Responsiveness"
                size="md"
              />
              <ScoreCircle
                score={ev.code_quality_score ?? 0}
                maxScore={10}
                label="Code Quality"
                size="md"
              />
            </div>
          )}

          {ev?.status === "failed" && ev.error_message && (
            <div className="bg-destructive/10 text-destructive border-destructive/30 mt-6 rounded-lg border p-4 text-sm">
              <div className="font-medium">Evaluation failed</div>
              <div className="opacity-90">{ev.error_message}</div>
            </div>
          )}

          {ev?.status === "running" && (
            <div className="bg-warning/10 text-warning border-warning/30 mt-6 inline-flex items-center gap-2 rounded-lg border p-4 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running evaluation — this can take 30–60 seconds.
            </div>
          )}
        </Card>

        {/* Tabs */}
        {ev?.status === "completed" && (
          <Tabs defaultValue="feedback" className="mt-8">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="feedback">AI Feedback</TabsTrigger>
              <TabsTrigger value="lighthouse">Lighthouse</TabsTrigger>
              <TabsTrigger value="screenshots">Screenshots</TabsTrigger>
              <TabsTrigger value="github">GitHub</TabsTrigger>
            </TabsList>

            {/* Feedback */}
            <TabsContent value="feedback" className="mt-6 space-y-5">
              {fb?.overallSummary && (
                <Card className="glass border-primary/30 from-primary/10 bg-gradient-to-br to-transparent p-6">
                  <div className="text-primary mb-2 text-xs font-medium uppercase tracking-wider">
                    Overall summary
                  </div>
                  <p className="text-base leading-relaxed">{fb.overallSummary}</p>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <FeedbackList
                  title="Strengths"
                  items={fb?.strengths ?? []}
                  Icon={CheckCircle2}
                  tone="success"
                />
                <FeedbackList
                  title="Suggestions"
                  items={fb?.suggestions ?? []}
                  Icon={Lightbulb}
                  tone="warning"
                />
                <FeedbackList
                  title="Issues"
                  items={[
                    ...(fb?.uiUxIssues ?? []),
                    ...(fb?.layoutIssues ?? []),
                    ...(fb?.responsivenessIssues ?? []),
                  ]}
                  Icon={XCircle}
                  tone="destructive"
                />
              </div>
            </TabsContent>

            {/* Lighthouse */}
            <TabsContent value="lighthouse" className="mt-6">
              <Card className="glass border-border/60 p-6 sm:p-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <LighthouseBar label="Performance" score={ev.performance_score} />
                  <LighthouseBar label="Accessibility" score={ev.accessibility_score} />
                  <LighthouseBar label="Best Practices" score={ev.best_practices_score} />
                  <LighthouseBar label="SEO" score={ev.seo_score} />
                </div>
                <p className="text-muted-foreground mt-6 text-xs">
                  Scores from Google PageSpeed Insights (mobile strategy). 90+ green ·
                  50–89 amber · &lt;50 red.
                </p>
              </Card>
            </TabsContent>

            {/* Screenshots */}
            <TabsContent value="screenshots" className="mt-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card className="glass border-border/60 col-span-2 overflow-hidden p-4">
                  <div className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
                    Desktop · 1280px
                  </div>
                  {ev.desktop_screenshot_url ? (
                    <img
                      src={ev.desktop_screenshot_url}
                      alt="Desktop screenshot"
                      className="border-border/60 w-full rounded-lg border"
                      loading="lazy"
                    />
                  ) : (
                    <p className="text-muted-foreground py-12 text-center text-sm">
                      No screenshot available.
                    </p>
                  )}
                </Card>
                <Card className="glass border-border/60 overflow-hidden p-4">
                  <div className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-wider">
                    Mobile · 375px
                  </div>
                  {ev.mobile_screenshot_url ? (
                    <img
                      src={ev.mobile_screenshot_url}
                      alt="Mobile screenshot"
                      className="border-border/60 mx-auto w-full max-w-[280px] rounded-lg border"
                      loading="lazy"
                    />
                  ) : (
                    <p className="text-muted-foreground py-12 text-center text-sm">
                      No screenshot available.
                    </p>
                  )}
                </Card>
              </div>
            </TabsContent>

            {/* GitHub */}
            <TabsContent value="github" className="mt-6">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <Card className="glass border-border/60 p-6 lg:col-span-1">
                  <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                    Repository
                  </div>
                  <div className="font-display mt-2 break-all text-lg font-semibold">
                    {gh?.repoName ?? "—"}
                  </div>
                  {gh?.description && (
                    <p className="text-muted-foreground mt-2 text-sm">
                      {gh.description}
                    </p>
                  )}

                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <Stat icon={<Star className="h-4 w-4" />} label="Stars" value={gh?.stars ?? 0} />
                    <Stat icon={<GitFork className="h-4 w-4" />} label="Forks" value={gh?.forks ?? 0} />
                    <Stat
                      icon={<FileText className="h-4 w-4" />}
                      label="Files"
                      value={gh?.fileCount ?? 0}
                    />
                  </div>

                  {gh?.language && (
                    <div className="border-border/60 mt-5 flex items-center justify-between border-t pt-4 text-sm">
                      <span className="text-muted-foreground">Language</span>
                      <span className="font-medium">{gh.language}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">README</span>
                    <span
                      className={gh?.hasReadme ? "text-success font-medium" : "text-muted-foreground"}
                    >
                      {gh?.hasReadme ? "Present" : "Missing"}
                    </span>
                  </div>
                </Card>

                <Card className="glass border-border/60 p-6 lg:col-span-2">
                  <div className="text-muted-foreground mb-4 text-xs font-medium uppercase tracking-wider">
                    Folder structure
                  </div>
                  {gh?.folderStructure?.length ? (
                    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                      {gh.folderStructure.map((f) => (
                        <li
                          key={f.name}
                          className="bg-secondary/40 text-foreground/90 inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm"
                        >
                          {f.type === "dir" ? (
                            <Folder className="text-primary h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <FileText className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                          )}
                          <span className="truncate font-mono text-xs">{f.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">No data available.</p>
                  )}
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

function FeedbackList({
  title,
  items,
  Icon,
  tone,
}: {
  title: string;
  items: string[];
  Icon: typeof CheckCircle2;
  tone: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : "text-destructive";
  return (
    <Card className="glass border-border/60 p-6">
      <div className={`mb-4 flex items-center gap-2 text-sm font-semibold ${toneClass}`}>
        <Icon className="h-4 w-4" />
        {title}
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">None.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toneClass}`} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-secondary/40 rounded-lg p-3">
      <div className="text-muted-foreground flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="font-display mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default Report;
