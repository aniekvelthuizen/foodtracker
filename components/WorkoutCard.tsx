"use client";

import { Workout, WORKOUT_PRESETS } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface WorkoutCardProps {
  workout: Workout;
  onDelete?: (id: string) => void;
}

export function WorkoutCard({ workout, onDelete }: WorkoutCardProps) {
  const preset = WORKOUT_PRESETS.find((p) => p.type === workout.type);
  const icon = preset?.icon || "⚡";

  return (
    <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 text-lg">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{workout.type}</p>
            <p className="text-sm text-muted-foreground">
              {workout.duration} min
              {workout.notes && ` • ${workout.notes}`}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-green-600 dark:text-green-400">
              +{workout.calories_burned} kcal
            </p>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(workout.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
