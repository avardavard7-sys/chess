'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

interface NicknameModalProps {
  userId: string;
  onComplete: (nickname: string) => void;
}

export default function NicknameModal({ userId, onComplete }: NicknameModalProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2) {
      setError('Минимум 2 символа');
      return;
    }
    if (trimmed.length > 20) {
      setError('Максимум 20 символов');
      return;
    }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(trimmed)) {
      setError('Только буквы, цифры, _ и -');
      return;
    }

    setLoading(true);
    setError('');

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .neq('id', userId)
      .single();

    if (existing) {
      setError('Этот ник уже занят');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', userId);

    if (updateError) {
      setError('Ошибка сохранения');
      setLoading(false);
      return;
    }

    setLoading(false);
    onComplete(trimmed);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass p-8 rounded-2xl text-center max-w-sm w-full mx-4"
        style={{ border: '1px solid rgba(245,158,11,0.3)' }}
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div className="text-5xl mb-4">♞</div>
        <h2
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}
        >
          Выберите ник
        </h2>
        <p className="text-white/50 text-sm mb-6">
          Ваш ник будет виден соперникам в онлайн игре
        </p>

        <input
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Введите ник..."
          maxLength={20}
          autoFocus
          className="w-full bg-white/8 rounded-xl px-4 py-3 text-white placeholder-white/30 border border-white/15 focus:border-yellow-400/50 focus:outline-none text-center text-lg mb-2"
        />

        <AnimatePresence>
          {error && (
            <motion.p
              className="text-red-400 text-sm mb-3"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <div className="text-xs text-white/30 mb-5">
          {nickname.length}/20 символов
        </div>

        <motion.button
          onClick={handleSubmit}
          disabled={loading || nickname.trim().length < 2}
          className="w-full py-3 rounded-xl font-bold text-black disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          {loading ? '...' : 'Начать играть →'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
