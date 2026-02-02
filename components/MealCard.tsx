"use client";

import { Meal, MEAL_TYPES } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil, Clock, Flame } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    <Card className="overflow-hidden hover:shadow-md transition-shadow !py-0">
      <div className="flex">
        {/* Photo section */}
        {meal.photo_url && (
          <div className="relative w-24 h-auto min-h-[100px] flex-shrink-0">
            <Image
              src={meal.photo_url}
              alt={meal.description}
              fill
              className="object-cover"
            />
          </div>
        )}
        
        {/* Content section */}
        <div className="flex-1 p-4">
          {/* Header row: meal type, time, and actions */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {mealTypeInfo && (
                <span className="inline-flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5">
                  <span>{mealTypeInfo.icon}</span>
                  <span>{mealTypeInfo.label}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {meal.time.slice(0, 5)}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              {showEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary cursor-pointer"
                  asChild
                >
                  <Link href={`/meal/${meal.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive cursor-pointer"
                  onClick={() => onDelete(meal.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Description */}
          <p className="font-medium text-sm leading-snug mb-2 line-clamp-2">
            {meal.description}
          </p>
          
          {/* Macros row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground">{Math.round(meal.protein)}g</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-xs text-muted-foreground">{Math.round(meal.carbs)}g</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-muted-foreground">{Math.round(meal.fat)}g</span>
              </div>
            </div>
            
            {/* Calories badge */}
            <div className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20 rounded-full px-2.5 py-1">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-sm font-semibold">{Math.round(meal.calories)}</span>
              <span className="text-xs text-muted-foreground">kcal</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
