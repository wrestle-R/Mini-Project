interface SelectedContext {
  element_id?: string;
  element_type?: string;
  element_name?: string;
  property_summary?: string;
}

interface GroqNormalizationResult {
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

export async function normalizeIfcInstructionWithGroq(params: {
  message: string;
  selectedContexts: SelectedContext[];
}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not defined");
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
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Groq][normalizeIfcInstruction] HTTP error:", response.status, errorText);
      return null;
    }

    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return null;
    }

    const jsonText = extractJsonObject(text) || text;
    const parsed = JSON.parse(jsonText) as GroqNormalizationResult;
    const instruction = parsed.instruction?.trim();
    if (!instruction) {
      return null;
    }

    return {
      instruction,
      reason: parsed.reason?.trim() || "Groq normalized the request.",
    };
  } catch (error) {
    console.error("[Groq][normalizeIfcInstruction] Error:", error);
    return null;
  }
}





