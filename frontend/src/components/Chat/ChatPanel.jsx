// ============================================================
//  ChatPanel.jsx — Панель чата
//  Содержит: список сообщений, поле ввода, reply-превью,
//            панель быстрых реакций
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react';
import useRoomStore from '../../store/useRoomStore';
import Message from './Message';

// Эмодзи для быстрых реакций
const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '😮', '😢', '🎉', '💯', '🤩', '😍'];

/**
 * @param {function} onSendMessage  — callback(text, replyTo)
 * @param {function} onSendReaction — callback(emoji)
 */
export default function ChatPanel({ onSendMessage, onSendReaction }) {
  const { messages, role } = useRoomStore();

  const [inputText, setInputText]   = useState('');
  const [replyTo, setReplyTo]       = useState(null);   // объект сообщения для ответа
  const [showReactions, setShowReactions] = useState(false);

  const listRef  = useRef(null);
  const inputRef = useRef(null);

  // Авто-скролл вниз при новых сообщениях
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Отправка сообщения
  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;

    // Формируем объект replyTo для отправки (только нужные поля)
    const replyPayload = replyTo
      ? { id: replyTo.id, text: replyTo.text, userName: replyTo.userName }
      : null;

    onSendMessage?.(text, replyPayload);
    setInputText('');
    setReplyTo(null);
    inputRef.current?.focus();
  }, [inputText, replyTo, onSendMessage]);

  // Enter для отправки (без Shift)
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Реакция
  const handleReaction = (emoji) => {
    onSendReaction?.(emoji);
    setShowReactions(false);
    // Haptic feedback
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  };

  // Определяем "своё" ли сообщение по role (упрощённо)
  // В реальном приложении сравниваем по socket.id
  const isOwnMessage = (msg) => msg.role === role;

  return (
    <div className="flex flex-col h-full" style={{ background: '#0A0A0F' }}>

      {/* ── Список сообщений ─────────────────────────────── */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5"
        style={{ overscrollBehavior: 'contain' }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                 stroke="#6B6B8A" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            <p className="text-rave-muted text-sm">Начните общение...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <Message
              key={msg.id}
              message={msg}
              isOwn={isOwnMessage(msg)}
              onReply={setReplyTo}
            />
          ))
        )}
      </div>

      {/* ── Панель быстрых реакций ───────────────────────── */}
      {showReactions && (
        <div
          className="px-3 py-2 flex gap-2 overflow-x-auto animate-slide-up"
          style={{ background: '#12121A', borderTop: '1px solid #2A2A3E' }}
        >
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="text-2xl flex-shrink-0 hover:scale-125 active:scale-110 transition-transform duration-100"
              aria-label={`Реакция ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* ── Reply-превью ─────────────────────────────────── */}
      {replyTo && (
        <div
          className="flex items-center gap-2 px-3 py-2 animate-slide-up"
          style={{ background: '#12121A', borderTop: '1px solid #2A2A3E' }}
        >
          {/* Вертикальная линия акцента */}
          <div className="w-0.5 self-stretch rounded-full"
               style={{ background: replyTo.role === 'host' ? '#FF6B9D' : '#56CFE1' }} />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium"
               style={{ color: replyTo.role === 'host' ? '#FF6B9D' : '#56CFE1' }}>
              {replyTo.userName}
            </p>
            <p className="text-xs text-rave-muted truncate">{replyTo.text}</p>
          </div>

          {/* Кнопка отмены */}
          <button
            onClick={() => setReplyTo(null)}
            className="text-rave-muted hover:text-rave-text transition-colors p-1"
            aria-label="Отменить ответ"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Поле ввода ───────────────────────────────────── */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          background:  '#12121A',
          borderTop:   '1px solid #2A2A3E',
          paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))'
        }}
      >
        {/* Кнопка реакций */}
        <button
          onClick={() => setShowReactions((v) => !v)}
          className={`flex-shrink-0 p-2 rounded-full transition-colors ${
            showReactions
              ? 'text-rave-accent bg-rave-glow'
              : 'text-rave-muted hover:text-rave-text'
          }`}
          aria-label="Реакции"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
            <line x1="9" y1="9" x2="9.01" y2="9"/>
            <line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </button>

        {/* Текстовое поле */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение..."
          maxLength={500}
          className="flex-1 bg-transparent text-rave-text text-sm outline-none placeholder-rave-muted"
          style={{ caretColor: '#7C5CFC' }}
        />

        {/* Кнопка отправки */}
        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          className={`
            flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
            transition-all duration-200
            ${inputText.trim()
              ? 'bg-rave-accent text-white hover:bg-rave-accent-dim active:scale-95'
              : 'bg-rave-elevated text-rave-muted'
            }
          `}
          aria-label="Отправить"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
