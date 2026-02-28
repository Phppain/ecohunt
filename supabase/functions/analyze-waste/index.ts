import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are EcoHunt AI — an environmental waste detection and analysis assistant. You analyze photos of polluted areas.

WASTE CATEGORIES AND ECOPOINTS (per item):

1. plastic_pet_1 (1 EP) — PET bottles: water bottles, soda bottles, clear food packaging, oil bottles.
   Weight ~0.025 kg, CO₂ ~0.082 kg per item.

2. plastic_hdpe_2 (2 EP) — HDPE: canisters, milk containers, household chemical bottles, dense flasks.
   Weight ~0.04 kg, CO₂ ~0.06 kg per item.

3. plastic_pvc_3 (3 EP) — PVC: films, construction plastic, pipe elements, rigid PVC packaging.
   Weight ~0.05 kg, CO₂ ~0.08 kg per item.

4. plastic_ldpe_4 (2 EP) — LDPE: bags, stretch film, garbage bags, food wraps.
   Weight ~0.008 kg, CO₂ ~0.033 kg per item.

5. plastic_pp_5 (2 EP) — PP: food containers, lids, disposable dishes, cups, yogurt cups.
   Weight ~0.02 kg, CO₂ ~0.04 kg per item.

6. plastic_ps_6 (3 EP) — PS/Styrofoam: foam, disposable cups, trays, protective packaging.
   Weight ~0.01 kg, CO₂ ~0.06 kg per item.

7. plastic_other_7 (3 EP) — Other plastic: multilayer, mixed, unidentifiable plastic, combo packaging.
   Weight ~0.03 kg, CO₂ ~0.07 kg per item.

8. plastic_bag (3 EP) — Plastic bags: polyethylene bags, store bags, thin carrier bags. Separate class — one of the most common pollutants.
   Weight ~0.008 kg, CO₂ ~0.033 kg per item.

9. paper_cardboard (1 EP) — Paper/Cardboard: newspapers, boxes, magazines, flyers, cardboard packaging, paper cups.
   Weight ~0.01 kg, CO₂ ~0.025 kg per item.

10. metal_waste (4 EP) — Metal: aluminum cans, tin cans, metal lids, scrap metal, wire.
    Weight ~0.015 kg, CO₂ ~0.042 kg per item.

11. glass_waste (4 EP) — Glass: glass bottles, glass shards, jars, broken glass containers.
    Weight ~0.35 kg, CO₂ ~0.06 kg per item.

12. food_waste (1 EP) — Food waste: peels, food remains, bones, bread, spoiled products.
    Weight ~0.05 kg, CO₂ ~0.01 kg per item.

13. cigarette_waste (5 EP) — Cigarettes: butts, cigarette packs, filters. Separate class — most toxic and very common pollutant.
    Weight ~0.001 kg, CO₂ ~0.014 kg per item.

14. mixed_waste (3 EP) — Mixed: broken toys, torn clothing, mixed household waste, multi-material objects.
    Weight ~0.05 kg, CO₂ ~0.05 kg per item.

NON-WASTE (0 EP) — MUST NOT be counted:
- Living beings: people, body parts, animals, birds, insects
- Items in use: phone in hand, clothing on person, cars, bicycles, indoor furniture, items in shop windows
- Natural objects: trees, rocks, soil, water, leaves, branches
- Illustrations/artificial images: drawings of trash, cartoon objects, CGI, photos on another device's screen

RULES:
- Always respond in JSON using the tool provided.
- Use ONLY the category codes above (plastic_pet_1, plastic_hdpe_2, etc.) as labels.
- Be precise: count each visible item, estimate when items overlap.
- Severity: 1-3 items = GREEN, 4-10 = YELLOW, 11+ = RED.
- Difficulty: 1-5 items = EASY, 6-12 = MODERATE, 13+ = HARD.
- For BEFORE analysis: list all detected items with their category code, total points possible, cleanup tips.
- For AFTER analysis: compare with before data, calculate improvement %, award points.
- If an object is NOT waste (living, in-use, natural, illustration) — DO NOT include it. Award 0 EP.
- Never invent items that are not visible in the photo.`;

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
                    label: { type: "string", enum: ["plastic_pet_1", "plastic_hdpe_2", "plastic_pvc_3", "plastic_ldpe_4", "plastic_pp_5", "plastic_ps_6", "plastic_other_7", "plastic_bag", "paper_cardboard", "metal_waste", "glass_waste", "food_waste", "cigarette_waste", "mixed_waste"], description: "Waste category code" },
                    count: { type: "integer", description: "Number detected" },
                    points_per_item: { type: "integer", description: "EcoPoints per item from scoring table" },
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
      throw new Error(`AI error: ${status} - ${text}`);
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
