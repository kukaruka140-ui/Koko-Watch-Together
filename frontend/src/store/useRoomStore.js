import { create } from 'zustand';

const useRoomStore = create((set) => ({
  roomId: null, role: null, videoUrl: null,
  hostName: '', guestName: '',
  isPlaying: false, currentTime: 0, lastSyncedAt: null,
  messages: [], reactions: [],
  connectionStatus: 'idle', peerConnected: false, rtt: 0,
  // Бали за перегляд
  scores: [], // [{ role, name, points }]

  setRoom: ({ roomId, role, videoUrl, hostName, guestName, playback, messages }) => set({
    roomId, role, videoUrl,
    hostName: hostName || '', guestName: guestName || '',
    isPlaying: playback?.isPlaying ?? false,
    currentTime: playback?.currentTime ?? 0,
    lastSyncedAt: Date.now(),
    messages: messages || [],
    connectionStatus: 'connected'
  }),

  setPlayback: ({ isPlaying, currentTime }) => set({
    isPlaying, currentTime, lastSyncedAt: Date.now()
  }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setPeerConnected: (connected) => set({ peerConnected: connected }),
  setRTT: (rtt) => set({ rtt: Math.round(rtt) }),
  setScores: (scores) => set({ scores }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  addReaction: (reaction) => {
    set((state) => ({ reactions: [...state.reactions, reaction] }));
    setTimeout(() => {
      set((state) => ({ reactions: state.reactions.filter(r => r.id !== reaction.id) }));
    }, 3500);
  },

  reset: () => set({
    roomId: null, role: null, videoUrl: null,
    hostName: '', guestName: '',
    isPlaying: false, currentTime: 0, lastSyncedAt: null,
    messages: [], reactions: [],
    connectionStatus: 'idle', peerConnected: false, rtt: 0,
    scores: []
  })
}));

export default useRoomStore;
