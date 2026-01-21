"use client";

import React, { useState, useEffect, useMemo } from 'react';

/**
 * Alice Visualizer - Animated ripple effect for voice feedback
 * Adapted from Lexi project, branded for Alice.
 */

interface VisualizerProps {
  audioData?: number[];
  isListening?: boolean;
  intensity?: number;
  width?: number;
  height?: number;
}

interface Ripple {
  id: number;
  born: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ 
  audioData = [], 
  isListening = false, 
  intensity = 0, 
  width = 600, 
  height = 400 
}) => {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rippleId, setRippleId] = useState(0);

  // Calculate audio intensity from audioData array
  const calculatedIntensity = useMemo(() => {
    if (!audioData || audioData.length === 0) return intensity;
    const sum = audioData.reduce((a, b) => a + b, 0);
    return Math.min(1, sum / (audioData.length * 128));
  }, [audioData, intensity]);

  const baseSize = Math.min(width, height) * 0.6;

  // Spawn ripples at intervals
  useEffect(() => {
    // Interval: slower when idle (5s), faster when listening (2s)
    const intervalTime = isListening ? 2000 : 5000;

    const interval = setInterval(() => {
      setRippleId(prev => prev + 1);
      setRipples(prev => [...prev, { id: rippleId, born: Date.now() }]);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [isListening, rippleId]);

  // Cleanup old ripples
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setRipples(prev => prev.filter(r => now - r.born < 6000));
    }, 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Audio-triggered ripples
  useEffect(() => {
    if (calculatedIntensity > 0.3) {
      setRippleId(prev => prev + 1);
      setRipples(prev => [...prev, { id: rippleId, born: Date.now() }]);
    }
  }, [calculatedIntensity > 0.3]);

  return (
    <div className="relative flex items-center justify-center" style={{ width, height }}>
      {/* Background ambient glow */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          width: baseSize * 0.4,
          height: baseSize * 0.4,
          background: `radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, transparent 70%)`,
          filter: 'blur(30px)',
        }}
      />

      {/* Ripple container */}
      <div className="absolute" style={{ width: baseSize, height: baseSize }}>
        {ripples.map((ripple) => (
          <div
            key={ripple.id}
            className="absolute inset-0 rounded-full border-2 border-cyan-400"
            style={{
              animation: 'ripple 6s ease-out forwards',
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Central Logo/Text */}
      <div
        className={`absolute text-cyan-100 font-bold tracking-widest drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] z-10 ${
          isListening ? 'animate-pulse' : ''
        }`}
        style={{
          fontSize: Math.min(width, height) * 0.06,
        }}
      >
        ALICE
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes ripple {
          0% {
            transform: scale(0.1);
            opacity: 0.8;
            border-width: 3px;
          }
          50% {
            opacity: 0.4;
            border-width: 2px;
          }
          100% {
            transform: scale(1);
            opacity: 0;
            border-width: 1px;
          }
        }
      `}</style>
    </div>
  );
};

export default Visualizer;
