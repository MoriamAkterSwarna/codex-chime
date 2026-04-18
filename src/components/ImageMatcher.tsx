import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, FileJson, Sparkles, Loader2, X, History, Trash2, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type MatchResult = {
  overallSimilarity: number;
  verdict: "match" | "partial" | "mismatch";
  criteria: { name: string; score: number; notes: string }[];
  differences: string[];
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
  const jsonInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const { data, error } = await supabase.functions.invoke("match-images", {
        body: { imageA: previewA, imageB: previewB, instruction },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult((data as { result: MatchResult }).result);
      toast.success("Comparison complete");
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                <h3 className="mb-2 text-sm font-semibold text-red-400">Differences</h3>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  {result.differences.map((s, i) => (
                    <li key={i}>• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
