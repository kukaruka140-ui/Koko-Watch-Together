// VideoPlayer.jsx — нативный HTML5 плеер (без Video.js)
import { useRef, useEffect, useCallback } from 'react';
import useRoomStore from '../../store/useRoomStore';
import ReactionFloat from '../Chat/ReactionFloat';
import { formatTime } from '../../lib/syncUtils';
import './VideoPlayer.css';

export default function VideoPlayer({ onPlay, onPause, onSeek, controlsRef }) {
  const videoRef = useRef(null);
  const { videoUrl, isPlaying, role, reactions } = useRoomStore();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

  const buildSrc = (url) => {
    if (!url) return '';
    if (!url.includes('drive.google.com') && !url.includes('googleapis.com')) {
      return url;
    }
    const match = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    const fileId = match?.[1] || url;
    return `${BACKEND_URL}/api/stream?fileId=${fileId}`;
  };

  const src = buildSrc(videoUrl);

  // Пробрасываем методы управления наружу
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
      seek: (t) => { if (videoRef.current) videoRef.current.currentTime = t; },
      getCurrentTime: () => videoRef.current?.currentTime || 0
    };
  }, [controlsRef]);

  // Обработчики событий плеера
  const handlePlay = useCallback(() => {
    if (role !== 'host') return;
    onPlay?.(videoRef.current?.currentTime || 0);
  }, [role, onPlay]);

  const handlePause = useCallback(() => {
    if (role !== 'host') return;
    onPause?.(videoRef.current?.currentTime || 0);
  }, [role, onPause]);

  const handleSeeked = useCallback(() => {
    if (role !== 'host') return;
    onSeek?.(videoRef.current?.currentTime || 0);
  }, [role, onSeek]);

  return (
    <div className="video-player-wrapper" style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>

      {/* Нативный HTML5 плеер */}
      <video
        ref={videoRef}
        src={src}
        controls={role === 'host'}
        controlsList="nodownload"
        playsInline
        preload="auto"
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeked={handleSeeked}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Для гостя — оверлей чтобы он не мог тыкать на контролы */}
      {role === 'guest' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
            cursor: 'default'
          }}
        />
      )}

      {/* Бейдж LIVE */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        background: 'rgba(255,0,0,0.8)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 20,
        pointerEvents: 'none',
        zIndex: 20
      }}>
        🔴 LIVE
      </div>

      {/* Реакции поверх видео */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 30 }}>
        {reactions.map(r => <ReactionFloat key={r.id} reaction={r} />)}
      </div>

      {/* Заглушка если нет видео */}
      {!videoUrl && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0A0A0F', color: '#6B6B8A'
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2A2A3E" strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14"/>
            <rect x="3" y="6" width="12" height="12" rx="2"/>
          </svg>
          <p style={{ fontSize: 14 }}>Видео не загружено</p>
        </div>
      )}
    </div>
  );
}