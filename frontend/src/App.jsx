// ============================================================
//  App.jsx — Корневой компонент приложения
//
//  Управляет переходом между лобби и комнатой.
//  Инициализирует Telegram SDK и WebSocket-подключение.
// ============================================================

import { useRef, useState, useEffect } from 'react';
import { useTelegram }       from './hooks/useTelegram';
import { useSync }           from './hooks/useSync';
import useRoomStore          from './store/useRoomStore';
import RoomLobby             from './components/Room/RoomLobby';
import RoomScreen            from './components/Room/RoomScreen';
import { destroySocket }     from './lib/socket';

export default function App() {
  const { user, initData, isReady } = useTelegram();
  const { roomId, reset }           = useRoomStore();

  // ref для методов управления плеером
  // (заполняется внутри VideoPlayer через controlsRef)
  const videoControlsRef = useRef({
    play:           () => {},
    pause:          () => {},
    seek:           () => {},
    getCurrentTime: () => 0
  });

  // Прокси-объект: useSync вызывает методы через ref,
  // а VideoPlayer их регистрирует. Это разрывает циклическую зависимость.
  const videoControls = {
    play:           (...args) => videoControlsRef.current?.play?.(...args),
    pause:          (...args) => videoControlsRef.current?.pause?.(...args),
    seek:           (...args) => videoControlsRef.current?.seek?.(...args),
    getCurrentTime: (...args) => videoControlsRef.current?.getCurrentTime?.(...args) ?? 0
  };

  // Инициализируем WebSocket-синхронизацию
  const { createRoom, joinRoom, sendPlaybackAction, sendMessage, sendReaction } =
    useSync(videoControls, initData);

  // Передаём имя пользователя из Telegram в создание/вход
  const userName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ')
    : '';

  const handleCreateRoom = ({ videoUrl }) =>
    createRoom({ videoUrl, userName });

  const handleJoinRoom = ({ roomId }) =>
    joinRoom({ roomId, userName });

  const handleLeave = () => {
    reset();
    // Не разрываем сокет-соединение полностью —
    // просто сбрасываем состояние комнаты
  };

  // Заглушка при инициализации
  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#0A0A0F' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C5CFC, #FF6B9D)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14"/>
              <rect x="3" y="6" width="12" height="12" rx="2"/>
            </svg>
          </div>
          <div className="w-6 h-6 border-2 border-rave-accent border-t-transparent
                          rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <>
      {!roomId ? (
        /* Лобби — создание или вход в комнату */
        <RoomLobby
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      ) : (
        /* Комната — видео + чат */
        <RoomScreen
          videoControlsRef={videoControlsRef}
          syncMethods={{ sendPlaybackAction, sendMessage, sendReaction }}
          onLeave={handleLeave}
        />
      )}
    </>
  );
}
