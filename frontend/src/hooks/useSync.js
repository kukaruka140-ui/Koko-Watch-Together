// ============================================================
//  useSync.js — Главный хук синхронизации
// ============================================================

import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import useRoomStore from '../store/useRoomStore';
import { compensateLatency, getDriftAction, updateRTT } from '../lib/syncUtils';

const PING_INTERVAL = 5000;

export function useSync(videoControls, initData = '') {
  const socket = getSocket(initData);
  const pingTimerRef  = useRef(null);

  // FIX: время последнего seek/sync — drift-check игнорируется
  // в течение SEEK_COOLDOWN мс после любого перемотки.
  // Без этого drift-check успевает сработать в окно между
  // локальным seek() и получением playback_sync от сервера,
  // и кидает плеер обратно на старую позицию.
  const lastSeekAtRef = useRef(0);
  const SEEK_COOLDOWN = 2000; // мс

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

  useEffect(() => {
    setConnectionStatus('connecting');

    socket.on('connect', () => {
      setConnectionStatus('connected');
      startPingLoop();
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
      stopPingLoop();
    });

    socket.on('pong', ({ clientTime }) => {
      const avgRTT = updateRTT(clientTime);
      setRTT(avgRTT);
    });

    socket.on('playback_sync', ({ action, currentTime, isPlaying, serverTime }) => {
      const compensated = compensateLatency(currentTime, serverTime, isPlaying);

      // Обновляем store (lastSyncedAt обновляется внутри setPlayback)
      setPlayback({ isPlaying, currentTime: compensated });

      // Сбрасываем cooldown — store теперь актуален, drift-check снова разрешён
      lastSeekAtRef.current = 0;

      const { role } = useRoomStore.getState();
      if (role === 'host') return;

      if (action === 'play') {
        videoControls.seek(compensated);
        videoControls.play();
      } else if (action === 'pause') {
        videoControls.seek(compensated);
        videoControls.pause();
      } else if (action === 'seek') {
        videoControls.seek(compensated);
        // После seek со стороны хоста — тоже ставим cooldown
        // чтобы не дёргать гостя пока его плеер перематывает
        lastSeekAtRef.current = Date.now();
      }
    });

    // ── Drift-коррекция ────────────────────────────────────
    const driftCheckInterval = setInterval(() => {
      const store = useRoomStore.getState();
      if (!store.isPlaying || !store.roomId || store.lastSyncedAt === null) return;

      // Пропускаем проверку если недавно был seek
      const msSinceSeek = Date.now() - lastSeekAtRef.current;
      if (lastSeekAtRef.current > 0 && msSinceSeek < SEEK_COOLDOWN) return;

      const playerTime   = videoControls.getCurrentTime();
      const elapsed      = (Date.now() - store.lastSyncedAt) / 1000;
      const expectedTime = store.currentTime + elapsed;

      const drift = getDriftAction(playerTime, expectedTime);

      if (drift === 'hard') {
        console.warn(
          `[Sync] Hard drift: player=${playerTime.toFixed(2)}s ` +
          `expected=${expectedTime.toFixed(2)}s (${elapsed.toFixed(1)}s ago)`
        );
        videoControls.seek(expectedTime);
        lastSeekAtRef.current = Date.now(); // cooldown после корректирующего seek
      }
    }, 10_000);

    socket.on('playback_request', ({ action, currentTime }) => {
      console.log(`[Sync] Запрос от гостя: ${action} @ ${currentTime}`);
    });

    socket.on('user_joined', ({ userName }) => {
      setPeerConnected(true);
      console.log(`[Sync] ${userName} присоединился`);
    });

    socket.on('user_disconnected', () => setPeerConnected(false));
    socket.on('user_left',         () => setPeerConnected(false));

    socket.on('room_closed', ({ message }) => {
      console.log('[Sync] Комната закрыта:', message);
      reset();
    });

    socket.on('new_message',  (msg)      => addMessage(msg));
    socket.on('new_reaction', (reaction) => addReaction(reaction));

    return () => {
      clearInterval(driftCheckInterval);
      stopPingLoop();
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

        const { currentTime, isPlaying } = res.state.playback;
        const compensated = compensateLatency(
          currentTime,
          res.state.playback.serverTime,
          isPlaying
        );
        videoControls.seek(compensated);
        lastSeekAtRef.current = Date.now(); // cooldown после начального seek

        if (isPlaying) videoControls.play();

        setPeerConnected(true);
        resolve(res);
      });
    });
  }, []);

  const sendPlaybackAction = useCallback((action, currentTime) => {
    const { roomId } = useRoomStore.getState();
    if (!roomId) return;
    // Ставим cooldown сразу при отправке — не ждём подтверждения от сервера
    lastSeekAtRef.current = Date.now();
    socket.emit('playback_action', { roomId, action, currentTime });
  }, []);

  const sendMessage = useCallback((text, replyTo = null) => {
    const { roomId } = useRoomStore.getState();
    if (!roomId) return;
    socket.emit('send_message', { roomId, text, replyTo });
  }, []);

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
