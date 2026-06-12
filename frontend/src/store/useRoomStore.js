// ============================================================
//  useRoomStore.js — Глобальное состояние через Zustand
//  Хранит: данные комнаты, чат, статус подключения
// ============================================================

import { create } from 'zustand';

const useRoomStore = create((set, get) => ({
  // ─── Комната ────────────────────────────────────────────
  roomId:    null,
  role:      null,       // 'host' | 'guest'
  videoUrl:  null,
  hostName:  '',
  guestName: '',

  // ─── Воспроизведение ────────────────────────────────────
  isPlaying:    false,
  currentTime:  0,
  lastSyncedAt: null, // Date.now() в момент последнего sync — для live drift-check

  // ─── Чат ────────────────────────────────────────────────
  messages:  [],
  reactions: [],         // плавающие реакции (живут 3с потом удаляются)

  // ─── Статус подключения ──────────────────────────────────
  connectionStatus: 'idle', // 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'
  peerConnected: false,     // подключён ли второй участник

  // ─── Латентность ─────────────────────────────────────────
  rtt: 0, // среднее RTT в мс

  // ═══ ДЕЙСТВИЯ ════════════════════════════════════════════

  setRoom: ({ roomId, role, videoUrl, hostName, guestName, playback, messages }) => set({
    roomId,
    role,
    videoUrl,
    hostName:  hostName  || '',
    guestName: guestName || '',
    isPlaying:    playback?.isPlaying   ?? false,
    currentTime:  playback?.currentTime ?? 0,
    lastSyncedAt: Date.now(), // фиксируем момент получения начального состояния
    messages: messages || [],
    connectionStatus: 'connected'
  }),

  // FIX: всегда сохраняем lastSyncedAt вместе с currentTime,
  // чтобы drift-check мог вычислять "живую" ожидаемую позицию
  setPlayback: ({ isPlaying, currentTime }) => set({
    isPlaying,
    currentTime,
    lastSyncedAt: Date.now(),
  }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setPeerConnected: (connected) => set({ peerConnected: connected }),

  setRTT: (rtt) => set({ rtt: Math.round(rtt) }),

  // Добавляем сообщение в чат
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  // Добавляем реакцию и удаляем через 3.5с (время анимации)
  addReaction: (reaction) => {
    set((state) => ({
      reactions: [...state.reactions, reaction]
    }));
    setTimeout(() => {
      set((state) => ({
        reactions: state.reactions.filter(r => r.id !== reaction.id)
      }));
    }, 3500);
  },

  // Полный сброс при выходе из комнаты
  reset: () => set({
    roomId:    null,
    role:      null,
    videoUrl:  null,
    hostName:  '',
    guestName: '',
    isPlaying:    false,
    currentTime:  0,
    lastSyncedAt: null,
    messages:  [],
    reactions: [],
    connectionStatus: 'idle',
    peerConnected: false,
    rtt: 0
  })
}));

export default useRoomStore;
