"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

// Extend Window interface for speech recognition
declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition;
    SpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item: (index: number) => SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export function VoiceInput({
  value,
  onChange,
  placeholder = "Beschrijf je maaltijd...",
  disabled,
}: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const shouldRestartRef = useRef(false);
  
  // Use refs to access current values without re-running useEffect
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  
  // Keep refs in sync with props
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // Check if speech recognition is supported
    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "nl-NL";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        const currentValue = valueRef.current;
        onChangeRef.current(currentValue + (currentValue ? " " : "") + finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);

      switch (event.error) {
        case "not-allowed":
          shouldRestartRef.current = false;
          setIsListening(false);
          toast.error("Microfoontoegang geweigerd. Sta toegang toe in je browser.");
          break;
        case "no-speech":
          // No speech detected - this is normal, don't show error
          // Recognition will automatically restart via onend
          break;
        case "audio-capture":
          shouldRestartRef.current = false;
          setIsListening(false);
          toast.error("Geen microfoon gevonden of microfoon is in gebruik.");
          break;
        case "network":
          shouldRestartRef.current = false;
          setIsListening(false);
          toast.error("Netwerkfout. Controleer je internetverbinding.");
          break;
        case "aborted":
          // User stopped - no error needed
          break;
        default:
          // For other errors, try to restart silently
          // Only show error if it keeps failing
          break;
      }
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't explicitly stopped
      if (shouldRestartRef.current) {
        try {
          recognition.start();
        } catch (error) {
          // Failed to restart, stop listening
          shouldRestartRef.current = false;
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldRestartRef.current = false;
      recognition.abort();
    };
  }, []); // Now runs only once on mount

  const toggleListening = () => {
    if (!recognitionRef.current) return;

    if (isListening) {
      shouldRestartRef.current = false;
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        shouldRestartRef.current = true;
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error("Failed to start speech recognition:", error);
        shouldRestartRef.current = false;
        toast.error("Kon spraakherkenning niet starten");
      }
    }
  };

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "min-h-[100px] pr-12 resize-none",
          isListening && "border-red-500 focus-visible:ring-red-500"
        )}
      />
      {isSupported && (
        <Button
          type="button"
          variant={isListening ? "destructive" : "ghost"}
          size="icon"
          className={cn(
            "absolute right-2 top-2 h-8 w-8",
            isListening && "animate-pulse"
          )}
          onClick={toggleListening}
          disabled={disabled}
        >
          {isListening ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      )}
      {isListening && (
        <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Luisteren...</span>
        </div>
      )}
    </div>
  );
}
