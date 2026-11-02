import React, { useState, useEffect, useRef, useCallback } from 'react';
import mainLogo from '../assets/images/main_logo.png';

interface WebsiteIntroAnimationProps {
  onComplete: () => void;
  forceShow?: boolean;
}

export const WebsiteIntroAnimation: React.FC<WebsiteIntroAnimationProps> = ({
  onComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [typewriterText, setTypewriterText] = useState<string>('FUNZY TECH,');
  const [currentBg, setCurrentBg] = useState<string>('#261508');

  const audioRef = useRef<HTMLAudioElement>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Complete intro with smooth Blur + Fade-in Transition
  const handleFinish = useCallback(() => {
    if (isFadingOut) return;
    setIsFadingOut(true);

    // After blur + fade-out duration (650ms), unmount overlay and restore document body
    setTimeout(() => {
      setIsPlaying(false);
      try {
        document.body.style.overflow = '';
        document.body.style.backgroundColor = '#f7f2ea';
      } catch {}
      onComplete();
    }, 650);
  }, [isFadingOut, onComplete]);

  // Audio Playback Handling: Reduced volume (0.28) & smoothed sound, zero UI buttons
  useEffect(() => {
    // Lock body during intro
    try {
      document.body.style.overflow = 'hidden';
      document.body.style.backgroundColor = '#261508';
    } catch {}

    const audio = audioRef.current;
    if (audio) {
      audio.volume = 0.28; // Smoothed, reduced volume per user requirement
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Silent fallback if browser autoplay policy restricts unmuted audio
        });
      }
    }

    // Safety timeout so intro never hangs
    safetyTimeoutRef.current = setTimeout(() => {
      handleFinish();
    }, 6800);

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      try {
        document.body.style.overflow = '';
        document.body.style.backgroundColor = '#f7f2ea';
      } catch {}
    };
  }, [handleFinish]);

  // FunzyTech Custom Animation Choreography
  useEffect(() => {
    // Step 1: 0 - 1.6s: Deep Espresso & Golden Capsule Typewriter
    setCurrentBg('#261508');
    setCurrentStep(1);

    const t1 = setTimeout(() => {
      setTypewriterText('FUNZY TECH, 1:1 CALLS');
    }, 600);

    const t2 = setTimeout(() => {
      setTypewriterText('FUNZY TECH, 1:1 CALLS & MENTORSHIP');
    }, 1100);

    // Step 2: 1.6s - 2.6s: Inversion Flash to Warm Cream Parchment (#f8f3ea)
    const t3 = setTimeout(() => {
      setCurrentBg('#f8f3ea');
      setCurrentStep(2);
      try {
        document.body.style.backgroundColor = '#f8f3ea';
      } catch {}
    }, 1600);

    // Step 3: 2.6s - 3.8s: Liquid Gold Comet & Wordmark in Espresso (#261508)
    const t4 = setTimeout(() => {
      setCurrentBg('#261508');
      setCurrentStep(3);
      try {
        document.body.style.backgroundColor = '#261508';
      } catch {}
    }, 2600);

    // Step 4: 3.8s - 5.1s: Circular Iris Expansion to FunzyTech Official Crest & Logo (#f8f3ea)
    const t5 = setTimeout(() => {
      setCurrentBg('#f8f3ea');
      setCurrentStep(4);
      try {
        document.body.style.backgroundColor = '#f8f3ea';
      } catch {}
    }, 3800);

    // Step 5: 5.1s: Initiate Smooth Blur + Fade-in Transition to homepage
    const t6 = setTimeout(() => {
      handleFinish();
    }, 5100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [handleFinish]);

  if (!isPlaying) return null;

  return (
    <div
      onClick={handleFinish}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        backgroundColor: currentBg,
        transition: isFadingOut
          ? 'all 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
          : 'background-color 0.28s ease',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.05)' : 'scale(1)',
        filter: isFadingOut ? 'blur(16px)' : 'none',
        backdropFilter: isFadingOut ? 'blur(28px)' : 'none',
        pointerEvents: isFadingOut ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      className="select-none font-['Outfit',sans-serif]"
    >
      {/* Synchronized Background Audio: Smoothed & Reduced Volume */}
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={handleFinish}
      >
        <source src="./assets/intro_audio.mp3" type="audio/mp3" />
        <source src="/assets/intro_audio.mp3" type="audio/mp3" />
        <source src="assets/intro_audio.mp3" type="audio/mp3" />
      </audio>

      {/* Main Animation Container */}
      <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
        
        {/* Phase 1: Deep Espresso with Spinning Golden Pill Capsule & Kinetic Typewriter */}
        {currentStep === 1 && (
          <div className="flex flex-col items-center justify-center gap-7 animate-ftFadeIn">
            <div
              style={{
                width: '36px',
                height: '18px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #b45309 100%)',
                boxShadow: '0 4px 24px rgba(245, 158, 11, 0.55), 0 0 12px rgba(254, 240, 138, 0.4)',
                transform: 'rotate(-35deg)',
                animation: 'ftCapsuleSpin 1.4s ease-in-out infinite alternate',
              }}
            />
            <div className="text-white font-black text-xl sm:text-2xl tracking-[0.18em] uppercase transition-all duration-200">
              {typewriterText}
            </div>
          </div>
        )}

        {/* Phase 2: Warm Parchment Cream with Spinning Espresso Capsule & Byline */}
        {currentStep === 2 && (
          <div className="flex flex-col items-center justify-center gap-6 animate-ftFadeIn">
            <div
              style={{
                width: '36px',
                height: '18px',
                borderRadius: '999px',
                background: 'linear-gradient(135deg, #452914 0%, #261508 100%)',
                boxShadow: '0 4px 18px rgba(38, 21, 8, 0.3)',
                transform: 'rotate(45deg)',
                animation: 'ftCapsuleSpin 1.4s ease-in-out infinite alternate',
              }}
            />
            <div className="text-[#8c6747] font-extrabold text-xs sm:text-sm tracking-[0.22em] uppercase">
              FUNZY TECH • LEARN • CREATE • GROW
            </div>
          </div>
        )}

        {/* Phase 3: Liquid Golden Comet Swirl & FunzyTech Wordmark */}
        {currentStep === 3 && (
          <div className="flex flex-col items-center justify-center gap-6 animate-ftScaleIn">
            {/* Luminous Rotating Orbit Arc */}
            <div className="relative flex items-center justify-center w-20 h-20">
              <svg className="w-full h-full animate-spin" viewBox="0 0 100 100" style={{ animationDuration: '1.2s' }}>
                <defs>
                  <linearGradient id="goldCometGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="60%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#b45309" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 50,14 A 36,36 0 0,1 86,50"
                  fill="none"
                  stroke="url(#goldCometGrad)"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute w-3 h-3 rounded-full bg-amber-300 shadow-[0_0_12px_#f59e0b] -top-1" />
            </div>

            {/* Custom FunzyTech Typographic Wordmark */}
            <div className="text-white font-black text-3xl sm:text-5xl tracking-tight flex items-center gap-2">
              <span>funzy</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-500 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]">
                tech
              </span>
            </div>
            <div className="text-amber-200/80 font-bold text-xs sm:text-sm tracking-[0.2em] uppercase">
              1:1 Tech Mentorship &amp; Calls
            </div>
          </div>
        )}

        {/* Phase 4: Circular Iris Reveal to Official FunzyTech Crest & Branding */}
        {currentStep === 4 && (
          <div className="flex flex-col items-center justify-center gap-4 animate-ftScaleIn">
            {/* Official Logo with Concentric Gold Rings & Glow */}
            <div className="relative flex items-center justify-center">
              <div className="absolute -inset-2.5 rounded-full border-2 border-amber-400/40 animate-pulse opacity-40" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-amber-500 via-amber-300 to-amber-600 shadow-[0_12px_32px_rgba(38,21,8,0.25)]">
                <img
                  src={mainLogo}
                  alt="Funzy Tech"
                  className="w-full h-full rounded-full object-cover bg-white"
                />
              </div>
            </div>

            {/* FunzyTech Brand Name & Call to Action */}
            <div className="flex flex-col items-center gap-1.5 mt-2">
              <div className="text-[#261508] font-black text-2xl sm:text-4xl tracking-wider uppercase">
                FUNZY TECH
              </div>
              <div className="text-[#8c6239] font-extrabold text-xs sm:text-sm tracking-[0.24em] uppercase">
                Book a 1:1 Call
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ftCapsuleSpin {
          0% { transform: rotate(-35deg) scale(0.92); }
          50% { transform: rotate(15deg) scale(1.1); }
          100% { transform: rotate(75deg) scale(0.92); }
        }
        @keyframes ftFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ftScaleIn {
          from { opacity: 0; transform: scale(0.88); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-ftFadeIn {
          animation: ftFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-ftScaleIn {
          animation: ftScaleIn 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
};
