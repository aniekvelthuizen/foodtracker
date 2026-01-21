"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { PhotoUpload } from "@/components/PhotoUpload";
import { VoiceInput } from "@/components/VoiceInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Search, Check, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { FoodAnalysis, FollowUpQuestion } from "@/types";

type Step = "input" | "analyzing" | "questions" | "review";

export default function AddMealPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Editable nutrition values
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [fiber, setFiber] = useState(0);

  const handleAnalyze = async () => {
    if (!photo && !description) {
      toast.error("Voeg een foto of beschrijving toe");
      return;
    }

    setStep("analyzing");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: photo, description }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data: FoodAnalysis = await response.json();
      setAnalysis(data);

      // Set initial values
      setCalories(data.calories);
      setProtein(data.protein);
      setCarbs(data.carbs);
      setFat(data.fat);
      setFiber(data.fiber);

      // Check if there are follow-up questions
      if (data.followUpQuestions && data.followUpQuestions.length > 0) {
        setStep("questions");
      } else {
        setStep("review");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Analyse mislukt. Probeer opnieuw.");
      setStep("input");
    }
  };

  const handleAnswerQuestion = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmitAnswers = async () => {
    setStep("analyzing");

    try {
      // Re-analyze with additional information
      const questionsWithAnswers: Record<string, string> = {};
      analysis?.followUpQuestions?.forEach((q) => {
        // Filter out placeholder value and empty answers
        if (answers[q.id] && answers[q.id] !== "__custom__") {
          questionsWithAnswers[q.question] = answers[q.id];
        }
      });

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: photo,
          description,
          answers: questionsWithAnswers,
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data: FoodAnalysis = await response.json();
      setAnalysis(data);

      // Update values with refined analysis
      setCalories(data.calories);
      setProtein(data.protein);
      setCarbs(data.carbs);
      setFat(data.fat);
      setFiber(data.fiber);

      setStep("review");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Analyse mislukt. Probeer opnieuw.");
      setStep("questions");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const today = new Date().toISOString().split("T")[0];
      const time = new Date().toTimeString().slice(0, 5);

      // Upload photo to Supabase Storage if present
      let photoUrl: string | null = null;
      if (photo) {
        const fileName = `${user.id}/${Date.now()}.jpg`;
        const base64Data = photo.replace(/^data:image\/\w+;base64,/, "");
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("meal-photos")
          .upload(fileName, Buffer.from(base64Data, "base64"), {
            contentType: "image/jpeg",
          });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          // Continue without photo
        } else {
          const { data: urlData } = supabase.storage
            .from("meal-photos")
            .getPublicUrl(fileName);
          photoUrl = urlData.publicUrl;
        }
      }

      // Save meal to database
      const { error } = await supabase.from("meals").insert({
        user_id: user.id,
        date: today,
        time,
        description: analysis?.description || description || "Maaltijd",
        photo_url: photoUrl,
        calories,
        protein,
        carbs,
        fat,
        fiber,
      });

      if (error) throw error;

      toast.success("Maaltijd opgeslagen!");
      router.push("/");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Kon maaltijd niet opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-md items-center px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="ml-2 font-semibold">Maaltijd toevoegen</span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* Step: Input */}
        {step === "input" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Foto</CardTitle>
              </CardHeader>
              <CardContent>
                <PhotoUpload value={photo} onChange={setPhoto} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Beschrijving</CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceInput
                  value={description}
                  onChange={setDescription}
                  placeholder="Beschrijf je maaltijd... (bijv. broodje kaas met tomaat)"
                />
              </CardContent>
            </Card>

            <Button className="w-full h-12" onClick={handleAnalyze}>
              <Search className="mr-2 h-4 w-4" />
              Analyseren
            </Button>
          </>
        )}

        {/* Step: Analyzing */}
        {step === "analyzing" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-muted-foreground">Analyseren...</p>
            </CardContent>
          </Card>
        )}

        {/* Step: Follow-up Questions */}
        {step === "questions" && analysis?.followUpQuestions && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nog een paar vragen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  {analysis.description}
                </p>

                {analysis.followUpQuestions.map((question: FollowUpQuestion) => {
                  const isCustomAnswer = question.type === "choice" && 
                    question.options && 
                    answers[question.id] && 
                    !question.options.includes(answers[question.id]) &&
                    answers[question.id] !== "__custom__";
                  const showCustomInput = answers[question.id] === "__custom__" || isCustomAnswer;
                  
                  return (
                    <div key={question.id} className="space-y-2">
                      <Label>{question.question}</Label>
                      {question.type === "choice" && question.options ? (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {question.options.map((option) => (
                              <Button
                                key={option}
                                variant={
                                  answers[question.id] === option
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() =>
                                  handleAnswerQuestion(question.id, option)
                                }
                              >
                                {option}
                              </Button>
                            ))}
                            <Button
                              variant={showCustomInput ? "default" : "outline"}
                              size="sm"
                              onClick={() =>
                                handleAnswerQuestion(question.id, "__custom__")
                              }
                            >
                              Anders...
                            </Button>
                          </div>
                          {showCustomInput && (
                            <Input
                              placeholder="Typ je antwoord..."
                              value={isCustomAnswer ? answers[question.id] : ""}
                              onChange={(e) =>
                                handleAnswerQuestion(question.id, e.target.value || "__custom__")
                              }
                              className="mt-2"
                              autoFocus
                            />
                          )}
                        </>
                      ) : (
                        <VoiceInput
                          value={answers[question.id] || ""}
                          onChange={(value) =>
                            handleAnswerQuestion(question.id, value)
                          }
                          placeholder="Je antwoord..."
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep("review")}
              >
                Overslaan
              </Button>
              <Button className="flex-1" onClick={handleSubmitAnswers}>
                Volgende
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {/* Step: Review & Edit */}
        {step === "review" && analysis && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resultaat</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {photo && (
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo}
                      alt="Meal"
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  {analysis.description}
                </p>
                <p className="text-xs text-muted-foreground">
                  Zekerheid: {analysis.confidence === "high" ? "Hoog" : analysis.confidence === "medium" ? "Gemiddeld" : "Laag"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Voedingswaarden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Pas de waarden aan indien nodig
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calories">Calorieën (kcal)</Label>
                    <Input
                      id="calories"
                      type="number"
                      value={calories}
                      onChange={(e) => setCalories(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="protein">Eiwit (g)</Label>
                    <Input
                      id="protein"
                      type="number"
                      value={protein}
                      onChange={(e) => setProtein(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="carbs">Koolhydraten (g)</Label>
                    <Input
                      id="carbs"
                      type="number"
                      value={carbs}
                      onChange={(e) => setCarbs(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fat">Vet (g)</Label>
                    <Input
                      id="fat"
                      type="number"
                      value={fat}
                      onChange={(e) => setFat(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="fiber">Vezels (g)</Label>
                    <Input
                      id="fiber"
                      type="number"
                      value={fiber}
                      onChange={(e) => setFiber(Number(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("input");
                  setAnalysis(null);
                  setAnswers({});
                }}
              >
                Opnieuw
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Opslaan
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
}
