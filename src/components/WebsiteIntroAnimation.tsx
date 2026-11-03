import React, { useState, useEffect, useRef, useCallback } from 'react';

interface WebsiteIntroAnimationProps {
  onComplete: () => void;
  forceShow?: boolean;
}

export const WebsiteIntroAnimation: React.FC<WebsiteIntroAnimationProps> = ({
  onComplete,
}) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
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
        document.body.style.backgroundColor = '#d9c4a2';
      } catch {}
      onComplete();
    }, 650);
  }, [isFadingOut, onComplete]);

  // Video and Audio Playback Handling
  useEffect(() => {
    try {
      document.body.style.overflow = 'hidden';
      document.body.style.backgroundColor = '#143bf0';
    } catch {}

    const video = videoRef.current;
    if (video) {
      video.volume = 0.30; // Smoothed, reduced volume so it isn't too loud
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // If browser autoplay policy restricts sound, mute and play video smoothly
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }

    // Defensive safety timeout (4.5s) so intro never hangs if video stalls
    safetyTimeoutRef.current = setTimeout(() => {
      handleFinish();
    }, 4500);

    return () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      try {
        document.body.style.overflow = '';
        document.body.style.backgroundColor = '#d9c4a2';
      } catch {}
    };
  }, [handleFinish]);

  // Smooth exit slightly before absolute ending for fluid transition into homepage
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    // Video is ~3.18 seconds; start blur + fade-out transition at 2.85s
    if (t >= 2.85 && !isFadingOut) {
      handleFinish();
    }
  };

  if (!isPlaying) return null;

  return (
    <div
      onClick={handleFinish}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        backgroundColor: '#143bf0',
        transition: isFadingOut
          ? 'all 0.65s cubic-bezier(0.16, 1, 0.3, 1)'
          : 'background-color 0.28s ease',
        opacity: isFadingOut ? 0 : 1,
        transform: isFadingOut ? 'scale(1.04)' : 'scale(1)',
        filter: isFadingOut ? 'blur(16px)' : 'none',
        backdropFilter: isFadingOut ? 'blur(28px)' : 'none',
        pointerEvents: isFadingOut ? 'none' : 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      className="select-none cursor-pointer"
      title="Tap to skip"
    >
      {/* Uploaded Intro Video with Multi-Source Fallback */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleFinish}
        onError={handleFinish}
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
        <source src="./assets/aistudio/Alex_Gorbunov______Want_to_get_a_logo___animation_for_your_brand___Don_t_hesitate_to_send_me_a_message____________________________logoanimation...___I_720p__9a408c37.mp4" type="video/mp4" />
      </video>
    </div>
  );
};
