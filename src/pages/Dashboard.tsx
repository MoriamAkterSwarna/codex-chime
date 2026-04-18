import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart3, GraduationCap, Sparkles, TrendingUp } from "lucide-react";
import { fetchProjects, startEvaluation } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import type { ProjectWithEvaluation } from "@/types";
import { Card } from "@/components/ui/card";
import { SiteHeader } from "@/components/SiteHeader";
import { ImageMatcher } from "@/components/ImageMatcher";

const Dashboard = () => {
  const [projects, setProjects] = useState<ProjectWithEvaluation[]>([]);

  const reload = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load projects");
    }
  };

  useEffect(() => {
    reload();

    const channel = supabase
      .channel("evaluations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "evaluations" },
        () => {
          reload();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const stats = useMemo(() => {
    const completed = projects.filter((p) => p.evaluation?.status === "completed");
    const totals = completed
      .map((p) => p.evaluation?.total_score)
      .filter((v): v is number => v != null);
    const avg = totals.length
      ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10
      : null;
    const top = totals.length ? Math.max(...totals) : null;
    return {
      total: projects.length,
      completed: completed.length,
      avg,
      top,
    };
  }, [projects]);

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:px-8">
        {/* Hero */}
        <section className="animate-fade-in-up">
          <div className="border-primary/30 bg-primary/10 text-primary mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Powered by Lovable AI
          </div>
          <h1 className="font-display max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
            Evaluate student projects in seconds, not hours.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-lg">
            Automated UI critique, Lighthouse performance, and GitHub repo analysis —
            all distilled into a clear, gradable report.
          </p>
        </section>

        {/* Stats */}
        <section className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            label="Projects"
            value={stats.total}
            icon={<GraduationCap className="h-4 w-4" />}
          />
          <StatCard
            label="Evaluated"
            value={stats.completed}
            icon={<BarChart3 className="h-4 w-4" />}
          />
          <StatCard
            label="Avg score"
            value={stats.avg ?? "—"}
            icon={<TrendingUp className="h-4 w-4" />}
            accent
          />
          <StatCard
            label="Top score"
            value={stats.top ?? "—"}
            icon={<Sparkles className="h-4 w-4" />}
          />
        </section>

        {/* Image-to-image matcher */}
        <section className="mt-12">
          <ImageMatcher />
        </section>
      </main>
    </div>
  );
};

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Card className="glass border-border/60 p-5">
      <div className="text-muted-foreground flex items-center gap-2 text-xs font-medium uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div
        className={
          "font-display mt-2 text-3xl font-bold tabular-nums " +
          (accent ? "text-gradient-primary" : "")
        }
      >
        {value}
      </div>
    </Card>
  );
}

export default Dashboard;
