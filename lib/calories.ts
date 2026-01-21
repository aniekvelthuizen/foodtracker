import { ACTIVITY_MULTIPLIERS, MacroTargets, UserProfile } from "@/types";

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor formula
 */
export function calculateBMR(profile: UserProfile): number | null {
  if (!profile.weight || !profile.height || !profile.age || !profile.gender) {
    return null;
  }

  // Mifflin-St Jeor formula
  // Men: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) + 5
  // Women: BMR = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(years) - 161
  const base = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age;

  return profile.gender === "male" ? base + 5 : base - 161;
}

/**
 * Calculate Total Daily Energy Expenditure
 */
export function calculateTDEE(profile: UserProfile): number | null {
  const bmr = calculateBMR(profile);
  if (!bmr || !profile.activity_level) {
    return null;
  }

  const multiplier = ACTIVITY_MULTIPLIERS[profile.activity_level] || 1.2;
  return Math.round(bmr * multiplier);
}

/**
 * Get effective TDEE (custom or calculated)
 */
export function getEffectiveTDEE(profile: UserProfile): number | null {
  // Use custom TDEE if enabled and set
  if (profile.use_custom_tdee && profile.custom_tdee) {
    return profile.custom_tdee;
  }
  // Otherwise use stored TDEE or calculate
  return profile.tdee || calculateTDEE(profile);
}

/**
 * Menstruation calorie adjustment factor
 * Research shows metabolism increases ~5-10% during luteal phase
 * We use 7% as a balanced middle ground
 */
export const MENSTRUATION_TDEE_MULTIPLIER = 1.07;

/**
 * Calculate macro targets based on TDEE and goals
 * @param profile - User profile with goals and measurements
 * @param isMenstruation - Whether the user is menstruating today
 */
export function calculateMacroTargets(
  profile: UserProfile,
  isMenstruation: boolean = false
): MacroTargets | null {
  let tdee = getEffectiveTDEE(profile);
  if (!tdee) {
    return null;
  }

  // Apply menstruation adjustment to TDEE (7% increase)
  if (isMenstruation && profile.gender === "female") {
    tdee = Math.round(tdee * MENSTRUATION_TDEE_MULTIPLIER);
  }

  // Adjust calories based on custom adjustment or goals
  let targetCalories = tdee;
  const goals = profile.goals || [];

  // Use custom calorie adjustment if set
  if (profile.calorie_adjustment !== null && profile.calorie_adjustment !== undefined) {
    targetCalories += profile.calorie_adjustment;
  } else if (goals.includes("weight_loss")) {
    // Default: 500 calorie deficit for ~0.5kg/week loss
    targetCalories -= 500;
  } else if (goals.includes("muscle_gain")) {
    // Default: 300 calorie surplus for lean gains
    targetCalories += 300;
  }

  // Calculate macros
  // High protein for muscle gain/preservation: 2g per kg bodyweight
  // Otherwise: 1.6g per kg
  const proteinPerKg = goals.includes("muscle_gain") || goals.includes("weight_loss") ? 2 : 1.6;
  const protein = profile.weight ? Math.round(profile.weight * proteinPerKg) : Math.round(targetCalories * 0.25 / 4);

  // Fat: 25-30% of calories (use 27.5%)
  const fatCalories = targetCalories * 0.275;
  const fat = Math.round(fatCalories / 9);

  // Carbs: remaining calories
  const proteinCalories = protein * 4;
  const carbCalories = targetCalories - proteinCalories - fatCalories;
  const carbs = Math.round(carbCalories / 4);

  // Fiber: 14g per 1000 calories
  const fiber = Math.round((targetCalories / 1000) * 14);

  return {
    calories: Math.round(targetCalories),
    protein,
    carbs,
    fat,
    fiber,
  };
}

/**
 * Format number with Dutch locale
 */
export function formatNumber(num: number): string {
  return num.toLocaleString("nl-NL");
}

/**
 * Calculate percentage (capped at 100)
 */
export function calculatePercentage(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/**
 * Get color class based on percentage
 */
export function getProgressColor(percentage: number): string {
  if (percentage < 50) return "bg-red-500";
  if (percentage < 80) return "bg-yellow-500";
  if (percentage <= 100) return "bg-green-500";
  return "bg-orange-500"; // Over target
}
