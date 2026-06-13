import { useEffect, useRef, useState } from "react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

// Розширений список для панелі вводу
const INPUT_EMOJIS = [
  "😀", "😂", "😅", "😍", "🥰", "😎", "😏", "🤔", "🙄", "😬",
  "😭", "😡", "👍", "👎", "❤️", "💔", "🔥", "✨", "🎉", "🍌",
  "👀", "💯", "🤡", "👽", "👻", "🤓", "🤝", "🙏"
];

/**
 * Панель чату: історія повідомлень + поле введення + реакції + відповіді + розумний скрол.
 */
export default function ChatPanel({ chatHistory, onSend, myUserId, onToggleReaction }) {
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true); // Відстежуємо позицію скролу
  
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Надійний скрол до низу
  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Розумний автоскрол при нових повідомленнях
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [chatHistory, isAtBottom]);

  // Обробник скролу: перевіряємо, чи користувач прогорнув вгору
  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    
    // Якщо до кінця залишилось менше 50px, вважаємо, що ми внизу
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(isNearBottom);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    
    onSend(trimmed, replyingTo?.id || null);
    
    setText("");
    setReplyingTo(null);
    setShowEmojiPicker(false);
    
    // Примусово скролимо вниз після власного повідомлення
    setTimeout(() => scrollToBottom("smooth"), 100);
  };

  const addEmojiToInput = (emoji) => {
    setText((prev) => prev + emoji);
  };

  const getReplyMessage = (id) => chatHistory.find((m) => m.id === id);

  return (
    <div className="flex flex-col h-full relative">
      {/* Контейнер повідомлень */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-3 pb-4"
      >
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
        <div ref={messagesEndRef} />
      </div>

      {/* Плаваюча кнопка скролу вниз (з'являється, якщо прогорнули вгору) */}
      {!isAtBottom && (
        <button
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-20 right-4 bg-panel2/90 backdrop-blur text-banana w-10 h-10 rounded-full shadow-lg flex items-center justify-center hover:bg-panel border border-mist/20 z-10 transition-transform active:scale-90"
          title="Вниз"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      )}

      {/* Нижня панель вводу */}
      <div className="bg-panel border-t border-panel2 flex flex-col relative">
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

        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
          
          {/* Кнопка Емоджі */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-mist hover:text-banana transition-colors rounded-full hover:bg-panel2"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
            </button>

            {/* Попап з емоджі */}
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 bg-panel2 border border-mist/20 rounded-xl p-2 shadow-2xl w-64 z-50">
                <div className="grid grid-cols-7 gap-1">
                  {INPUT_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => addEmojiToInput(emoji)}
                      className="hover:bg-panel rounded p-1 text-lg hover:scale-110 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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

        {/* Прозорий оверлей для закриття панелі емоджі при кліку поза нею */}
        {showEmojiPicker && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowEmojiPicker(false)}
          />
        )}
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
      
      <div className={`absolute top-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-panel border border-panel2 rounded-lg p-1 shadow-lg ${isMine ? "right-12" : "left-12"} -mt-5`}>
        <button onClick={onReply} className="text-[10px] text-cream hover:text-banana px-1.5 py-0.5">
          Відповісти
        </button>
        <div className="relative">
          <button onClick={() => setShowReactMenu(!showReactMenu)} className="text-[10px] text-cream hover:text-banana px-1.5 py-0.5">
            Реакція
          </button>
          
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
          {replyQuote && (
            <div className={`text-xs mb-1 pl-2 border-l-2 opacity-80 truncate max-w-full ${isMine ? "border-ink/30" : "border-banana/50"}`}>
              <span className="font-semibold">{replyQuote.from?.name}: </span>
              {replyQuote.text}
            </div>
          )}
          
          <span>{msg.text}</span>
        </div>

        {hasReactions && (
          <div className={`flex flex-wrap gap-1 mt-1 z-10 relative ${isMine ? "justify-end" : "justify-start"}`}>
            {Object.entries(msg.reactions).map(([emoji, users]) => (
              <button 
                key={emoji} 
                onClick={() => onReact(emoji)}
                className="flex items-center gap-1 bg-panel border border-panel2 px-1.5 py-[2px] rounded-full text-[10px] text-cream hover:border-mist transition-colors"
                title={users.join(", ")}
              >
                <span>{emoji}</span>
                <span className="text-mist">{users.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      
      {showReactMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowReactMenu(false)} />
      )}
    </div>
  );
}
