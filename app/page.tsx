"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Header } from "@/components/Header";
import { Navigation } from "@/components/Navigation";
import { MacroProgress } from "@/components/MacroProgress";
import { MealCard } from "@/components/MealCard";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Apple, Lightbulb, Dumbbell, Droplets, MessageCircle, Send, X, Info, Mic, MicOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import Link from "next/link";
import { Meal, Workout, UserProfile, MacroTargets, DailyLog } from "@/types";
import { calculateMacroTargets } from "@/lib/calories";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  
  // Chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  const today = new Date().toISOString().split("T")[0];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isSendingChat]);

  // Auto-resize chat input based on content
  useEffect(() => {
    const textarea = chatInputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(Math.max(40, textarea.scrollHeight), 120)}px`;
    }
  }, [chatInput]);

  useEffect(() => {
    loadData();
  }, []);

  // Auto-load advice when data is ready or meals change
  useEffect(() => {
    if (profile && !isLoading) {
      loadAdvice();
    }
  }, [profile, isLoading, meals.length]);

  const loadData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Load today's meals
      const { data: mealsData } = await supabase
        .from("meals")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("time", { ascending: true });

      if (mealsData) {
        setMeals(mealsData);
      }

      // Load today's workouts
      const { data: workoutsData } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .order("created_at", { ascending: true });

      if (workoutsData) {
        setWorkouts(workoutsData);
      }

      // Load today's daily log (menstruation status)
      const { data: logData } = await supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", today)
        .single();

      if (logData) {
        setDailyLog(logData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Kon gegevens niet laden");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMenstruation = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const newValue = !dailyLog?.is_menstruation;

      if (dailyLog) {
        // Update existing log
        const { error } = await supabase
          .from("daily_logs")
          .update({ 
            is_menstruation: newValue,
            updated_at: new Date().toISOString()
          })
          .eq("id", dailyLog.id);

        if (error) throw error;
        setDailyLog({ ...dailyLog, is_menstruation: newValue });
      } else {
        // Create new log
        const { data, error } = await supabase
          .from("daily_logs")
          .insert({
            user_id: user.id,
            date: today,
            is_menstruation: newValue,
          })
          .select()
          .single();

        if (error) throw error;
        setDailyLog(data);
      }

      // Clear advice so user can get updated advice
      setAdvice(null);
    } catch (error) {
      console.error("Error toggling menstruation:", error);
      toast.error("Kon status niet opslaan");
    }
  };

  const handleDeleteMeal = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("meals").delete().eq("id", id);

      if (error) throw error;

      setMeals(meals.filter((m) => m.id !== id));
      toast.success("Maaltijd verwijderd");
    } catch (error) {
      console.error("Error deleting meal:", error);
      toast.error("Kon maaltijd niet verwijderen");
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("workouts").delete().eq("id", id);

      if (error) throw error;

      setWorkouts(workouts.filter((w) => w.id !== id));
      toast.success("Workout verwijderd");
    } catch (error) {
      console.error("Error deleting workout:", error);
      toast.error("Kon workout niet verwijderen");
    }
  };

  const loadAdvice = async () => {
    if (!profile || !targets) return;

    setIsLoadingAdvice(true);
    try {
      // Get unique meal types that have been logged today
      const mealsLogged = [...new Set(meals.map(m => m.meal_type).filter(Boolean))];
      
      const response = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          totals,
          targets,
          timeOfDay: new Date().getHours(),
          isMenstruation: dailyLog?.is_menstruation || false,
          mealsLogged,
        }),
      });

      if (!response.ok) throw new Error("Failed to get advice");

      const data = await response.json();
      setAdvice(data.advice);
    } catch (error) {
      console.error("Error loading advice:", error);
      toast.error("Kon advies niet laden");
    } finally {
      setIsLoadingAdvice(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isSendingChat) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    
    // Add user message to chat
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsSendingChat(true);

    try {
      // Get unique meal types that have been logged today
      const mealsLogged = [...new Set(meals.map(m => m.meal_type).filter(Boolean))];
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          context: {
            profile,
            totals,
            targets,
            mealsLogged,
            isMenstruation: dailyLog?.is_menstruation || false,
          },
          history: chatMessages,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error) {
      console.error("Error sending chat:", error);
      toast.error("Kon bericht niet verzenden");
      // Remove the user message if it failed
      setChatMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSendingChat(false);
    }
  };

  const openChat = () => {
    // Initialize chat with the advice as first assistant message
    if (advice && chatMessages.length === 0) {
      setChatMessages([{ role: "assistant", content: advice }]);
    }
    setIsChatOpen(true);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast.error("Kon opname niet starten");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Transcription failed");

      const data = await response.json();
      if (data.text) {
        setChatInput((prev) => prev + (prev ? " " : "") + data.text);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Kon spraak niet omzetten naar tekst");
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Calculate totals
  const totals = {
    calories: meals.reduce((sum, m) => sum + m.calories, 0),
    protein: meals.reduce((sum, m) => sum + m.protein, 0),
    carbs: meals.reduce((sum, m) => sum + m.carbs, 0),
    fat: meals.reduce((sum, m) => sum + m.fat, 0),
    fiber: meals.reduce((sum, m) => sum + m.fiber, 0),
    caloriesBurned: workouts.reduce((sum, w) => sum + w.calories_burned, 0),
  };

  // Get targets from profile (with menstruation adjustment if applicable)
  const isMenstruating = dailyLog?.is_menstruation || false;
  const targets: MacroTargets | null = profile
    ? calculateMacroTargets(profile, isMenstruating)
    : null;

  // Adjust calorie target for workouts (using user's preferred percentage)
  const workoutPercentage = profile?.workout_calorie_percentage ?? 100;
  const adjustedWorkoutCalories = Math.round(totals.caloriesBurned * (workoutPercentage / 100));
  const adjustedCalorieTarget = targets
    ? targets.calories + adjustedWorkoutCalories
    : 0;

  const caloriePercentage = adjustedCalorieTarget
    ? Math.min(100, (totals.calories / adjustedCalorieTarget) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      
      <main className="mx-auto max-w-md space-y-4 p-4">
        {/* Profile incomplete warning */}
        {(!profile?.weight || !profile?.height || !profile?.tdee) && (
          <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
            <CardContent className="p-4">
              <p className="text-sm">
                Vul eerst je{" "}
                <Link href="/profile" className="font-medium underline">
                  profiel
                </Link>{" "}
                in voor nauwkeurige berekeningen.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Calorie summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Vandaag</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-2xl font-bold">{totals.calories}</span>
                <span className="text-2xl text-muted-foreground">
                  / {adjustedCalorieTarget} kcal
                </span>
              </div>
              <Progress value={caloriePercentage} className="h-3" />
              {totals.caloriesBurned > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  +{adjustedWorkoutCalories} kcal door workouts
                  {workoutPercentage < 100 && (
                    <span className="text-muted-foreground"> ({workoutPercentage}% van {totals.caloriesBurned})</span>
                  )}
                </p>
              )}
            </div>

            {targets && (
              <div className="space-y-3">
                <MacroProgress
                  label="Eiwit"
                  current={totals.protein}
                  target={targets.protein}
                  color="bg-blue-500"
                />
                <MacroProgress
                  label="Koolhydraten"
                  current={totals.carbs}
                  target={targets.carbs}
                  color="bg-yellow-500"
                />
                <MacroProgress
                  label="Vet"
                  current={totals.fat}
                  target={targets.fat}
                  color="bg-red-500"
                />
                <MacroProgress
                  label="Vezels"
                  current={totals.fiber}
                  target={targets.fiber}
                  color="bg-green-500"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => setIsInfoOpen(true)}
                >
                  Hoe wordt dit berekend?
                  <Info className="ml-1 h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button asChild className="h-12 flex items-center justify-center">
            <Link href="/add" className="flex items-center justify-center">
              <Apple className="mr-2 h-4 w-4 flex-shrink-0" />
              Eten toevoegen
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-12 flex items-center justify-center">
            <Link href="/workout" className="flex items-center justify-center">
              <Dumbbell className="mr-2 h-4 w-4 flex-shrink-0" />
              Workout toevoegen
            </Link>
          </Button>
        </div>

        {/* Menstruation toggle */}
        {profile?.gender === "female" && (
          <Button
            variant={dailyLog?.is_menstruation ? "default" : "outline"}
            className={cn(
              "w-full justify-start gap-2",
              dailyLog?.is_menstruation && "bg-pink-600 hover:bg-pink-700 text-white"
            )}
            onClick={toggleMenstruation}
          >
            <Droplets className="h-4 w-4" />
            {dailyLog?.is_menstruation ? "Ongesteld vandaag" : "Ongesteld vandaag?"}
          </Button>
        )}

        {/* AI Advice */}
        {targets && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base font-medium">
                  <Lightbulb className="h-4 w-4" />
                  AI Advies
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setChatMessages([]);
                    loadAdvice();
                  }}
                  disabled={isLoadingAdvice}
                  className="cursor-pointer"
                >
                  {isLoadingAdvice ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Vernieuw"
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {advice ? (
                <>
                  <ul className="space-y-2">
                    {advice.split('\n').filter(line => line.trim()).map((line, i) => {
                      const cleanLine = line.replace(/^[•\-\*]\s*/, '').trim();
                      if (!cleanLine) return null;
                      return (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-1 flex-shrink-0">•</span>
                          <span className="text-muted-foreground">{cleanLine}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full cursor-pointer"
                    onClick={openChat}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Vraag meer
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-center py-4 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span className="text-sm">Advies laden...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Macro Info Dialog */}
        <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Hoe worden je doelen berekend?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <h4 className="font-medium mb-1">Calorieën ({targets?.calories} kcal)</h4>
                <p className="text-muted-foreground">
                  Gebaseerd op je TDEE (dagelijkse energiebehoefte) van {profile?.tdee || profile?.custom_tdee} kcal
                  {profile?.calorie_adjustment ? (
                    <>, aangepast met {profile.calorie_adjustment > 0 ? '+' : ''}{profile.calorie_adjustment} kcal voor je doel</>
                  ) : profile?.goals?.includes('weight_loss') ? (
                    <>, minus 500 kcal voor afvallen</>
                  ) : profile?.goals?.includes('muscle_gain') ? (
                    <>, plus 300 kcal voor spieropbouw</>
                  ) : null}.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Eiwit ({targets?.protein}g)</h4>
                <p className="text-muted-foreground">
                  {profile?.goals?.includes('muscle_gain') || profile?.goals?.includes('weight_loss') ? (
                    <>1.6 gram per kg lichaamsgewicht ({profile?.weight} kg). Dit is het wetenschappelijk optimale niveau voor spieropbouw en spierbehoud tijdens afvallen.</>
                  ) : (
                    <>1.2 gram per kg lichaamsgewicht ({profile?.weight} kg). Dit is voldoende voor onderhoud.</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Bron: Meta-analyse Morton et al., ISSN position stand
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Vet ({targets?.fat}g)</h4>
                <p className="text-muted-foreground">
                  27.5% van je calorieën. Dit zit binnen de WHO-richtlijn van 25-35%.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Koolhydraten ({targets?.carbs}g)</h4>
                <p className="text-muted-foreground">
                  De resterende calorieën na eiwit en vet. Koolhydraten zijn je belangrijkste energiebron voor training.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Vezels ({targets?.fiber}g)</h4>
                <p className="text-muted-foreground">
                  14 gram per 1000 kcal, conform de voedingsrichtlijnen.
                </p>
              </div>

              {dailyLog?.is_menstruation && profile?.gender === 'female' && (
                <div className="bg-pink-50 dark:bg-pink-950/30 p-3 rounded-lg">
                  <h4 className="font-medium mb-1 text-pink-700 dark:text-pink-300">Menstruatie-aanpassing</h4>
                  <p className="text-muted-foreground">
                    Je calorie-doel is vandaag met 7% verhoogd omdat je lichaam tijdens de menstruatie meer energie verbruikt.
                  </p>
                </div>
              )}

              {totals.caloriesBurned > 0 && (
                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                  <h4 className="font-medium mb-1 text-green-700 dark:text-green-300">Workout calorieën</h4>
                  <p className="text-muted-foreground">
                    {workoutPercentage < 100 ? (
                      <>Je hebt {totals.caloriesBurned} kcal verbrand. Hiervan wordt {workoutPercentage}% ({adjustedWorkoutCalories} kcal) bij je budget opgeteld. Dit kun je aanpassen in je profiel.</>
                    ) : (
                      <>Je hebt {totals.caloriesBurned} kcal verbrand. Dit wordt volledig bij je budget opgeteld.</>
                    )}
                  </p>
                </div>
              )}

              <Button asChild className="w-full cursor-pointer">
                <Link href="/profile" onClick={() => setIsInfoOpen(false)}>
                  Aanpassen in profiel
                </Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Chat Dialog */}
        <Dialog open={isChatOpen} onOpenChange={setIsChatOpen}>
          <DialogContent className="h-[90vh] max-h-[90vh] w-full max-w-lg flex flex-col p-0">
            <DialogHeader className="px-4 py-3 border-b">
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Chat met AI Coach
              </DialogTitle>
            </DialogHeader>
            
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-sm p-3 rounded-xl max-w-[85%] whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted"
                  )}
                >
                  {msg.content}
                </div>
              ))}
              {isSendingChat && (
                <div className="bg-muted p-3 rounded-xl max-w-[85%]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input area */}
            <div className="border-t px-4 py-3">
              {isRecording && (
                <div className="mb-2 flex items-center gap-2 text-sm text-blue-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  </span>
                  <span>Opnemen... Klik om te stoppen</span>
                </div>
              )}
              {isTranscribing && (
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Transcriberen met Whisper...</span>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                    isRecording 
                      ? "bg-blue-500 text-white animate-pulse" 
                      : "bg-muted hover:bg-muted/80 text-muted-foreground",
                    (isSendingChat || isTranscribing) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={toggleRecording}
                  disabled={isSendingChat || isTranscribing}
                >
                  {isTranscribing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>
                <Textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Stel een vraag over voeding..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  disabled={isSendingChat || isTranscribing}
                  className="flex-1 min-h-[40px] max-h-[120px] py-2 resize-none overflow-hidden"
                  rows={1}
                />
                <Button
                  size="icon"
                  onClick={sendChatMessage}
                  disabled={isSendingChat || !chatInput.trim()}
                  className="cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Workouts */}
        {workouts.length > 0 && (
          <div className="space-y-2">
            <h2 className="font-semibold">Workouts</h2>
            {workouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                onDelete={handleDeleteWorkout}
              />
            ))}
          </div>
        )}

        {/* Meals */}
        <div className="space-y-2">
          <h2 className="font-semibold">Maaltijden</h2>
          {meals.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                <p>Nog geen maaltijden vandaag</p>
                <Button asChild variant="link" className="mt-2">
                  <Link href="/add">Voeg je eerste maaltijd toe</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            meals.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}
