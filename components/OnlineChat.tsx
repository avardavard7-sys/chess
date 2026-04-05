'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface ChatMessage {
  id: string;
  text: string;
  sender: 'me' | 'opponent';
  time: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
}

const QUICK_REACTIONS = ['👍', '😮', '😂', '😤', '🤝', '👏', '🔥', '💀'];
const QUICK_PHRASES = [
  'Хороший ход!',
  'Ничья?',
  'Удачи!',
  'GG!',
  'Интересно...',
  'Спасибо за игру!',
];

interface OnlineChatProps {
  sessionId: string;
  playerColor: 'white' | 'black';
}

export default function OnlineChat({ sessionId, playerColor }: OnlineChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`chat:${sessionId}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'CHAT' }, ({ payload }) => {
        const msg: ChatMessage = {
          id: Date.now().toString(),
          text: payload.text,
          sender: 'opponent',
          time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, msg]);
        if (!isOpen) setUnread((u) => u + 1);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      })
      .on('broadcast', { event: 'REACTION' }, ({ payload }) => {
        addFloatingReaction(payload.emoji);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [sessionId]);

  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [isOpen]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !channelRef.current) return;
    const msg: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender: 'me',
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, msg]);
    setInput('');
    await channelRef.current.send({
      type: 'broadcast',
      event: 'CHAT',
      payload: { text },
    });
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const sendReaction = async (emoji: string) => {
    if (!channelRef.current) return;
    addFloatingReaction(emoji);
    await channelRef.current.send({
      type: 'broadcast',
      event: 'REACTION',
      payload: { emoji },
    });
  };

  const addFloatingReaction = (emoji: string) => {
    const id = Date.now().toString() + Math.random();
    const x = 20 + Math.random() * 60;
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000);
  };

  return (
    <>
      {/* Floating reactions */}
      <div className="fixed bottom-20 right-6 z-50 pointer-events-none w-24">
        <AnimatePresence>
          {floatingReactions.map((r) => (
            <motion.div
              key={r.id}
              className="absolute text-3xl"
              style={{ left: `${r.x}%` }}
              initial={{ opacity: 1, y: 0, scale: 0.5 }}
              animate={{ opacity: 0, y: -120, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Chat toggle button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 rounded-full flex items-center justify-center text-2xl shadow-lg"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', width: 52, height: 52 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        💬
        {unread > 0 && (
          <motion.div
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center text-white"
            initial={{ scale: 0 }} animate={{ scale: 1 }}
          >
            {unread}
          </motion.div>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-24 right-6 z-50 w-80 rounded-2xl overflow-hidden flex flex-col"
            style={{
              background: 'rgba(15,23,42,0.97)',
              border: '1px solid rgba(124,58,237,0.3)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              height: 400,
            }}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-shrink-0">
              <span className="text-sm font-semibold text-white/80">Чат с соперником</span>
              <button onClick={() => setIsOpen(false)} className="text-white/30 hover:text-white/60 transition-colors text-lg leading-none">✕</button>
            </div>

            {/* Reactions bar */}
            <div className="flex gap-2 px-3 py-2 border-b border-white/8 flex-shrink-0 overflow-x-auto">
              {QUICK_REACTIONS.map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="text-xl flex-shrink-0 hover:scale-125 transition-transform"
                  whileTap={{ scale: 0.8 }}
                  title="Отправить реакцию"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-white/25 text-sm text-center mt-8">
                  Начните общение с соперником 👋
                </p>
              )}
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div
                    className="max-w-[80%] px-3 py-2 rounded-xl text-sm"
                    style={
                      msg.sender === 'me'
                        ? { background: 'rgba(124,58,237,0.7)', color: 'white', borderRadius: '14px 14px 4px 14px' }
                        : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', borderRadius: '14px 14px 14px 4px' }
                    }
                  >
                    <div>{msg.text}</div>
                    <div className="text-xs opacity-40 mt-0.5 text-right">{msg.time}</div>
                  </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick phrases */}
            <div className="flex gap-1.5 px-3 py-2 border-t border-white/8 overflow-x-auto flex-shrink-0">
              {QUICK_PHRASES.map((phrase) => (
                <button
                  key={phrase}
                  onClick={() => sendMessage(phrase)}
                  className="flex-shrink-0 text-xs px-2.5 py-1 rounded-lg border border-white/15 text-white/55 hover:text-white/80 hover:border-white/30 transition-all whitespace-nowrap"
                >
                  {phrase}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex gap-2 px-3 py-3 border-t border-white/10 flex-shrink-0">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
                placeholder="Написать..."
                maxLength={100}
                className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 border border-white/10 focus:border-purple-500/50 focus:outline-none"
              />
              <motion.button
                onClick={() => sendMessage(input)}
                disabled={!input.trim()}
                className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.9 }}
              >
                ➤
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
