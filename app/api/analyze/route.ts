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
VRAGENBELEID - VOLG DIT STRIKT:
1. Bij confidence "high": GEEN vragen stellen, gebruik je beste schatting
2. Bij confidence "medium" of "low": stel ALLEEN een vraag als het antwoord >50 kcal verschil zou maken
3. Als het verschil <50 kcal is: kies de meest waarschijnlijke optie en vermeld dit in de description

Wanneer GEEN vragen nodig zijn:
- Standaard porties van herkenbare gerechten (bijv. "boterham met kaas", "appel", "koffie")
- Als je een duidelijke foto hebt waarop de portie zichtbaar is
- Bij simpele snacks/drankjes met weinig variatie
- Als je uit de eetgeschiedenis kunt afleiden wat de gebruiker waarschijnlijk bedoelt

Wanneer WEL een vraag nuttig is:
- Verborgen caloriebomben: sauzen, olie, boter die >50 kcal kunnen toevoegen
- Portiegrootte is totaal onduidelijk EN maakt >50 kcal verschil
- Meerdere varianten mogelijk met >50 kcal verschil (bijv. friet met of zonder mayo)

Als je aannames maakt, vermeld deze in de description, bijv:
"Boterham kaas (aangenomen: 2 sneetjes bruin brood, 30g kaas - zoals je vaker eet)"

Antwoord in JSON formaat:
{
  "description": "korte beschrijving, inclusief eventuele aannames",
  "calories": getal (beste schatting),
  "protein": getal in grammen,
  "carbs": getal in grammen,
  "fat": getal in grammen,
  "fiber": getal in grammen,
  "confidence": "low" | "medium" | "high",
  "followUpQuestions": []
}

BELANGRIJK: followUpQuestions mag LEEG zijn (en is dat meestal). Voeg alleen vragen toe als ze echt nodig zijn volgens bovenstaand beleid.

Als je toch een vraag stelt, gebruik dit formaat:
{
  "id": "unieke_id",
  "question": "vraag in het Nederlands",
  "type": "choice" | "text",
  "options": ["optie1", "optie2"] // alleen bij type "choice"
}

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
