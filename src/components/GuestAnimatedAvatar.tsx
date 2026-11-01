import React, { useState } from 'react';
import guestAvatarBundled from '../assets/guest_avatar.jpg';

const PUBLIC_FALLBACK = '/assets/aistudio/image_search_1793255271014_a6aeee98.jpg';

export const GuestAnimatedAvatar: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [currentSrc, setCurrentSrc] = useState<string>(guestAvatarBundled || PUBLIC_FALLBACK);
  const [hasFallbackTriggered, setHasFallbackTriggered] = useState<boolean>(false);

  const handleImageError = () => {
    if (!hasFallbackTriggered) {
      setHasFallbackTriggered(true);
      setCurrentSrc(PUBLIC_FALLBACK);
    }
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-full select-none pointer-events-none bg-[#3b2d20] ${className}`}
      style={{
        // Subtle AI-assisted color grading, studio lighting and contrast adjustments
        filter: 'contrast(1.06) saturate(1.08) brightness(1.02)',
      }}
    >
      {/* 
        Slow, natural head movement and gentle breathing micro-sway
      */}
      <div className="relative w-full h-full animate-guest-head-sway">
        {/* Base uploaded image */}
        {/* Base uploaded image with high-DPI srcset and sizes strategy */}
        <img
          src={currentSrc}
          srcSet={`${currentSrc} 1x, ${currentSrc} 2x, ${currentSrc} 3x`}
          sizes="(max-width: 640px) 44px, 48px"
          onError={handleImageError}
          alt="Guest Profile Avatar"
          loading="eager"
          decoding="sync"
          fetchPriority="high"
          className="w-full h-full object-cover scale-[1.08] pointer-events-none"
        />

        {/* 
          Hair micro-sway highlight layer (subtle natural movement on hair tufts)
        */}
        <div 
          className="absolute inset-0 pointer-events-none animate-guest-hair-sway"
          style={{
            background: 'radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.12) 0%, transparent 45%)',
            mixBlendMode: 'overlay',
          }}
          aria-hidden="true"
        />

        {/* 
          Occasional realistic eye blinking:
          Precise anatomical placement over vector eye pupil coordinates
        */}
        {/* Left eye eyelid (viewer's left) */}
        <div
          className="absolute rounded-full pointer-events-none animate-guest-blink"
          style={{
            top: '39.8%',
            left: '36.5%',
            width: '9.4%',
            height: '6.8%',
            backgroundColor: '#f3c9a6',
            boxShadow: 'inset 0 1px 1px rgba(115, 68, 35, 0.35)',
            transformOrigin: 'top center',
          }}
          aria-hidden="true"
        />

        {/* Right eye eyelid (viewer's right) */}
        <div
          className="absolute rounded-full pointer-events-none animate-guest-blink"
          style={{
            top: '39.8%',
            left: '54.5%',
            width: '9.4%',
            height: '6.8%',
            backgroundColor: '#f3c9a6',
            boxShadow: 'inset 0 1px 1px rgba(115, 68, 35, 0.35)',
            transformOrigin: 'top center',
          }}
          aria-hidden="true"
        />
      </div>

      {/* Subtle warm rim light and specular ambient glow overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow: 'inset 0 1.5px 2px rgba(255, 255, 255, 0.7), inset 0 -2px 3px rgba(36, 20, 7, 0.25)',
        }}
        aria-hidden="true"
      />
    </div>
  );
};
