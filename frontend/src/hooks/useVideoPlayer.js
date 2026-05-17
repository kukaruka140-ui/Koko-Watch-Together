// ============================================================
//  useVideoPlayer.js — Хук управления Video.js плеером
//
//  Инициализирует плеер, хранит ref на инстанс,
//  предоставляет методы play/pause/seek для внешнего управления.
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import videojs from 'video.js';

/**
 * @param {React.RefObject} videoRef — ref на <video> элемент
 * @param {string}          src      — URL видео (наш прокси или прямая ссылка)
 * @param {object}          options  — дополнительные опции Video.js
 * @returns {{ playerRef, play, pause, seek, getCurrentTime }}
 */
export function useVideoPlayer(videoRef, src, options = {}) {
  const playerRef = useRef(null);

  // Инициализация плеера
  useEffect(() => {
    if (!videoRef.current) return;

    // Не создаём второй раз если уже инициализирован
    if (playerRef.current) return;

    playerRef.current = videojs(videoRef.current, {
      controls:    true,
      autoplay:    false,
      preload:     'auto',
      fluid:       false,
      responsive:  false,
      playsinline: true,           // критично для iOS WebView
      nativeVideoTracks: true,
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true
        }
      },
      sources: src ? [{ src, type: 'video/mp4' }] : [],
      ...options
    });

    playerRef.current.on('error', (err) => {
      console.error('[VideoPlayer] Ошибка:', err);
    });

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Обновляем src при изменении
  useEffect(() => {
    if (playerRef.current && src) {
      playerRef.current.src({ src, type: 'video/mp4' });
    }
  }, [src]);

  // ─── Внешние методы управления (вызываются из useSync) ───

  const play = useCallback(() => {
    playerRef.current?.play()?.catch(() => {});
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const seek = useCallback((time) => {
    if (!playerRef.current) return;
    const duration = playerRef.current.duration();
    // Защита от выхода за пределы
    const safeTime = Math.max(0, Math.min(time, duration || Infinity));
    playerRef.current.currentTime(safeTime);
  }, []);

  const getCurrentTime = useCallback(() => {
    return playerRef.current?.currentTime() || 0;
  }, []);

  const getDuration = useCallback(() => {
    return playerRef.current?.duration() || 0;
  }, []);

  return { playerRef, play, pause, seek, getCurrentTime, getDuration };
}
