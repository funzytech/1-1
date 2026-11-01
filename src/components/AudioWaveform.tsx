/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';

interface AudioWaveformProps {
  level: number; // 0 to 1 normalized audio amplitude
  barsCount?: number;
  isActive?: boolean;
  isPaused?: boolean;
  color?: string;
  className?: string;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  level,
  barsCount = 5,
  isActive = false,
  isPaused = false,
  color = '#261508',
  className = '',
}) => {
  // Deterministic heights based on real input level with natural harmonic offsets
  const bars = useMemo(() => {
    return Array.from({ length: barsCount }).map((_, index) => {
      if (!isActive) return 3;
      if (isPaused) return 4;
      // Stagger multipliers so center bars react with slightly higher amplitude
      const centerFactor = 1 - Math.abs(index - (barsCount - 1) / 2) / (barsCount / 1.5);
      const baseHeight = 4;
      const dynamicHeight = Math.max(3, Math.min(22, baseHeight + level * 20 * centerFactor));
      return dynamicHeight;
    });
  }, [level, barsCount, isActive, isPaused]);

  return (
    <div
      className={`inline-flex items-center justify-center gap-[2.5px] h-6 px-1 select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[2.5px] rounded-full transition-all duration-100 ease-out"
          style={{
            height: `${h}px`,
            backgroundColor: isPaused ? '#a68d6a' : color,
            opacity: isActive ? (isPaused ? 0.6 : 0.95) : 0.45,
          }}
        />
      ))}
    </div>
  );
};
