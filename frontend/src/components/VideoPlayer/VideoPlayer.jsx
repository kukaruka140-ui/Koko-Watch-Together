import { useRef, useEffect, useCallback, useState } from 'react';
import useRoomStore from '../../store/useRoomStore';
import ReactionFloat from '../Chat/ReactionFloat';
import './VideoPlayer.css';

export default function VideoPlayer({ onPlay, onPause, onSeek, controlsRef }) {
  const videoRef        = useRef(null);
  const pendingSeekRef  = useRef(null);
  const programmaticRef = useRef(false); // true = seek зроблений кодом, не юзером
  const [needsGesture, setNeedsGesture] = useState(false);

  const { videoUrl, role, reactions } = useRoomStore();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

  const buildSrc = (url) => {
    if (!url) return '';
    if (!url.includes('drive.google.com') && !url.includes('googleapis.com')) return url;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
    const fileId = match?.[1] || url;
    return `${BACKEND_URL}/api/stream?fileId=${fileId}`;
  };

  const src = buildSrc(videoUrl);

  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      play: () => {
        if (!videoRef.current) return;
        const p = videoRef.current.play();
        if (p?.catch) {
          p.catch((err) => {
            if (err.name === 'NotAllowedError') setNeedsGesture(true);
          });
        }
      },
      pause: () => {
        setNeedsGesture(false);
        videoRef.current?.pause();
      },
      seek: (t) => {
        if (!videoRef.current) return;
        programmaticRef.current = true; // позначаємо: це НЕ дія юзера
        videoRef.current.currentTime = t;
        pendingSeekRef.current = t;
      },
      getCurrentTime: () => videoRef.current?.currentTime || 0,
    };
  }, [controlsRef]);

  const handleCanPlay = useCallback(() => {
    if (pendingSeekRef.current !== null && videoRef.current) {
      programmaticRef.current = true;
      videoRef.current.currentTime = pendingSeekRef.current;
      pendingSeekRef.current = null;
    }
  }, []);

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

  // Ключовий фікс: якщо seek зроблений програмно — скидаємо флаг і НЕ
  // відправляємо sendPlaybackAction. Без цього виникала петля:
  // drift-seek → onSeeked → sendPlaybackAction → playback_sync → seek → ...
  const handleSeeked = useCallback(() => {
    if (role !== 'host') return;
    if (programmaticRef.current) {
      programmaticRef.current = false;
      return;
    }
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
        onCanPlay={handleCanPlay}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {role === 'guest' && !needsGesture && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10 }} />
      )}

      {needsGesture && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)'
        }}>
          <button onClick={handleGesturePlay} style={{
            background: 'linear-gradient(135deg, #7C5CFC, #5A3FD4)',
            color: '#fff', border: 'none', borderRadius: 50,
            width: 72, height: 72, fontSize: 28, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, boxShadow: '0 0 24px rgba(124,92,252,0.5)'
          }}>▶</button>
          <p style={{ color: '#fff', fontSize: 14, margin: 0, opacity: 0.8 }}>
            Натисни щоб приєднатись
          </p>
        </div>
      )}

      <div style={{
        position: 'absolute', top: 12, right: 12,
        background: 'rgba(255,0,0,0.8)', color: '#fff',
        fontSize: 11, fontWeight: 600, padding: '3px 8px',
        borderRadius: 20, pointerEvents: 'none', zIndex: 25
      }}>🔴 LIVE</div>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 30 }}>
        {reactions.map(r => <ReactionFloat key={r.id} reaction={r} />)}
      </div>

      {!videoUrl && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0A0A0F', color: '#6B6B8A'
        }}>
          <p style={{ fontSize: 14 }}>Відео не завантажено</p>
        </div>
      )}
    </div>
  );
}
