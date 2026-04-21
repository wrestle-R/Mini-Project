const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";

interface SelectedContext {
  element_id?: string;
  element_type?: string;
  element_name?: string;
  property_summary?: string;
}

interface GeminiNormalizationResult {
  instruction: string;
  reason?: string;
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

export async function normalizeIfcInstructionWithGemini(params: {
  message: string;
  selectedContexts: SelectedContext[];
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const selectedSummary =
    params.selectedContexts.length > 0
      ? params.selectedContexts
          .map((ctx, index) => {
            const type = ctx.element_type || "element";
            const id = ctx.element_id || "unknown-id";
            const name = ctx.element_name?.trim() || "unnamed";
            const summary = ctx.property_summary?.trim() || "no property summary";
            return `${index + 1}. type=${type}, name=${name}, id=${id}, summary=${summary}`;
          })
          .join("\n")
      : "None";

  const prompt = [
    "You convert IFC editing requests into one simple canonical command for a deterministic rule-based engine.",
    "Return JSON only.",
    'Schema: {"instruction":"string","reason":"string"}',
    "The instruction must be a single plain-English command the engine can execute.",
    "Prefer using the word selected when the user likely refers to the selected context.",
    "Supported command families:",
    "- make the roof blue",
    "- make all walls 4 meters tall",
    "- rename the selected door to Service Entry",
    "- remove the selected wall",
    "- rotate the whole model 90 degrees on the x axis",
    "- rotate the whole model 90 degrees on the y axis",
    "- rotate the whole model 90 degrees on the z axis",
    "- restore the default color for the selected wall",
    "",
    `User request: ${params.message}`,
    `Selected context:\n${selectedSummary}`,
  ].join("\n");

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Gemini][normalizeIfcInstruction] HTTP error:", response.status, errorText);
      return null;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) {
      return null;
    }

    const jsonText = extractJsonObject(text) || text;
    const parsed = JSON.parse(jsonText) as GeminiNormalizationResult;
    const instruction = parsed.instruction?.trim();
    if (!instruction) {
      return null;
    }

    return {
      instruction,
      reason: parsed.reason?.trim() || "Gemini normalized the request.",
    };
  } catch (error) {
    console.error("[Gemini][normalizeIfcInstruction] Error:", error);
    return null;
  }
}
