"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, LogOut, Save, Watch, Calculator, Target, ChevronRight, Dumbbell, History } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { UserProfile, WEIGHT_LOSS_RATES, WEIGHT_GAIN_RATES, WORKOUT_CALORIE_OPTIONS, getSuggestedWorkoutPercentage } from "@/types";
import { calculateTDEE, calculateMacroTargets, getEffectiveTDEE } from "@/lib/calories";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const activityLevels = [
  { value: "sedentary", label: "Zittend (weinig beweging)" },
  { value: "light", label: "Licht actief (1-3 dagen/week)" },
  { value: "moderate", label: "Matig actief (3-5 dagen/week)" },
  { value: "active", label: "Actief (6-7 dagen/week)" },
  { value: "very_active", label: "Zeer actief (intensieve sport/fysiek werk)" },
];

const goalOptions = [
  { value: "weight_loss", label: "Afvallen" },
  { value: "muscle_gain", label: "Spieropbouw" },
  { value: "maintenance", label: "Gewicht behouden" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<Partial<UserProfile>>({
    weight: null,
    height: null,
    age: null,
    gender: null,
    activity_level: null,
    goals: [],
    custom_tdee: null,
    use_custom_tdee: false,
    calorie_adjustment: null,
    target_weight: null,
    workout_calorie_percentage: 100,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Kon profiel niet laden");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Not authenticated");
      }

      // Calculate TDEE (even if using custom, store calculated as backup)
      const tdee = calculateTDEE(profile as UserProfile);

      const { error } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          ...profile,
          tdee,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("Profiel opgeslagen!");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Kon profiel niet opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const toggleGoal = (goal: string) => {
    const currentGoals = profile.goals || [];
    
    // If selecting a new goal, clear old ones first (single select behavior)
    let newGoals: UserProfile["goals"];
    if (currentGoals.includes(goal as UserProfile["goals"][number])) {
      newGoals = currentGoals.filter((g) => g !== goal);
    } else {
      // Replace with new goal (single selection)
      newGoals = [goal as UserProfile["goals"][number]];
    }
    
    // Reset calorie adjustment when goal changes
    let newAdjustment = profile.calorie_adjustment;
    if (goal === "maintenance") {
      newAdjustment = 0;
    } else if (goal === "weight_loss" && (!newAdjustment || newAdjustment > 0)) {
      newAdjustment = -500; // Default deficit
    } else if (goal === "muscle_gain" && (!newAdjustment || newAdjustment < 0)) {
      newAdjustment = 300; // Default surplus
    }
    
    // Set suggested workout calorie percentage based on goal
    const suggestedPercentage = getSuggestedWorkoutPercentage(newAdjustment ?? null, goal);
    
    setProfile({ ...profile, goals: newGoals, calorie_adjustment: newAdjustment, workout_calorie_percentage: suggestedPercentage });
  };

  const selectCalorieAdjustment = (adjustment: number) => {
    const currentGoal = profile.goals?.[0] || null;
    const suggestedPercentage = getSuggestedWorkoutPercentage(adjustment, currentGoal);
    setProfile({ ...profile, calorie_adjustment: adjustment, workout_calorie_percentage: suggestedPercentage });
  };

  const selectWorkoutPercentage = (percentage: number) => {
    setProfile({ ...profile, workout_calorie_percentage: percentage });
  };

  // Calculate preview
  const previewProfile = { ...profile, id: "preview" } as UserProfile;
  const calculatedTdee = calculateTDEE(previewProfile);
  const effectiveTdee = getEffectiveTDEE(previewProfile);
  const macros = calculateMacroTargets(previewProfile);

  // Calculate time to goal
  const calculateTimeToGoal = () => {
    if (!profile.weight || !profile.target_weight || !profile.calorie_adjustment) {
      return null;
    }
    const weightDiff = profile.weight - profile.target_weight;
    if (weightDiff <= 0) return null; // Already at or below target
    
    // 7700 kcal = 1 kg fat
    const dailyDeficit = Math.abs(profile.calorie_adjustment);
    const daysToGoal = (weightDiff * 7700) / dailyDeficit;
    const weeksToGoal = Math.round(daysToGoal / 7);
    
    return weeksToGoal;
  };

  const weeksToGoal = calculateTimeToGoal();

  const isWeightLoss = profile.goals?.includes("weight_loss");
  const isMuscleGain = profile.goals?.includes("muscle_gain");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Profiel" />
      
      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle>Persoonlijke gegevens</CardTitle>
            <CardDescription>
              Vul je gegevens in voor nauwkeurige berekeningen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight">Huidig gewicht (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  placeholder="75"
                  value={profile.weight || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, weight: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_weight">Streefgewicht (kg)</Label>
                <Input
                  id="target_weight"
                  type="number"
                  placeholder="70"
                  value={profile.target_weight || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, target_weight: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Lengte (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  placeholder="180"
                  value={profile.height || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, height: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Leeftijd</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="30"
                  value={profile.age || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, age: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Geslacht</Label>
              <Select
                value={profile.gender || ""}
                onValueChange={(value) =>
                  setProfile({ ...profile, gender: value as "male" | "female" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kies..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Man</SelectItem>
                  <SelectItem value="female">Vrouw</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* TDEE Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Dagelijks verbruik (TDEE)
            </CardTitle>
            <CardDescription>
              Hoeveel calorieën verbruik je per dag?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Toggle between calculated and custom */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={!profile.use_custom_tdee ? "default" : "outline"}
                className="h-auto flex-col gap-1 py-3"
                onClick={() => setProfile({ ...profile, use_custom_tdee: false })}
              >
                <Calculator className="h-5 w-5" />
                <span className="text-sm">Berekenen</span>
              </Button>
              <Button
                variant={profile.use_custom_tdee ? "default" : "outline"}
                className="h-auto flex-col gap-1 py-3"
                onClick={() => setProfile({ ...profile, use_custom_tdee: true })}
              >
                <Watch className="h-5 w-5" />
                <span className="text-sm">Garmin/Smartwatch</span>
              </Button>
            </div>

            {profile.use_custom_tdee ? (
              /* Custom TDEE input */
              <div className="space-y-2">
                <Label htmlFor="custom_tdee">Jouw gemeten TDEE (kcal/dag)</Label>
                <Input
                  id="custom_tdee"
                  type="number"
                  placeholder="2200"
                  value={profile.custom_tdee || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, custom_tdee: e.target.value ? Number(e.target.value) : null })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Tip: In Garmin Connect vind je dit onder &quot;Calorieën&quot; → Rust + Actief gemiddelde
                </p>
              </div>
            ) : (
              /* Activity level for calculation */
              <div className="space-y-2">
                <Label htmlFor="activity">Activiteitsniveau</Label>
                <Select
                  value={profile.activity_level || ""}
                  onValueChange={(value) =>
                    setProfile({ ...profile, activity_level: value as UserProfile["activity_level"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Kies je activiteitsniveau" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityLevels.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {calculatedTdee && (
                  <p className="text-sm text-muted-foreground">
                    Berekend verbruik: <strong>{calculatedTdee} kcal/dag</strong>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle>Doel</CardTitle>
            <CardDescription>Wat wil je bereiken?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {goalOptions.map((goal) => (
                <Button
                  key={goal.value}
                  variant={profile.goals?.includes(goal.value as UserProfile["goals"][number]) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleGoal(goal.value)}
                >
                  {goal.label}
                </Button>
              ))}
            </div>

            {/* Weight loss rate selection */}
            {isWeightLoss && (
              <div className="space-y-2 pt-2">
                <Label>Hoe snel wil je afvallen?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEIGHT_LOSS_RATES.map((rate) => (
                    <Button
                      key={rate.id}
                      variant={profile.calorie_adjustment === rate.adjustment ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-auto flex-col gap-0.5 py-2",
                        profile.calorie_adjustment === rate.adjustment && "ring-2 ring-primary ring-offset-1"
                      )}
                      onClick={() => selectCalorieAdjustment(rate.adjustment)}
                    >
                      <span className="font-medium">{rate.labelNL}</span>
                      <span className="text-xs text-muted-foreground">{rate.weeklyLoss}</span>
                      <span className="text-xs opacity-60">{rate.adjustment} kcal</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Weight gain rate selection */}
            {isMuscleGain && (
              <div className="space-y-2 pt-2">
                <Label>Hoe snel wil je aankomen?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {WEIGHT_GAIN_RATES.map((rate) => (
                    <Button
                      key={rate.id}
                      variant={profile.calorie_adjustment === rate.adjustment ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        "h-auto flex-col gap-0.5 py-2",
                        profile.calorie_adjustment === rate.adjustment && "ring-2 ring-primary ring-offset-1"
                      )}
                      onClick={() => selectCalorieAdjustment(rate.adjustment)}
                    >
                      <span className="font-medium">{rate.labelNL}</span>
                      <span className="text-xs text-muted-foreground">{rate.weeklyLoss}</span>
                      <span className="text-xs opacity-60">+{rate.adjustment} kcal</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Workout Calorie Settings */}
        {(isWeightLoss || isMuscleGain || profile.goals?.includes("maintenance")) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5" />
                Workout calorieën
              </CardTitle>
              <CardDescription>
                Hoeveel van je verbrande workout-calorieën wil je terugeten?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {WORKOUT_CALORIE_OPTIONS.map((option) => (
                  <Button
                    key={option.id}
                    variant={profile.workout_calorie_percentage === option.percentage ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-1 h-10",
                      profile.workout_calorie_percentage === option.percentage && "ring-2 ring-primary ring-offset-1"
                    )}
                    onClick={() => selectWorkoutPercentage(option.percentage)}
                  >
                    {option.percentage}%
                  </Button>
                ))}
              </div>
              
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="text-muted-foreground">
                  {profile.workout_calorie_percentage === 100 ? (
                    <>Bij een workout van 400 kcal krijg je <strong>400 kcal</strong> extra te eten.</>
                  ) : profile.workout_calorie_percentage === 0 ? (
                    <>Workout calorieën worden niet bij je dagbudget opgeteld. Dit maximaliseert je deficit.</>
                  ) : (
                    <>Bij een workout van 400 kcal krijg je <strong>{Math.round(400 * (profile.workout_calorie_percentage || 100) / 100)} kcal</strong> extra te eten.</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results Preview */}
        {effectiveTdee && macros && (
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle>Jouw dagelijkse doelen</CardTitle>
              <CardDescription>
                {profile.use_custom_tdee ? "Gebaseerd op je Garmin data" : "Gebaseerd op je gegevens"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-lg font-medium">
                  <span>Calorieën</span>
                  <span>{macros.calories} kcal</span>
                </div>
                
                {profile.calorie_adjustment && profile.calorie_adjustment !== 0 && (
                  <p className="text-sm text-muted-foreground">
                    TDEE ({effectiveTdee}) {profile.calorie_adjustment > 0 ? "+" : ""}{profile.calorie_adjustment} = {macros.calories} kcal
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Eiwit</span>
                    <span>{macros.protein}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Koolhydraten</span>
                    <span>{macros.carbs}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vet</span>
                    <span>{macros.fat}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vezels</span>
                    <span>{macros.fiber}g</span>
                  </div>
                </div>

                {/* Time to goal estimate */}
                {isWeightLoss && weeksToGoal && profile.target_weight && (
                  <div className="mt-4 rounded-lg bg-background p-3">
                    <p className="text-sm">
                      <strong>Geschatte tijd tot {profile.target_weight} kg:</strong>
                      <br />
                      {weeksToGoal < 52 ? (
                        <span className="text-lg font-semibold text-primary">~{weeksToGoal} weken</span>
                      ) : (
                        <span className="text-lg font-semibold text-primary">~{Math.round(weeksToGoal / 4)} maanden</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <Button className="w-full" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opslaan...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Profiel opslaan
            </>
          )}
        </Button>

        {/* History */}
        <Card>
          <CardContent className="py-0">
            <Link 
              href="/history" 
              className="flex items-center justify-between py-4 hover:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Geschiedenis</p>
                  <p className="text-sm text-muted-foreground">Bekijk je eerdere dagen</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button variant="outline" className="w-full" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Uitloggen
        </Button>
      </main>

      <Navigation />
    </div>
  );
}
