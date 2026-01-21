"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Meal, MealType, MEAL_TYPES } from "@/types";
import { cn } from "@/lib/utils";
import Image from "next/image";

export default function EditMealPage() {
  const router = useRouter();
  const params = useParams();
  const mealId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [meal, setMeal] = useState<Meal | null>(null);

  // Editable fields
  const [description, setDescription] = useState("");
  const [mealType, setMealType] = useState<MealType | null>(null);
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [fiber, setFiber] = useState(0);

  useEffect(() => {
    loadMeal();
  }, [mealId]);

  const loadMeal = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("meals")
        .select("*")
        .eq("id", mealId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        toast.error("Maaltijd niet gevonden");
        router.push("/");
        return;
      }

      setMeal(data);
      setDescription(data.description || "");
      setMealType(data.meal_type);
      setCalories(data.calories);
      setProtein(data.protein);
      setCarbs(data.carbs);
      setFat(data.fat);
      setFiber(data.fiber);
    } catch (error) {
      console.error("Error loading meal:", error);
      toast.error("Kon maaltijd niet laden");
    } finally {
      setIsLoading(false);
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

      const { error } = await supabase
        .from("meals")
        .update({
          description,
          meal_type: mealType,
          calories,
          protein,
          carbs,
          fat,
          fiber,
        })
        .eq("id", mealId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Maaltijd bijgewerkt!");
      router.push("/");
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Kon maaltijd niet opslaan");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Weet je zeker dat je deze maaltijd wilt verwijderen?")) {
      return;
    }

    setIsDeleting(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      const { error } = await supabase
        .from("meals")
        .delete()
        .eq("id", mealId)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Maaltijd verwijderd");
      router.push("/");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Kon maaltijd niet verwijderen");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!meal) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-md items-center px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="ml-2 font-semibold">Maaltijd bewerken</span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* Photo preview */}
        {meal.photo_url && (
          <Card>
            <CardContent className="p-3">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg">
                <Image
                  src={meal.photo_url}
                  alt={meal.description}
                  fill
                  className="object-cover"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Meal type */}
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

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beschrijving</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijf je maaltijd..."
            />
          </CardContent>
        </Card>

        {/* Nutrition values */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voedingswaarden</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center">
          Datum: {meal.date} • Tijd: {meal.time.slice(0, 5)}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verwijderen...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </>
            )}
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={isSaving || isDeleting}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Opslaan...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Opslaan
              </>
            )}
          </Button>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
