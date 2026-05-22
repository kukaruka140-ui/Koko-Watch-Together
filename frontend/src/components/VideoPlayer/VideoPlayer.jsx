import { useRef, useEffect, useCallback, useState } from 'react';
import useRoomStore from '../../store/useRoomStore';
import ReactionFloat from '../Chat/ReactionFloat';
import './VideoPlayer.css';

export default function VideoPlayer({ onPlay, onPause, onSeek, controlsRef }) {
  const videoRef = useRef(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const pendingPlayRef = useRef(false);

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
      play: () => {
        if (!videoRef.current) return;
        const p = videoRef.current.play();
        if (p && p.catch) {
          p.catch(() => {
            // Браузер заблокировал autoplay — показываем кнопку
            pendingPlayRef.current = true;
            setNeedsGesture(true);
          });
        }
      },
      pause: () => {
        setNeedsGesture(false);
        videoRef.current?.pause();
      },
      seek: (t) => {
        if (videoRef.current) videoRef.current.currentTime = t;
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0
    };
  }, [controlsRef]);

  // Пользователь нажал кнопку — разрешаем воспроизведение
  const handleGesturePlay = () => {
    setNeedsGesture(false);
    videoRef.current?.play();
  };

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
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>

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

      {/* Блокируем контролы для гостя */}
      {role === 'guest' && !needsGesture && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} />
      )}

      {/* Кнопка для гостя когда браузер заблокировал autoplay */}
      {needsGesture && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)'
        }}>
          <button
            onClick={handleGesturePlay}
            style={{
              background: 'linear-gradient(135deg, #7C5CFC, #5A3FD4)',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              width: 72,
              height: 72,
              fontSize: 28,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              boxShadow: '0 0 24px rgba(124,92,252,0.5)'
            }}
          >
            ▶
          </button>
          <p style={{ color: '#fff', fontSize: 14, margin: 0, opacity: 0.8 }}>
            Нажми чтобы присоединиться
          </p>
        </div>
      )}

      {/* Бейдж LIVE */}
      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(255,0,0,0.8)', color: '#fff',
        fontSize: 11, fontWeight: 600,
        padding: '3px 8px', borderRadius: 20,
        pointerEvents: 'none', zIndex: 25
      }}>
        🔴 LIVE
      </div>

      {/* Реакции */}
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
          <p style={{ fontSize: 14 }}>Видео не загружено</p>
        </div>
      )}
    </div>
  );
}