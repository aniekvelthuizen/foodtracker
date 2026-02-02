import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { profile, totals, targets, timeOfDay, isMenstruation, mealsLogged } = await request.json();

    // Calculate remaining macros
    const remaining = {
      calories: targets.calories - totals.calories + totals.caloriesBurned,
      protein: targets.protein - totals.protein,
      carbs: targets.carbs - totals.carbs,
      fat: targets.fat - totals.fat,
      fiber: targets.fiber - totals.fiber,
    };

    // Check which meals have been logged
    const mealTypeLabels: Record<string, string> = {
      breakfast: "ontbijt",
      lunch: "lunch", 
      dinner: "avondeten",
      snack: "snack",
    };
    
    const loggedMealTypes = mealsLogged || [];
    const hasBreakfast = loggedMealTypes.includes("breakfast");
    const hasLunch = loggedMealTypes.includes("lunch");
    const hasDinner = loggedMealTypes.includes("dinner");
    
    // Determine what meal to suggest based on time AND what's already logged
    let mealContext = "een snack";
    if (timeOfDay < 10 && !hasBreakfast) {
      mealContext = "ontbijt";
    } else if (timeOfDay < 14 && !hasLunch) {
      mealContext = "lunch";
    } else if (timeOfDay >= 17 && !hasDinner) {
      mealContext = "avondeten";
    } else if (timeOfDay >= 14 && timeOfDay < 17) {
      mealContext = "een tussendoortje";
    }
    
    // Build logged meals info
    const loggedMealsText = loggedMealTypes.length > 0
      ? `Al gelogde maaltijden vandaag: ${loggedMealTypes.map((t: string) => mealTypeLabels[t] || t).join(", ")}`
      : "Nog geen maaltijden gelogd vandaag";

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

    const prompt = `Je bent een Nederlandse voedingsadviseur. Geef praktisch advies in bullet points.

Gebruikersprofiel:
- Doelen: ${goalsText}
- Gewicht: ${profile.weight || "onbekend"} kg
${menstruationContext}

${loggedMealsText}

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

Suggereer ${mealContext} (niet een maaltijd die al gelogd is!).

GEEF JE ANTWOORD IN DIT EXACTE FORMAT:
• [Korte status over hoe de dag gaat - 1 zin]
• [Waar je op moet letten bij ${mealContext}, bijv. "Focus op eiwitrijk: kip, vis, eieren, tofu, peulvruchten of zuivel"]
• [2-3 flexibele opties die je waarschijnlijk in huis hebt, gescheiden door " of "]
• [Optioneel: snelle tip]

REGELS:
- Begin elke regel met • (bullet point)
- Maximaal 3-4 bullets
- NIET te specifiek met exacte hoeveelheden - geef CATEGORIEËN en OPTIES
- Geef altijd meerdere alternatieven zodat de gebruiker kan kiezen wat ze in huis heeft
- Voorbeelden van goede suggesties:
  * "Eiwitrijk: kip, vis, ei, cottage cheese, of peulvruchten"
  * "Vezelrijk: groenten, volkoren producten, of fruit"
  * "Combineer bijv. een ei-gerecht, wrap met kip, of yoghurt met noten"
- ${isMenstruation ? "Noem ijzer/magnesium-rijke opties: spinazie, rode biet, noten, pure chocolade, peulvruchten." : "Focus op het belangrijkste tekort."}
- Gebruik een vriendelijke toon
- Als de gebruiker al genoeg heeft: geef een compliment en zeg dat het goed is zo`;

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
