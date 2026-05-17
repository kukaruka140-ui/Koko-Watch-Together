// ============================================================
//  VideoPlayer.jsx — Компонент видео-плеера
//
//  Обёртка над Video.js с кастомными контролами,
//  синхронизацией и отображением реакций поверх видео.
// ============================================================

import { useRef, useEffect, useState, useCallback } from 'react';
import { useVideoPlayer } from '../../hooks/useVideoPlayer';
import useRoomStore from '../../store/useRoomStore';
import { formatTime } from '../../lib/syncUtils';
import ReactionFloat from '../Chat/ReactionFloat';
import './VideoPlayer.css';

/**
 * @param {function} onPlay          — callback: хост нажал play
 * @param {function} onPause         — callback: хост нажал pause
 * @param {function} onSeek          — callback: хост перемотал (newTime)
 * @param {React.Ref} controlsRef    — ref для привязки внешних методов
 */
export default function VideoPlayer({ onPlay, onPause, onSeek, controlsRef }) {
  const videoNodeRef = useRef(null);
  const [showIndicator, setShowIndicator] = useState(null); // 'play' | 'pause'
  const [buffering, setBuffering]         = useState(false);
  const [isSeeking, setIsSeeking]         = useState(false);
  const [sliderValue, setSliderValue]     = useState(0);
  const [duration, setDuration]           = useState(0);
  const [displayTime, setDisplayTime]     = useState(0);

  const { videoUrl, isPlaying, role, reactions } = useRoomStore();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

  // Формируем src: Google Drive через прокси или прямой URL
  const buildSrc = (url) => {
    if (!url) return '';
    // Google Drive fileId (прямой или из ссылки)
    const driveMatch = url.match(/[-\w]{25,}/);
    if (url.includes('drive.google.com') || url.includes('googleapis.com')) {
      const fileId = driveMatch?.[0];
      return fileId ? `${BACKEND_URL}/api/stream?fileId=${fileId}` : url;
    }
    return url;
  };

  const src = buildSrc(videoUrl);

  const { playerRef, play, pause, seek, getCurrentTime, getDuration } =
    useVideoPlayer(videoNodeRef, src);

  // Пробрасываем методы наружу через ref
  useEffect(() => {
    if (controlsRef) {
      controlsRef.current = { play, pause, seek, getCurrentTime };
    }
  }, [play, pause, seek, getCurrentTime, controlsRef]);

  // Подписываемся на события Video.js
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const onWaiting  = () => setBuffering(true);
    const onCanPlay  = () => setBuffering(false);
    const onPlaying  = () => setBuffering(false);

    const onTimeUpdate = () => {
      if (isSeeking) return;
      const t = player.currentTime();
      const d = player.duration() || 0;
      setDisplayTime(t);
      setDuration(d);
      setSliderValue(d > 0 ? (t / d) * 100 : 0);
    };

    const onLoadedMetadata = () => {
      setDuration(player.duration() || 0);
    };

    player.on('waiting',          onWaiting);
    player.on('canplay',          onCanPlay);
    player.on('playing',          onPlaying);
    player.on('timeupdate',       onTimeUpdate);
    player.on('loadedmetadata',   onLoadedMetadata);

    return () => {
      player.off('waiting',        onWaiting);
      player.off('canplay',        onCanPlay);
      player.off('playing',        onPlaying);
      player.off('timeupdate',     onTimeUpdate);
      player.off('loadedmetadata', onLoadedMetadata);
    };
  }, [playerRef.current, isSeeking]); // eslint-disable-line

  // ── Кастомные контролы (только для хоста) ─────────────────

  const handlePlayPause = useCallback(() => {
    if (role !== 'host') return; // гость не управляет
    const playing = playerRef.current?.paused() === false;
    if (playing) {
      onPause?.(getCurrentTime());
      setShowIndicator('pause');
    } else {
      onPlay?.(getCurrentTime());
      setShowIndicator('play');
    }
    setTimeout(() => setShowIndicator(null), 700);
  }, [role, getCurrentTime, onPlay, onPause, playerRef]);

  const handleSliderStart = () => setIsSeeking(true);

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setSliderValue(val);
    const d = getDuration();
    if (d > 0) setDisplayTime((val / 100) * d);
  };

  const handleSliderEnd = (e) => {
    const val   = parseFloat(e.target.value);
    const d     = getDuration();
    const newTime = (val / 100) * d;
    setIsSeeking(false);
    if (role !== 'host') return; // только хост может перематывать
    onSeek?.(newTime);
  };

  return (
    <div className="video-player-wrapper">
      {/* Video.js контейнер */}
      <div data-vjs-player>
        <video
          ref={videoNodeRef}
          className="video-js vjs-theme-rave"
          playsInline
          preload="auto"
        />
      </div>

      {/* Кастомный оверлей — кликабельная зона */}
      <div
        className="absolute inset-0 cursor-pointer"
        style={{ bottom: '52px' }} // не перекрываем нижний контролбар
        onClick={handlePlayPause}
      />

      {/* Анимированный индикатор play/pause */}
      {showIndicator && (
        <div className="video-player-overlay">
          <div className="play-indicator">
            {showIndicator === 'play' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Буферизация */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-rave-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Кастомный нижний контролбар */}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2 pt-6"
           style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.9))' }}>

        {/* Прогресс-слайдер */}
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={sliderValue}
          onMouseDown={handleSliderStart}
          onTouchStart={handleSliderStart}
          onChange={handleSliderChange}
          onMouseUp={handleSliderEnd}
          onTouchEnd={handleSliderEnd}
          disabled={role !== 'host'}
          className="w-full mb-2"
          style={{
            height: '3px',
            accentColor: '#7C5CFC',
            cursor: role === 'host' ? 'pointer' : 'default'
          }}
        />

        {/* Нижняя строка: play/pause + время */}
        <div className="flex items-center gap-3">
          {/* Play/Pause кнопка */}
          <button
            onClick={handlePlayPause}
            disabled={role !== 'host'}
            className="text-white opacity-90 hover:opacity-100 disabled:opacity-40 transition-opacity"
            aria-label={isPlaying ? 'Пауза' : 'Играть'}
          >
            {isPlaying ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            )}
          </button>

          {/* Время */}
          <span className="text-white text-xs font-mono opacity-80">
            {formatTime(displayTime)} / {formatTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Бейдж роли */}
          <span className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  background: role === 'host' ? 'rgba(255,107,157,0.2)' : 'rgba(86,207,225,0.2)',
                  color:       role === 'host' ? '#FF6B9D' : '#56CFE1',
                  border:     `1px solid ${role === 'host' ? 'rgba(255,107,157,0.3)' : 'rgba(86,207,225,0.3)'}`
                }}>
            {role === 'host' ? 'Ведущий' : 'Зритель'}
          </span>
        </div>
      </div>

      {/* Реакции поверх видео */}
      <div className="reactions-container">
        {reactions.map(reaction => (
          <ReactionFloat key={reaction.id} reaction={reaction} />
        ))}
      </div>

      {/* Бейдж состояния синхронизации */}
      <div className={`sync-badge ${buffering ? 'buffering' : 'synced'}`}>
        {buffering ? '⏳ Буферизация...' : '🔴 LIVE'}
      </div>

      {/* Заглушка если видео не задано */}
      {!videoUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
             style={{ background: '#0A0A0F' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
               stroke="#2A2A3E" strokeWidth="1.5" className="mb-3">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14"/>
            <rect x="3" y="6" width="12" height="12" rx="2"/>
          </svg>
          <p className="text-rave-muted text-sm">Видео не загружено</p>
        </div>
      )}
    </div>
  );
}
