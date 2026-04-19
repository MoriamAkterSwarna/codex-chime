import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, FileJson, Sparkles, Loader2, X, History, Trash2, ChevronDown, Cpu } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { computeCVMetrics, type CVMetrics } from "@/lib/cv";

type BBox = { x: number; y: number; w: number; h: number };
type Difference = { description: string; bboxA: BBox; bboxB: BBox };

type MatchResult = {
  overallSimilarity: number;
  verdict: "match" | "partial" | "mismatch";
  criteria: { name: string; score: number; notes: string }[];
  differences: (Difference | string)[];
  similarities: string[];
  summary: string;
};

type MatchRun = {
  id: string;
  image_a_url: string;
  image_b_url: string;
  instruction: unknown;
  result: MatchResult;
  overall_similarity: number | null;
  verdict: string | null;
  summary: string | null;
  created_at: string;
};

const DEFAULT_INSTRUCTION = {
  goal: "Compare two UI screenshots for visual parity",
  weights: { layout: 0.3, color: 0.25, typography: 0.2, content: 0.15, spacing: 0.1 },
  ignore: ["timestamps", "user-specific data"],
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function BBoxCrop({ src, bbox, label }: { src: string; bbox: BBox; label: string }) {
  // Clamp + guard against zero-size boxes
  const x = Math.max(0, Math.min(1, bbox.x));
  const y = Math.max(0, Math.min(1, bbox.y));
  const w = Math.max(0.001, Math.min(1 - x, bbox.w));
  const h = Math.max(0.001, Math.min(1 - y, bbox.h));

  const displayHeight = 140;
  const aspect = w / h;
  const displayWidth = displayHeight * aspect;

  return (
    <div className="space-y-1.5">
      <div className="text-muted-foreground flex items-center justify-between text-[10px] font-medium uppercase tracking-wider">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.round(w * 100)}×{Math.round(h * 100)}%
        </span>
      </div>
      <div className="border-border/60 bg-background/60 flex items-center justify-center overflow-hidden rounded border">
        <div
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            maxWidth: "100%",
            backgroundImage: `url(${src})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${100 / w}% ${100 / h}%`,
            backgroundPosition: `${(x / (1 - w || 1)) * 100}% ${(y / (1 - h || 1)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsText(file);
  });
}

function ImageDrop({
  label,
  file,
  preview,
  onChange,
  onClear,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onChange: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {label}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && f.type.startsWith("image/")) onChange(f);
        }}
        className="border-border/60 hover:border-primary/60 hover:bg-primary/5 group relative flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors"
      >
        {preview ? (
          <>
            <img src={preview} alt={label} className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="bg-background/80 hover:bg-background absolute right-2 top-2 rounded-full p-1.5 backdrop-blur"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-4 text-center">
            <ImageIcon className="h-7 w-7" />
            <span className="text-sm">Click or drop image</span>
            {file && <span className="text-xs">{file.name}</span>}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onChange(f);
          }}
        />
      </div>
    </div>
  );
}

export function ImageMatcher() {
  const [imgA, setImgA] = useState<File | null>(null);
  const [imgB, setImgB] = useState<File | null>(null);
  const [previewA, setPreviewA] = useState<string | null>(null);
  const [previewB, setPreviewB] = useState<string | null>(null);
  const [instructionText, setInstructionText] = useState<string>(
    JSON.stringify(DEFAULT_INSTRUCTION, null, 2),
  );
  const [jsonName, setJsonName] = useState<string>("default rubric");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [cv, setCv] = useState<CVMetrics | null>(null);
  const [history, setHistory] = useState<MatchRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = async () => {
    const { data, error } = await (supabase as any)
      .from("image_matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("history load error", error);
      return;
    }
    setHistory((data ?? []) as MatchRun[]);
  };

  useEffect(() => {
    (async () => {
      setHistoryLoading(true);
      await loadHistory();
      setHistoryLoading(false);
    })();
  }, []);

  const deleteRun = async (id: string) => {
    const prev = history;
    setHistory((h) => h.filter((r) => r.id !== id));
    const { error } = await (supabase as any).from("image_matches").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      setHistory(prev);
    } else {
      toast.success("Deleted");
    }
  };

  const loadFromHistory = (run: MatchRun) => {
    setPreviewA(run.image_a_url);
    setPreviewB(run.image_b_url);
    setImgA(null);
    setImgB(null);
    setInstructionText(JSON.stringify(run.instruction, null, 2));
    setJsonName(`from history · ${new Date(run.created_at).toLocaleString()}`);
    setResult(run.result);
    setCv(null);
    // Recompute CV metrics for the loaded pair
    computeCVMetrics(run.image_a_url, run.image_b_url)
      .then(setCv)
      .catch((e) => console.warn("cv recompute failed", e));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleImage = async (which: "a" | "b", f: File) => {
    const url = await fileToDataUrl(f);
    if (which === "a") {
      setImgA(f);
      setPreviewA(url);
    } else {
      setImgB(f);
      setPreviewB(url);
    }
  };

  const handleJson = async (f: File) => {
    try {
      const text = await fileToText(f);
      JSON.parse(text); // validate
      setInstructionText(text);
      setJsonName(f.name);
      toast.success("Instruction loaded");
    } catch {
      toast.error("Invalid JSON file");
    }
  };

  const run = async () => {
    if (!previewA || !previewB) {
      toast.error("Upload both images");
      return;
    }
    let instruction: unknown;
    try {
      instruction = JSON.parse(instructionText);
    } catch {
      toast.error("Instruction is not valid JSON");
      return;
    }

    setRunning(true);
    setResult(null);
    setCv(null);
    try {
      // Run computer-vision metrics + Gemini rubric in parallel.
      const cvPromise = computeCVMetrics(previewA, previewB).catch((e) => {
        console.warn("cv failed", e);
        return null;
      });
      const aiPromise = supabase.functions.invoke("match-images", {
        body: { imageA: previewA, imageB: previewB, instruction },
      });

      const [cvMetrics, { data, error }] = await Promise.all([cvPromise, aiPromise]);
      if (cvMetrics) setCv(cvMetrics);
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const matchResult = (data as { result: MatchResult }).result;
      setResult(matchResult);
      toast.success("Comparison complete");

      // Persist run to history
      const { data: inserted, error: insErr } = await (supabase as any)
        .from("image_matches")
        .insert({
          image_a_url: previewA,
          image_b_url: previewB,
          instruction,
          result: matchResult,
          overall_similarity: matchResult.overallSimilarity,
          verdict: matchResult.verdict,
          summary: matchResult.summary,
        })
        .select()
        .single();
      if (insErr) {
        console.warn("save history error", insErr);
      } else if (inserted) {
        setHistory((h) => [inserted as MatchRun, ...h]);
      }
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setRunning(false);
    }
  };

  const verdictColor =
    result?.verdict === "match"
      ? "bg-green-500/15 text-green-400 border-green-500/30"
      : result?.verdict === "partial"
        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
        : "bg-red-500/15 text-red-400 border-red-500/30";

  return (
    <Card className="glass border-border/60 p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <h2 className="font-display text-2xl font-semibold">Image-to-Image Matcher</h2>
        </div>
        <p className="text-muted-foreground text-sm">
          Upload two images and a JSON rubric. Lovable AI scores their visual similarity against your criteria.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <ImageDrop
          label="Image A (reference)"
          file={imgA}
          preview={previewA}
          onChange={(f) => handleImage("a", f)}
          onClear={() => {
            setImgA(null);
            setPreviewA(null);
          }}
        />
        <ImageDrop
          label="Image B (candidate)"
          file={imgB}
          preview={previewB}
          onChange={(f) => handleImage("b", f)}
          onClear={() => {
            setImgB(null);
            setPreviewB(null);
          }}
        />
      </div>

      <div className="mt-6 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            JSON instruction
          </label>
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="text-primary hover:text-primary/80 inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <FileJson className="h-3.5 w-3.5" />
            Load .json ({jsonName})
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleJson(f);
            }}
          />
        </div>
        <textarea
          value={instructionText}
          onChange={(e) => setInstructionText(e.target.value)}
          spellCheck={false}
          className="border-border/60 bg-background/50 focus:border-primary/60 focus:ring-primary/20 min-h-[140px] w-full rounded-lg border px-3 py-2 font-mono text-xs outline-none focus:ring-2"
        />
      </div>

      <div className="mt-6 flex justify-end">
        <Button onClick={run} disabled={running} size="lg">
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Comparing…
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Run match
            </>
          )}
        </Button>
      </div>

      {cv && (
        <div className="border-border/50 mt-8 border-t pt-6">
          <div className="mb-3 flex items-center gap-2">
            <Cpu className="text-primary h-4 w-4" />
            <h3 className="font-display text-lg font-semibold">Computer-vision metrics</h3>
            <Badge variant="secondary" className="text-[10px]">
              client-side
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="border-border/60 bg-background/40 rounded-lg border p-3">
              <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                pHash similarity
              </div>
              <div className="font-display mt-1 text-2xl font-bold tabular-nums">
                {cv.phashSimilarity.toFixed(1)}
                <span className="text-muted-foreground text-sm">/100</span>
              </div>
              <div className="text-muted-foreground mt-1 text-xs tabular-nums">
                Hamming {cv.hammingDistance}/64
              </div>
              <Progress value={cv.phashSimilarity} className="mt-2 h-1.5" />
            </div>
            <div className="border-border/60 bg-background/40 rounded-lg border p-3">
              <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                SSIM
              </div>
              <div className="font-display mt-1 text-2xl font-bold tabular-nums">
                {cv.ssim.toFixed(3)}
              </div>
              <div className="text-muted-foreground mt-1 text-xs tabular-nums">
                ≈ {cv.ssimSimilarity.toFixed(1)}/100
              </div>
              <Progress value={cv.ssimSimilarity} className="mt-2 h-1.5" />
            </div>
            <div className="border-primary/30 bg-primary/5 rounded-lg border p-3">
              <div className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
                CV combined
              </div>
              <div className="font-display text-gradient-primary mt-1 text-2xl font-bold tabular-nums">
                {cv.combined.toFixed(1)}
                <span className="text-muted-foreground text-sm">/100</span>
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                50% pHash · 50% SSIM
              </div>
              <Progress value={cv.combined} className="mt-2 h-1.5" />
            </div>
          </div>
          <details className="mt-3">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
              Hashes
            </summary>
            <div className="text-muted-foreground mt-2 grid grid-cols-1 gap-1 font-mono text-[11px] sm:grid-cols-2">
              <div>A: {cv.phashA}</div>
              <div>B: {cv.phashB}</div>
            </div>
          </details>
        </div>
      )}

      {result && (
        <div className="border-border/50 mt-8 space-y-6 border-t pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">
                Overall similarity
              </div>
              <div className="font-display text-gradient-primary text-5xl font-bold tabular-nums">
                {Math.round(result.overallSimilarity)}
                <span className="text-muted-foreground text-2xl">/100</span>
              </div>
            </div>
            <Badge className={`border px-3 py-1 text-sm ${verdictColor}`}>
              {result.verdict.toUpperCase()}
            </Badge>
          </div>

          <p className="text-foreground/90 text-sm leading-relaxed">{result.summary}</p>

          {result.criteria.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Per-criterion scores</h3>
              {result.criteria.map((c) => (
                <div key={c.name} className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {Math.round(c.score)}/100
                    </span>
                  </div>
                  <Progress value={c.score} className="h-1.5" />
                  {c.notes && <p className="text-muted-foreground text-xs">{c.notes}</p>}
                </div>
              ))}
            </div>
          )}

          {result.similarities.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-green-400">Similarities</h3>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {result.similarities.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}

          {result.differences.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-red-400">Differences</h3>
              <div className="space-y-4">
                {result.differences.map((d, i) => {
                  // Backwards-compat: tolerate plain-string differences from older runs
                  if (typeof d === "string") {
                    return (
                      <div
                        key={i}
                        className="border-border/60 bg-background/40 rounded-lg border p-3 text-sm"
                      >
                        <span className="text-muted-foreground">• {d}</span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={i}
                      className="border-border/60 bg-background/40 space-y-3 rounded-lg border p-3"
                    >
                      <p className="text-foreground/90 text-sm">{d.description}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <BBoxCrop
                          src={previewA!}
                          bbox={d.bboxA}
                          label="Image A"
                        />
                        <BBoxCrop
                          src={previewB!}
                          bbox={d.bboxB}
                          label="Image B"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      <div className="border-border/50 mt-10 border-t pt-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="text-muted-foreground h-4 w-4" />
            <h3 className="font-display text-lg font-semibold">Match history</h3>
          </div>
          <span className="text-muted-foreground text-xs tabular-nums">
            {history.length} run{history.length === 1 ? "" : "s"}
          </span>
        </div>

        {historyLoading ? (
          <div className="text-muted-foreground py-6 text-center text-sm">Loading…</div>
        ) : history.length === 0 ? (
          <div className="border-border/50 text-muted-foreground rounded-lg border border-dashed py-8 text-center text-sm">
            No comparisons yet. Run your first match above.
          </div>
        ) : (
          <ul className="space-y-2">
            {history.map((run) => {
              const isOpen = openId === run.id;
              const score = Math.round(run.overall_similarity ?? 0);
              const v = run.verdict ?? "";
              const vClass =
                v === "match"
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : v === "partial"
                    ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                    : "bg-red-500/15 text-red-400 border-red-500/30";
              return (
                <li
                  key={run.id}
                  className="border-border/60 bg-background/40 rounded-lg border"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : run.id)}
                    className="hover:bg-background/60 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors"
                  >
                    <div className="flex shrink-0 items-center gap-1.5">
                      <img
                        src={run.image_a_url}
                        alt="A"
                        className="border-border/50 h-10 w-10 rounded border object-cover"
                      />
                      <img
                        src={run.image_b_url}
                        alt="B"
                        className="border-border/50 h-10 w-10 rounded border object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-semibold tabular-nums">
                          {score}
                          <span className="text-muted-foreground text-xs">/100</span>
                        </span>
                        {v && (
                          <Badge className={`border px-1.5 py-0 text-[10px] ${vClass}`}>
                            {v.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {new Date(run.created_at).toLocaleString()} ·{" "}
                        {run.summary ?? "No summary"}
                      </p>
                    </div>
                    <ChevronDown
                      className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="border-border/50 space-y-3 border-t px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => loadFromHistory(run)}
                        >
                          Reopen
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteRun(run.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                      {run.result.criteria?.length > 0 && (
                        <div className="space-y-1.5">
                          {run.result.criteria.map((c) => (
                            <div
                              key={c.name}
                              className="flex items-center justify-between gap-3 text-xs"
                            >
                              <span className="text-foreground/80 truncate">{c.name}</span>
                              <span className="text-muted-foreground shrink-0 tabular-nums">
                                {Math.round(c.score)}/100
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <details className="text-xs">
                        <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                          Instruction JSON
                        </summary>
                        <pre className="bg-background/60 border-border/50 mt-2 overflow-x-auto rounded border p-2 font-mono text-[11px]">
                          {JSON.stringify(run.instruction, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
