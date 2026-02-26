import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are EcoHunt AI — an environmental waste detection and analysis assistant. You analyze photos of polluted areas.

SCORING TABLE (per item removed):
- Plastic Bottle: 5 EcoPoints
- Metal/Aluminum Can: 8 EcoPoints
- Glass Bottle: 10 EcoPoints
- Plastic Bag: 3 EcoPoints
- Cigarette Butt: 2 EcoPoints
- Paper/Cardboard: 3 EcoPoints
- Food Wrapper: 4 EcoPoints
- Styrofoam: 6 EcoPoints
- Tire/Rubber: 15 EcoPoints
- Large debris (furniture, electronics): 25 EcoPoints
- Other waste item: 4 EcoPoints

ENVIRONMENTAL IMPACT (approximate per item):
- Plastic Bottle: 0.082 kg CO₂, 0.025 kg waste
- Metal Can: 0.042 kg CO₂, 0.015 kg waste
- Glass Bottle: 0.06 kg CO₂, 0.35 kg waste
- Plastic Bag: 0.033 kg CO₂, 0.008 kg waste
- Cigarette Butt: 0.014 kg CO₂, 0.001 kg waste
- Paper: 0.025 kg CO₂, 0.01 kg waste

RULES:
- Always respond in JSON using the tool provided.
- Be precise: count each visible item, estimate when items overlap.
- Severity: 1-3 items = GREEN, 4-10 = YELLOW, 11+ = RED.
- Difficulty: 1-5 items = EASY, 6-12 = MODERATE, 13+ = HARD.
- For BEFORE analysis: list all detected items, total points possible, cleanup tips.
- For AFTER analysis: compare with before data, calculate improvement %, award points.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, mode, beforeData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let userPrompt = "";
    const tools = [];

    if (mode === "before") {
      userPrompt = "Analyze this photo of a polluted area. Detect all visible waste items, count them, estimate total EcoPoints for cleaning, calculate environmental impact, and give 2-3 short cleanup tips. Use the report_before_analysis tool.";
      tools.push({
        type: "function",
        function: {
          name: "report_before_analysis",
          description: "Report the waste analysis of a BEFORE photo",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string", description: "Type of waste item" },
                    count: { type: "integer", description: "Number detected" },
                    points_per_item: { type: "integer", description: "EcoPoints per item" },
                  },
                  required: ["label", "count", "points_per_item"],
                },
              },
              total_items: { type: "integer" },
              total_points: { type: "integer", description: "Total EcoPoints possible if all cleaned" },
              severity: { type: "string", enum: ["GREEN", "YELLOW", "RED"] },
              difficulty: { type: "string", enum: ["EASY", "MODERATE", "HARD"] },
              co2_impact_kg: { type: "number", description: "Total estimated CO₂ impact in kg" },
              waste_weight_kg: { type: "number", description: "Total estimated waste weight in kg" },
              cleanup_tips: {
                type: "array",
                items: { type: "string" },
                description: "2-3 short cleanup tips",
              },
              summary: { type: "string", description: "One sentence summary of the pollution level" },
            },
            required: ["items", "total_items", "total_points", "severity", "difficulty", "co2_impact_kg", "waste_weight_kg", "cleanup_tips", "summary"],
          },
        },
      });
    } else {
      userPrompt = `Analyze this AFTER photo. The BEFORE analysis found: ${JSON.stringify(beforeData)}. Compare the before and after, determine how many items were removed, calculate earned EcoPoints, improvement percentage, and write a short report. Use the report_after_analysis tool.`;
      tools.push({
        type: "function",
        function: {
          name: "report_after_analysis",
          description: "Report the comparison of BEFORE vs AFTER cleanup",
          parameters: {
            type: "object",
            properties: {
              items_before: { type: "integer" },
              items_after: { type: "integer" },
              improvement_pct: { type: "number" },
              items_removed: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    count: { type: "integer" },
                    points_earned: { type: "integer" },
                  },
                  required: ["label", "count", "points_earned"],
                },
              },
              total_points_earned: { type: "integer" },
              co2_saved_kg: { type: "number" },
              waste_diverted_kg: { type: "number" },
              status: { type: "string", enum: ["CLEAN", "IMPROVED", "NEEDS_MORE"] },
              report: { type: "string", description: "2-3 sentence summary of cleanup results" },
            },
            required: ["items_before", "items_after", "improvement_pct", "items_removed", "total_points_earned", "co2_saved_kg", "waste_diverted_kg", "status", "report"],
          },
        },
      });
    }

    const toolName = mode === "before" ? "report_before_analysis" : "report_after_analysis";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        tools,
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов. Попробуйте позже." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Недостаточно кредитов AI." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      // Fallback: try to parse content as JSON
      const content = data.choices?.[0]?.message?.content;
      return new Response(JSON.stringify({ mode, result: content }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ mode, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-waste error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
