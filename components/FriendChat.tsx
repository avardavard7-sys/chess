'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { getMessages, sendMessage, markMessagesRead } from '@/lib/friends';

interface FriendChatProps {
  userId: string;
  friend: { id: string; username: string; avatar_url: string; elo_rating: number };
  onClose: () => void;
  onInvite: (friendId: string) => void;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  text: string;
  created_at: string;
  read: boolean;
}

export default function FriendChat({ userId, friend, onClose, onInvite }: FriendChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const load = async () => {
      const msgs = await getMessages(userId, friend.id);
      setMessages(msgs as Message[]);
      setLoading(false);
      await markMessagesRead(userId, friend.id);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    load();

    const channel = supabase.channel(`dm:${[userId, friend.id].sort().join(':')}`);
    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'MSG' }, ({ payload }) => {
        if (payload.sender_id === friend.id) {
          setMessages((prev) => [...prev, payload as Message]);
          markMessagesRead(userId, friend.id);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .on('broadcast', { event: 'GAME_INVITE' }, ({ payload }) => {
        if (payload.from === friend.id) {
          const inviteMsg: Message = {
            id: `invite-${Date.now()}`,
            sender_id: friend.id,
            receiver_id: userId,
            text: `[INVITE:${payload.invite_code}]`,
            created_at: new Date().toISOString(),
            read: true,
          };
          setMessages((prev) => [...prev, inviteMsg]);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, friend.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    const msg: Message = {
      id: `temp-${Date.now()}`,
      sender_id: userId,
      receiver_id: friend.id,
      text,
      created_at: new Date().toISOString(),
      read: false,
    };
    setMessages((prev) => [...prev, msg]);
    setInput('');

    await sendMessage(userId, friend.id, text);
    channelRef.current?.send({ type: 'broadcast', event: 'MSG', payload: msg });
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleInvite = () => {
    onInvite(friend.id);
  };

  const renderMessage = (msg: Message) => {
    const isMe = msg.sender_id === userId;
    const isInvite = msg.text.startsWith('[INVITE:');

    if (isInvite) {
      const code = msg.text.replace('[INVITE:', '').replace(']', '');
      return (
        <motion.div key={msg.id} className="flex justify-center my-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <div className="text-sm text-yellow-400 font-semibold mb-1">
              {isMe ? 'Вы отправили приглашение' : `${friend.username} приглашает в игру`}
            </div>
            {!isMe && (
              <button
                onClick={() => window.location.href = `/invite/${code}`}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-black"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                Принять
              </button>
            )}
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="max-w-[80%] px-3 py-2 rounded-xl text-sm"
          style={isMe
            ? { background: 'rgba(124,58,237,0.7)', color: 'white', borderRadius: '14px 14px 4px 14px' }
            : { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', borderRadius: '14px 14px 14px 4px' }
          }
        >
          <div>{msg.text}</div>
          <div className="text-xs opacity-40 mt-0.5 text-right">
            {new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <div className="flex items-center gap-3 p-4 border-b border-white/10">
        <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="w-9 h-9 rounded-full overflow-hidden border border-yellow-500/40 flex-shrink-0">
          {friend.avatar_url ? (
            <Image src={friend.avatar_url} alt={friend.username} width={36} height={36} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-sm font-bold text-yellow-400">
              {friend.username[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{friend.username}</div>
          <div className="text-xs text-yellow-400">ELO {friend.elo_rating}</div>
        </div>
        <motion.button
          onClick={handleInvite}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
        >
          Пригласить
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-white/30 text-sm">Загрузка...</div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/25 text-sm">Начните общение</div>
        ) : (
          messages.map(renderMessage)
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 px-3 py-3 border-t border-white/10 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Написать..."
          maxLength={200}
          className="flex-1 bg-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 border border-white/10 focus:border-purple-500/50 focus:outline-none"
        />
        <motion.button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-30 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }}
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
        >
          ➤
        </motion.button>
      </div>
    </motion.div>
  );
}
