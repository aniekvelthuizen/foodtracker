"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { MealCard } from "@/components/MealCard";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Meal, Workout, UserProfile, MacroTargets, DailyLog } from "@/types";
import { calculateMacroTargets } from "@/lib/calories";
import { nl } from "date-fns/locale";

export default function HistoryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set());

  const formattedDate = selectedDate.toISOString().split("T")[0];

  useEffect(() => {
    loadProfile();
    loadDatesWithData();
  }, []);

  useEffect(() => {
    loadDayData(formattedDate);
  }, [formattedDate]);

  const loadProfile = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const loadDatesWithData = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Get unique dates from meals and workouts
      const { data: mealDates } = await supabase
        .from("meals")
        .select("date")
        .eq("user_id", user.id);

      const { data: workoutDates } = await supabase
        .from("workouts")
        .select("date")
        .eq("user_id", user.id);

      const dates = new Set<string>();
      mealDates?.forEach((m) => dates.add(m.date));
      workoutDates?.forEach((w) => dates.add(w.date));

      setDatesWithData(dates);
    } catch (error) {
      console.error("Error loading dates:", error);
    }
  };

  const loadDayData = async (date: string) => {
    setIsLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Load meals for selected date
      const { data: mealsData } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("time", { ascending: true });

      if (mealsData) {
        setMeals(mealsData);
      }

      // Load workouts for selected date
      const { data: workoutsData } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .order("created_at", { ascending: true });

      if (workoutsData) {
        setWorkouts(workoutsData);
      }

      // Load daily log for selected date (menstruation status)
      const { data: logData } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", date)
        .single();

      setDailyLog(logData || null);
    } catch (error) {
      console.error("Error loading day data:", error);
      toast.error("Kon gegevens niet laden");
    } finally {
      setIsLoading(false);
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

  const isMenstruating = dailyLog?.is_menstruation || false;
  const targets: MacroTargets | null = profile
    ? calculateMacroTargets(profile, isMenstruating)
    : null;

  const formatDateNL = (date: Date) => {
    return date.toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header title="Geschiedenis" />

      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* Calendar */}
        <Card>
          <CardContent className="p-2">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              locale={nl}
              disabled={(date) => date > new Date()}
              modifiers={{
                hasData: (date) =>
                  datesWithData.has(date.toISOString().split("T")[0]),
              }}
              modifiersStyles={{
                hasData: {
                  fontWeight: "bold",
                  textDecoration: "underline",
                },
              }}
              className="mx-auto"
            />
          </CardContent>
        </Card>

        {/* Selected date */}
        <div className="flex items-center gap-2">
          <h2 className="font-semibold capitalize">{formatDateNL(selectedDate)}</h2>
          {isMenstruating && (
            <span className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700 dark:bg-pink-900/50 dark:text-pink-300">
              Ongesteld
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Day summary */}
            {(meals.length > 0 || workouts.length > 0) && targets && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Samenvatting</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Calorieën</span>
                      <span>
                        {totals.calories} / {targets.calories + totals.caloriesBurned}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Eiwit</span>
                      <span>
                        {totals.protein}g / {targets.protein}g
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Koolhydraten</span>
                      <span>
                        {totals.carbs}g / {targets.carbs}g
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vet</span>
                      <span>
                        {totals.fat}g / {targets.fat}g
                      </span>
                    </div>
                    {totals.caloriesBurned > 0 && (
                      <div className="col-span-2 flex justify-between text-green-600 dark:text-green-400">
                        <span>Verbrand (sport)</span>
                        <span>+{totals.caloriesBurned} kcal</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Workouts */}
            {workouts.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Workouts
                </h3>
                {workouts.map((workout) => (
                  <WorkoutCard key={workout.id} workout={workout} />
                ))}
              </div>
            )}

            {/* Meals */}
            {meals.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Maaltijden
                </h3>
                {meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {meals.length === 0 && workouts.length === 0 && (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p>Geen gegevens voor deze dag</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
}
