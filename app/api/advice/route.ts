import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { profile, totals, targets, timeOfDay, isMenstruation } = await request.json();

    // Calculate remaining macros
    const remaining = {
      calories: targets.calories - totals.calories + totals.caloriesBurned,
      protein: targets.protein - totals.protein,
      carbs: targets.carbs - totals.carbs,
      fat: targets.fat - totals.fat,
      fiber: targets.fiber - totals.fiber,
    };

    // Determine time of day context
    let mealContext = "avondeten";
    if (timeOfDay < 10) {
      mealContext = "ontbijt";
    } else if (timeOfDay < 14) {
      mealContext = "lunch";
    } else if (timeOfDay < 17) {
      mealContext = "tussendoortje";
    }

    const goals = profile.goals || [];
    const goalsText = goals.length > 0 
      ? goals.map((g: string) => {
          if (g === "weight_loss") return "afvallen";
          if (g === "muscle_gain") return "spieropbouw";
          return "gewicht behouden";
        }).join(" en ")
      : "gezond eten";

    // Menstruation context
    const menstruationContext = isMenstruation 
      ? `
BELANGRIJK: De gebruiker is vandaag ongesteld. Houd hier rekening mee:
- Extra behoefte aan ijzer (spinazie, rode biet, linzen, rood vlees)
- Magnesium helpt tegen krampen (noten, pure chocolade, banaan)
- Vaak meer trek in koolhydraten/zoet - dit is normaal
- Eventueel iets meer calorieën toegestaan (+100-200 kcal)
- Wees extra begripvol en ondersteunend in je advies`
      : "";

    const prompt = `Je bent een Nederlandse voedingsadviseur. Geef kort, praktisch advies (max 2-3 zinnen) voor wat de gebruiker nog kan eten.

Gebruikersprofiel:
- Doelen: ${goalsText}
- Gewicht: ${profile.weight || "onbekend"} kg
${menstruationContext}

Huidige intake vandaag:
- Calorieën: ${totals.calories} / ${targets.calories} kcal
- Eiwit: ${totals.protein}g / ${targets.protein}g
- Koolhydraten: ${totals.carbs}g / ${targets.carbs}g
- Vet: ${totals.fat}g / ${targets.fat}g
- Vezels: ${totals.fiber}g / ${targets.fiber}g
- Verbrande calorieën door sport: ${totals.caloriesBurned} kcal

Nog nodig:
- Calorieën: ${remaining.calories} kcal
- Eiwit: ${remaining.protein}g
- Koolhydraten: ${remaining.carbs}g
- Vet: ${remaining.fat}g
- Vezels: ${remaining.fiber}g

Het is nu tijd voor ${mealContext}.

Geef een persoonlijk, praktisch advies. Noem concrete voedingsmiddelen met hoeveelheden. ${isMenstruation ? "Verwijs subtiel naar ijzer/magnesium-rijke opties." : "Focus op het belangrijkste tekort (meestal eiwit bij sportdoelen)."} Gebruik een vriendelijke, motiverende toon.

Als de gebruiker al (bijna) genoeg heeft gegeten, geef dan een compliment en suggereer eventueel een lichte snack of zeg dat het goed is zo.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    return NextResponse.json({ advice: textContent.text });
  } catch (error) {
    console.error("Advice error:", error);
    return NextResponse.json(
      { error: "Failed to get advice" },
      { status: 500 }
    );
  }
}
