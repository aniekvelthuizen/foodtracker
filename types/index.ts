// User Profile
export interface UserProfile {
  id: string;
  weight: number | null;
  height: number | null;
  age: number | null;
  gender: "male" | "female" | null;
  activity_level:
    | "sedentary"
    | "light"
    | "moderate"
    | "active"
    | "very_active"
    | null;
  goals: ("weight_loss" | "muscle_gain" | "maintenance")[];
  tdee: number | null;
  // New fields for manual TDEE and weight loss rate
  custom_tdee: number | null;         // Manual TDEE (e.g., from Garmin)
  use_custom_tdee: boolean;           // Use manual value instead of calculation
  calorie_adjustment: number | null;  // Calorie deficit/surplus (e.g., -500 for weight loss)
  target_weight: number | null;       // Goal weight in kg
  created_at?: string;
  updated_at?: string;
}

// Weight loss rate options
export interface WeightLossRate {
  id: string;
  label: string;
  labelNL: string;
  adjustment: number;
  weeklyLoss: string;
}

export const WEIGHT_LOSS_RATES: WeightLossRate[] = [
  { id: "slow", label: "Slow", labelNL: "Langzaam", adjustment: -250, weeklyLoss: "~0.25 kg/week" },
  { id: "normal", label: "Normal", labelNL: "Normaal", adjustment: -500, weeklyLoss: "~0.5 kg/week" },
  { id: "fast", label: "Fast", labelNL: "Snel", adjustment: -750, weeklyLoss: "~0.75 kg/week" },
  { id: "aggressive", label: "Aggressive", labelNL: "Agressief", adjustment: -1000, weeklyLoss: "~1 kg/week" },
];

export const WEIGHT_GAIN_RATES: WeightLossRate[] = [
  { id: "lean", label: "Lean bulk", labelNL: "Lean bulk", adjustment: 250, weeklyLoss: "+0.25 kg/week" },
  { id: "normal", label: "Normal", labelNL: "Normaal", adjustment: 400, weeklyLoss: "+0.4 kg/week" },
];

// Meal
export interface Meal {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  description: string;
  photo_url?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  created_at?: string;
}

// Workout
export interface Workout {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  type: string;
  duration: number; // minutes
  calories_burned: number;
  notes?: string | null;
  created_at?: string;
}

// Daily log (menstruation tracking, etc.)
export interface DailyLog {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  is_menstruation: boolean;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Macro targets (calculated from TDEE and goals)
export interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

// Daily summary
export interface DailySummary {
  date: string;
  meals: Meal[];
  workouts: Workout[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    caloriesBurned: number;
  };
  targets: MacroTargets;
}

// Claude analysis response
export interface FoodAnalysis {
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidence: "low" | "medium" | "high";
  followUpQuestions?: FollowUpQuestion[];
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  type: "choice" | "text";
  options?: string[];
}

// Workout presets
export interface WorkoutPreset {
  type: string;
  caloriesPerHour: number;
  icon: string;
}

export const WORKOUT_PRESETS: WorkoutPreset[] = [
  { type: "Krachttraining", caloriesPerHour: 400, icon: "💪" },
  { type: "Hardlopen", caloriesPerHour: 600, icon: "🏃" },
  { type: "Fietsen", caloriesPerHour: 500, icon: "🚴" },
  { type: "Zwemmen", caloriesPerHour: 550, icon: "🏊" },
  { type: "Wandelen", caloriesPerHour: 250, icon: "🚶" },
  { type: "Yoga", caloriesPerHour: 200, icon: "🧘" },
  { type: "HIIT", caloriesPerHour: 700, icon: "🔥" },
  { type: "Anders", caloriesPerHour: 300, icon: "⚡" },
];

// Activity level multipliers for TDEE
export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2, // Little to no exercise
  light: 1.375, // Light exercise 1-3 days/week
  moderate: 1.55, // Moderate exercise 3-5 days/week
  active: 1.725, // Hard exercise 6-7 days/week
  very_active: 1.9, // Very hard exercise, physical job
};
