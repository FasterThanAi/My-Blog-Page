"use client";

import * as React from "react";

export interface ArticleContent {
  id: string;
  title: string;
  excerpt?: string | null;
  content?: unknown; // Tiptap JSON or string content
  authorName?: string | null;
  coverUrl?: string | null;
}

interface AudioReaderContextType {
  activePost: ArticleContent | null;
  isPlaying: boolean;
  isPaused: boolean;
  currentSentenceIndex: number;
  sentences: string[];
  rate: number;
  pitch: number;
  selectedVoice: SpeechSynthesisVoice | null;
  availableVoices: SpeechSynthesisVoice[];
  isVoiceCommandActive: boolean;
  voiceTranscript: string;
  
  // Actions
  playPost: (post: ArticleContent) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  seekToSentence: (index: number) => void;
  setRate: (rate: number) => void;
  setPitch: (pitch: number) => void;
  setVoice: (voice: SpeechSynthesisVoice) => void;
  toggleVoiceCommands: () => void;
}

const AudioReaderContext = React.createContext<AudioReaderContextType | undefined>(undefined);

// Helper function to extract plain text from Tiptap JSON or string HTML
function extractPlainText(content: unknown, excerpt?: string | null): string {
  let rawText = "";

  if (typeof content === "string") {
    // Basic HTML tag stripping
    rawText = content.replace(/<[^>]*>/g, " ");
  } else if (content && typeof content === "object" && "type" in content) {
    // Tiptap JSON traversal
    const extractFromNode = (node: any): string => {
      if (!node) return "";
      if (node.type === "text" && typeof node.text === "string") {
        return node.text;
      }
      if (Array.isArray(node.content)) {
        return node.content.map(extractFromNode).join(" ");
      }
      return "";
    };
    rawText = extractFromNode(content);
  }

  if (!rawText.trim() && excerpt) {
    rawText = excerpt;
  }

  // Clean double spaces and line breaks
  return rawText.replace(/\s+/g, " ").trim();
}

// Helper to segment text into spoken sentence chunks
function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // Split on sentence boundaries (. ! ?) while preserving clean readability
  const rawSentences = text.split(/(?<=[.!?])\s+/);
  return rawSentences
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function AudioReaderProvider({ children }: { children: React.ReactNode }) {
  const [activePost, setActivePost] = React.useState<ArticleContent | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [sentences, setSentences] = React.useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = React.useState(0);

  // Audio parameters: Rate (0.75x - 2.0x), Pitch (1.0 default - natural, non-high frequency)
  const [rate, setRateState] = React.useState<number>(1.0);
  const [pitch, setPitchState] = React.useState<number>(1.0);
  const [availableVoices, setAvailableVoices] = React.useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = React.useState<SpeechSynthesisVoice | null>(null);

  // Voice Command (Hands-free "stop", "continue") state
  const [isVoiceCommandActive, setIsVoiceCommandActive] = React.useState(false);
  const [voiceTranscript, setVoiceTranscript] = React.useState("");

  const recognitionRef = React.useRef<any>(null);
  const utteranceRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const isPlayingRef = React.useRef(isPlaying);
  const isPausedRef = React.useRef(isPaused);
  const sentencesRef = React.useRef(sentences);
  const currentSentenceIndexRef = React.useRef(currentSentenceIndex);

  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  sentencesRef.current = sentences;
  currentSentenceIndexRef.current = currentSentenceIndex;

  // Load available system voices & select best natural voice
  React.useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);

        // Pick preferred natural voice (e.g. Google US English, Samantha, Natural, Daniel)
        const preferred = voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Google") ||
              v.name.includes("Natural") ||
              v.name.includes("Samantha") ||
              v.name.includes("Daniel") ||
              v.name.includes("Karen") ||
              v.name.includes("Alex"))
        ) || voices.find((v) => v.lang.startsWith("en")) || voices[0];

        setSelectedVoice((prev) => prev || preferred || null);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Internal function to speak a specific sentence index
  const speakSentence = React.useCallback(
    (index: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const list = sentencesRef.current;
      if (index < 0 || index >= list.length) {
        // Reached end of article
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentSentenceIndex(0);
        return;
      }

      window.speechSynthesis.cancel(); // Cancel any ongoing speech

      const textToSpeak = list[index];
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utteranceRef.current = utterance;

      utterance.rate = rate;
      utterance.pitch = pitch;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        // Move to next sentence if still playing and not paused
        if (isPlayingRef.current && !isPausedRef.current) {
          const nextIdx = index + 1;
          if (nextIdx < sentencesRef.current.length) {
            setCurrentSentenceIndex(nextIdx);
            speakSentence(nextIdx);
          } else {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentSentenceIndex(0);
          }
        }
      };

      utterance.onerror = (e) => {
        console.error("Speech Synthesis Error:", e);
      };

      setCurrentSentenceIndex(index);
      setIsPlaying(true);
      setIsPaused(false);
      window.speechSynthesis.speak(utterance);
    },
    [pitch, rate, selectedVoice]
  );

  // Play a post
  const playPost = React.useCallback(
    (post: ArticleContent) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      const fullText = `${post.title}. ${extractPlainText(post.content, post.excerpt)}`;
      const parsedSentences = splitIntoSentences(fullText);

      if (parsedSentences.length === 0) return;

      setActivePost(post);
      setSentences(parsedSentences);
      sentencesRef.current = parsedSentences;
      setCurrentSentenceIndex(0);
      setIsPlaying(true);
      setIsPaused(false);

      // Give state a tick to update before speaking
      setTimeout(() => {
        speakSentence(0);
      }, 50);
    },
    [speakSentence]
  );

  // Pause playback
  const pause = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
    setIsPlaying(false);
  }, []);

  // Resume playback
  const resume = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      speakSentence(currentSentenceIndexRef.current);
    }
  }, [speakSentence]);

  // Stop playback completely
  const stop = React.useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setActivePost(null);
    setCurrentSentenceIndex(0);
  }, []);

  const skipForward = React.useCallback(() => {
    const nextIdx = Math.min(sentencesRef.current.length - 1, currentSentenceIndexRef.current + 1);
    speakSentence(nextIdx);
  }, [speakSentence]);

  const skipBackward = React.useCallback(() => {
    const prevIdx = Math.max(0, currentSentenceIndexRef.current - 1);
    speakSentence(prevIdx);
  }, [speakSentence]);

  const seekToSentence = React.useCallback(
    (index: number) => {
      if (index >= 0 && index < sentencesRef.current.length) {
        speakSentence(index);
      }
    },
    [speakSentence]
  );

  const setRate = React.useCallback(
    (newRate: number) => {
      setRateState(newRate);
      if (isPlayingRef.current && !isPausedRef.current) {
        speakSentence(currentSentenceIndexRef.current);
      }
    },
    [speakSentence]
  );

  const setPitch = React.useCallback(
    (newPitch: number) => {
      setPitchState(newPitch);
      if (isPlayingRef.current && !isPausedRef.current) {
        speakSentence(currentSentenceIndexRef.current);
      }
    },
    [speakSentence]
  );

  const setVoice = React.useCallback(
    (voice: SpeechSynthesisVoice) => {
      setSelectedVoice(voice);
      if (isPlayingRef.current && !isPausedRef.current) {
        speakSentence(currentSentenceIndexRef.current);
      }
    },
    [speakSentence]
  );

  // Setup Web Speech Recognition for Hands-Free Voice Commands ("stop", "continue", "pause", "resume")
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript.toLowerCase();
      }

      setVoiceTranscript(currentTranscript);

      // Check voice commands
      if (
        currentTranscript.includes("stop") ||
        currentTranscript.includes("pause") ||
        currentTranscript.includes("hold on") ||
        currentTranscript.includes("wait") ||
        currentTranscript.includes("shut up")
      ) {
        if (isPlayingRef.current) {
          pause();
        }
      } else if (
        currentTranscript.includes("continue") ||
        currentTranscript.includes("resume") ||
        currentTranscript.includes("play") ||
        currentTranscript.includes("keep reading") ||
        currentTranscript.includes("start") ||
        currentTranscript.includes("go on")
      ) {
        if (isPausedRef.current || !isPlayingRef.current) {
          resume();
        }
      } else if (currentTranscript.includes("faster")) {
        setRate(Math.min(2.0, rate + 0.25));
      } else if (currentTranscript.includes("slower")) {
        setRate(Math.max(0.75, rate - 0.25));
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        console.warn("Speech recognition error:", e.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart recognition if voice command mode is toggled on
      if (isVoiceCommandActive) {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      }
    };

    recognitionRef.current = recognition;

    if (isVoiceCommandActive) {
      try {
        recognition.start();
      } catch {
        // ignore
      }
    } else {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [isVoiceCommandActive, pause, resume, rate, setRate]);

  const toggleVoiceCommands = React.useCallback(() => {
    setIsVoiceCommandActive((prev) => !prev);
  }, []);

  return (
    <AudioReaderContext.Provider
      value={{
        activePost,
        isPlaying,
        isPaused,
        currentSentenceIndex,
        sentences,
        rate,
        pitch,
        selectedVoice,
        availableVoices,
        isVoiceCommandActive,
        voiceTranscript,
        playPost,
        pause,
        resume,
        stop,
        skipForward,
        skipBackward,
        seekToSentence,
        setRate,
        setPitch,
        setVoice,
        toggleVoiceCommands,
      }}
    >
      {children}
    </AudioReaderContext.Provider>
  );
}

export function useAudioReader() {
  const context = React.useContext(AudioReaderContext);
  if (!context) {
    throw new Error("useAudioReader must be used within an AudioReaderProvider");
  }
  return context;
}
