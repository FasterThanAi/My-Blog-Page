"use client";

import * as React from "react";
import Image from "next/image";
import { useAudioReader } from "@/context/audio-reader-context";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  RotateCw,
  Mic,
  MicOff,
  Volume2,
  X,
  Sparkles,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AudioPlayerBar() {
  const {
    activePost,
    isPlaying,
    currentSentenceIndex,
    sentences,
    rate,
    pitch,
    selectedVoice,
    availableVoices,
    isVoiceCommandActive,
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
  } = useAudioReader();

  const [showSettings, setShowSettings] = React.useState(false);

  if (!activePost) return null;

  const totalSentences = sentences.length || 1;
  const progressPercent = Math.min(
    100,
    Math.round(((currentSentenceIndex + 1) / totalSentences) * 100)
  );

  const rates = [0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-6 duration-300">
      <div className="bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all">
        {/* Top sentence highlight & scrubber bar */}
        <div className="w-full bg-border/30 h-1.5 relative cursor-pointer group">
          <div
            className="bg-accent h-full transition-all duration-300 ease-out rounded-r-full"
            style={{ width: `${progressPercent}%` }}
          />
          <input
            type="range"
            min={0}
            max={totalSentences - 1}
            value={currentSentenceIndex}
            onChange={(e) => seekToSentence(parseInt(e.target.value, 10))}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>

        {/* Main Bar Content */}
        <div className="p-4 flex items-center justify-between gap-4">
          {/* Post info & thumbnail */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            {activePost.coverUrl ? (
              <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-border/50 shadow-sm">
                <Image
                  src={activePost.coverUrl}
                  alt={activePost.title}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-11 font-semibold tracking-wider text-accent uppercase flex items-center gap-1">
                  {isPlaying && (
                    <span className="flex items-end gap-0.5 h-3">
                      <span className="w-0.5 bg-accent h-full animate-bounce" />
                      <span className="w-0.5 bg-accent h-2/3 animate-bounce [animation-delay:0.15s]" />
                      <span className="w-0.5 bg-accent h-4/5 animate-bounce [animation-delay:0.3s]" />
                    </span>
                  )}
                  AI Audio Reader
                </span>

                {/* Voice Command Live Status Pill */}
                {isVoiceCommandActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-10 font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-pulse">
                    <Mic className="w-2.5 h-2.5" /> Say "Stop" / "Continue"
                  </span>
                )}
              </div>

              <h4 className="text-14 font-medium text-text truncate leading-snug">
                {activePost.title}
              </h4>

              {/* Current sentence preview snippet */}
              <p className="text-12 text-muted truncate italic mt-0.5">
                "{sentences[currentSentenceIndex] || "Reading article..."}"
              </p>
            </div>
          </div>

          {/* Primary Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Skip back */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full hidden sm:flex"
              onClick={skipBackward}
              title="Previous Sentence"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>

            {/* Play / Pause Toggle */}
            {isPlaying ? (
              <Button
                variant="primary"
                size="sm"
                className="h-10 w-10 p-0 rounded-full shadow-md bg-accent text-white hover:bg-accent/90 transition-transform active:scale-95"
                onClick={pause}
                title="Pause (or say 'Stop')"
              >
                <Pause className="w-5 h-5 fill-current" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                className="h-10 w-10 p-0 rounded-full shadow-md bg-accent text-white hover:bg-accent/90 transition-transform active:scale-95"
                onClick={resume}
                title="Play (or say 'Continue')"
              >
                <Play className="w-5 h-5 fill-current translate-x-0.5" />
              </Button>
            )}

            {/* Skip forward */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-full hidden sm:flex"
              onClick={skipForward}
              title="Next Sentence"
            >
              <RotateCw className="w-4 h-4" />
            </Button>

            {/* Stop Button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted hover:text-rose-500 rounded-full"
              onClick={stop}
              title="Stop Reading"
            >
              <Square className="w-4 h-4" />
            </Button>

            {/* Speed preset toggle */}
            <button
              type="button"
              onClick={() => {
                const nextIdx = (rates.indexOf(rate) + 1) % rates.length;
                setRate(rates[nextIdx]);
              }}
              className="px-2 py-1 rounded-lg text-12 font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              title="Playback Speed"
            >
              {rate}x
            </button>

            {/* Voice Command Mic Toggle */}
            <Button
              variant={isVoiceCommandActive ? "secondary" : "ghost"}
              size="sm"
              className={`h-8 w-8 p-0 rounded-full transition-colors ${
                isVoiceCommandActive
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "text-muted hover:text-text"
              }`}
              onClick={toggleVoiceCommands}
              title={
                isVoiceCommandActive
                  ? "Disable Voice Commands (Say 'Stop' / 'Continue')"
                  : "Enable Hands-Free Voice Commands"
              }
            >
              {isVoiceCommandActive ? (
                <Mic className="w-4 h-4 text-emerald-500" />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
            </Button>

            {/* Extra settings drawer toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted hover:text-text rounded-full"
              onClick={() => setShowSettings((prev) => !prev)}
              title="Audio Voice & Pitch Settings"
            >
              <Sliders className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Expandable Voice & Pitch Controls Drawer */}
        {showSettings && (
          <div className="border-t border-border/60 p-4 bg-muted/20 flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="text-12 font-medium text-text flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-accent" /> Natural Voice & Pitch Settings
              </span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-muted hover:text-text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-12">
              {/* Voice Selector */}
              <div className="flex flex-col gap-1">
                <label className="text-muted text-11 font-medium">Select Voice:</label>
                <select
                  value={selectedVoice?.name || ""}
                  onChange={(e) => {
                    const found = availableVoices.find((v) => v.name === e.target.value);
                    if (found) setVoice(found);
                  }}
                  className="bg-bg border border-border/70 rounded-lg px-2.5 py-1.5 text-12 text-text focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  {availableVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pitch Frequency Slider */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-muted text-11 font-medium">
                  <span>Pitch Frequency:</span>
                  <span className="text-text font-semibold">{pitch.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={1.5}
                  step={0.1}
                  value={pitch}
                  onChange={(e) => setPitch(parseFloat(e.target.value))}
                  className="accent-accent cursor-pointer"
                />
                <span className="text-10 text-muted">
                  Default 1.0 (Balanced, non-high frequency natural pitch)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
