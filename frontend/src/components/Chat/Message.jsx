// ============================================================
//  Message.jsx — Одно сообщение в чате
//  Поддерживает: reply-цитату, роль отправителя, свайп для ответа
// ============================================================

import { useRef, useState } from 'react';

/**
 * @param {object}   message    — объект сообщения
 * @param {boolean}  isOwn     — своё ли сообщение (для выравнивания)
 * @param {function} onReply   — callback(message) при нажатии "Ответить"
 */
export default function Message({ message, isOwn, onReply }) {
  const [showActions, setShowActions] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const roleColor = message.role === 'host' ? '#FF6B9D' : '#56CFE1';

  // Форматируем время HH:MM
  const timeStr = new Date(message.timestamp).toLocaleTimeString('ru', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // ── Свайп вправо → ответить ─────────────────────────────
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Горизонтальный свайп >40px без вертикального смещения
    if (dx > 40 && dy < 20) {
      onReply?.(message);
      // Haptic feedback если доступен
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    }
    touchStartX.current = null;
  };

  return (
    <div
      className={`flex flex-col mb-1 animate-slide-up ${isOwn ? 'items-end' : 'items-start'}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onLongPress={() => setShowActions(true)}
    >
      {/* Имя отправителя (показываем только для чужих сообщений) */}
      {!isOwn && (
        <span className="text-xs font-medium mb-0.5 px-1" style={{ color: roleColor }}>
          {message.userName}
        </span>
      )}

      <div className="relative group max-w-[80%]">
        {/* Бабл сообщения */}
        <div
          className={`
            px-3 py-2 rounded-2xl text-sm leading-relaxed break-words
            ${isOwn
              ? 'rounded-tr-sm bg-rave-accent text-white'
              : 'rounded-tl-sm text-rave-text'
            }
          `}
          style={{
            background: isOwn
              ? 'linear-gradient(135deg, #7C5CFC, #5A3FD4)'
              : '#1A1A26',
            border: isOwn ? 'none' : '1px solid #2A2A3E'
          }}
        >
          {/* Reply-цитата внутри бабла */}
          {message.replyTo && (
            <div
              className="mb-2 pl-2 py-1 rounded text-xs opacity-70 line-clamp-2"
              style={{
                borderLeft: `2px solid ${isOwn ? 'rgba(255,255,255,0.5)' : roleColor}`,
                background: isOwn ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.2)'
              }}
            >
              <span className="font-medium block" style={{ color: isOwn ? '#fff' : roleColor }}>
                {message.replyTo.userName}
              </span>
              <span className="text-xs opacity-80">{message.replyTo.text}</span>
            </div>
          )}

          {/* Текст сообщения */}
          <span>{message.text}</span>

          {/* Время */}
          <span className={`text-xs ml-2 opacity-50 ${isOwn ? 'text-white' : 'text-rave-muted'}`}>
            {timeStr}
          </span>
        </div>

        {/* Кнопка "Ответить" при hover/тапе */}
        <button
          onClick={() => onReply?.(message)}
          className={`
            absolute top-1/2 -translate-y-1/2
            ${isOwn ? '-left-8' : '-right-8'}
            opacity-0 group-hover:opacity-100
            transition-opacity duration-150
            text-rave-muted hover:text-rave-accent
            p-1 rounded-full
          `}
          aria-label="Ответить"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9 17 4 12 9 7"/>
            <path d="M20 18v-2a4 4 0 00-4-4H4"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
