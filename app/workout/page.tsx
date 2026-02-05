"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Check, Watch } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/types";

// Simplified workout presets
const WORKOUT_TYPES = [
  { type: "CrossFit", icon: "🏋️" },
  { type: "Krachttraining", icon: "💪" },
  { type: "Hardlopen", icon: "🏃" },
  { type: "Fietsen", icon: "🚴" },
  { type: "Zwemmen", icon: "🏊" },
  { type: "Wandelen", icon: "🚶" },
  { type: "HIIT", icon: "🔥" },
  { type: "Anders", icon: "⚡" },
];

export default function WorkoutPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [customType, setCustomType] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [caloriesBurned, setCaloriesBurned] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data);
    };
    loadProfile();
  }, []);

  // Auto-resize notes textarea based on content
  useEffect(() => {
    const textarea = notesRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.max(60, textarea.scrollHeight)}px`;
    }
  }, [notes]);

  // Calculate adjusted calories based on user's preference
  const workoutPercentage = profile?.workout_calorie_percentage ?? 100;
  const adjustedCalories = caloriesBurned ? Math.round(Number(caloriesBurned) * (workoutPercentage / 100)) : 0;

  const handleSave = async () => {
    const workoutType = selectedType === "Anders" ? customType || "Anders" : selectedType;
    
    if (!workoutType) {
      toast.error("Kies een workout type");
      return;
    }

    if (!caloriesBurned || caloriesBurned <= 0) {
      toast.error("Vul de verbrande calorieën in");
      return;
    }

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

      const { error } = await supabase.from("workouts").insert({
        user_id: user.id,
        date: today,
        type: workoutType,
        duration: duration || 0,
        calories_burned: caloriesBurned,
        notes: notes || null,
      });

      if (error) throw error;

      toast.success("Workout opgeslagen!");
      router.push("/");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Kon workout niet opslaan");
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
          <span className="ml-2 font-semibold">Workout toevoegen</span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Type workout</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {WORKOUT_TYPES.map((preset) => (
                <Button
                  key={preset.type}
                  variant={selectedType === preset.type ? "default" : "outline"}
                  className={cn(
                    "h-auto flex-col gap-1 py-3",
                    selectedType === preset.type && "ring-2 ring-primary ring-offset-2"
                  )}
                  onClick={() => setSelectedType(preset.type)}
                >
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-xs">{preset.type}</span>
                </Button>
              ))}
            </div>

            {selectedType === "Anders" && (
              <div className="mt-4 space-y-2">
                <Label htmlFor="customType">Naam workout</Label>
                <Input
                  id="customType"
                  placeholder="Bijv. Klimmen, Tennis..."
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Watch className="h-4 w-4" />
              Garmin / Smartwatch data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="caloriesBurned">Verbrande calorieën (kcal)</Label>
              <Input
                id="caloriesBurned"
                type="number"
                placeholder="487"
                value={caloriesBurned}
                onChange={(e) => setCaloriesBurned(e.target.value ? Number(e.target.value) : "")}
                min={1}
                max={5000}
              />
              <p className="text-xs text-muted-foreground">
                Vul de &quot;Active Calories&quot; in van je Garmin
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duur (minuten) - optioneel</Label>
              <Input
                id="duration"
                type="number"
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : "")}
                min={1}
                max={480}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notities (optioneel)</Label>
              <Textarea
                ref={notesRef}
                id="notes"
                placeholder="Bijv. Fran 8:32, AMRAP 15 min..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px] resize-none overflow-hidden"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {caloriesBurned && caloriesBurned > 0 && (
          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Extra calorieën vandaag</span>
                <span className="text-xl font-bold text-green-600 dark:text-green-400">
                  +{adjustedCalories} kcal
                </span>
              </div>
              {workoutPercentage < 100 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  {workoutPercentage}% van {caloriesBurned} kcal (ingesteld in je profiel)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">
                  Je mag {caloriesBurned} kcal extra eten
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <Button
          className="w-full h-12"
          onClick={handleSave}
          disabled={!selectedType || !caloriesBurned || isSaving}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opslaan...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Workout opslaan
            </>
          )}
        </Button>
      </main>

      <Navigation />
    </div>
  );
}
