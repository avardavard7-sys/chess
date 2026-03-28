'use client';

import { useEffect, useState } from 'react';

interface FloatingItem {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  animDuration: number;
  animDelay: number;
  animType: 'float-up' | 'float-sideways' | 'spin-slow';
}

const kidsEmojis = ['🦕', '🦖', '⭐', '🌟', '☁️', '🌈', '☀️', '🌸', '🌺', '🎈', '🦋', '🐝', '🌻', '💫', '🎀'];

function generateItems(count: number): FloatingItem[] {
  const animTypes: FloatingItem['animType'][] = ['float-up', 'float-sideways', 'spin-slow'];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    emoji: kidsEmojis[Math.floor(Math.random() * kidsEmojis.length)],
    x: Math.random() * 95,
    y: Math.random() * 95,
    size: 24 + Math.random() * 32,
    animDuration: 3 + Math.random() * 5,
    animDelay: Math.random() * 4,
    animType: animTypes[Math.floor(Math.random() * animTypes.length)],
  }));
}

export default function KidsBackground() {
  const [items, setItems] = useState<FloatingItem[]>([]);

  useEffect(() => {
    setItems(generateItems(22));
  }, []);

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      style={{
        background: 'linear-gradient(135deg, #fdf2f8 0%, #ede9fe 30%, #dbeafe 60%, #dcfce7 100%)',
      }}
    >
      {/* Pastel gradient blobs */}
      <div
        className="absolute top-[-10%] left-[-5%] w-96 h-96 rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, #fbcfe8, transparent)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-5%] w-96 h-96 rounded-full opacity-40"
        style={{
          background: 'radial-gradient(circle, #bfdbfe, transparent)',
          filter: 'blur(60px)',
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, #bbf7d0, transparent)',
          filter: 'blur(80px)',
        }}
      />

      {/* Floating items */}
      {items.map((item) => (
        <div
          key={item.id}
          className={`absolute select-none ${item.animType}`}
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            fontSize: item.size,
            animationDuration: `${item.animDuration}s`,
            animationDelay: `${item.animDelay}s`,
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}
        >
          {item.emoji}
        </div>
      ))}

      {/* Rainbow arcs decoration */}
      <svg
        className="absolute top-4 right-8 opacity-30"
        width="120"
        height="80"
        viewBox="0 0 120 80"
      >
        {[
          { r: 60, color: '#ff6b6b' },
          { r: 50, color: '#ffd93d' },
          { r: 40, color: '#6bcb77' },
          { r: 30, color: '#4d96ff' },
          { r: 20, color: '#c77dff' },
        ].map((arc, i) => (
          <path
            key={i}
            d={`M${60 - arc.r},60 A${arc.r},${arc.r} 0 0,1 ${60 + arc.r},60`}
            fill="none"
            stroke={arc.color}
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
      </svg>

      <svg
        className="absolute bottom-8 left-8 opacity-25"
        width="100"
        height="70"
        viewBox="0 0 100 70"
      >
        {[
          { r: 48, color: '#ff6b6b' },
          { r: 38, color: '#ffd93d' },
          { r: 28, color: '#6bcb77' },
          { r: 18, color: '#4d96ff' },
        ].map((arc, i) => (
          <path
            key={i}
            d={`M${50 - arc.r},55 A${arc.r},${arc.r} 0 0,1 ${50 + arc.r},55`}
            fill="none"
            stroke={arc.color}
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* Stars scattered */}
      {[...Array(8)].map((_, i) => (
        <div
          key={`star-${i}`}
          className="absolute sparkle text-yellow-400 select-none"
          style={{
            left: `${10 + i * 11}%`,
            top: `${8 + (i % 3) * 28}%`,
            fontSize: 12 + (i % 3) * 6,
            animationDelay: `${i * 0.3}s`,
          }}
        >
          ✦
        </div>
      ))}
    </div>
  );
}
