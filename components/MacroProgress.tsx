"use client";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface MacroProgressProps {
  label: string;
  current: number;
  target: number;
  unit?: string;
  color?: string;
}

export function MacroProgress({
  label,
  current,
  target,
  unit = "g",
  color = "bg-primary",
}: MacroProgressProps) {
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isOver = current > target;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(isOver && "text-orange-500")}>
          {Math.round(current)} / {target}
          {unit}
        </span>
      </div>
      <div className="relative">
        <Progress value={percentage} className="h-2" />
        <div
          className={cn(
            "absolute inset-0 h-2 rounded-full transition-all",
            color,
            "opacity-100"
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}
