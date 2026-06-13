import { useState, useCallback } from 'react';
import VideoPlayer from '../VideoPlayer/VideoPlayer';
import ChatPanel from '../Chat/ChatPanel';
import useRoomStore from '../../store/useRoomStore';

export default function RoomScreen({ syncMethods, onLeave, videoControlsRef }) {
  const {
    roomId, role, hostName, guestName,
    isPlaying, peerConnected, rtt, scores
  } = useRoomStore();

  const { sendPlaybackAction, sendMessage, sendReaction } = syncMethods;

  const [copied, setCopied] = useState(false);
  const [showScores, setShowScores] = useState(false);

  const handlePlay  = useCallback((t) => sendPlaybackAction('play',  t), [sendPlaybackAction]);
  const handlePause = useCallback((t) => sendPlaybackAction('pause', t), [sendPlaybackAction]);
  const handleSeek  = useCallback((t) => sendPlaybackAction('seek',  t), [sendPlaybackAction]);

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    } catch {
      window.Telegram?.WebApp?.showAlert?.(`Код кімнати: ${roomId}`);
    }
  };

  const myScore = scores.find(s => s.role === role);

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>

      {/* Топ-бар */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0" style={{
        background: '#12121A', borderBottom: '1px solid #2A2A3E',
        paddingTop: 'calc(0.5rem + env(safe-area-inset-top))'
      }}>
        <button onClick={onLeave} className="flex items-center gap-1.5 text-rave-muted hover:text-rave-text transition-colors text-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Вийти
        </button>

        <button onClick={copyRoomId} className="flex items-center gap-2 transition-all active:scale-95">
          <span className="text-xs font-mono font-semibold tracking-widest px-2.5 py-1 rounded-lg" style={{
            background: '#1A1A26', border: '1px solid #2A2A3E',
            color: '#7C5CFC', letterSpacing: '0.15em'
          }}>{roomId}</span>
          {copied
            ? <span className="text-xs text-green-400">✓ Скопійовано</span>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B6B8A" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
          }
        </button>

        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${peerConnected ? 'bg-green-400' : 'bg-rave-muted animate-pulse'}`} />
          <span className="text-xs text-rave-muted">
            {peerConnected
              ? (role === 'host' ? guestName || 'Гість' : hostName || 'Хост')
              : 'Очікування...'}
          </span>
          {rtt > 0 && (
            <span className="text-xs" style={{ color: rtt < 100 ? '#4ade80' : rtt < 300 ? '#facc15' : '#f87171' }}>
              {rtt}мс
            </span>
          )}
        </div>
      </div>

      {/* Відео */}
      <div className="flex-shrink-0" style={{ height: 'min(56vw, 240px)', background: '#000' }}>
        <VideoPlayer
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          controlsRef={videoControlsRef}
        />
      </div>

      {/* Статус-бар */}
      <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0" style={{
        background: '#12121A', borderBottom: '1px solid #2A2A3E'
      }}>
        <div className="flex items-center gap-1.5">
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
            background: role === 'host' ? 'rgba(255,107,157,0.15)' : 'rgba(86,207,225,0.15)',
            color: role === 'host' ? '#FF6B9D' : '#56CFE1'
          }}>
            {role === 'host' ? '👑 Ведучий' : '👁 Глядач'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Бали */}
          {myScore && (
            <button
              onClick={() => setShowScores(v => !v)}
              className="flex items-center gap-1 text-xs"
              style={{ color: '#7C5CFC' }}
            >
              ⭐ {myScore.points} балів
            </button>
          )}

          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-rave-muted'}`} />
            <span className="text-xs text-rave-muted">{isPlaying ? 'Грає' : 'Пауза'}</span>
          </div>
        </div>
      </div>

      {/* Лідерборд (розкривається по кліку на бали) */}
      {showScores && scores.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3" style={{
          background: '#12121A', borderBottom: '1px solid #2A2A3E'
        }}>
          <p className="text-xs text-rave-muted mb-2">🏆 Бали за перегляд</p>
          {scores.map((s, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1">
              <span style={{ color: s.role === 'host' ? '#FF6B9D' : '#56CFE1' }}>
                {s.role === 'host' ? '👑' : '👁'} {s.name}
              </span>
              <span style={{ color: '#7C5CFC', fontWeight: 600 }}>⭐ {s.points}</span>
            </div>
          ))}
          <p className="text-xs text-rave-muted mt-1 opacity-60">+1 бал кожні 60с перегляду</p>
        </div>
      )}

      {/* Чат */}
      <div className="flex-1 min-h-0">
        <ChatPanel onSendMessage={sendMessage} onSendReaction={sendReaction} />
      </div>
    </div>
  );
}
