import React, { useState, useEffect, useRef, useCallback } from 'react';

interface WebsiteIntroAnimationProps {
  onComplete: () => void;
  forceShow?: boolean;
}

export const WebsiteIntroAnimation: React.FC<WebsiteIntroAnimationProps> = ({
  onComplete,
  forceShow = false,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [hasAudioFailed, setHasAudioFailed] = useState<boolean>(false);
  const [currentPhaseBg, setCurrentPhaseBg] = useState<string>('#0b3be8'); // #0b3be8 or #ffffff
  const [useFallbackAnimation, setUseFallbackAnimation] = useState<boolean>(false);
  const [fallbackStep, setFallbackStep] = useState<number>(1);
  const [typewriterText, setTypewriterText] = useState<string>('ONE HUB,');

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Complete intro with smooth exit animation
  const handleFinish = useCallback(() => {
    setIsFadingOut(true);
    try {
      sessionStorage.setItem('ft_intro_shown', 'true');
    } catch {}
    setTimeout(() => {
      setIsPlaying(false);
      onComplete();
    }, 650);
  }, [onComplete]);

  // Audio Playback Handling with Autoplay Policy Fallback
  const tryStartAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.muted = false;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.info('Autoplay with audio restricted by browser. User can unmute:', err);
          setIsMuted(true);
          setHasAudioFailed(true);
          if (videoRef.current) {
            videoRef.current.muted = true;
          }
        });
      }
    }
  }, []);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(() => {});
      }
      if (videoRef.current) {
        videoRef.current.muted = false;
      }
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.muted = true;
      if (videoRef.current) videoRef.current.muted = true;
    }
  };

  // Video time updates to sync ambient background colors with exact video frames
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    // 0.0s - 2.2s: Electric Blue (#0b3be8)
    // 2.2s - 3.2s: White (#ffffff)
    // 3.2s - 6.5s: Electric Blue (#0b3be8)
    // 6.5s - 9.3s: White (#ffffff)
    if (t >= 6.5) {
      setCurrentPhaseBg('#ffffff');
    } else if (t >= 3.2) {
      setCurrentPhaseBg('#0b3be8');
    } else if (t >= 2.2) {
      setCurrentPhaseBg('#ffffff');
    } else {
      setCurrentPhaseBg('#0b3be8');
    }

    // Trigger smooth exit slightly before total end (at ~8.8s) for maximum fluid transition
    if (t >= 8.8 && !isFadingOut) {
      handleFinish();
    }
  };

  useEffect(() => {
    // If not forced and already shown in this session, skip intro
    if (!forceShow) {
      try {
        if (sessionStorage.getItem('ft_intro_shown') === 'true') {
          onComplete();
          setIsPlaying(false);
          return;
        }
      } catch {}
    }

    // Defensive safety timeout: never block website indefinitely if video stalls
    safetyTimeoutRef.current = setTimeout(() => {
      if (!isFadingOut) {
        handleFinish();
      }
    }, 10500);

    // Initial audio attempt
    tryStartAudio();

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      try {
        document.body.style.overflow = '';
        document.body.style.backgroundColor = '#f7f2ea';
      } catch {}
    };
  }, [forceShow, handleFinish, onComplete, tryStartAudio, isFadingOut]);

  // Video Error Fallback: Run pure synchronized CSS/SVG sequence if video fails
  const handleVideoError = () => {
    console.warn('Video failed to load or decode. Running high-fidelity CSS animation sequence.');
    setUseFallbackAnimation(true);
  };

  // Fallback CSS sequence timing
  useEffect(() => {
    if (!useFallbackAnimation) return;

    // Step 1: 0 - 2.2s (Typewriter & spinning white capsule on blue)
    setCurrentPhaseBg('#0b3be8');
    setFallbackStep(1);

    const t1 = setTimeout(() => {
      setTypewriterText('ONE HUB, ENDLESS');
    }, 700);

    const t2 = setTimeout(() => {
      setTypewriterText('ONE HUB, ENDLESS DIGITAL');
    }, 1400);

    // Step 2: 2.2s - 3.2s (White flash, spinning blue capsule)
    const t3 = setTimeout(() => {
      setCurrentPhaseBg('#ffffff');
      setFallbackStep(2);
    }, 2200);

    // Step 3: 3.2s - 6.5s (Blue card zoom, comet swoosh, letter formation)
    const t4 = setTimeout(() => {
      setCurrentPhaseBg('#0b3be8');
      setFallbackStep(3);
    }, 3200);

    // Step 4: 6.5s - 8.8s (Circle wipe to white, final logo)
    const t5 = setTimeout(() => {
      setCurrentPhaseBg('#ffffff');
      setFallbackStep(4);
    }, 6500);

    // Step 5: Finish
    const t6 = setTimeout(() => {
      handleFinish();
    }, 8800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [useFallbackAnimation, handleFinish]);

  if (!isPlaying) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        backgroundColor: currentPhaseBg,
        transition: 'background-color 0.28s ease, opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), transform 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.04)' : 'scale(1)',
        pointerEvents: isFadingOut ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      className="select-none font-['Outfit',sans-serif]"
    >
      {/* Synchronized Audio Track from reference video */}
      <audio
        ref={audioRef}
        preload="auto"
        onEnded={handleFinish}
      >
        <source src="./assets/intro_audio.mp3" type="audio/mp3" />
        <source src="/assets/intro_audio.mp3" type="audio/mp3" />
        <source src="assets/intro_audio.mp3" type="audio/mp3" />
      </audio>

      {/* Primary Video Element */}
      {!useFallbackAnimation ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleFinish}
          onError={handleVideoError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            maxHeight: '100vh',
            maxWidth: '100vw',
          }}
        >
          <source src="./assets/intro_animation.mp4" type="video/mp4" />
          <source src="/assets/intro_animation.mp4" type="video/mp4" />
          <source src="assets/intro_animation.mp4" type="video/mp4" />
        </video>
      ) : (
        /* Pixel-perfect Pure CSS/SVG Fallback Replica */
        <div className="relative w-full h-full flex flex-col items-center justify-center p-6 text-center">
          {fallbackStep === 1 && (
            <div className="flex flex-col items-center justify-center gap-8 animate-fadeIn">
              <div
                style={{
                  width: '32px',
                  height: '18px',
                  borderRadius: '999px',
                  backgroundColor: '#ffffff',
                  transform: 'rotate(-35deg)',
                  boxShadow: '0 4px 16px rgba(255, 255, 255, 0.35)',
                  animation: 'ftCapsuleSpin 1.4s ease-in-out infinite alternate',
                }}
              />
              <div className="text-white font-extrabold text-xl sm:text-2xl tracking-[0.16em] uppercase">
                {typewriterText}
              </div>
            </div>
          )}

          {fallbackStep === 2 && (
            <div className="flex flex-col items-center justify-center gap-8 animate-fadeIn">
              <div
                style={{
                  width: '32px',
                  height: '18px',
                  borderRadius: '999px',
                  backgroundColor: '#0b3be8',
                  transform: 'rotate(45deg)',
                  boxShadow: '0 4px 16px rgba(11, 59, 232, 0.25)',
                  animation: 'ftCapsuleSpin 1.4s ease-in-out infinite alternate',
                }}
              />
              <div className="text-[#8898c8] font-extrabold text-sm sm:text-base tracking-[0.2em] uppercase">
                ONE HUB ENDLESS DIGITAL SOLUTIONS
              </div>
            </div>
          )}

          {fallbackStep === 3 && (
            <div className="flex flex-col items-center justify-center gap-6 animate-scaleIn">
              <div className="relative flex items-center justify-center">
                <svg className="w-16 h-16 animate-spin" viewBox="0 0 100 100">
                  <path
                    d="M 50,15 A 35,35 0 0,1 85,50"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="text-white font-black text-3xl sm:text-4xl tracking-tight flex items-center gap-1.5">
                <span>ma</span>
                <span className="text-[#ff6b00]">x</span>
                <span>terz</span>
              </div>
            </div>
          )}

          {fallbackStep === 4 && (
            <div className="flex items-center justify-center gap-3 animate-scaleIn">
              {/* Circular Emblem with m and orange dot */}
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: '#0b3be8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  boxShadow: '0 6px 20px rgba(11, 59, 232, 0.25)',
                }}
              >
                <span className="text-white font-bold text-2xl" style={{ transform: 'translateY(-2px)' }}>
                  m
                </span>
                <span
                  style={{
                    position: 'absolute',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#ff5d15',
                    bottom: '14px',
                    right: '13px',
                  }}
                />
              </div>

              {/* Wordmark */}
              <div className="text-[#0b3be8] font-black text-3xl sm:text-4xl tracking-tight flex items-center">
                <span>ma</span>
                <span className="text-[#ff5d15]">x</span>
                <span>terz</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Control Badges: Sound Toggle & Skip */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Unmute/Mute button */}
        <button
          type="button"
          onClick={toggleSound}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer backdrop-blur-md"
          style={{
            backgroundColor: currentPhaseBg === '#0b3be8' ? 'rgba(255, 255, 255, 0.18)' : 'rgba(11, 59, 232, 0.08)',
            color: currentPhaseBg === '#0b3be8' ? '#ffffff' : '#0b3be8',
            border: currentPhaseBg === '#0b3be8' ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid rgba(11, 59, 232, 0.25)',
          }}
          title={isMuted ? 'Turn Sound On' : 'Mute Sound'}
        >
          {isMuted ? (
            <>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              </svg>
              <span>{hasAudioFailed ? 'Sound Off' : 'Muted'}</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              </svg>
              <span>Sound On</span>
            </>
          )}
        </button>

        {/* Skip Button */}
        <button
          type="button"
          onClick={handleFinish}
          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-md cursor-pointer backdrop-blur-md"
          style={{
            backgroundColor: currentPhaseBg === '#0b3be8' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(11, 59, 232, 0.12)',
            color: currentPhaseBg === '#0b3be8' ? '#ffffff' : '#0b3be8',
            border: currentPhaseBg === '#0b3be8' ? '1px solid rgba(255, 255, 255, 0.4)' : '1px solid rgba(11, 59, 232, 0.3)',
          }}
        >
          <span>Skip</span>
          <span>➔</span>
        </button>
      </div>

      <style>{`
        @keyframes ftCapsuleSpin {
          0% { transform: rotate(-35deg) scale(0.9); }
          50% { transform: rotate(15deg) scale(1.1); }
          100% { transform: rotate(75deg) scale(0.9); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .animate-scaleIn {
          animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>
    </div>
  );
};
