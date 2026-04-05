'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { createGameInvite } from '@/lib/friends';

interface Friend { id: string; username: string; avatar_url: string; elo_rating: number; }

interface GameInviteModalProps {
  userId: string;
  friends: Friend[];
  isOpen: boolean;
  onClose: () => void;
  onInviteCreated?: (code: string, inviteId: string) => void;
}

const TIME_CONTROLS = [
  { label: '1+0', minutes: 1, increment: 0, type: 'Bullet' },
  { label: '3+0', minutes: 3, increment: 0, type: 'Blitz' },
  { label: '3+2', minutes: 3, increment: 2, type: 'Blitz' },
  { label: '5+0', minutes: 5, increment: 0, type: 'Blitz' },
  { label: '5+3', minutes: 5, increment: 3, type: 'Blitz' },
  { label: '10+0', minutes: 10, increment: 0, type: 'Rapid' },
  { label: '15+10', minutes: 15, increment: 10, type: 'Rapid' },
  { label: '♾️', minutes: 0, increment: 0, type: 'Без таймера' },
];

export default function GameInviteModal({ userId, friends, isOpen, onClose, onInviteCreated }: GameInviteModalProps) {
  const [tab, setTab] = useState<'link' | 'friend'>('link');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [selectedTC, setSelectedTC] = useState(4);
  const tc = TIME_CONTROLS[selectedTC];

  const createInviteLink = async () => {
    setCreating(true);
    const { data } = await createGameInvite(userId, undefined, tc.minutes, tc.increment);
    if (data) { setInviteCode(data.invite_code); setInviteId(data.id); onInviteCreated?.(data.invite_code, data.id); }
    setCreating(false);
  };

  const inviteFriend = async (friendId: string) => {
    setWaitingFor(friendId);
    const { data } = await createGameInvite(userId, friendId, tc.minutes, tc.increment);
    if (data) {
      setInviteCode(data.invite_code); setInviteId(data.id); onInviteCreated?.(data.invite_code, data.id);
      const channel = supabase.channel(`dm:${[userId, friendId].sort().join(':')}`);
      await channel.send({ type: 'broadcast', event: 'GAME_INVITE', payload: { from: userId, invite_code: data.invite_code, time_control: tc } });
      channel.unsubscribe();
    }
  };

  useEffect(() => {
    if (!inviteId) return;
    const channel = supabase.channel(`invite:${inviteId}`);
    channel.on('broadcast', { event: 'ACCEPTED' }, () => {
      window.location.href = `/game/friend?mode=friend&session=${inviteId}&color=white&tc_min=${tc.minutes}&tc_inc=${tc.increment}`;
    }).subscribe();
    return () => { channel.unsubscribe(); };
  }, [inviteId, tc]);

  const copyLink = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteCode}?tc_min=${tc.minutes}&tc_inc=${tc.increment}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => { if (!isOpen) { setInviteCode(null); setInviteId(null); setCopied(false); setWaitingFor(null); } }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(245,158,11,0.3)' }}
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}>
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Пригласить в игру</h2>
              <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl">x</button>
            </div>

            {/* Выбор тайминга */}
            {!inviteCode && (
              <div className="px-5 pt-4">
                <div className="text-xs text-white/40 mb-2">Тайминг:</div>
                <div className="flex flex-wrap gap-1.5">
                  {TIME_CONTROLS.map((t, i) => (
                    <button key={i} onClick={() => setSelectedTC(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedTC === i ? 'text-black bg-yellow-400' : 'text-white/50 border border-white/10 hover:bg-white/5'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-white/20 mt-1">{tc.type}{tc.minutes > 0 ? ` · ${tc.minutes} мин` : ''}{tc.increment > 0 ? ` + ${tc.increment} сек` : ''}</div>
              </div>
            )}

            <div className="flex border-b border-white/10 mt-3">
              {(['link', 'friend'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-white/40 hover:text-white/60'}`}>
                  {t === 'link' ? 'По ссылке' : 'Пригласить друга'}
                </button>
              ))}
            </div>

            <div className="p-5">
              {tab === 'link' && (
                <div className="text-center">
                  {!inviteCode ? (
                    <motion.button onClick={createInviteLink} disabled={creating} className="w-full py-4 rounded-xl font-bold text-black"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                      {creating ? 'Создаём...' : `Создать ссылку (${tc.label})`}
                    </motion.button>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-4xl font-mono font-bold text-yellow-400 tracking-widest">{inviteCode}</div>
                      <div className="text-xs text-white/30">Тайминг: {tc.label} ({tc.type})</div>
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={copyLink}>
                        <input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${inviteCode}?tc_min=${tc.minutes}&tc_inc=${tc.increment}`}
                          className="flex-1 bg-transparent text-sm text-white/70 outline-none cursor-pointer" />
                        <span className="text-xs text-yellow-400 font-semibold flex-shrink-0">{copied ? 'Скопировано!' : 'Копировать'}</span>
                      </div>
                      <p className="text-white/30 text-xs">Отправьте ссылку другу. Ожидание...</p>
                      <motion.div className="text-3xl" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'friend' && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {friends.length === 0 ? (
                    <p className="text-center text-white/30 text-sm py-8">У вас пока нет друзей.</p>
                  ) : friends.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-yellow-500/20 flex items-center justify-center text-sm font-bold text-yellow-400 flex-shrink-0">
                        {f.avatar_url ? <img src={f.avatar_url} alt={f.username} className="w-full h-full object-cover" /> : f.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{f.username}</div>
                        <div className="text-xs text-yellow-400">ELO {f.elo_rating}</div>
                      </div>
                      <motion.button onClick={() => inviteFriend(f.id)} disabled={!!waitingFor}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black disabled:opacity-50 flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        {waitingFor === f.id ? 'Ждём...' : `Пригласить (${tc.label})`}
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
