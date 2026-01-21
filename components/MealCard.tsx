"use client";

import { Meal, MEAL_TYPES } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface MealCardProps {
  meal: Meal;
  onDelete?: (id: string) => void;
  showEdit?: boolean;
}

const getMealTypeInfo = (mealType: string | null) => {
  const type = MEAL_TYPES.find(t => t.id === mealType);
  return type || null;
};

export function MealCard({ meal, onDelete, showEdit = true }: MealCardProps) {
  const mealTypeInfo = getMealTypeInfo(meal.meal_type);
  
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex gap-3">
          {meal.photo_url && (
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md">
              <Image
                src={meal.photo_url}
                alt={meal.description}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{meal.description}</p>
                <p className="text-sm text-muted-foreground">
                  {mealTypeInfo && <span className="mr-1">{mealTypeInfo.icon}</span>}
                  {mealTypeInfo?.label && <span className="mr-1">{mealTypeInfo.label} •</span>}
                  {meal.time.slice(0, 5)}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold">{meal.calories} kcal</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                E: {meal.protein}g
              </span>
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
                K: {meal.carbs}g
              </span>
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/50 dark:text-red-300">
                V: {meal.fat}g
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            {showEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-primary"
                asChild
              >
                <Link href={`/meal/${meal.id}`}>
                  <Pencil className="h-4 w-4" />
                </Link>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(meal.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
