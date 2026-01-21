import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  try {
    const { message, context, history } = await request.json();

    // Build conversation history for Claude
    const messages: { role: "user" | "assistant"; content: string }[] = [];

    // Add previous messages from history
    if (history && history.length > 0) {
      history.forEach((msg: ChatMessage) => {
        messages.push({
          role: msg.role,
          content: msg.content,
        });
      });
    }

    // Add current user message
    messages.push({
      role: "user",
      content: message,
    });

    // Build system prompt with user context
    const { profile, totals, targets, mealsLogged, isMenstruation } = context;

    const goals = profile?.goals || [];
    const goalsText = goals.length > 0
      ? goals.map((g: string) => {
          if (g === "weight_loss") return "afvallen";
          if (g === "muscle_gain") return "spieropbouw";
          return "gewicht behouden";
        }).join(" en ")
      : "gezond eten";

    const mealTypeLabels: Record<string, string> = {
      breakfast: "ontbijt",
      lunch: "lunch",
      dinner: "avondeten",
      snack: "snack",
    };

    const loggedMealsText = mealsLogged && mealsLogged.length > 0
      ? mealsLogged.map((t: string) => mealTypeLabels[t] || t).join(", ")
      : "geen";

    const remaining = targets ? {
      calories: targets.calories - (totals?.calories || 0) + (totals?.caloriesBurned || 0),
      protein: targets.protein - (totals?.protein || 0),
      carbs: targets.carbs - (totals?.carbs || 0),
      fat: targets.fat - (totals?.fat || 0),
    } : null;

    const menstruationNote = isMenstruation
      ? "\nDe gebruiker is vandaag ongesteld - houd rekening met extra behoefte aan ijzer en magnesium, en wees begripvol over trek in zoet/koolhydraten."
      : "";

    const systemPrompt = `Je bent een behulpzame Nederlandse voedingsadviseur die chat met een gebruiker over hun voeding.

Gebruikersprofiel:
- Doelen: ${goalsText}
- Gewicht: ${profile?.weight || "onbekend"} kg${menstruationNote}

Vandaag gegeten: ${loggedMealsText}
${totals && targets ? `
Huidige intake:
- Calorieën: ${totals.calories} / ${targets.calories} kcal
- Eiwit: ${totals.protein}g / ${targets.protein}g  
- Koolhydraten: ${totals.carbs}g / ${targets.carbs}g
- Vet: ${totals.fat}g / ${targets.fat}g
${totals.caloriesBurned > 0 ? `- Verbrand door sport: ${totals.caloriesBurned} kcal` : ""}

Nog nodig: ${remaining ? `${remaining.calories} kcal, ${remaining.protein}g eiwit, ${remaining.carbs}g koolhydraten, ${remaining.fat}g vet` : "onbekend"}` : ""}

Instructies:
- Geef korte, praktische antwoorden (max 2-3 zinnen tenzij meer detail gevraagd wordt)
- Noem concrete hoeveelheden waar mogelijk
- Wees vriendelijk en motiverend
- Als je recepten geeft, houd ze simpel en snel
- Houd rekening met de macro's die de gebruiker nog nodig heeft
- Antwoord in het Nederlands`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    // Extract text response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    return NextResponse.json({ reply: textContent.text });
  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to get response" },
      { status: 500 }
    );
  }
}
