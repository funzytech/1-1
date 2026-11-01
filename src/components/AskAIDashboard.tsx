/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useAuth } from '../firebase/authContext';
import { AudioWaveform } from './AudioWaveform';
import { LiveVoiceModal } from './LiveVoiceModal';
import { ContinuousAudioRecorder, RecordingState } from '../services/audioRecorder';

interface AskAIDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSignIn?: () => void;
  onOpenBooking?: () => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelUsed?: string;
  imageUrl?: string;
}

const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', badge: 'Default · Fast & Multimodal' },
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', badge: 'Next-Gen Speed' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', badge: 'Ultra-Fast & Efficient' },
];

export const AskAIDashboard: React.FC<AskAIDashboardProps> = ({
  isOpen,
  onClose,
  onOpenSignIn,
  onOpenBooking,
}) => {
  const { user, isAuthenticated } = useAuth();

  const [shouldRender, setShouldRender] = useState<boolean>(isOpen);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Tools & Attachments popover
  const [showToolsMenu, setShowToolsMenu] = useState<boolean>(false);
  const [attachedImageBase64, setAttachedImageBase64] = useState<string | null>(null);
  const [attachedImageMimeType, setAttachedImageMimeType] = useState<string>('image/jpeg');
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState<boolean>(false);

  // Continuous Voice Recording State (Feature A)
  const [recordingState, setRecordingState] = useState<RecordingState>('IDLE');
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] = useState<number>(0);
  const [micAudioLevel, setMicAudioLevel] = useState<number>(0);
  const [voiceErrorMessage, setVoiceErrorMessage] = useState<string | null>(null);
  const [interimSpeechPreview, setInterimSpeechPreview] = useState<string>('');
  const audioRecorderRef = useRef<ContinuousAudioRecorder | null>(null);

  // Real-Time Live Talk Modal State (Feature B)
  const [isLiveModalOpen, setIsLiveModalOpen] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Display one-line error message with auto-dismiss
  const showVoiceError = (msg: string) => {
    setVoiceErrorMessage(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setVoiceErrorMessage(null);
    }, 4500);
  };

  // Format seconds into MM:SS format
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize or cleanup ContinuousAudioRecorder
  useEffect(() => {
    audioRecorderRef.current = new ContinuousAudioRecorder({
      onStateChange: (state) => setRecordingState(state),
      onTimeUpdate: (secs) => setRecordingElapsedSeconds(secs),
      onAudioLevel: (level) => setMicAudioLevel(level),
      onError: (msg) => showVoiceError(msg),
      onInterimSpeech: (text) => setInterimSpeechPreview(text),
    });

    return () => {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cancel();
      }
    };
  }, []);

  // Smooth opening and closing animation controller
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 250);
    } else if (shouldRender) {
      setIsClosing(true);
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cancel();
      }
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, recordingState]);

  const handleSmoothClose = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancel();
    }
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleNewChat = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancel();
    }
    setMessages([]);
    setInputText('');
    setAttachedImageBase64(null);
    setVoiceErrorMessage(null);
    textareaRef.current?.focus();
  };

  // Continuous Voice Recording Handlers (Feature A)
  const handleToggleVoiceRecording = async () => {
    if (!audioRecorderRef.current) return;

    if (recordingState === 'RECORDING' || recordingState === 'PAUSED') {
      await handleFinishVoiceRecording();
    } else {
      setVoiceErrorMessage(null);
      setInterimSpeechPreview('');
      await audioRecorderRef.current.start();
    }
  };

  const handlePauseRecording = () => {
    if (audioRecorderRef.current && recordingState === 'RECORDING') {
      audioRecorderRef.current.pause();
    }
  };

  const handleResumeRecording = () => {
    if (audioRecorderRef.current && recordingState === 'PAUSED') {
      audioRecorderRef.current.resume();
    }
  };

  const handleCancelRecording = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancel();
      setRecordingState('IDLE');
      setRecordingElapsedSeconds(0);
      setMicAudioLevel(0);
      setInterimSpeechPreview('');
    }
  };

  const handleFinishVoiceRecording = async () => {
    if (!audioRecorderRef.current) return;

    setRecordingState('TRANSCRIBING');
    try {
      const audioBlob = await audioRecorderRef.current.finish();
      if (!audioBlob || audioBlob.size === 0) {
        setRecordingState('IDLE');
        showVoiceError('No audio was captured. Please record your message again.');
        return;
      }

      // Convert audio blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const audioBase64 = btoa(binary);

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      });

      if (!res.ok) {
        throw new Error('Transcription request failed');
      }

      const data = await res.json();
      const recognized = data.text ? data.text.trim() : '';

      if (recognized) {
        setInputText((prev) => (prev ? `${prev} ${recognized}` : recognized));
        textareaRef.current?.focus();
      } else {
        showVoiceError('No speech was recognized. Try recording again in a quieter environment.');
      }
    } catch (err: any) {
      console.error('Transcription error:', err);
      showVoiceError('Could not transcribe the recording. Please retry.');
    } finally {
      setRecordingState('IDLE');
      setRecordingElapsedSeconds(0);
      setMicAudioLevel(0);
      setInterimSpeechPreview('');
    }
  };

  // Image Attachment Handling
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showVoiceError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      setAttachedImageBase64(base64Data);
      setAttachedImageMimeType(file.type);
      setShowToolsMenu(false);
    };
    reader.readAsDataURL(file);
  };

  // Chat message submission
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if ((!textToSend && !attachedImageBase64) || isLoading) return;

    const userMessage: ChatMessage = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      imageUrl: attachedImageBase64 ? `data:${attachedImageMimeType};base64,${attachedImageBase64}` : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    const sentImageBase64 = attachedImageBase64;
    const sentImageMime = attachedImageMimeType;
    setAttachedImageBase64(null);
    setIsLoading(true);

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const payloadMessage = isWebSearchEnabled
        ? `[Web Search Active] ${textToSend}`
        : textToSend;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payloadMessage,
          model: selectedModel,
          history: historyPayload,
          imageBase64: sentImageBase64,
          imageMimeType: sentImageMime,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: data.text || 'I could not generate an answer right now. Please try your technology question again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: data.model || selectedModel,
      };

      setMessages([...newMessages, assistantMessage]);
    } catch (err: any) {
      console.error('Ask AI error:', err);
      const fallbackMessage: ChatMessage = {
        id: `msg_ai_${Date.now()}`,
        role: 'assistant',
        content: 'I specialize specifically in smartphones, hardware, processors, and tech troubleshooting. Please ask any technology-related question!',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelUsed: selectedModel,
      };
      setMessages([...newMessages, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyMessage = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMessageId(msg.id);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  // Quick Action Tool Pills from attachment
  const handleQuickToolSelect = (toolType: 'image' | 'write' | 'search') => {
    if (toolType === 'image') {
      setInputText('Create a modern 3D render of a futuristic transparent smartphone with liquid-glass casing: ');
      textareaRef.current?.focus();
    } else if (toolType === 'write') {
      setInputText('Write a detailed technical comparison of camera sensors, flagship benchmarks, and battery longevity: ');
      textareaRef.current?.focus();
    } else if (toolType === 'search') {
      setIsWebSearchEnabled(true);
      setInputText('Search latest hardware releases and Snapdragon vs Dimensity benchmarks: ');
      textareaRef.current?.focus();
    }
  };

  if (!shouldRender) return null;

  const isRecordingActive = recordingState === 'RECORDING' || recordingState === 'PAUSED';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#fbf7f2] text-[#261508] select-none font-['Outfit',sans-serif] ${
        isClosing ? 'animate-ask-ai-close' : 'animate-ask-ai-open'
      }`}
    >
      {/* Warm Parchment Texture & Subtle Ambient Background Depth */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f8f0e3] via-[#f5ede2] to-[#ecdfd0] opacity-95" />
      <div className="pointer-events-none absolute top-10 left-1/3 h-96 w-96 rounded-full bg-amber-400/12 blur-3xl" />
      <div className="pointer-events-none absolute bottom-20 right-1/4 h-80 w-80 rounded-full bg-orange-400/10 blur-3xl" />

      {/* Top Header Bar matching user's design */}
      <header className="relative z-20 flex h-16 items-center justify-between px-4 sm:px-8 shrink-0">
        {/* Left: Liquid Glass Circle Close Button (X) */}
        <button
          type="button"
          onClick={handleSmoothClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#3b2716] border border-white/80 shadow-[0_4px_14px_rgba(115,88,48,0.12)] transition-all cursor-pointer active:scale-95"
          title="Close Ask AI"
          aria-label="Close Ask AI"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Center: Liquid Glass Pill "Book a Call" Button */}
        {onOpenBooking && (
          <button
            type="button"
            onClick={onOpenBooking}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/75 hover:bg-white text-[#261508] font-bold text-xs sm:text-sm border border-white/90 shadow-[0_4px_16px_rgba(115,88,48,0.12)] hover:shadow-[0_6px_20px_rgba(115,88,48,0.18)] transition-all active:scale-95 cursor-pointer"
            title="Schedule personal consultation call"
          >
            <svg className="w-4 h-4 text-[#4a321f]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            <span>Book a Call</span>
          </button>
        )}

        {/* Right: Liquid Glass Circle Chat Bubble / Reset Button */}
        <button
          type="button"
          onClick={handleNewChat}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#3b2716] border border-white/80 shadow-[0_4px_14px_rgba(115,88,48,0.12)] transition-all cursor-pointer active:scale-95"
          title="Start new conversation"
          aria-label="New chat"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      </header>

      {/* Main Canvas Area */}
      <main className="relative z-10 flex-1 overflow-y-auto px-4 sm:px-8 py-3 flex flex-col justify-between">
        
        {/* Empty State matching user's design */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-end max-w-xl mx-auto w-full pb-3">
            {/* Action Suggestion Pills on Bottom-Left */}
            <div className="flex flex-col items-start gap-3 select-none">
              {/* Pill 1: Create an image */}
              <button
                type="button"
                onClick={() => handleQuickToolSelect('image')}
                className="group inline-flex items-center gap-3.5 px-4 py-2.5 rounded-full bg-white/50 hover:bg-white/85 backdrop-blur-md border border-white/80 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 border border-white/90 shadow-2xs text-[#4a321f] group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </div>
                <span className="font-bold text-sm text-[#261508] tracking-tight">Create an image</span>
              </button>

              {/* Pill 2: Write or edit */}
              <button
                type="button"
                onClick={() => handleQuickToolSelect('write')}
                className="group inline-flex items-center gap-3.5 px-4 py-2.5 rounded-full bg-white/50 hover:bg-white/85 backdrop-blur-md border border-white/80 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 border border-white/90 shadow-2xs text-[#4a321f] group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </div>
                <span className="font-bold text-sm text-[#261508] tracking-tight">Write or edit</span>
              </button>

              {/* Pill 3: Search the web */}
              <button
                type="button"
                onClick={() => handleQuickToolSelect('search')}
                className="group inline-flex items-center gap-3.5 px-4 py-2.5 rounded-full bg-white/50 hover:bg-white/85 backdrop-blur-md border border-white/80 shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/80 border border-white/90 shadow-2xs text-[#4a321f] group-hover:scale-105 transition-transform">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <span className="font-bold text-sm text-[#261508] tracking-tight">Search the web</span>
              </button>
            </div>
          </div>
        ) : (
          /* Active Chat Stream */
          <div className="max-w-2xl mx-auto w-full space-y-4 py-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} w-full`}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-[#7d644d] mb-1 px-1">
                  <span className="font-bold">{msg.role === 'user' ? 'You' : 'Ask AI'}</span>
                  <span>·</span>
                  <span>{msg.timestamp}</span>
                </div>

                <div
                  className={`relative p-3.5 sm:p-4 rounded-3xl shadow-xs select-text leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#382314] text-white border border-[#4a3422] max-w-[85%]'
                      : 'bg-white/85 text-[#261508] border border-[#a68d6a]/25 backdrop-blur-md w-full'
                  }`}
                >
                  {msg.imageUrl && (
                    <img
                      src={msg.imageUrl}
                      alt="Attached upload"
                      className="max-h-48 rounded-2xl mb-2 object-cover border border-white/20"
                    />
                  )}
                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <MarkdownRenderer content={msg.content} />
                  )}
                </div>

                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-[#7d644d]">
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="inline-flex items-center gap-1 hover:text-[#261508] transition-colors cursor-pointer"
                    >
                      {copiedMessageId === msg.id ? (
                        <span className="text-emerald-700 font-bold">✓ Copied</span>
                      ) : (
                        <>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                          </svg>
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex flex-col items-start w-full">
                <div className="flex items-center gap-1.5 text-[10px] text-[#7d644d] mb-1 px-1">
                  <span className="font-bold">Ask AI</span>
                  <span>·</span>
                  <span>Thinking...</span>
                </div>
                <div className="p-3.5 rounded-3xl bg-white/85 border border-[#8c7054]/25 backdrop-blur-md flex items-center gap-2 text-xs text-[#573e2a]">
                  <span className="h-2 w-2 rounded-full bg-amber-600 animate-ping" />
                  <span className="font-medium">Synthesizing technology insights with {selectedModel}...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Bottom Floating Composer Bar Area */}
        <div className="w-full max-w-xl mx-auto mt-3 pb-3">
          
          {/* Single-Line Error Message */}
          {voiceErrorMessage && (
            <div className="mb-2 px-3.5 py-1.5 rounded-xl bg-amber-100/90 border border-amber-300 text-xs font-bold text-amber-950 shadow-xs flex items-center justify-between gap-2 animate-bounce-short">
              <span className="truncate">{voiceErrorMessage}</span>
              <button
                type="button"
                onClick={() => setVoiceErrorMessage(null)}
                className="text-xs text-amber-900 font-black hover:text-black cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Attached Image Thumbnail Preview */}
          {attachedImageBase64 && (
            <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white/85 border border-[#a68d6a]/30 shadow-xs">
              <img
                src={`data:${attachedImageMimeType};base64,${attachedImageBase64}`}
                alt="Upload thumbnail"
                className="h-9 w-9 rounded-lg object-cover"
              />
              <span className="text-xs font-bold text-[#261508]">Image attached</span>
              <button
                type="button"
                onClick={() => setAttachedImageBase64(null)}
                className="text-xs font-black text-[#7d644d] hover:text-red-600 ml-1 cursor-pointer"
                title="Remove image"
              >
                ✕
              </button>
            </div>
          )}

          {/* Web Search Active Badge */}
          {isWebSearchEnabled && (
            <div className="mb-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-emerald-300 text-[10.5px] font-bold text-emerald-900">
              <span>🌐 Web Search Grounding Active</span>
              <button
                type="button"
                onClick={() => setIsWebSearchEnabled(false)}
                className="hover:text-black font-black cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Floating Liquid Glass Input Capsule matching screenshot */}
          <div className="relative flex items-center rounded-full bg-white/80 hover:bg-white/90 backdrop-blur-2xl border border-[#a68d6a]/30 shadow-[0_8px_30px_rgba(115,88,48,0.12)] px-2.5 py-1.5 transition-all focus-within:shadow-[0_12px_36px_rgba(115,88,48,0.18)] focus-within:border-amber-600/50">
            
            {/* Hidden File Input for Image Uploads */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileChange}
              className="hidden"
            />

            {/* Left: Plus (+) Button for Tools Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#3b2716] hover:bg-black/5 transition-colors cursor-pointer"
                title="Attachments and tools"
                aria-label="Attachments and tools"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>

              {/* Tools Menu Popover */}
              {showToolsMenu && (
                <div className="absolute bottom-12 left-0 z-30 w-52 rounded-2xl bg-white/95 backdrop-blur-xl border border-[#a68d6a]/30 shadow-lg p-1.5 flex flex-col gap-1 text-xs font-semibold text-[#261508] animate-fade-in">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-amber-50/90 text-left transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-amber-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    <span>Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsWebSearchEnabled(!isWebSearchEnabled);
                      setShowToolsMenu(false);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-amber-50/90 text-left transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-emerald-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                    </svg>
                    <span>{isWebSearchEnabled ? 'Disable Web Search' : 'Search the Web'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleNewChat();
                      setShowToolsMenu(false);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-amber-50/90 text-left transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 text-orange-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    <span>New Consultation</span>
                  </button>
                </div>
              )}
            </div>

            {/* Center Area: Regular Text Input vs Continuous Recording State */}
            {isRecordingActive ? (
              /* ACTIVE CONTINUOUS RECORDING CONTROLS (Feature A) */
              <div className="flex-1 flex items-center justify-between gap-2 px-2 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Blinking Red Dot */}
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      recordingState === 'RECORDING' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                    }`}
                  />

                  {/* Real-Time Audio Waveform */}
                  <AudioWaveform
                    level={micAudioLevel}
                    barsCount={6}
                    isActive={recordingState === 'RECORDING'}
                    isPaused={recordingState === 'PAUSED'}
                    color="#991b1b"
                  />

                  {/* Elapsed Timer (Counts up continuously during silence) */}
                  <span className="font-mono font-bold text-xs sm:text-sm text-[#261508] tracking-wider shrink-0">
                    {formatTime(recordingElapsedSeconds)}
                  </span>

                  {/* Label / Interim Speech Preview */}
                  <span className="hidden sm:inline-block text-xs font-semibold text-[#7d644d] truncate">
                    {recordingState === 'PAUSED'
                      ? 'Paused'
                      : interimSpeechPreview
                      ? `"${interimSpeechPreview}"`
                      : 'Recording (no silence limit)...'}
                  </span>
                </div>

                {/* Recording Actions: Pause/Resume, Cancel, Send */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Pause / Resume Button */}
                  {recordingState === 'RECORDING' ? (
                    <button
                      type="button"
                      onClick={handlePauseRecording}
                      className="px-2.5 py-1.5 rounded-full bg-black/5 hover:bg-black/10 text-[#3d2714] text-xs font-bold transition-all cursor-pointer"
                      title="Pause recording without losing audio"
                    >
                      Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResumeRecording}
                      className="px-2.5 py-1.5 rounded-full bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold transition-all cursor-pointer"
                      title="Resume recording"
                    >
                      Resume
                    </button>
                  )}

                  {/* Cancel Button */}
                  <button
                    type="button"
                    onClick={handleCancelRecording}
                    className="h-8 w-8 rounded-full flex items-center justify-center text-[#7d644d] hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Cancel and discard recording"
                    aria-label="Cancel recording"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>

                  {/* Send Button */}
                  <button
                    type="button"
                    onClick={handleFinishVoiceRecording}
                    className="h-8 w-8 rounded-full bg-[#2c1708] hover:bg-black text-white flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95"
                    title="Send audio for transcription"
                    aria-label="Send audio"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : recordingState === 'TRANSCRIBING' ? (
              /* Transcribing Loading Indicator */
              <div className="flex-1 flex items-center gap-2 px-3 py-1 text-xs font-bold text-[#573e2a]">
                <div className="h-4 w-4 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                <span>Transcribing your voice with Gemini...</span>
              </div>
            ) : (
              /* REGULAR TEXT INPUT */
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI"
                rows={1}
                className="flex-1 resize-none bg-transparent px-2 text-sm sm:text-base text-[#261508] placeholder-[#7d644d]/75 focus:outline-none font-medium leading-relaxed max-h-32 overflow-y-auto"
                style={{ minHeight: '38px', paddingTop: '8px' }}
              />
            )}

            {/* Right Side Icons: Microphone + Waveform Live Button */}
            {!isRecordingActive && recordingState !== 'TRANSCRIBING' && (
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                {inputText.trim() ? (
                  /* Send Arrow when text is present */
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={isLoading}
                    className="h-9 w-9 rounded-full bg-[#2c1708] hover:bg-black text-white flex items-center justify-center shadow-xs transition-all cursor-pointer active:scale-95"
                    title="Send question"
                    aria-label="Send message"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  </button>
                ) : (
                  <>
                    {/* Microphone Icon Button (Feature A: Continuous Voice Recording) */}
                    <button
                      type="button"
                      onClick={handleToggleVoiceRecording}
                      className="flex h-10 w-10 items-center justify-center rounded-full text-[#3b2716] hover:bg-black/5 hover:text-black transition-all cursor-pointer active:scale-95"
                      title="Continuous Voice Input (No silence limit)"
                      aria-label="Continuous voice input"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                      </svg>
                    </button>

                    {/* Waveform / Live Button (Feature B: Real-Time Live Talk Mode) */}
                    <button
                      type="button"
                      onClick={() => setIsLiveModalOpen(true)}
                      className="flex h-10 items-center justify-center px-3.5 rounded-full bg-white/70 hover:bg-white text-[#261508] border border-white/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer active:scale-95 group"
                      title="Real-Time Live Talk Mode"
                      aria-label="Real-time live talk mode"
                    >
                      <div className="flex items-center gap-[2.5px] h-4">
                        <span className="w-[2.5px] h-2.5 rounded-full bg-[#261508] group-hover:h-3.5 transition-all duration-200" />
                        <span className="w-[2.5px] h-4 rounded-full bg-[#261508] group-hover:h-4.5 transition-all duration-200" />
                        <span className="w-[2.5px] h-2 rounded-full bg-[#261508] group-hover:h-3 transition-all duration-200" />
                        <span className="w-[2.5px] h-3.5 rounded-full bg-[#261508] group-hover:h-4 transition-all duration-200" />
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Real-Time Conversational Live Talk Interface (Feature B) */}
      <LiveVoiceModal
        isOpen={isLiveModalOpen}
        onClose={() => setIsLiveModalOpen(false)}
        onOpenBooking={onOpenBooking}
      />
    </div>
  );
};
