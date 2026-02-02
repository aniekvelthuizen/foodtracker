"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowLeft, Star, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { FavoriteMeal, SavedIngredient, MealType, MEAL_TYPES } from "@/types";
import { cn } from "@/lib/utils";

export default function FavoritesPage() {
  const [activeTab, setActiveTab] = useState<"favorites" | "ingredients">("favorites");
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [ingredients, setIngredients] = useState<SavedIngredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New ingredient form
  const [showNewIngredient, setShowNewIngredient] = useState(false);
  const [newIngredient, setNewIngredient] = useState({
    name: "",
    serving_size: "",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
  });

  // Edit states
  const [editingFavorite, setEditingFavorite] = useState<FavoriteMeal | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<SavedIngredient | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [favoritesRes, ingredientsRes] = await Promise.all([
        supabase
          .from("favorite_meals")
          .select("*")
          .eq("user_id", user.id)
          .order("use_count", { ascending: false }),
        supabase
          .from("saved_ingredients")
          .select("*")
          .eq("user_id", user.id)
          .order("use_count", { ascending: false }),
      ]);

      if (favoritesRes.data) setFavorites(favoritesRes.data);
      if (ingredientsRes.data) setIngredients(ingredientsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFavorite = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("favorite_meals").delete().eq("id", id);
      if (error) throw error;
      setFavorites((prev) => prev.filter((f) => f.id !== id));
      toast.success("Favoriet verwijderd");
    } catch (error) {
      console.error("Error deleting favorite:", error);
      toast.error("Kon favoriet niet verwijderen");
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("saved_ingredients").delete().eq("id", id);
      if (error) throw error;
      setIngredients((prev) => prev.filter((i) => i.id !== id));
      toast.success("Ingrediënt verwijderd");
    } catch (error) {
      console.error("Error deleting ingredient:", error);
      toast.error("Kon ingrediënt niet verwijderen");
    }
  };

  const handleSaveNewIngredient = async () => {
    if (!newIngredient.name.trim()) {
      toast.error("Geef het ingrediënt een naam");
      return;
    }

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("saved_ingredients")
        .insert({
          user_id: user.id,
          ...newIngredient,
          name: newIngredient.name.trim(),
          serving_size: newIngredient.serving_size.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setIngredients((prev) => [data, ...prev]);
      setNewIngredient({
        name: "",
        serving_size: "",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      });
      setShowNewIngredient(false);
      toast.success("Ingrediënt opgeslagen");
    } catch (error) {
      console.error("Error saving ingredient:", error);
      toast.error("Kon ingrediënt niet opslaan");
    }
  };

  const handleUpdateFavorite = async () => {
    if (!editingFavorite) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("favorite_meals")
        .update({
          name: editingFavorite.name,
          description: editingFavorite.description,
          calories: editingFavorite.calories,
          protein: editingFavorite.protein,
          carbs: editingFavorite.carbs,
          fat: editingFavorite.fat,
          fiber: editingFavorite.fiber,
          default_meal_type: editingFavorite.default_meal_type,
        })
        .eq("id", editingFavorite.id);

      if (error) throw error;

      setFavorites((prev) =>
        prev.map((f) => (f.id === editingFavorite.id ? editingFavorite : f))
      );
      setEditingFavorite(null);
      toast.success("Favoriet bijgewerkt");
    } catch (error) {
      console.error("Error updating favorite:", error);
      toast.error("Kon favoriet niet bijwerken");
    }
  };

  const handleUpdateIngredient = async () => {
    if (!editingIngredient) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("saved_ingredients")
        .update({
          name: editingIngredient.name,
          serving_size: editingIngredient.serving_size,
          calories: editingIngredient.calories,
          protein: editingIngredient.protein,
          carbs: editingIngredient.carbs,
          fat: editingIngredient.fat,
          fiber: editingIngredient.fiber,
        })
        .eq("id", editingIngredient.id);

      if (error) throw error;

      setIngredients((prev) =>
        prev.map((i) => (i.id === editingIngredient.id ? editingIngredient : i))
      );
      setEditingIngredient(null);
      toast.success("Ingrediënt bijgewerkt");
    } catch (error) {
      console.error("Error updating ingredient:", error);
      toast.error("Kon ingrediënt niet bijwerken");
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
          <span className="ml-2 font-semibold">Favorieten & Ingrediënten</span>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === "favorites" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("favorites")}
          >
            <Star className="mr-2 h-4 w-4" />
            Favorieten
          </Button>
          <Button
            variant={activeTab === "ingredients" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setActiveTab("ingredients")}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ingrediënten
          </Button>
        </div>

        {/* Favorites Tab */}
        {activeTab === "favorites" && (
          <div className="space-y-3">
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Laden...
                </CardContent>
              </Card>
            ) : favorites.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Nog geen favorieten</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sla een maaltijd op als favoriet bij het toevoegen
                  </p>
                </CardContent>
              </Card>
            ) : (
              favorites.map((favorite) => (
                <Card key={favorite.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{favorite.name}</h3>
                        {favorite.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {favorite.description}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                          <span>{favorite.calories} kcal</span>
                          <span>{favorite.protein}g eiwit</span>
                          <span>{favorite.carbs}g kh</span>
                          <span>{favorite.fat}g vet</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {favorite.use_count}x gebruikt
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingFavorite(favorite)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Favoriet bewerken</DialogTitle>
                            </DialogHeader>
                            {editingFavorite && (
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Naam</Label>
                                  <Input
                                    value={editingFavorite.name}
                                    onChange={(e) =>
                                      setEditingFavorite({
                                        ...editingFavorite,
                                        name: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Calorieën</Label>
                                    <Input
                                      type="number"
                                      value={editingFavorite.calories}
                                      onChange={(e) =>
                                        setEditingFavorite({
                                          ...editingFavorite,
                                          calories: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Eiwit (g)</Label>
                                    <Input
                                      type="number"
                                      value={editingFavorite.protein}
                                      onChange={(e) =>
                                        setEditingFavorite({
                                          ...editingFavorite,
                                          protein: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Koolhydraten (g)</Label>
                                    <Input
                                      type="number"
                                      value={editingFavorite.carbs}
                                      onChange={(e) =>
                                        setEditingFavorite({
                                          ...editingFavorite,
                                          carbs: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Vet (g)</Label>
                                    <Input
                                      type="number"
                                      value={editingFavorite.fat}
                                      onChange={(e) =>
                                        setEditingFavorite({
                                          ...editingFavorite,
                                          fat: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <Button className="w-full" onClick={handleUpdateFavorite}>
                                  Opslaan
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteFavorite(favorite.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Ingredients Tab */}
        {activeTab === "ingredients" && (
          <div className="space-y-3">
            {/* Add new ingredient button */}
            {!showNewIngredient && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNewIngredient(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Nieuw ingrediënt toevoegen
              </Button>
            )}

            {/* New ingredient form */}
            {showNewIngredient && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Nieuw ingrediënt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Naam *</Label>
                    <Input
                      placeholder="bijv. Ei"
                      value={newIngredient.name}
                      onChange={(e) =>
                        setNewIngredient({ ...newIngredient, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Portiegrootte</Label>
                    <Input
                      placeholder="bijv. 1 groot (60g)"
                      value={newIngredient.serving_size}
                      onChange={(e) =>
                        setNewIngredient({ ...newIngredient, serving_size: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Calorieën</Label>
                      <Input
                        type="number"
                        value={newIngredient.calories || ""}
                        onChange={(e) =>
                          setNewIngredient({
                            ...newIngredient,
                            calories: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Eiwit (g)</Label>
                      <Input
                        type="number"
                        value={newIngredient.protein || ""}
                        onChange={(e) =>
                          setNewIngredient({
                            ...newIngredient,
                            protein: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Koolhydraten (g)</Label>
                      <Input
                        type="number"
                        value={newIngredient.carbs || ""}
                        onChange={(e) =>
                          setNewIngredient({
                            ...newIngredient,
                            carbs: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vet (g)</Label>
                      <Input
                        type="number"
                        value={newIngredient.fat || ""}
                        onChange={(e) =>
                          setNewIngredient({
                            ...newIngredient,
                            fat: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Vezels (g)</Label>
                      <Input
                        type="number"
                        value={newIngredient.fiber || ""}
                        onChange={(e) =>
                          setNewIngredient({
                            ...newIngredient,
                            fiber: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowNewIngredient(false);
                        setNewIngredient({
                          name: "",
                          serving_size: "",
                          calories: 0,
                          protein: 0,
                          carbs: 0,
                          fat: 0,
                          fiber: 0,
                        });
                      }}
                    >
                      Annuleren
                    </Button>
                    <Button className="flex-1" onClick={handleSaveNewIngredient}>
                      Opslaan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ingredients list */}
            {isLoading ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Laden...
                </CardContent>
              </Card>
            ) : ingredients.length === 0 && !showNewIngredient ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Plus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Nog geen ingrediënten</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Voeg ingrediënten toe die je vaak gebruikt
                  </p>
                </CardContent>
              </Card>
            ) : (
              ingredients.map((ingredient) => (
                <Card key={ingredient.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium">{ingredient.name}</h3>
                        {ingredient.serving_size && (
                          <p className="text-sm text-muted-foreground">
                            {ingredient.serving_size}
                          </p>
                        )}
                        <div className="flex gap-3 mt-2 text-sm text-muted-foreground">
                          <span>{ingredient.calories} kcal</span>
                          <span>{ingredient.protein}g E</span>
                          <span>{ingredient.carbs}g K</span>
                          <span>{ingredient.fat}g V</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {ingredient.use_count}x gebruikt
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingIngredient(ingredient)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Ingrediënt bewerken</DialogTitle>
                            </DialogHeader>
                            {editingIngredient && (
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label>Naam</Label>
                                  <Input
                                    value={editingIngredient.name}
                                    onChange={(e) =>
                                      setEditingIngredient({
                                        ...editingIngredient,
                                        name: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Portiegrootte</Label>
                                  <Input
                                    value={editingIngredient.serving_size || ""}
                                    onChange={(e) =>
                                      setEditingIngredient({
                                        ...editingIngredient,
                                        serving_size: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Calorieën</Label>
                                    <Input
                                      type="number"
                                      value={editingIngredient.calories}
                                      onChange={(e) =>
                                        setEditingIngredient({
                                          ...editingIngredient,
                                          calories: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Eiwit (g)</Label>
                                    <Input
                                      type="number"
                                      value={editingIngredient.protein}
                                      onChange={(e) =>
                                        setEditingIngredient({
                                          ...editingIngredient,
                                          protein: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Koolhydraten (g)</Label>
                                    <Input
                                      type="number"
                                      value={editingIngredient.carbs}
                                      onChange={(e) =>
                                        setEditingIngredient({
                                          ...editingIngredient,
                                          carbs: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Vet (g)</Label>
                                    <Input
                                      type="number"
                                      value={editingIngredient.fat}
                                      onChange={(e) =>
                                        setEditingIngredient({
                                          ...editingIngredient,
                                          fat: Number(e.target.value),
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <Button className="w-full" onClick={handleUpdateIngredient}>
                                  Opslaan
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteIngredient(ingredient.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </main>

      <Navigation />
    </div>
  );
}
