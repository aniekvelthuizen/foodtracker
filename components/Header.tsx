"use client";

import { ThemeToggle } from "./ThemeToggle";
import { Apple } from "lucide-react";

interface HeaderProps {
  title?: string;
}

export function Header({ title = "FoodTracker" }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Apple className="h-6 w-6 text-green-500" />
          <span className="font-semibold">{title}</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
