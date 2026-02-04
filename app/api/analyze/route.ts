import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface RecentMeal {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export async function POST(request: Request) {
  try {
    const { image, description, answers, recentMeals } = await request.json();

    if (!image && !description) {
      return NextResponse.json(
        { error: "Image or description required" },
        { status: 400 }
      );
    }

    // Build recent meals context if available
    const recentMealsContext = recentMeals && recentMeals.length > 0
      ? `\nPERSOONLIJKE EETGESCHIEDENIS:
De gebruiker heeft recent deze maaltijden gelogd:
${(recentMeals as RecentMeal[]).map((m: RecentMeal) => `- ${m.description}: ${m.calories} kcal, ${m.protein}g eiwit`).join("\n")}

Gebruik deze informatie om patronen te herkennen en als defaults te gebruiken. Bijvoorbeeld:
- Als ze vaak "koffie met melk" loggen → neem melk aan bij nieuwe koffie
- Als hun boterhammen meestal ~250 kcal zijn → gebruik dat als referentie
`
      : "";

    // Build the prompt based on whether we have follow-up answers
    let prompt: string;
    
    if (answers && Object.keys(answers).length > 0) {
      // Follow-up analysis with additional info
      prompt = `Je bent een voedingsexpert die maaltijden analyseert. De gebruiker heeft eerder een foto/beschrijving gegeven en nu extra informatie verstrekt.

Oorspronkelijke beschrijving: ${description || "Geen beschrijving"}

Extra informatie van de gebruiker:
${Object.entries(answers)
  .map(([question, answer]) => `- ${question}: ${answer}`)
  .join("\n")}
${recentMealsContext}
Geef nu een nauwkeurige schatting van de voedingswaarden in JSON formaat:
{
  "description": "korte beschrijving van de maaltijd",
  "calories": getal,
  "protein": getal in grammen,
  "carbs": getal in grammen,
  "fat": getal in grammen,
  "fiber": getal in grammen,
  "confidence": "low" | "medium" | "high"
}

Geef ALLEEN de JSON terug, geen andere tekst.`;
    } else {
      // Initial analysis - may need follow-up questions
      prompt = `Je bent een voedingsexpert die maaltijden analyseert voor een Nederlandse gebruiker.

${description ? `Beschrijving van de gebruiker: "${description}"` : "De gebruiker heeft geen beschrijving gegeven."}
${recentMealsContext}
VRAGENBELEID - SLIMME BALANS:

STAP 1: Check eerst de eetgeschiedenis
- Als de maaltijd LIJKT op iets uit de eetgeschiedenis → gebruik die waarden als basis, GEEN vragen
- Voorbeeld: gebruiker zegt "koffie" en heeft eerder "koffie met melk: 45 kcal" gelogd → neem 45 kcal aan

STAP 2: Bepaal of vragen nodig zijn (max 2 vragen!)
Context-afhankelijke drempel:
- Kleine maaltijd/snack (<200 kcal): vraag bij >25 kcal verschil
- Normale maaltijd (200-500 kcal): vraag bij >30 kcal verschil  
- Grote maaltijd (>500 kcal): vraag bij >50 kcal verschil

ALTIJD vragen bij deze "verborgen calorieën" (ongeacht drempel):
- Sauzen en dressings (mayo, ketchup, pesto, dressing)
- Bereidingswijze met vet (gebakken in boter/olie vs droog/gestoomd)
- Toppings bij warme maaltijden (kaas, room, croutons)
- Broodbeleg spreads (boter, margarine, pindakaas hoeveelheid)

NOOIT vragen bij:
- Items die matchen met eetgeschiedenis (gebruik die waarden)
- Standaard fruit en groente zonder toevoegingen
- Dranken met weinig variatie (water, thee zonder suiker)
- Als de foto duidelijk de portie en ingrediënten toont

STAP 3: Maak aannames transparant
Vermeld altijd je aannames in de description:
"Boterham kaas (2 sneetjes bruin, 30g kaas, geen boter - zoals je gebruikelijk eet)"
"Salade (aangenomen: zonder dressing - vraag gesteld)"

Antwoord in JSON formaat:
{
  "description": "korte beschrijving met aannames tussen haakjes",
  "calories": getal (beste schatting),
  "protein": getal in grammen,
  "carbs": getal in grammen,
  "fat": getal in grammen,
  "fiber": getal in grammen,
  "confidence": "low" | "medium" | "high",
  "followUpQuestions": []
}

followUpQuestions formaat (MAX 2 vragen, vaak 0-1):
{
  "id": "unieke_id",
  "question": "korte vraag in het Nederlands",
  "type": "choice" | "text",
  "options": ["optie1", "optie2", "optie3"] // alleen bij type "choice", max 4 opties
}

Voorbeelden van goede vragen:
- "Met saus of dressing?" met opties ["Geen", "Lichte hoeveelheid", "Normale hoeveelheid"]
- "Hoe is het bereid?" met opties ["Gebakken in boter/olie", "Droog gebakken", "Gestoomd/gekookt"]
- "Zat er boter op het brood?" met opties ["Ja", "Nee"]

Geef ALLEEN de JSON terug, geen andere tekst.`;
    }

    // Build message content
    const content: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    if (image) {
      // Extract base64 data from data URL
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const mediaType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: base64Data,
        },
      });
    }

    content.push({
      type: "text",
      text: prompt,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    });

    // Extract text response
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response");
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze food" },
      { status: 500 }
    );
  }
}
