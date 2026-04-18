// Compare two images against a JSON instruction using Lovable AI (Gemini)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { imageA, imageB, instruction } = await req.json();
    if (!imageA || !imageB || !instruction) {
      return new Response(
        JSON.stringify({ error: "imageA, imageB, and instruction are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "submit_match",
          description: "Return structured visual similarity scoring between two images.",
          parameters: {
            type: "object",
            properties: {
              overallSimilarity: {
                type: "number",
                description: "0-100 overall visual similarity score",
              },
              verdict: {
                type: "string",
                enum: ["match", "partial", "mismatch"],
              },
              criteria: {
                type: "array",
                description: "Per-criterion scores derived from the JSON instruction.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    score: { type: "number", description: "0-100" },
                    notes: { type: "string" },
                  },
                  required: ["name", "score", "notes"],
                  additionalProperties: false,
                },
              },
              differences: {
                type: "array",
                description:
                  "Each visual difference, with normalized bounding boxes (0-1) on both images marking the mismatched region.",
                items: {
                  type: "object",
                  properties: {
                    description: { type: "string" },
                    bboxA: {
                      type: "object",
                      description:
                        "Normalized bounding box on Image A (values 0-1). x,y is top-left corner.",
                      properties: {
                        x: { type: "number" },
                        y: { type: "number" },
                        w: { type: "number" },
                        h: { type: "number" },
                      },
                      required: ["x", "y", "w", "h"],
                      additionalProperties: false,
                    },
                    bboxB: {
                      type: "object",
                      description: "Normalized bounding box on Image B (values 0-1).",
                      properties: {
                        x: { type: "number" },
                        y: { type: "number" },
                        w: { type: "number" },
                        h: { type: "number" },
                      },
                      required: ["x", "y", "w", "h"],
                      additionalProperties: false,
                    },
                  },
                  required: ["description", "bboxA", "bboxB"],
                  additionalProperties: false,
                },
              },
              similarities: { type: "array", items: { type: "string" } },
              summary: { type: "string" },
            },
            required: [
              "overallSimilarity",
              "verdict",
              "criteria",
              "differences",
              "similarities",
              "summary",
            ],
            additionalProperties: false,
          },
        },
      },
    ];

    const userContent = [
      {
        type: "text",
        text: `Compare these two images. Image A is the FIRST image; Image B is the SECOND image.

Use this JSON instruction as the rubric for what to compare and how to weight things:

\`\`\`json
${JSON.stringify(instruction, null, 2)}
\`\`\`

For EACH visual difference, return:
- a short text description
- bboxA: a normalized bounding box (x, y, w, h all between 0 and 1) on Image A locating the region
- bboxB: the corresponding normalized bounding box on Image B
Boxes should tightly enclose the differing element. If a difference exists on only one image, still return a bbox on the other image at the spatial location where it would be.

Return your structured evaluation ONLY via the submit_match tool.`,
      },
      { type: "image_url", image_url: { url: imageA } },
      { type: "image_url", image_url: { url: imageB } },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a meticulous visual QA expert. Always respond using the submit_match tool.",
          },
          { role: "user", content: userContent },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "submit_match" } },
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (res.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (res.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!res.ok) {
      const t = await res.text();
      console.error("AI gateway error", res.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured response from AI" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("match-images error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
