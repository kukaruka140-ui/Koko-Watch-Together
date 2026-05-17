// ============================================================
//  RoomLobby.jsx — Экран лобби
//  Хост создаёт комнату с ссылкой на видео.
//  Гость вводит roomId и присоединяется.
// ============================================================

import { useState } from 'react';
import useRoomStore from '../../store/useRoomStore';

/**
 * @param {function} onCreateRoom — callback({ videoUrl, userName })
 * @param {function} onJoinRoom   — callback({ roomId, userName })
 */
export default function RoomLobby({ onCreateRoom, onJoinRoom }) {
  const [tab, setTab]           = useState('create'); // 'create' | 'join'
  const [videoUrl, setVideoUrl] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const { connectionStatus } = useRoomStore();

  const handleCreate = async () => {
    setError('');
    if (!videoUrl.trim()) {
      setError('Вставьте ссылку на видео Google Drive');
      return;
    }
    setLoading(true);
    try {
      await onCreateRoom({ videoUrl: videoUrl.trim(), userName: userName.trim() || 'Host' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError('');
    if (!roomCode.trim()) {
      setError('Введите код комнаты');
      return;
    }
    setLoading(true);
    try {
      await onJoinRoom({ roomId: roomCode.trim().toUpperCase(), userName: userName.trim() || 'Guest' });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen items-center justify-center px-6 py-10"
      style={{ background: '#0A0A0F' }}
    >
      {/* Логотип */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse-glow"
          style={{ background: 'linear-gradient(135deg, #7C5CFC, #FF6B9D)' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14"/>
            <rect x="3" y="6" width="12" height="12" rx="2"/>
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-rave-text tracking-tight">RAVE</h1>
          <p className="text-sm text-rave-muted mt-1">Смотрите вместе, в реальном времени</p>
        </div>
      </div>

      {/* Карточка */}
      <div
        className="w-full max-w-sm rounded-2xl p-5"
        style={{ background: '#12121A', border: '1px solid #2A2A3E' }}
      >
        {/* Табы */}
        <div
          className="flex rounded-xl p-1 mb-5"
          style={{ background: '#0A0A0F' }}
        >
          {['create', 'join'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                tab === t
                  ? 'text-white shadow-sm'
                  : 'text-rave-muted hover:text-rave-text'
              }`}
              style={tab === t
                ? { background: 'linear-gradient(135deg, #7C5CFC, #5A3FD4)' }
                : {}
              }
            >
              {t === 'create' ? '🎬 Создать' : '🔗 Войти'}
            </button>
          ))}
        </div>

        {/* Поле имени — общее для обоих табов */}
        <div className="mb-3">
          <label className="block text-xs text-rave-muted mb-1.5">Ваше имя</label>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Введите имя..."
            maxLength={30}
            className="w-full px-3 py-2.5 rounded-xl text-sm text-rave-text outline-none transition-all"
            style={{
              background: '#1A1A26',
              border: '1px solid #2A2A3E',
              caretColor: '#7C5CFC'
            }}
            onFocus={(e) => e.target.style.borderColor = '#7C5CFC'}
            onBlur={(e)  => e.target.style.borderColor = '#2A2A3E'}
          />
        </div>

        {/* Поля для создания комнаты */}
        {tab === 'create' && (
          <div className="mb-4">
            <label className="block text-xs text-rave-muted mb-1.5">
              Ссылка на видео Google Drive
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="w-full px-3 py-2.5 rounded-xl text-sm text-rave-text outline-none transition-all"
              style={{
                background: '#1A1A26',
                border: '1px solid #2A2A3E',
                caretColor: '#7C5CFC'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7C5CFC'}
              onBlur={(e)  => e.target.style.borderColor = '#2A2A3E'}
            />
            <p className="text-xs text-rave-muted mt-1.5 leading-relaxed">
              Файл должен быть открыт для просмотра ("Все, у кого есть ссылка")
            </p>
          </div>
        )}

        {/* Поле кода комнаты для входа */}
        {tab === 'join' && (
          <div className="mb-4">
            <label className="block text-xs text-rave-muted mb-1.5">Код комнаты</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="например: A3X9KP2W"
              maxLength={8}
              className="w-full px-3 py-2.5 rounded-xl text-sm text-rave-text outline-none text-center
                         tracking-widest font-mono uppercase transition-all"
              style={{
                background: '#1A1A26',
                border: '1px solid #2A2A3E',
                caretColor: '#7C5CFC',
                letterSpacing: '0.2em'
              }}
              onFocus={(e) => e.target.style.borderColor = '#7C5CFC'}
              onBlur={(e)  => e.target.style.borderColor = '#2A2A3E'}
            />
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div
            className="mb-3 px-3 py-2 rounded-lg text-xs animate-bounce-in"
            style={{ background: 'rgba(255,80,80,0.1)', color: '#FF6B6B', border: '1px solid rgba(255,80,80,0.2)' }}
          >
            {error}
          </div>
        )}

        {/* Кнопка действия */}
        <button
          onClick={tab === 'create' ? handleCreate : handleJoin}
          disabled={loading || connectionStatus === 'connecting'}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white
                     transition-all duration-200 active:scale-95 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #7C5CFC, #5A3FD4)' }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {tab === 'create' ? 'Создание...' : 'Вход...'}
            </span>
          ) : (
            tab === 'create' ? '🚀 Создать комнату' : '🔗 Войти в комнату'
          )}
        </button>
      </div>

      {/* Статус подключения */}
      <div className="mt-4 flex items-center gap-1.5 text-xs text-rave-muted">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400' :
            connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
            'bg-red-400'
          }`}
        />
        {connectionStatus === 'connected'  ? 'Подключено к серверу' :
         connectionStatus === 'connecting' ? 'Подключение...' :
         'Нет соединения'}
      </div>
    </div>
  );
}
