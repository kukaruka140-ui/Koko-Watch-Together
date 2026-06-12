// ============================================================
//  useSync.js — Главный хук синхронизации
//
//  Подключается к WebSocket серверу, обрабатывает все события:
//  - Создание и вход в комнату
//  - Синхронизация воспроизведения (play/pause/seek)
//  - Компенсация задержки сети
//  - Чат и реакции
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import useRoomStore from '../store/useRoomStore';
import { compensateLatency, getDriftAction, updateRTT } from '../lib/syncUtils';

const PING_INTERVAL = 5000; // пинг каждые 5 секунд

/**
 * @param {object} videoControls — { play, pause, seek, getCurrentTime } из useVideoPlayer
 * @param {string} initData      — Telegram initData для авторизации
 */
export function useSync(videoControls, initData = '') {
  const socket = getSocket(initData);
  const pingTimerRef = useRef(null);

  const {
    setRoom,
    setPlayback,
    setConnectionStatus,
    setPeerConnected,
    setRTT,
    addMessage,
    addReaction,
    reset
  } = useRoomStore();

  // ── Подписка на события сервера ───────────────────────────
  useEffect(() => {
    setConnectionStatus('connecting');

    // ── Статус соединения ──────────────────────────────────
    socket.on('connect', () => {
      setConnectionStatus('connected');
      startPingLoop();
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      stopPingLoop();
    });

    // ── Измерение RTT (ping/pong) ──────────────────────────
    socket.on('pong', ({ clientTime }) => {
      const avgRTT = updateRTT(clientTime);
      setRTT(avgRTT);
    });

    // ── Синхронизация воспроизведения ─────────────────────
    // Сервер рассылает это событие ВСЕМ участникам комнаты
    // при каждом действии хоста (play/pause/seek)
    socket.on('playback_sync', ({ action, currentTime, isPlaying, serverTime }) => {
      // Компенсируем сетевую задержку
      const compensated = compensateLatency(currentTime, serverTime, isPlaying);

      // Обновляем Zustand store
      setPlayback({ isPlaying, currentTime: compensated });

      // Хост уже управляет плеером напрямую через свой UI —
      // не нужно повторно вызывать play()/pause()/seek() по echo от сервера,
      // иначе программный play() без жеста пользователя будет заблокирован браузером.
      const { role } = useRoomStore.getState();
      if (role === 'host') return;

      // Управляем плеером (только гость)
      if (action === 'play') {
        videoControls.seek(compensated);
        videoControls.play();
      } else if (action === 'pause') {
        videoControls.seek(compensated);
        videoControls.pause();
      } else if (action === 'seek') {
        videoControls.seek(compensated);
      }
    });

    // ── Drift-коррекция (периодическая проверка дрейфа) ───
    // Каждые 10с проверяем, не ушёл ли плеер с правильной позиции
    const driftCheckInterval = setInterval(() => {
      const store = useRoomStore.getState();
      if (!store.isPlaying || !store.roomId) return;

      const playerTime = videoControls.getCurrentTime();
      const drift = getDriftAction(playerTime, store.currentTime);

      if (drift === 'hard') {
        console.warn(`[Sync] Жёсткий drift: плеер ${playerTime.toFixed(2)}s, ожидается ~${store.currentTime.toFixed(2)}s`);
        videoControls.seek(store.currentTime);
      }
      // soft drift — плеер сам выровняется естественным образом
    }, 10_000);

    // ── Запрос актуального состояния от хоста ─────────────
    socket.on('playback_request', ({ userId, action, currentTime }) => {
      // Хост получил запрос от гостя — обрабатываем в RoomScreen
      // Здесь просто логируем (UI-компонент решит что делать)
      console.log(`[Sync] Запрос от гостя: ${action} @ ${currentTime}`);
    });

    // ── Входящий пользователь ─────────────────────────────
    socket.on('user_joined', ({ userName }) => {
      setPeerConnected(true);
      console.log(`[Sync] ${userName} присоединился`);
    });

    socket.on('user_disconnected', () => {
      setPeerConnected(false);
    });

    socket.on('user_left', () => {
      setPeerConnected(false);
    });

    // ── Закрытие комнаты ──────────────────────────────────
    socket.on('room_closed', ({ message }) => {
      console.log('[Sync] Комната закрыта:', message);
      reset();
    });

    // ── Чат ───────────────────────────────────────────────
    socket.on('new_message', (message) => {
      addMessage(message);
    });

    // ── Реакции ───────────────────────────────────────────
    socket.on('new_reaction', (reaction) => {
      addReaction(reaction);
    });

    return () => {
      clearInterval(driftCheckInterval);
      stopPingLoop();
      // Отписываемся от всех событий (не дисконнектимся!)
      socket.off('connect');
      socket.off('disconnect');
      socket.off('pong');
      socket.off('playback_sync');
      socket.off('playback_request');
      socket.off('user_joined');
      socket.off('user_disconnected');
      socket.off('user_left');
      socket.off('room_closed');
      socket.off('new_message');
      socket.off('new_reaction');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ping loop ─────────────────────────────────────────────
  function startPingLoop() {
    stopPingLoop();
    pingTimerRef.current = setInterval(() => {
      socket.emit('ping', { clientTime: Date.now() });
    }, PING_INTERVAL);
  }

  function stopPingLoop() {
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }

  // ═══ ПУБЛИЧНЫЕ МЕТОДЫ ════════════════════════════════════

  /**
   * Хост создаёт новую комнату.
   */
  const createRoom = useCallback(({ videoUrl, userName }) => {
    return new Promise((resolve, reject) => {
      socket.emit('create_room', { videoUrl, userName }, (res) => {
        if (res.error) return reject(new Error(res.error));
        setRoom({
          roomId:    res.roomId,
          role:      res.role,
          videoUrl:  res.state.videoUrl,
          hostName:  res.state.hostName,
          guestName: res.state.guestName,
          playback:  res.state.playback,
          messages:  res.state.messages
        });
        resolve(res);
      });
    });
  }, []);

  /**
   * Гость входит в существующую комнату.
   */
  const joinRoom = useCallback(({ roomId, userName }) => {
    return new Promise((resolve, reject) => {
      socket.emit('join_room', { roomId, userName }, (res) => {
        if (res.error) return reject(new Error(res.error));
        setRoom({
          roomId:    res.state.roomId,
          role:      res.role,
          videoUrl:  res.state.videoUrl,
          hostName:  res.state.hostName,
          guestName: res.state.guestName,
          playback:  res.state.playback,
          messages:  res.state.messages
        });
        // Синхронизируем плеер с текущей позицией
        const { currentTime, isPlaying } = res.state.playback;
        const compensated = compensateLatency(currentTime, res.state.playback.serverTime, isPlaying);
        videoControls.seek(compensated);
        if (isPlaying) videoControls.play();

        setPeerConnected(true);
        resolve(res);
      });
    });
  }, []);

  /**
   * Отправляем действие воспроизведения (play/pause/seek).
   * Только хост может; гость отправляет запрос.
   */
  const sendPlaybackAction = useCallback((action, currentTime) => {
    const { roomId } = useRoomStore.getState();
    if (!roomId) return;
    socket.emit('playback_action', { roomId, action, currentTime });
  }, []);

  /**
   * Отправляем сообщение в чат.
   */
  const sendMessage = useCallback((text, replyTo = null) => {
    const { roomId } = useRoomStore.getState();
    if (!roomId) return;
    socket.emit('send_message', { roomId, text, replyTo });
  }, []);

  /**
   * Отправляем реакцию.
   */
  const sendReaction = useCallback((emoji) => {
    const { roomId } = useRoomStore.getState();
    if (!roomId) return;
    socket.emit('send_reaction', { roomId, emoji });
  }, []);

  return {
    createRoom,
    joinRoom,
    sendPlaybackAction,
    sendMessage,
    sendReaction
  };
}
