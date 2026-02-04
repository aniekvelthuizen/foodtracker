"use client";

import { useState, useEffect } from "react";
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
import { ArrowLeft, Loader2, Search, Check, ChevronRight, Pencil, Star, Plus, X, Settings2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { FoodAnalysis, FollowUpQuestion, MealType, MEAL_TYPES, UserProfile, MacroTargets, FavoriteMeal, SavedIngredient } from "@/types";
import { cn } from "@/lib/utils";
import { calculateMacroTargets } from "@/lib/calories";

type Step = "input" | "analyzing" | "questions" | "review";

interface RecentMeal {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export default function AddMealPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [photo, setPhoto] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [recentMeals, setRecentMeals] = useState<RecentMeal[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [targets, setTargets] = useState<MacroTargets | null>(null);
  
  // Favorites and ingredients
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [ingredients, setIngredients] = useState<SavedIngredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<SavedIngredient[]>([]);
  const [quickSelectTab, setQuickSelectTab] = useState<"favorites" | "ingredients">("favorites");
  const [showSaveFavoriteDialog, setShowSaveFavoriteDialog] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [todayTotals, setTodayTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });

  // Editable nutrition values (stored as strings for input, converted to numbers when needed)
  const [caloriesInput, setCaloriesInput] = useState("0");
  const [proteinInput, setProteinInput] = useState("0");
  const [carbsInput, setCarbsInput] = useState("0");
  const [fatInput, setFatInput] = useState("0");
  const [fiberInput, setFiberInput] = useState("0");

  // Helper to parse input string to number (supports comma and dot)
  const parseInput = (val: string): number => {
    const normalized = val.replace(",", ".");
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  };

  // Computed number values for calculations
  const calories = parseInput(caloriesInput);
  const protein = parseInput(proteinInput);
  const carbs = parseInput(carbsInput);
  const fat = parseInput(fatInput);
  const fiber = parseInput(fiberInput);

  // Fetch profile, targets, today's totals, and recent meals on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) return;

        // Fetch profile for targets
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileData) {
          setProfile(profileData);
          const calculatedTargets = calculateMacroTargets(profileData);
          if (calculatedTargets) {
            setTargets(calculatedTargets);
          }
        }

        // Fetch today's meals for totals
        const today = new Date().toISOString().split("T")[0];
        const { data: todayMeals } = await supabase
          .from("meals")
          .select("calories, protein, carbs, fat, fiber")
          .eq("user_id", user.id)
          .eq("date", today);

        if (todayMeals && todayMeals.length > 0) {
          setTodayTotals({
            calories: todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0),
            protein: todayMeals.reduce((sum, m) => sum + (m.protein || 0), 0),
            carbs: todayMeals.reduce((sum, m) => sum + (m.carbs || 0), 0),
            fat: todayMeals.reduce((sum, m) => sum + (m.fat || 0), 0),
            fiber: todayMeals.reduce((sum, m) => sum + (m.fiber || 0), 0),
          });
        }

        // Fetch recent meals for smart defaults
        const { data: meals } = await supabase
          .from("meals")
          .select("description, calories, protein, carbs, fat")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (meals) {
          setRecentMeals(meals.filter(m => m.description) as RecentMeal[]);
        }

        // Fetch favorite meals
        const { data: favoritesData } = await supabase
          .from("favorite_meals")
          .select("*")
          .eq("user_id", user.id)
          .order("use_count", { ascending: false });

        if (favoritesData) {
          setFavorites(favoritesData);
        }

        // Fetch saved ingredients
        const { data: ingredientsData } = await supabase
          .from("saved_ingredients")
          .select("*")
          .eq("user_id", user.id)
          .order("use_count", { ascending: false });

        if (ingredientsData) {
          setIngredients(ingredientsData);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

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
        body: JSON.stringify({ image: photo, description, recentMeals }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data: FoodAnalysis = await response.json();
      setAnalysis(data);

      // Set initial values
      setCaloriesInput(String(data.calories));
      setProteinInput(String(data.protein));
      setCarbsInput(String(data.carbs));
      setFatInput(String(data.fat));
      setFiberInput(String(data.fiber));

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
          recentMeals,
        }),
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const data: FoodAnalysis = await response.json();
      setAnalysis(data);

      // Update values with refined analysis
      setCaloriesInput(String(data.calories));
      setProteinInput(String(data.protein));
      setCarbsInput(String(data.carbs));
      setFatInput(String(data.fat));
      setFiberInput(String(data.fiber));

      setStep("review");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Analyse mislukt. Probeer opnieuw.");
      setStep("questions");
    }
  };

  // Select a favorite meal - go straight to review
  const handleSelectFavorite = async (favorite: FavoriteMeal) => {
    setAnalysis({
      description: favorite.description || favorite.name,
      calories: favorite.calories,
      protein: favorite.protein,
      carbs: favorite.carbs,
      fat: favorite.fat,
      fiber: favorite.fiber,
      confidence: "high",
    });
    setCaloriesInput(String(favorite.calories));
    setProteinInput(String(favorite.protein));
    setCarbsInput(String(favorite.carbs));
    setFatInput(String(favorite.fat));
    setFiberInput(String(favorite.fiber));
    if (favorite.default_meal_type) {
      setMealType(favorite.default_meal_type);
    }
    setDescription(favorite.name);
    setStep("review");

    // Increment use count
    const supabase = createClient();
    await supabase
      .from("favorite_meals")
      .update({ use_count: favorite.use_count + 1 })
      .eq("id", favorite.id);
  };

  // Toggle ingredient selection
  const handleToggleIngredient = (ingredient: SavedIngredient) => {
    setSelectedIngredients((prev) => {
      const isSelected = prev.some((i) => i.id === ingredient.id);
      if (isSelected) {
        return prev.filter((i) => i.id !== ingredient.id);
      } else {
        return [...prev, ingredient];
      }
    });
  };

  // Use selected ingredients - sum up macros and go to review
  const handleUseIngredients = async () => {
    if (selectedIngredients.length === 0) return;

    const totalCalories = selectedIngredients.reduce((sum, i) => sum + i.calories, 0);
    const totalProtein = selectedIngredients.reduce((sum, i) => sum + i.protein, 0);
    const totalCarbs = selectedIngredients.reduce((sum, i) => sum + i.carbs, 0);
    const totalFat = selectedIngredients.reduce((sum, i) => sum + i.fat, 0);
    const totalFiber = selectedIngredients.reduce((sum, i) => sum + i.fiber, 0);

    const ingredientNames = selectedIngredients.map((i) => i.name).join(", ");

    setAnalysis({
      description: ingredientNames,
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      fiber: totalFiber,
      confidence: "high",
    });
    setCaloriesInput(String(totalCalories));
    setProteinInput(String(totalProtein));
    setCarbsInput(String(totalCarbs));
    setFatInput(String(totalFat));
    setFiberInput(String(totalFiber));
    setDescription(ingredientNames);
    setStep("review");

    // Increment use count for all selected ingredients
    const supabase = createClient();
    for (const ingredient of selectedIngredients) {
      await supabase
        .from("saved_ingredients")
        .update({ use_count: ingredient.use_count + 1 })
        .eq("id", ingredient.id);
    }
  };

  // Save current meal as favorite
  const handleSaveAsFavorite = async () => {
    if (!favoriteName.trim()) {
      toast.error("Geef je favoriet een naam");
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("favorite_meals").insert({
        user_id: user.id,
        name: favoriteName.trim(),
        description: analysis?.description || description,
        calories,
        protein,
        carbs,
        fat,
        fiber,
        default_meal_type: mealType,
        use_count: 0,
      });

      if (error) throw error;

      toast.success("Opgeslagen als favoriet!");
      setShowSaveFavoriteDialog(false);
      setFavoriteName("");

      // Refresh favorites list
      const { data: favoritesData } = await supabase
        .from("favorite_meals")
        .select("*")
        .eq("user_id", user.id)
        .order("use_count", { ascending: false });

      if (favoritesData) {
        setFavorites(favoritesData);
      }
    } catch (error) {
      console.error("Error saving favorite:", error);
      toast.error("Kon niet opslaan als favoriet");
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
        meal_type: mealType,
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
            {/* Quick Select: Favorites & Ingredients */}
            {(favorites.length > 0 || ingredients.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex gap-2">
                    <Button
                      variant={quickSelectTab === "favorites" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setQuickSelectTab("favorites")}
                      className="flex-1"
                    >
                      <Star className="mr-1.5 h-4 w-4" />
                      Favorieten
                    </Button>
                    <Button
                      variant={quickSelectTab === "ingredients" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setQuickSelectTab("ingredients")}
                      className="flex-1"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Ingrediënten
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/favorites">
                        <Settings2 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {quickSelectTab === "favorites" && (
                    <div className="space-y-2">
                      {favorites.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nog geen favorieten. Sla een maaltijd op als favoriet!
                        </p>
                      ) : (
                        <div className="grid gap-2">
                          {favorites.slice(0, 5).map((favorite) => (
                            <Button
                              key={favorite.id}
                              variant="outline"
                              className="h-auto py-3 px-4 justify-start"
                              onClick={() => handleSelectFavorite(favorite)}
                            >
                              <div className="flex flex-col items-start gap-0.5 text-left">
                                <span className="font-medium">{favorite.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {favorite.calories} kcal • {favorite.protein}g eiwit
                                </span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {quickSelectTab === "ingredients" && (
                    <div className="space-y-3">
                      {ingredients.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nog geen ingrediënten opgeslagen.
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2">
                            {ingredients.map((ingredient) => {
                              const isSelected = selectedIngredients.some(
                                (i) => i.id === ingredient.id
                              );
                              return (
                                <Button
                                  key={ingredient.id}
                                  variant={isSelected ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handleToggleIngredient(ingredient)}
                                  className="h-auto py-1.5"
                                >
                                  {ingredient.name}
                                  {ingredient.serving_size && (
                                    <span className="ml-1 text-xs opacity-70">
                                      ({ingredient.serving_size})
                                    </span>
                                  )}
                                </Button>
                              );
                            })}
                          </div>

                          {selectedIngredients.length > 0 && (
                            <div className="border-t pt-3 mt-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">Geselecteerd:</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedIngredients([])}
                                  className="h-auto py-1 px-2 text-xs"
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Wis
                                </Button>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span>Calorieën</span>
                                  <span className="font-medium">
                                    {selectedIngredients.reduce((sum, i) => sum + i.calories, 0)} kcal
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Eiwit</span>
                                  <span>
                                    {selectedIngredients.reduce((sum, i) => sum + i.protein, 0)}g
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Koolhydraten</span>
                                  <span>
                                    {selectedIngredients.reduce((sum, i) => sum + i.carbs, 0)}g
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Vet</span>
                                  <span>
                                    {selectedIngredients.reduce((sum, i) => sum + i.fat, 0)}g
                                  </span>
                                </div>
                              </div>
                              <Button
                                className="w-full mt-3"
                                onClick={handleUseIngredients}
                              >
                                <Check className="mr-2 h-4 w-4" />
                                Gebruik deze ingrediënten
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Divider when favorites/ingredients exist */}
            {(favorites.length > 0 || ingredients.length > 0) && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    of nieuwe maaltijd
                  </span>
                </div>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Type maaltijd</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2">
                  {MEAL_TYPES.map((type) => (
                    <Button
                      key={type.id}
                      variant={mealType === type.id ? "default" : "outline"}
                      className={cn(
                        "h-auto flex-col gap-1 py-3",
                        mealType === type.id && "ring-2 ring-primary ring-offset-2"
                      )}
                      onClick={() => setMealType(type.id)}
                    >
                      <span className="text-xl">{type.icon}</span>
                      <span className="text-xs">{type.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Resultaat</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => {
                      setStep("input");
                      setAnswers({});
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Wijzig
                  </Button>
                </div>
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
                <p className="text-xs flex items-center gap-1.5">
                  <span className="text-muted-foreground">Zekerheid:</span>
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    analysis.confidence === "high" 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : analysis.confidence === "medium"
                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                  )}>
                    {analysis.confidence === "high" ? "Hoog" : analysis.confidence === "medium" ? "Gemiddeld" : "Laag"}
                  </span>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Voedingswaarden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Calories - prominent display */}
                <div className="bg-gradient-to-r from-green-500/10 via-yellow-500/10 to-red-500/10 dark:from-green-500/20 dark:via-yellow-500/20 dark:to-red-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-green-500 to-red-500" />
                      <span className="text-sm font-medium">Calorieën</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={caloriesInput}
                        onChange={(e) => setCaloriesInput(e.target.value)}
                        className="w-20 h-8 text-right text-lg font-bold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary"
                      />
                      <span className="text-sm text-muted-foreground">kcal</span>
                    </div>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden relative bg-gradient-to-r from-green-500 via-yellow-500 to-red-500">
                    {/* Gray overlay to hide unfilled portion */}
                    <div 
                      className="absolute right-0 h-full bg-muted transition-all duration-300"
                      style={{ 
                        width: targets 
                          ? `${100 - Math.min(((todayTotals.calories + calories) / targets.calories) * 100, 100)}%`
                          : `${100 - Math.min((calories / 500) * 100, 100)}%`
                      }}
                    />
                    {/* Divider line between "already eaten" and "this meal" */}
                    {targets && todayTotals.calories > 0 && (
                      <div 
                        className="absolute h-full w-0.5 bg-white/50 dark:bg-black/30 transition-all duration-300"
                        style={{ left: `${Math.min((todayTotals.calories / targets.calories) * 100, 100)}%` }}
                      />
                    )}
                  </div>
                  {targets ? (
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>Eerder: {Math.round(todayTotals.calories)}</span>
                      <span>Na: {Math.round(todayTotals.calories + calories)} / {targets.calories}</span>
                    </div>
                  ) : (
                    <div className="flex justify-end text-xs text-muted-foreground mt-1">
                      <span>{calories} kcal</span>
                    </div>
                  )}
                </div>

                {/* Macros with stacked colored bars */}
                <div className="space-y-3">
                  {/* Protein */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-sm">Eiwit</span>
                      </div>
                      <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={proteinInput}
                        onChange={(e) => setProteinInput(e.target.value)}
                        className="w-16 h-7 text-right text-sm font-medium bg-transparent border-none focus-visible:ring-1 focus-visible:ring-blue-500"
                      />
                        <span className="text-xs text-muted-foreground w-4">g</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                      {targets ? (
                        <>
                          <div 
                            className="absolute h-full bg-blue-300 dark:bg-blue-800 transition-all duration-300"
                            style={{ width: `${Math.min((todayTotals.protein / targets.protein) * 100, 100)}%` }}
                          />
                          <div 
                            className="absolute h-full bg-blue-500 transition-all duration-300"
                            style={{ 
                              left: `${Math.min((todayTotals.protein / targets.protein) * 100, 100)}%`,
                              width: `${Math.min((protein / targets.protein) * 100, 100 - Math.min((todayTotals.protein / targets.protein) * 100, 100))}%` 
                            }}
                          />
                        </>
                      ) : (
                        <div 
                          className="absolute h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${Math.min((protein / 50) * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    {targets && (
                      <div className="flex justify-end text-xs text-muted-foreground">
                        <span>{Math.round(todayTotals.protein + protein)} / {targets.protein}g</span>
                      </div>
                    )}
                  </div>

                  {/* Carbs */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                        <span className="text-sm">Koolhydraten</span>
                      </div>
                      <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={carbsInput}
                        onChange={(e) => setCarbsInput(e.target.value)}
                        className="w-16 h-7 text-right text-sm font-medium bg-transparent border-none focus-visible:ring-1 focus-visible:ring-yellow-500"
                      />
                        <span className="text-xs text-muted-foreground w-4">g</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                      {targets ? (
                        <>
                          <div 
                            className="absolute h-full bg-yellow-300 dark:bg-yellow-800 transition-all duration-300"
                            style={{ width: `${Math.min((todayTotals.carbs / targets.carbs) * 100, 100)}%` }}
                          />
                          <div 
                            className="absolute h-full bg-yellow-500 transition-all duration-300"
                            style={{ 
                              left: `${Math.min((todayTotals.carbs / targets.carbs) * 100, 100)}%`,
                              width: `${Math.min((carbs / targets.carbs) * 100, 100 - Math.min((todayTotals.carbs / targets.carbs) * 100, 100))}%` 
                            }}
                          />
                        </>
                      ) : (
                        <div 
                          className="absolute h-full bg-yellow-500 transition-all duration-300"
                          style={{ width: `${Math.min((carbs / 75) * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    {targets && (
                      <div className="flex justify-end text-xs text-muted-foreground">
                        <span>{Math.round(todayTotals.carbs + carbs)} / {targets.carbs}g</span>
                      </div>
                    )}
                  </div>

                  {/* Fat */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="text-sm">Vet</span>
                      </div>
                      <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={fatInput}
                        onChange={(e) => setFatInput(e.target.value)}
                        className="w-16 h-7 text-right text-sm font-medium bg-transparent border-none focus-visible:ring-1 focus-visible:ring-red-500"
                      />
                        <span className="text-xs text-muted-foreground w-4">g</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                      {targets ? (
                        <>
                          <div 
                            className="absolute h-full bg-red-300 dark:bg-red-800 transition-all duration-300"
                            style={{ width: `${Math.min((todayTotals.fat / targets.fat) * 100, 100)}%` }}
                          />
                          <div 
                            className="absolute h-full bg-red-500 transition-all duration-300"
                            style={{ 
                              left: `${Math.min((todayTotals.fat / targets.fat) * 100, 100)}%`,
                              width: `${Math.min((fat / targets.fat) * 100, 100 - Math.min((todayTotals.fat / targets.fat) * 100, 100))}%` 
                            }}
                          />
                        </>
                      ) : (
                        <div 
                          className="absolute h-full bg-red-500 transition-all duration-300"
                          style={{ width: `${Math.min((fat / 30) * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    {targets && (
                      <div className="flex justify-end text-xs text-muted-foreground">
                        <span>{Math.round(todayTotals.fat + fat)} / {targets.fat}g</span>
                      </div>
                    )}
                  </div>

                  {/* Fiber */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-sm">Vezels</span>
                      </div>
                      <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={fiberInput}
                        onChange={(e) => setFiberInput(e.target.value)}
                        className="w-16 h-7 text-right text-sm font-medium bg-transparent border-none focus-visible:ring-1 focus-visible:ring-green-500"
                      />
                        <span className="text-xs text-muted-foreground w-4">g</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden relative">
                      {targets ? (
                        <>
                          <div 
                            className="absolute h-full bg-green-300 dark:bg-green-800 transition-all duration-300"
                            style={{ width: `${Math.min((todayTotals.fiber / targets.fiber) * 100, 100)}%` }}
                          />
                          <div 
                            className="absolute h-full bg-green-500 transition-all duration-300"
                            style={{ 
                              left: `${Math.min((todayTotals.fiber / targets.fiber) * 100, 100)}%`,
                              width: `${Math.min((fiber / targets.fiber) * 100, 100 - Math.min((todayTotals.fiber / targets.fiber) * 100, 100))}%` 
                            }}
                          />
                        </>
                      ) : (
                        <div 
                          className="absolute h-full bg-green-500 transition-all duration-300"
                          style={{ width: `${Math.min((fiber / 10) * 100, 100)}%` }}
                        />
                      )}
                    </div>
                    {targets && (
                      <div className="flex justify-end text-xs text-muted-foreground">
                        <span>{Math.round(todayTotals.fiber + fiber)} / {targets.fiber}g</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save as favorite dialog */}
            {showSaveFavoriteDialog && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Opslaan als favoriet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Naam voor deze favoriet..."
                    value={favoriteName}
                    onChange={(e) => setFavoriteName(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowSaveFavoriteDialog(false);
                        setFavoriteName("");
                      }}
                    >
                      Annuleren
                    </Button>
                    <Button className="flex-1" onClick={handleSaveAsFavorite}>
                      <Star className="mr-2 h-4 w-4" />
                      Opslaan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setStep("input");
                  setAnalysis(null);
                  setAnswers({});
                  setSelectedIngredients([]);
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

            {!showSaveFavoriteDialog && (
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowSaveFavoriteDialog(true)}
              >
                <Star className="mr-2 h-4 w-4" />
                Opslaan als favoriet
              </Button>
            )}
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
}
