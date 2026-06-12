// ============================================================
//  RoomScreen.jsx — Главный экран просмотра
//
//  Layout: верхняя половина — видео, нижняя — чат.
//  Хост управляет воспроизведением, гость только смотрит.
//  Оба видят реакции и могут писать в чат.
// ============================================================

import { useState, useCallback } from 'react';
import VideoPlayer from '../VideoPlayer/VideoPlayer';
import ChatPanel from '../Chat/ChatPanel';
import useRoomStore from '../../store/useRoomStore';

/**
 * @param {object}   syncMethods — { sendPlaybackAction, sendMessage, sendReaction }
 * @param {function} onLeave     — callback при выходе из комнаты
 */
export default function RoomScreen({ syncMethods, onLeave, videoControlsRef }) {
  const {
    roomId, role, videoUrl,
    hostName, guestName,
    isPlaying, peerConnected, rtt
  } = useRoomStore();

  const { sendPlaybackAction, sendMessage, sendReaction } = syncMethods;

  // ref для передачи методов VideoPlayer'а в useSync — приходит из App.jsx

  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [copied, setCopied]             = useState(false);

  // ── Обработчики событий плеера (только для хоста) ─────────
  const handlePlay = useCallback((currentTime) => {
    sendPlaybackAction('play', currentTime);
  }, [sendPlaybackAction]);

  const handlePause = useCallback((currentTime) => {
    sendPlaybackAction('pause', currentTime);
  }, [sendPlaybackAction]);

  const handleSeek = useCallback((newTime) => {
    sendPlaybackAction('seek', newTime);
  }, [sendPlaybackAction]);

  // ── Копирование кода комнаты ───────────────────────────────
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {
      // Fallback для WebView без Clipboard API
      window.Telegram?.WebApp?.showAlert?.(`Код комнаты: ${roomId}`);
    }
  };

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: '#0A0A0F' }}
    >
      {/* ── Топ-бар ─────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{
          background: '#12121A',
          borderBottom: '1px solid #2A2A3E',
          paddingTop: 'calc(0.5rem + env(safe-area-inset-top))'
        }}
      >
        {/* Левая часть: кнопка выхода */}
        <button
          onClick={onLeave}
          className="flex items-center gap-1.5 text-rave-muted hover:text-rave-text
                     transition-colors text-sm"
          aria-label="Выйти из комнаты"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Выйти
        </button>

        {/* Центр: код комнаты */}
        <button
          onClick={copyRoomId}
          className="flex items-center gap-2 transition-all active:scale-95"
          aria-label="Скопировать код комнаты"
        >
          <span
            className="text-xs font-mono font-semibold tracking-widest px-2.5 py-1 rounded-lg"
            style={{
              background: '#1A1A26',
              border: '1px solid #2A2A3E',
              color: '#7C5CFC',
              letterSpacing: '0.15em'
            }}
          >
            {roomId}
          </span>
          {copied ? (
            <span className="text-xs text-green-400">✓ Скопировано</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="#6B6B8A" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          )}
        </button>

        {/* Правая часть: статус гостя */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              peerConnected ? 'bg-green-400' : 'bg-rave-muted animate-pulse'
            }`}
          />
          <span className="text-xs text-rave-muted">
            {peerConnected
              ? (role === 'host' ? guestName || 'Гость' : hostName || 'Хост')
              : 'Ожидание...'
            }
          </span>
          {rtt > 0 && (
            <span className="text-xs" style={{ color: rtt < 100 ? '#4ade80' : rtt < 300 ? '#facc15' : '#f87171' }}>
              {rtt}мс
            </span>
          )}
        </div>
      </div>

      {/* ── Видеоплеер (верхняя половина) ───────────────────── */}
      <div
        className="flex-shrink-0"
        style={{
          height: 'min(56vw, 240px)',   // соотношение 16:9 на мобильном
          background: '#000'
        }}
      >
        <VideoPlayer
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          controlsRef={videoControlsRef}
        />
      </div>

      {/* ── Разделитель с информацией ────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
        style={{ background: '#12121A', borderBottom: '1px solid #2A2A3E' }}
      >
        {/* Роль */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{
              background: role === 'host' ? 'rgba(255,107,157,0.15)' : 'rgba(86,207,225,0.15)',
              color:       role === 'host' ? '#FF6B9D' : '#56CFE1'
            }}
          >
            {role === 'host' ? '👑 Ведущий' : '👁 Зритель'}
          </span>
          {role === 'guest' && (
            <span className="text-xs text-rave-muted">
              Управление у хоста
            </span>
          )}
        </div>

        {/* Статус воспроизведения */}
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-rave-muted'}`}
          />
          <span className="text-xs text-rave-muted">
            {isPlaying ? 'Играет' : 'Пауза'}
          </span>
        </div>
      </div>

      {/* ── Чат (нижняя часть, занимает остаток экрана) ─────── */}
      <div className="flex-1 min-h-0">
        <ChatPanel
          onSendMessage={sendMessage}
          onSendReaction={sendReaction}
        />
      </div>
    </div>
  );
}
