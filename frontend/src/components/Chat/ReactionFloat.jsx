// ============================================================
//  ReactionFloat.jsx — Плавающая реакция (эмодзи)
//
//  Появляется снизу, плывёт вверх и исчезает.
//  spawnX (0..1) задаёт горизонтальную позицию — эффект разброса.
// ============================================================

import { useEffect, useRef } from 'react';

export default function ReactionFloat({ reaction }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    // Запускаем CSS-анимацию сразу после монтирования
    ref.current.style.animationPlayState = 'running';
  }, []);

  // Конвертируем spawnX (0..1) в процент ширины контейнера
  const leftPercent = Math.round(reaction.spawnX * 80) + 10; // 10%..90%

  return (
    <div
      ref={ref}
      className="absolute bottom-4 select-none pointer-events-none text-3xl"
      style={{
        left: `${leftPercent}%`,
        animationName: 'floatUp',
        animationDuration: '2.5s',
        animationTimingFunction: 'ease-out',
        animationFillMode: 'forwards',
        animationPlayState: 'paused', // включается в useEffect
        willChange: 'transform, opacity',
        // Каждая реакция чуть разного размера — живее смотрится
        fontSize: `${1.8 + Math.random() * 0.8}rem`
      }}
    >
      {reaction.emoji}
    </div>
  );
}
