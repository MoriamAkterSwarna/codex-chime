import { supabase } from "@/integrations/supabase/client";
import type { Evaluation, Project, ProjectWithEvaluation } from "@/types";

export async function fetchProjects(): Promise<ProjectWithEvaluation[]> {
  const { data: projects, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const ids = (projects ?? []).map((p) => p.id);
  if (!ids.length) return [];

  const { data: evals, error: evalErr } = await supabase
    .from("evaluations")
    .select("*")
    .in("project_id", ids)
    .order("created_at", { ascending: false });
  if (evalErr) throw evalErr;

  const latest = new Map<string, Evaluation>();
  for (const e of (evals ?? []) as Evaluation[]) {
    if (!latest.has(e.project_id)) latest.set(e.project_id, e);
  }

  return (projects as Project[]).map((p) => ({
    ...p,
    evaluation: latest.get(p.id) ?? null,
  }));
}

export async function fetchProjectWithLatestEvaluation(
  projectId: string,
): Promise<ProjectWithEvaluation | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  if (!project) return null;

  const { data: evals, error: evalErr } = await supabase
    .from("evaluations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (evalErr) throw evalErr;

  return {
    ...(project as Project),
    evaluation: ((evals ?? [])[0] as Evaluation) ?? null,
  };
}

export async function fetchEvaluation(evaluationId: string): Promise<Evaluation | null> {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .eq("id", evaluationId)
    .maybeSingle();
  if (error) throw error;
  return (data as Evaluation) ?? null;
}

export async function startEvaluation(
  projectId: string,
  liveUrl: string,
  githubRepo: string,
): Promise<{ evaluationId: string }> {
  const { data, error } = await supabase.functions.invoke("evaluate-project", {
    body: { projectId, liveUrl, githubRepo },
  });
  if (error) throw error;
  return data as { evaluationId: string };
}

export function pollEvaluation(
  evaluationId: string,
  onUpdate: (evaluation: Evaluation) => void,
  intervalMs = 3000,
): () => void {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const ev = await fetchEvaluation(evaluationId);
      if (ev) {
        onUpdate(ev);
        if (ev.status === "completed" || ev.status === "failed") return;
      }
    } catch (e) {
      console.warn("poll error", e);
    }
    if (!stopped) setTimeout(tick, intervalMs);
  };
  tick();
  return () => {
    stopped = true;
  };
}
