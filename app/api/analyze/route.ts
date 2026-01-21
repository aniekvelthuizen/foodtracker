import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { image, description, answers } = await request.json();

    if (!image && !description) {
      return NextResponse.json(
        { error: "Image or description required" },
        { status: 400 }
      );
    }

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

Analyseer de maaltijd en geef een schatting van de voedingswaarden. Als je twijfelt over bepaalde aspecten (portiegroottes, ingrediënten die je niet kunt zien, bereidingswijze), stel dan 1-3 korte vervolgvragen.

Antwoord in JSON formaat:
{
  "description": "korte beschrijving van wat je ziet/begrijpt",
  "calories": getal (beste schatting),
  "protein": getal in grammen,
  "carbs": getal in grammen,
  "fat": getal in grammen,
  "fiber": getal in grammen,
  "confidence": "low" | "medium" | "high",
  "followUpQuestions": [
    {
      "id": "unieke_id",
      "question": "vraag in het Nederlands",
      "type": "choice" | "text",
      "options": ["optie1", "optie2"] // alleen bij type "choice"
    }
  ]
}

Voorbeelden van goede vervolgvragen:
- "Hoeveel boter of olie is gebruikt bij de bereiding?" met opties ["Geen", "Weinig", "Normaal", "Veel"]
- "Welk type brood is dit?" met opties ["Wit", "Bruin", "Volkoren", "Spelt"]
- "Hoe groot schat je de portie?" met opties ["Klein", "Normaal", "Groot"]
- "Zat er saus of dressing bij?" met opties ["Nee", "Ja, weinig", "Ja, normaal", "Ja, veel"]

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
