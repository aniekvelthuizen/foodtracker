"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { MacroProgress } from "@/components/MacroProgress";
import { MealCard } from "@/components/MealCard";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Plus, Lightbulb, Dumbbell, Droplets } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Meal, Workout, UserProfile, MacroTargets, DailyLog } from "@/types";
import { calculateMacroTargets } from "@/lib/calories";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Load today's meals
      const { data: mealsData } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("time", { ascending: true });

      if (mealsData) {
        setMeals(mealsData);
      }

      // Load today's workouts
      const { data: workoutsData } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: true });

      if (workoutsData) {
        setWorkouts(workoutsData);
      }

      // Load today's daily log (menstruation status)
      const { data: logData } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .single();

      if (logData) {
        setDailyLog(logData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Kon gegevens niet laden");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMenstruation = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const newValue = !dailyLog?.is_menstruation;

      if (dailyLog) {
        // Update existing log
        const { error } = await supabase
          .from("daily_logs")
          .update({ 
            is_menstruation: newValue,
            updated_at: new Date().toISOString()
          })
          .eq("id", dailyLog.id);

        if (error) throw error;
        setDailyLog({ ...dailyLog, is_menstruation: newValue });
      } else {
        // Create new log
        const { data, error } = await supabase
          .from("daily_logs")
          .insert({
            user_id: user.id,
            date: today,
            is_menstruation: newValue,
          })
          .select()
          .single();

        if (error) throw error;
        setDailyLog(data);
      }

      // Clear advice so user can get updated advice
      setAdvice(null);
    } catch (error) {
      console.error("Error toggling menstruation:", error);
      toast.error("Kon status niet opslaan");
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("meals").delete().eq("id", id);

      if (error) throw error;

      setMeals(meals.filter((m) => m.id !== id));
      toast.success("Maaltijd verwijderd");
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast.error("Kon maaltijd niet verwijderen");
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("workouts").delete().eq("id", id);

      if (error) throw error;

      setWorkouts(workouts.filter((w) => w.id !== id));
      toast.success("Workout verwijderd");
    } catch (error) {
      console.error("Error deleting workout:", error);
      toast.error("Kon workout niet verwijderen");
    }
  };

  const loadAdvice = async () => {
    if (!profile || !targets) return;

    setIsLoadingAdvice(true);
    try {
      const response = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          totals,
          targets,
          timeOfDay: new Date().getHours(),
          isMenstruation: dailyLog?.is_menstruation || false,
        }),
      });

      if (!response.ok) throw new Error("Failed to get advice");

      const data = await response.json();
      setAdvice(data.advice);
    } catch (error) {
      console.error("Error loading advice:", error);
      toast.error("Kon advies niet laden");
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  // Calculate totals
  const totals = {
    calories: meals.reduce((sum, m) => sum + m.calories, 0),
    protein: meals.reduce((sum, m) => sum + m.protein, 0),
    carbs: meals.reduce((sum, m) => sum + m.carbs, 0),
    fat: meals.reduce((sum, m) => sum + m.fat, 0),
    fiber: meals.reduce((sum, m) => sum + m.fiber, 0),
    caloriesBurned: workouts.reduce((sum, w) => sum + w.calories_burned, 0),
  };

  // Get targets from profile (with menstruation adjustment if applicable)
  const isMenstruating = dailyLog?.is_menstruation || false;
  const targets: MacroTargets | null = profile
    ? calculateMacroTargets(profile, isMenstruating)
    : null;

  // Adjust calorie target for workouts
  const adjustedCalorieTarget = targets
    ? targets.calories + totals.caloriesBurned
    : 0;

  const caloriePercentage = adjustedCalorieTarget
    ? Math.min(100, (totals.calories / adjustedCalorieTarget) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* Profile incomplete warning */}
        {(!profile?.weight || !profile?.height || !profile?.tdee) && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
            <CardContent className="p-4">
              <p className="text-sm">
                Vul eerst je{" "}
                <Link href="/profile" className="font-medium underline">
                  profiel
                </Link>{" "}
                in voor nauwkeurige berekeningen.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Calorie summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Vandaag</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-2xl font-bold">{totals.calories}</span>
                <span className="text-2xl text-muted-foreground">
                  / {adjustedCalorieTarget} kcal
                </span>
              </div>
              <Progress value={caloriePercentage} className="h-3" />
              {totals.caloriesBurned > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  +{totals.caloriesBurned} kcal door workouts
                </p>
              )}
            </div>

            {targets && (
              <div className="space-y-3">
                <MacroProgress
                  label="Eiwit"
                  current={totals.protein}
                  target={targets.protein}
                  color="bg-blue-500"
                />
                <MacroProgress
                  label="Koolhydraten"
                  current={totals.carbs}
                  target={targets.carbs}
                  color="bg-yellow-500"
                />
                <MacroProgress
                  label="Vet"
                  current={totals.fat}
                  target={targets.fat}
                  color="bg-red-500"
                />
                <MacroProgress
                  label="Vezels"
                  current={totals.fiber}
                  target={targets.fiber}
                  color="bg-green-500"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button asChild className="h-12">
            <Link href="/add">
              <Plus className="mr-2 h-4 w-4" />
              Eten toevoegen
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12">
            <Link href="/workout">
              <Dumbbell className="mr-2 h-4 w-4" />
              Workout toevoegen
            </Link>
          </Button>
        </div>

        {/* Menstruation toggle */}
        {profile?.gender === "female" && (
          <Button
            variant={dailyLog?.is_menstruation ? "default" : "outline"}
            className={cn(
              "w-full justify-start gap-2",
              dailyLog?.is_menstruation && "bg-pink-600 hover:bg-pink-700 text-white"
            )}
            onClick={toggleMenstruation}
          >
            <Droplets className="h-4 w-4" />
            {dailyLog?.is_menstruation ? "Ongesteld vandaag" : "Ongesteld vandaag?"}
          </Button>
        )}

        {/* AI Advice */}
        {targets && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Lightbulb className="h-4 w-4" />
                  AI Advies
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadAdvice}
                  disabled={isLoadingAdvice}
                >
                  {isLoadingAdvice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Vernieuw"
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {advice ? (
                <p className="text-sm text-muted-foreground">{advice}</p>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={loadAdvice}
                  disabled={isLoadingAdvice}
                >
                  {isLoadingAdvice ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Laden...
                    </>
                  ) : (
                    "Vraag advies"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Workouts */}
        {workouts.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold">Workouts</h2>
            {workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onDelete={handleDeleteWorkout}
              />
            ))}
          </div>
        )}

        {/* Meals */}
        <div className="space-y-2">
          <h2 className="font-semibold">Maaltijden</h2>
          {meals.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>Nog geen maaltijden vandaag</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/add">Voeg je eerste maaltijd toe</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} onDelete={handleDeleteMeal} />
            ))
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}
