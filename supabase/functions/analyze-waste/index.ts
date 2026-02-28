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
    } else if (mode === "help_description") {
      const ctx = beforeData || {};
      userPrompt = `IMPORTANT: You MUST use the generate_help_description tool to respond. Do NOT use any other tool.

На основе фото загрязнённой территории и данных анализа, сгенерируй подробное описание экологической проблемы для публикации на карте. 

Категория мусора: ${ctx.category || 'не указана'}. 
Уровень загрязнения: ${ctx.severity_color || 'ORANGE'}. 
Описание от пользователя: ${ctx.user_description || 'нет'}. 

Данные ИИ-анализа: предметов обнаружено: ${ctx.total_items || 'неизвестно'}, уровень: ${ctx.severity || 'неизвестно'}, краткое описание: ${ctx.summary || 'нет'}.

Напиши подробное описание проблемы на русском языке (2-4 предложения), оцени количество волонтёров, время уборки и необходимые инструменты. Используй ТОЛЬКО инструмент generate_help_description.`;
      tools.push({
        type: "function",
        function: {
          name: "generate_help_description",
          description: "Generate a structured mission description for a help request. This is the ONLY tool you should use.",
          parameters: {
            type: "object",
            properties: {
              description: { type: "string", description: "Detailed description of the pollution problem, 2-4 sentences in Russian" },
              volunteers_needed: { type: "integer", description: "Estimated number of volunteers needed" },
              time_estimate: { type: "string", description: "Estimated cleanup time, e.g. '2-3 часа'" },
              tools_needed: { type: "array", items: { type: "string" }, description: "List of tools/equipment needed in Russian" },
            },
            required: ["description", "volunteers_needed", "time_estimate", "tools_needed"],
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

    const toolName = mode === "before" ? "report_before_analysis" : mode === "help_description" ? "generate_help_description" : "report_after_analysis";

    const messages = mode === "help_description"
      ? [{ role: "user", content: [{ type: "text", text: userPrompt }] }]
      : [{
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: imageBase64 } },
          ],
        }];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("AI_TIMEOUT"), 18000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: mode === "help_description" ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash",
        max_tokens: mode === "help_description" ? 300 : undefined,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        tools,
        tool_choice: { type: "function", function: { name: toolName } },
      }),
    });

    clearTimeout(timeoutId);

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
    
    // If help_description mode, normalize output even when model calls the wrong tool
    if (mode === "help_description") {
      const severityCtx = beforeData?.severity_color || beforeData?.severity || "ORANGE";
      const isRed = severityCtx === "RED";

      if (!result.description) {
        const category = beforeData?.category || "смешанный мусор";
        const totalItems = beforeData?.total_items ?? "несколько";
        const summary = beforeData?.summary ? ` ${beforeData.summary}` : "";
        result.description = `Обнаружено загрязнение категории «${category}», ориентировочно ${totalItems} единиц мусора.${summary} Нужна командная уборка с сортировкой и вывозом отходов.`;
      }

      if (!result.volunteers_needed) {
        result.volunteers_needed = isRed ? 10 : 5;
      }

      if (!result.time_estimate) {
        result.time_estimate = isRed ? "3-5 часов" : "1-2 часа";
      }

      if (!Array.isArray(result.tools_needed) || result.tools_needed.length === 0) {
        result.tools_needed = isRed
          ? ["Перчатки", "Мешки для мусора", "Лопаты", "Транспорт для вывоза"]
          : ["Перчатки", "Мешки для мусора", "Сортировочные пакеты"];
      }
    }
    
    return new Response(JSON.stringify({ mode, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-waste error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const isTimeout = message.includes("AI_TIMEOUT") || message.includes("aborted");
    return new Response(JSON.stringify({ error: isTimeout ? "ИИ отвечает слишком долго. Попробуйте ещё раз." : message }), {
      status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
