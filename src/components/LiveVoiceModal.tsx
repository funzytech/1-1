/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export type LiveTalkState =
  | 'CONNECTING'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'MUTED'
  | 'ERROR'
  | 'ENDED';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBooking?: () => void;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  onOpenBooking,
}) => {
  const [state, setState] = useState<LiveTalkState>('CONNECTING');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<string>('Kore');
  const [showSubtitles, setShowSubtitles] = useState<boolean>(true);

  // Live dialogue turns
  const [liveTranscript, setLiveTranscript] = useState<string>('');
  const [aiSpokenText, setAiSpokenText] = useState<string>('');
  const [typedFallbackInput, setTypedFallbackInput] = useState<string>('');

  // Audio measurement
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [outputAudioLevel, setOutputAudioLevel] = useState<number>(0);

  // References
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Conversation history for context
  const conversationHistoryRef = useRef<Array<{ role: string; content: string }>>([]);

  // Turn detection
  const isSpeakingRef = useRef<boolean>(false);
  const speechSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Stop current AI audio playback immediately
  const stopAiPlayback = useCallback(() => {
    if (activeAudioSourceRef.current) {
      try {
        activeAudioSourceRef.current.stop();
        activeAudioSourceRef.current.disconnect();
      } catch {}
      activeAudioSourceRef.current = null;
    }
  }, []);

  // Process a conversational user turn
  const handleUserTurnComplete = useCallback(
    async (audioBlob?: Blob, fallbackText?: string) => {
      if (isMuted || state === 'ENDED') return;

      setState('THINKING');
      setMicAudioLevel(0);

      try {
        let audioBase64 = '';
        if (audioBlob && audioBlob.size > 0) {
          const buffer = await audioBlob.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = '';
          for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          audioBase64 = btoa(binary);
        }

        const payload = {
          audioBase64,
          mimeType: audioBlob ? audioBlob.type : 'audio/webm',
          textPrompt: fallbackText || '',
          history: conversationHistoryRef.current.slice(-6),
          voiceName: selectedVoice,
        };

        const res = await fetch('/api/ai/live-turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('Conversational turn request failed');
        }

        const data = await res.json();
        if (data.userTranscript) {
          setLiveTranscript(data.userTranscript);
          conversationHistoryRef.current.push({ role: 'user', content: data.userTranscript });
        }

        if (data.responseText) {
          setAiSpokenText(data.responseText);
          conversationHistoryRef.current.push({ role: 'assistant', content: data.responseText });
        }

        // Play synthesized audio response
        if (data.audioBase64) {
          await playAiAudioResponse(data.audioBase64);
        } else {
          // If no audio was returned, transition back to Listening after a short pause
          setTimeout(() => {
            setState((prev) => (prev === 'ENDED' ? 'ENDED' : isMuted ? 'MUTED' : 'LISTENING'));
          }, 1400);
        }
      } catch (err: any) {
        console.error('Live turn error:', err);
        setErrorMessage('Connection interrupted. Resuming listening...');
        setTimeout(() => {
          setErrorMessage(null);
          setState((prev) => (prev === 'ENDED' ? 'ENDED' : isMuted ? 'MUTED' : 'LISTENING'));
        }, 2200);
      }
    },
    [isMuted, state, selectedVoice]
  );

  // Play audio through Web Audio API
  const playAiAudioResponse = useCallback(
    async (base64Audio: string) => {
      try {
        stopAiPlayback();

        const binary = atob(base64Audio);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new AudioCtxClass();
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
        const sourceNode = audioContextRef.current.createBufferSource();
        sourceNode.buffer = audioBuffer;

        // Connect through output analyser for audio-synchronized visualizer
        if (!outputAnalyserRef.current) {
          outputAnalyserRef.current = audioContextRef.current.createAnalyser();
          outputAnalyserRef.current.fftSize = 64;
          outputAnalyserRef.current.smoothingTimeConstant = 0.8;
        }

        sourceNode.connect(outputAnalyserRef.current);
        outputAnalyserRef.current.connect(audioContextRef.current.destination);

        activeAudioSourceRef.current = sourceNode;
        setState('SPEAKING');

        sourceNode.onended = () => {
          activeAudioSourceRef.current = null;
          setOutputAudioLevel(0);
          setState((prev) => (prev === 'ENDED' ? 'ENDED' : isMuted ? 'MUTED' : 'LISTENING'));
        };

        sourceNode.start();
      } catch (playErr) {
        console.warn('AI audio playback error:', playErr);
        setState((prev) => (prev === 'ENDED' ? 'ENDED' : isMuted ? 'MUTED' : 'LISTENING'));
      }
    },
    [isMuted, stopAiPlayback]
  );

  // Start real-time audio pipeline
  const initializeLiveSession = useCallback(async () => {
    setState('CONNECTING');
    setErrorMessage(null);
    setLiveTranscript('');
    setAiSpokenText('');

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        setState('ERROR');
        setErrorMessage('Voice recording is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioCtxClass();

      const micSource = audioContextRef.current.createMediaStreamSource(stream);
      micAnalyserRef.current = audioContextRef.current.createAnalyser();
      micAnalyserRef.current.fftSize = 64;
      micAnalyserRef.current.smoothingTimeConstant = 0.75;
      micSource.connect(micAnalyserRef.current);

      // Start MediaRecorder for user turns
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      mediaRecorderRef.current = rec;

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      rec.start(300);

      // Continuous visualizer and audio level polling loop
      const micData = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
      const outData = new Uint8Array(32);

      const updateLevels = () => {
        // Measure user mic input
        if (micAnalyserRef.current && !isMuted) {
          micAnalyserRef.current.getByteFrequencyData(micData);
          let sum = 0;
          for (let i = 0; i < micData.length; i++) {
            sum += micData[i];
          }
          const avg = sum / micData.length;
          const level = Math.min(1, Math.max(0, avg / 128));
          setMicAudioLevel(level);

          // User speech detection for natural turn-taking & interruption
          if (level > 0.16) {
            // If AI is speaking, user speech acts as interruption
            if (activeAudioSourceRef.current) {
              stopAiPlayback();
              setState('LISTENING');
            }

            isSpeakingRef.current = true;
            if (speechSilenceTimerRef.current) {
              clearTimeout(speechSilenceTimerRef.current);
              speechSilenceTimerRef.current = null;
            }
          } else if (isSpeakingRef.current) {
            // Silence detected after user was speaking -> finalize turn after 1400ms of natural pause
            if (!speechSilenceTimerRef.current) {
              speechSilenceTimerRef.current = setTimeout(() => {
                isSpeakingRef.current = false;
                speechSilenceTimerRef.current = null;

                if (recordedChunksRef.current.length > 0) {
                  const blob = new Blob(recordedChunksRef.current, { type: rec.mimeType || 'audio/webm' });
                  recordedChunksRef.current = [];
                  handleUserTurnComplete(blob);
                }
              }, 1400);
            }
          }
        }

        // Measure AI output playback audio level
        if (outputAnalyserRef.current && activeAudioSourceRef.current) {
          outputAnalyserRef.current.getByteFrequencyData(outData);
          let outSum = 0;
          for (let i = 0; i < outData.length; i++) {
            outSum += outData[i];
          }
          const outLevel = Math.min(1, Math.max(0, (outSum / outData.length) / 128));
          setOutputAudioLevel(outLevel);
        } else {
          setOutputAudioLevel(0);
        }

        animationFrameRef.current = requestAnimationFrame(updateLevels);
      };

      animationFrameRef.current = requestAnimationFrame(updateLevels);

      setState(isMuted ? 'MUTED' : 'LISTENING');
    } catch (err: any) {
      console.error('Microphone setup error:', err);
      setState('ERROR');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Microphone permission denied. Allow access to start Live Talk.');
      } else {
        setErrorMessage('Microphone unavailable. Check your device and try again.');
      }
    }
  }, [isMuted, stopAiPlayback, handleUserTurnComplete]);

  // Clean cleanup on close
  const cleanupLiveSession = useCallback(() => {
    stopAiPlayback();

    if (speechSilenceTimerRef.current) {
      clearTimeout(speechSilenceTimerRef.current);
      speechSilenceTimerRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }

    setState('ENDED');
  }, [stopAiPlayback]);

  useEffect(() => {
    if (isOpen) {
      initializeLiveSession();
    } else {
      cleanupLiveSession();
    }
    return () => {
      cleanupLiveSession();
    };
  }, [isOpen, initializeLiveSession, cleanupLiveSession]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setState(nextMuted ? 'MUTED' : 'LISTENING');
  };

  const handleEndLiveTalk = () => {
    cleanupLiveSession();
    onClose();
  };

  if (!isOpen) return null;

  // Compute visualizer orb scale and glow dynamic values
  const activeLevel = state === 'SPEAKING' ? outputAudioLevel : micAudioLevel;
  const orbScale = 1 + activeLevel * 0.28;
  const ringScale1 = 1 + activeLevel * 0.45;
  const ringScale2 = 1 + activeLevel * 0.7;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="live-talk-title"
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#fbf7f2] text-[#261508] select-none font-['Outfit',sans-serif] animate-fade-in"
    >
      {/* Warm Parchment Texture & Subtle Ambient Background Depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f8f0e3] via-[#f5ede2] to-[#ecdfd0] opacity-95" />
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-gradient-to-b from-amber-300/20 via-orange-300/10 to-transparent blur-3xl" />

      {/* Top Header Bar */}
      <header className="relative z-20 flex h-16 items-center justify-between px-4 sm:px-8 border-b border-[#a68d6a]/20 bg-white/60 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          {/* Live Status Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-white/90 shadow-2xs">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                state === 'LISTENING'
                  ? 'bg-emerald-500 animate-pulse'
                  : state === 'THINKING'
                  ? 'bg-amber-500 animate-ping'
                  : state === 'SPEAKING'
                  ? 'bg-orange-500 animate-bounce'
                  : state === 'MUTED'
                  ? 'bg-neutral-400'
                  : state === 'CONNECTING'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-xs font-black uppercase tracking-wider text-[#3d2714]">
              {state === 'LISTENING'
                ? 'Listening'
                : state === 'THINKING'
                ? 'Thinking...'
                : state === 'SPEAKING'
                ? 'Speaking'
                : state === 'MUTED'
                ? 'Muted'
                : state === 'CONNECTING'
                ? 'Connecting...'
                : 'Offline'}
            </span>
          </div>

          {/* Book a Call Action Pill */}
          {onOpenBooking && (
            <button
              type="button"
              onClick={onOpenBooking}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100/80 hover:bg-amber-200/90 text-amber-950 text-xs font-bold border border-amber-300/70 shadow-2xs transition-all active:scale-95 cursor-pointer"
              title="Schedule consultation"
            >
              <span>📞</span>
              <span>Book a Call</span>
            </button>
          )}
        </div>

        {/* Right Header Options & Exit */}
        <div className="flex items-center gap-2.5">
          {/* Voice Personality Selector */}
          <div className="relative">
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="appearance-none text-xs font-bold text-[#4a3422] bg-white/70 hover:bg-white border border-[#a68d6a]/30 rounded-xl px-2.5 py-1.5 pr-6 shadow-2xs focus:outline-none cursor-pointer transition-all"
              title="Switch Voice Persona"
            >
              <option value="Kore">Voice: Kore (Natural)</option>
              <option value="Zephyr">Voice: Zephyr (Crisp)</option>
              <option value="Puck">Voice: Puck (Smooth)</option>
              <option value="Fenrir">Voice: Fenrir (Deep)</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[#7d644d]">
              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Close / Exit Button */}
          <button
            type="button"
            onClick={handleEndLiveTalk}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#3b2716] border border-white/80 shadow-2xs transition-all cursor-pointer active:scale-95"
            aria-label="Exit Live Talk"
          >
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Center Main Stage: The Liquid Glass Visualizer Orb */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 text-center">
        
        {/* Single-line Error Banner */}
        {errorMessage && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 max-w-md w-[90%] px-3.5 py-2 rounded-xl bg-amber-50/95 border border-amber-300 text-xs font-bold text-amber-950 shadow-md flex items-center justify-between gap-2 animate-bounce-short">
            <span className="truncate">{errorMessage}</span>
            <button
              type="button"
              onClick={initializeLiveSession}
              className="text-[11px] underline font-extrabold hover:text-black shrink-0 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Interactive Visualizer Canvas with Concentric Liquid Waves */}
        <div className="relative flex items-center justify-center my-auto">
          {/* Outermost expanding liquid acoustic ripple */}
          <div
            className="absolute rounded-full border border-amber-400/25 pointer-events-none transition-transform duration-150 ease-out"
            style={{
              width: '260px',
              height: '260px',
              transform: `scale(${ringScale2})`,
              opacity: state === 'LISTENING' || state === 'SPEAKING' ? 0.35 + activeLevel * 0.4 : 0.1,
            }}
          />

          {/* Secondary acoustic wave ring */}
          <div
            className="absolute rounded-full border-2 border-amber-300/40 pointer-events-none transition-transform duration-120 ease-out"
            style={{
              width: '210px',
              height: '210px',
              transform: `scale(${ringScale1})`,
              opacity: state === 'LISTENING' || state === 'SPEAKING' ? 0.55 + activeLevel * 0.45 : 0.15,
            }}
          />

          {/* Central Liquid Glass Orb */}
          <div
            className={`relative flex items-center justify-center rounded-full shadow-[0_20px_60px_rgba(115,88,48,0.25)] border-2 border-white/90 backdrop-blur-2xl transition-all duration-150 ease-out ${
              state === 'THINKING'
                ? 'bg-gradient-to-br from-amber-100/90 via-orange-100/80 to-amber-200/90 animate-pulse'
                : state === 'SPEAKING'
                ? 'bg-gradient-to-br from-white/95 via-amber-50/90 to-orange-100/80'
                : state === 'MUTED'
                ? 'bg-neutral-200/80'
                : 'bg-gradient-to-br from-white/95 via-amber-50/80 to-white/90'
            }`}
            style={{
              width: '160px',
              height: '160px',
              transform: `scale(${orbScale})`,
            }}
          >
            {/* Liquid specular highlight shimmer */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/50 to-white pointer-events-none" />

            {/* Center Dynamic Audio Waves / Icon */}
            <div className="relative z-10 flex flex-col items-center justify-center gap-1.5">
              {state === 'THINKING' ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="h-6 w-6 rounded-full border-2 border-amber-500 border-t-amber-800 animate-spin" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                    Thinking
                  </span>
                </div>
              ) : state === 'MUTED' ? (
                <div className="flex flex-col items-center gap-1 text-neutral-500">
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <line x1="2" y1="2" x2="22" y2="22" />
                    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
                    <path d="M5 10v2a7 7 0 0 0 12 5" />
                    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
                    <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                  <span className="text-[10px] font-bold">Muted</span>
                </div>
              ) : (
                /* Dynamic Waveform Bars */
                <div className="flex items-center gap-1.5 h-10 px-2">
                  {[0.5, 0.9, 1.2, 0.8, 0.4].map((multiplier, idx) => {
                    const barHeight = Math.max(6, Math.min(36, 8 + activeLevel * 32 * multiplier));
                    return (
                      <span
                        key={idx}
                        className={`w-1.5 rounded-full transition-all duration-100 ${
                          state === 'SPEAKING' ? 'bg-amber-600' : 'bg-[#2c1708]'
                        }`}
                        style={{ height: `${barHeight}px` }}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Subtitle Transcript Feed */}
        {showSubtitles && (
          <div className="w-full max-w-lg mt-6 px-4">
            <div className="min-h-[72px] p-4 rounded-2xl bg-white/70 backdrop-blur-md border border-white/80 shadow-sm flex flex-col justify-center text-center transition-all">
              {liveTranscript || aiSpokenText ? (
                <div className="space-y-1">
                  {liveTranscript && (
                    <p className="text-xs sm:text-sm font-bold text-[#261508] leading-relaxed">
                      "{liveTranscript}"
                    </p>
                  )}
                  {aiSpokenText && (
                    <p className="text-xs sm:text-sm font-medium text-amber-950 leading-relaxed">
                      {aiSpokenText}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs font-semibold text-[#8c745d]/85">
                  Start speaking naturally. Ask AI will respond in real time.
                </p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Floating Control Bar */}
      <footer className="relative z-20 pb-8 pt-4 px-6 flex items-center justify-center gap-4 bg-gradient-to-t from-white/80 via-white/50 to-transparent">
        {/* Toggle Subtitles Button */}
        <button
          type="button"
          onClick={() => setShowSubtitles(!showSubtitles)}
          className={`px-3 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer shadow-2xs active:scale-95 ${
            showSubtitles
              ? 'bg-white text-[#2c1708] border-[#a68d6a]/40 shadow-xs'
              : 'bg-white/50 text-[#7d644d] border-transparent hover:bg-white'
          }`}
          title="Toggle transcript text"
        >
          CC Subtitles
        </button>

        {/* Mute / Unmute Button */}
        <button
          type="button"
          onClick={toggleMute}
          className={`h-14 w-14 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 ${
            isMuted
              ? 'bg-neutral-800 text-white hover:bg-black'
              : 'bg-white text-[#2c1708] hover:bg-amber-50 border border-white/90'
          }`}
          title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
              <path d="M5 10v2a7 7 0 0 0 12 5" />
              <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </button>

        {/* End Live Talk Button */}
        <button
          type="button"
          onClick={handleEndLiveTalk}
          className="px-5 py-3 rounded-full bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all cursor-pointer active:scale-95 flex items-center gap-2"
          title="End conversation session"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
          <span>End Call</span>
        </button>
      </footer>
    </div>
  );
};
