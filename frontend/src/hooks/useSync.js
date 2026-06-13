import { useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import useRoomStore from '../store/useRoomStore';
import { compensateLatency, getDriftAction, updateRTT } from '../lib/syncUtils';

const PING_INTERVAL = 5000;
const SEEK_COOLDOWN = 2000;

export function useSync(videoControls, initData = '') {
  const socket       = getSocket(initData);
  const pingTimerRef = useRef(null);
  const lastSeekAtRef = useRef(0);

  const {
    setRoom, setPlayback, setConnectionStatus,
    setPeerConnected, setRTT, setScores,
    addMessage, addReaction, reset
  } = useRoomStore();

  useEffect(() => {
    setConnectionStatus('connecting');

    socket.on('connect',    () => { setConnectionStatus('connected');    startPingLoop(); });
    socket.on('disconnect', () => { setConnectionStatus('disconnected'); stopPingLoop();  });
    socket.on('pong', ({ clientTime }) => setRTT(updateRTT(clientTime)));

    socket.on('playback_sync', ({ action, currentTime, isPlaying, serverTime }) => {
      const compensated = compensateLatency(currentTime, serverTime, isPlaying);
      setPlayback({ isPlaying, currentTime: compensated });
      lastSeekAtRef.current = 0;

      // Страховка: хост не повинен отримувати echo (сервер шле тільки гостю)
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
        lastSeekAtRef.current = Date.now();
      }
    });

    // Drift-корекція кожні 10с
    const driftCheckInterval = setInterval(() => {
      const store = useRoomStore.getState();
      if (!store.isPlaying || !store.roomId || store.lastSyncedAt === null) return;
      if (lastSeekAtRef.current > 0 && (Date.now() - lastSeekAtRef.current) < SEEK_COOLDOWN) return;

      const playerTime   = videoControls.getCurrentTime();
      const elapsed      = (Date.now() - store.lastSyncedAt) / 1000;
      const expectedTime = store.currentTime + elapsed;
      const drift        = getDriftAction(playerTime, expectedTime);

      if (drift === 'hard') {
        console.warn(`[Drift] ${playerTime.toFixed(2)}s → ${expectedTime.toFixed(2)}s`);
        videoControls.seek(expectedTime);
        lastSeekAtRef.current = Date.now();
      }
    }, 10_000);

    // Бали за перегляд
    socket.on('points_update', ({ scores }) => setScores(scores));

    socket.on('playback_request', ({ action, currentTime }) => {
      console.log(`[Sync] запит від гостя: ${action} @ ${currentTime}`);
    });

    socket.on('user_joined',       ({ userName }) => { setPeerConnected(true);  console.log(`[+] ${userName}`); });
    socket.on('user_disconnected', () => setPeerConnected(false));
    socket.on('user_left',         () => setPeerConnected(false));
    socket.on('room_closed',       ({ message }) => { console.log('[Sync] закрито:', message); reset(); });
    socket.on('new_message',       (msg)      => addMessage(msg));
    socket.on('new_reaction',      (reaction) => addReaction(reaction));

    return () => {
      clearInterval(driftCheckInterval);
      stopPingLoop();
      ['connect','disconnect','pong','playback_sync','playback_request','points_update',
       'user_joined','user_disconnected','user_left','room_closed',
       'new_message','new_reaction'].forEach(e => socket.off(e));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startPingLoop() {
    stopPingLoop();
    pingTimerRef.current = setInterval(() => socket.emit('ping', { clientTime: Date.now() }), PING_INTERVAL);
  }
  function stopPingLoop() {
    if (pingTimerRef.current) { clearInterval(pingTimerRef.current); pingTimerRef.current = null; }
  }

  const createRoom = useCallback(({ videoUrl, userName }) => {
    return new Promise((resolve, reject) => {
      socket.emit('create_room', { videoUrl, userName }, (res) => {
        if (res.error) return reject(new Error(res.error));
        setRoom({
          roomId: res.roomId, role: res.role, videoUrl: res.state.videoUrl,
          hostName: res.state.hostName, guestName: res.state.guestName,
          playback: res.state.playback, messages: res.state.messages
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
          roomId: res.state.roomId, role: res.role, videoUrl: res.state.videoUrl,
          hostName: res.state.hostName, guestName: res.state.guestName,
          playback: res.state.playback, messages: res.state.messages
        });

        const { currentTime, isPlaying, serverTime } = res.state.playback;
        const compensated = compensateLatency(currentTime, serverTime, isPlaying);
        videoControls.seek(compensated);
        lastSeekAtRef.current = Date.now();
        if (isPlaying) videoControls.play();

        setPeerConnected(true);
        resolve(res);
      });
    });
  }, []);

  const sendPlaybackAction = useCallback((action, currentTime) => {
    const { roomId } = useRoomStore.getState();
    if (!roomId) return;
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

  return { createRoom, joinRoom, sendPlaybackAction, sendMessage, sendReaction };
}
