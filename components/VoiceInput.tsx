"use client";

import { useState, useRef, useEffect } from "react";
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

export function VoiceInput({
  value,
  onChange,
  placeholder = "Beschrijf je maaltijd...",
  disabled,
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = "auto";
      // Set height to scrollHeight to fit content
      textarea.style.height = `${Math.max(100, textarea.scrollHeight)}px`;
    }
  }, [value]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Use webm format which is well supported
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        
        // Create blob from chunks
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        
        // Send to Whisper API
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.error("Microfoontoegang geweigerd. Sta toegang toe in je browser.");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        toast.error("Geen microfoon gevonden.");
      } else {
        toast.error("Kon opname niet starten.");
      }
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
      // Create form data with audio file
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Transcription failed");
      }

      const data = await response.json();
      
      if (data.text) {
        // Append transcribed text to existing value
        const newValue = value + (value ? " " : "") + data.text;
        onChange(newValue);
      }
    } catch (error) {
      console.error("Transcription error:", error);
      toast.error("Kon spraak niet omzetten naar tekst.");
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

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || isTranscribing}
        className={cn(
          "min-h-[100px] pr-14 resize-none overflow-hidden",
          isRecording && "border-blue-500 focus-visible:ring-blue-500"
        )}
      />
      <button
        type="button"
        className={cn(
          "absolute right-2 top-2 h-10 w-10 rounded-full flex items-center justify-center transition-colors",
          isRecording 
            ? "bg-blue-500 text-white animate-pulse" 
            : "bg-muted hover:bg-muted/80 text-muted-foreground",
          (disabled || isTranscribing) && "opacity-50 cursor-not-allowed"
        )}
        onClick={toggleRecording}
        disabled={disabled || isTranscribing}
      >
        {isTranscribing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>
      {isRecording && (
        <div className="mt-2 flex items-center gap-2 text-sm text-blue-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          <span>Opnemen... Klik om te stoppen</span>
        </div>
      )}
      {isTranscribing && (
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Transcriberen met Whisper...</span>
        </div>
      )}
    </div>
  );
}
