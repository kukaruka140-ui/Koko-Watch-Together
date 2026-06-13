import { useEffect, useRef, useState } from "react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/**
 * Панель чату: історія повідомлень + поле введення + реакції + відповіді.
 */
export default function ChatPanel({ chatHistory, onSend, myUserId, onToggleReaction }) {
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const messagesEndRef = useRef(null);

  // Надійний автоскрол до низу
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    
    onSend(trimmed, replyingTo?.id || null);
    
    setText("");
    setReplyingTo(null); // Скидаємо відповідь після відправки
  };

  // Пошук повідомлення для відображення цитати
  const getReplyMessage = (id) => chatHistory.find((m) => m.id === id);

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3 pb-4">
        {chatHistory.length === 0 && (
          <p className="text-mist text-sm text-center mt-6">
            Поки тихо. Напиши щось першим 👋
          </p>
        )}
        {chatHistory.map((msg, i) => (
          <ChatMessage 
            key={msg.id || i} 
            msg={msg} 
            isMine={msg.from?.userId === myUserId}
            onReply={() => setReplyingTo(msg)}
            onReact={(emoji) => onToggleReaction(msg.id, emoji)}
            replyQuote={msg.replyToId ? getReplyMessage(msg.replyToId) : null}
          />
        ))}
        {/* Якір для автоскролу */}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-panel border-t border-panel2 flex flex-col">
        {/* Блок відображення "Відповідь на..." */}
        {replyingTo && (
          <div className="flex items-center justify-between px-4 py-2 bg-panel2/50 border-l-2 border-banana text-sm">
            <div className="truncate flex-1 text-mist">
              <span className="font-semibold text-cream">{replyingTo.from?.name}: </span>
              {replyingTo.text}
            </div>
            <button 
              onClick={() => setReplyingTo(null)} 
              className="text-mist hover:text-coral ml-3 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Форма вводу */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Написати в чат..."
            maxLength={500}
            className="flex-1 bg-panel2 text-cream placeholder:text-mist rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-banana"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="bg-banana text-ink font-display font-semibold rounded-full px-4 py-2.5 text-sm disabled:opacity-40 active:scale-95 transition-transform"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

function ChatMessage({ msg, isMine, onReply, onReact, replyQuote }) {
  const [showReactMenu, setShowReactMenu] = useState(false);

  if (msg.system) {
    return (
      <div className="text-center my-2">
        <span className="text-xs text-mist bg-panel2 rounded-full px-3 py-1">
          {msg.text}
        </span>
      </div>
    );
  }

  const hasReactions = msg.reactions && Object.keys(msg.reactions).length > 0;

  return (
    <div className={`group flex flex-col relative ${isMine ? "items-end" : "items-start"}`}>
      <span className="text-xs text-mist px-1 mb-0.5">{msg.from?.name}</span>
      
      {/* Кнопки Дій (Відповісти / Реакція) з'являються при наведенні */}
      <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-panel border border-panel2 rounded-lg p-1 shadow-lg ${isMine ? "right-12" : "left-12"} -mt-5`}>
        <button onClick={onReply} className="text-[10px] text-cream hover:text-banana px-1.5 py-0.5">
          Відповісти
        </button>
        <div className="relative">
          <button onClick={() => setShowReactMenu(!showReactMenu)} className="text-[10px] text-cream hover:text-banana px-1.5 py-0.5">
            Реакція
          </button>
          
          {/* Меню вибору емоджі */}
          {showReactMenu && (
            <div className="absolute top-full mt-1 bg-panel2 border border-mist/20 rounded-full flex gap-1 p-1 shadow-xl z-30 right-0">
              {QUICK_EMOJIS.map(emoji => (
                <button 
                  key={emoji} 
                  onClick={() => {
                    onReact(emoji);
                    setShowReactMenu(false);
                  }}
                  className="hover:scale-125 transition-transform text-sm px-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-[85%] relative">
        <div className={`px-3 py-2 text-sm break-words flex flex-col ${
          isMine 
            ? "bg-banana text-ink rounded-2xl rounded-tr-sm" 
            : "bg-panel2 text-cream rounded-2xl rounded-tl-sm"
        }`}>
          {/* Цитата (якщо це відповідь) */}
          {replyQuote && (
            <div className={`text-xs mb-1 pl-2 border-l-2 opacity-80 truncate max-w-full ${isMine ? "border-ink/30" : "border-banana/50"}`}>
              <span className="font-semibold">{replyQuote.from?.name}: </span>
              {replyQuote.text}
            </div>
          )}
          
          <span>{msg.text}</span>
        </div>

        {/* Блок з відображенням реакцій */}
        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-1 z-10 relative ${isMine ? "justify-end" : "justify-start"}`}>
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <button 
                key={emoji} 
                onClick={() => onReact(emoji)}
                className="flex items-center gap-1 bg-panel border border-panel2 px-1.5 py-[2px] rounded-full text-[10px] text-cream hover:border-mist transition-colors"
                title={users.join(", ")} // Показує імена при наведенні
              >
                <span>{emoji}</span>
                <span className="text-mist">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
