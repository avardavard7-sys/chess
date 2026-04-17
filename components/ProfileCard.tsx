'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTranslation } from '@/lib/i18n';
import { getRankProgress, getNextRankThreshold, getPrevRankThreshold, getRank as getEloRank } from '@/lib/elo';
import { getLichessAuthUrl } from '@/lib/lichess-auth';
import { supabase } from '@/lib/supabase';
import TrainerSection from '@/components/TrainerSection';

// Компонент выбора тренера — с поиском и удобным выбором
function TrainerSelector({ profileId, currentTrainerId, onUpdate, username }: { profileId: string; currentTrainerId?: string; onUpdate: (p: any) => void; username?: string }) {
  const { t } = useTranslation();
  const [trainers, setTrainers] = useState<any[]>([]);
  const [selected, setSelected] = useState(currentTrainerId || '');
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('school_trainers').select('*').order('name').then(({ data }) => setTrainers(data || []));
  }, []);

  useEffect(() => { setSelected(currentTrainerId || ''); }, [currentTrainerId]);

  const currentTrainer = trainers.find(tr => tr.id === selected);
  const filteredTrainers = trainers.filter(tr =>
    tr.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectTrainer = async (val: string | null) => {
    setSaving(true);
    setSelected(val || '');
    await supabase.from('profiles').update({ trainer_id: val }).eq('id', profileId);
    onUpdate((prev: any) => ({ ...prev, trainer_id: val }));
    if (val) {
      const { data: existing } = await supabase.from('school_students').select('id').eq('profile_id', profileId).maybeSingle();
      if (existing) {
        await supabase.from('school_students').update({ trainer_id: val }).eq('id', existing.id);
      } else {
        await supabase.from('school_students').insert({
          full_name: username || 'Ученик',
          profile_id: profileId,
          trainer_id: val,
          rating: 0,
          rating_history: [{ date: new Date().toLocaleDateString('ru-RU'), rating: 0 }],
        });
      }
    }
    setSaving(false);
    setShowPicker(false);
    setSearch('');
  };

  if (trainers.length === 0) return (
    <motion.div className="glass p-5 rounded-2xl mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">👨‍🏫</span>
        <div className="flex-1">
          <div className="text-xs text-white/40 mb-1">{t('my_trainer')}</div>
          <span className="text-sm text-white/30">{t('no_trainers')}</span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <>
      <motion.div className="glass p-5 rounded-2xl mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <div className="text-xs text-white/40 mb-3 flex items-center gap-2">
          <span>👨‍🏫</span>{t('my_trainer')}
        </div>
        {currentTrainer ? (
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.05))', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a1628' }}>
              {currentTrainer.name?.[0]?.toUpperCase() || 'Т'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white truncate">{currentTrainer.name}</div>
              <div className="text-[10px] text-white/40">Ваш тренер</div>
            </div>
            <button onClick={() => setShowPicker(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/15 text-white/70 hover:bg-white/5">
              Изменить
            </button>
          </div>
        ) : (
          <button onClick={() => setShowPicker(true)}
            className="w-full p-3 rounded-xl text-sm font-medium border-2 border-dashed border-white/15 text-white/50 hover:border-yellow-500/40 hover:text-yellow-400 transition-all">
            + Выбрать тренера
          </button>
        )}
      </motion.div>

      {/* Модалка выбора */}
      <AnimatePresence>
        {showPicker && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            onClick={() => setShowPicker(false)}>
            <motion.div className="glass rounded-2xl p-5 max-w-md w-full max-h-[80vh] flex flex-col"
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Выберите тренера</h3>
                <button onClick={() => setShowPicker(false)} className="text-white/40 hover:text-white text-xl">✕</button>
              </div>
              <input
                type="text" autoFocus
                placeholder="🔍 Поиск по имени..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-3"
              />
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {currentTrainer && (
                  <button onClick={() => selectTrainer(null)} disabled={saving}
                    className="w-full p-3 rounded-xl text-left flex items-center gap-3 border border-red-500/20 text-red-400 hover:bg-red-500/5">
                    <span className="text-xl">🚫</span>
                    <span className="text-sm font-medium">Без тренера</span>
                  </button>
                )}
                {filteredTrainers.length === 0 ? (
                  <div className="text-center py-8 text-white/40 text-sm">Тренеры не найдены</div>
                ) : (
                  filteredTrainers.map(tr => {
                    const isSelected = tr.id === selected;
                    return (
                      <button key={tr.id} onClick={() => selectTrainer(tr.id)} disabled={saving}
                        className="w-full p-3 rounded-xl text-left flex items-center gap-3 transition-all"
                        style={isSelected
                          ? { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)' }
                          : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a1628' }}>
                          {tr.name?.[0]?.toUpperCase() || 'Т'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{tr.name}</div>
                          {isSelected && <div className="text-[10px] text-yellow-400">✓ Текущий выбор</div>}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  rank: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_draw: number;
  lichess_username?: string;
  lichess_rating?: number;
  puzzle_rating?: number;
  puzzle_games?: number;
  is_online?: boolean;
  coins?: number;
  [key: string]: unknown;
}

interface GameHistoryItem {
  id: string;
  result: string;
  elo_change: number;
  elo_before: number;
  elo_after: number;
  played_at: string;
  opponent: {
    username: string;
    avatar_url: string;
    elo_rating: number;
  } | null;
}

interface ProfileCardProps {
  profile: Profile;
  gameHistory: GameHistoryItem[];
  onProfileUpdate?: (updated: Profile) => void;
}

export default function ProfileCard({ profile, gameHistory, onProfileUpdate }: ProfileCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(profile.username);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (trimmed.length < 2) { setNameError('Минимум 2 символа'); return; }
    if (trimmed.length > 20) { setNameError('Максимум 20 символов'); return; }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(trimmed)) { setNameError('Только буквы, цифры, _ и -'); return; }
    if (trimmed === profile.username) { setEditing(false); return; }

    setSaving(true);
    setNameError('');

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmed)
      .neq('id', profile.id)
      .single();

    if (existing) { setNameError('Этот ник уже занят'); setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({ username: trimmed })
      .eq('id', profile.id);

    if (error) { setNameError('Ошибка сохранения'); setSaving(false); return; }

    setSaving(false);
    setEditing(false);
    if (onProfileUpdate) onProfileUpdate({ ...profile, username: trimmed });
  };
  const winRate = profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0;

  const [internalRating, setInternalRating] = useState<{ rating: number; rank: string; color: string } | null>(null);
  const [realElo, setRealElo] = useState<number | null>(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [editingRealElo, setEditingRealElo] = useState(false);
  const [realEloInput, setRealEloInput] = useState('');

  useEffect(() => {
    supabase.from('school_students').select('rating').eq('profile_id', profile.id).maybeSingle().then(({ data }) => {
      if (data) {
        const RANKS = [{ min: 0, name: 'Без разряда', color: '#6b7280' }, { min: 700, name: '5 разряд', color: '#CD7F32' }, { min: 800, name: '4 разряд', color: '#3b82f6' }, { min: 1000, name: '3 разряд', color: '#8b5cf6' }, { min: 1200, name: '2 разряд', color: '#f59e0b' }, { min: 1400, name: '1 разряд', color: '#ef4444' }];
        let rank = RANKS[0]; for (let i = RANKS.length - 1; i >= 0; i--) if (data.rating >= RANKS[i].min) { rank = RANKS[i]; break; }
        setInternalRating({ rating: data.rating, rank: rank.name, color: rank.color });
      }
    });
    // Загружаем real_elo и is_trainer
    supabase.from('profiles').select('real_elo, is_trainer').eq('id', profile.id).single().then(({ data }) => {
      if (data) {
        if (data.real_elo) { setRealElo(data.real_elo); setRealEloInput(String(data.real_elo)); }
        if (data.is_trainer) setIsTrainer(true);
      }
    });
  }, [profile.id]);

  const rankProgress = getRankProgress(profile.elo_rating);
  const nextThreshold = getNextRankThreshold(profile.elo_rating);
  const prevThreshold = getPrevRankThreshold(profile.elo_rating);

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (winRate / 100) * circumference;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main profile card */}
      <motion.div
        className="glass p-8 rounded-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Avatar */}
          <motion.div
            className="relative flex-shrink-0"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-yellow-500/50 shadow-lg shadow-yellow-500/20">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.username}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-4xl font-bold text-yellow-400">
                  {profile.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            {/* Online dot */}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900" />
            {/* Загрузить аватарку */}
            <label className="absolute -bottom-1 -left-1 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer text-base shadow-lg"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#0a1628' }}
              title="Загрузить аватарку">
              📷
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    // Сжатие до 200×200, JPEG 70% → ~10-30 KB
                    const compressed: string = await new Promise((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const img = new window.Image();
                        img.onload = () => {
                          const max = 200;
                          let w = img.width, h = img.height;
                          if (w > h && w > max) { h = (h * max) / w; w = max; }
                          else if (h > max) { w = (w * max) / h; h = max; }
                          const canvas = document.createElement('canvas');
                          canvas.width = w; canvas.height = h;
                          const ctx = canvas.getContext('2d');
                          if (!ctx) return reject('no ctx');
                          ctx.drawImage(img, 0, 0, w, h);
                          resolve(canvas.toDataURL('image/jpeg', 0.7));
                        };
                        img.onerror = reject;
                        img.src = ev.target?.result as string;
                      };
                      reader.onerror = reject;
                      reader.readAsDataURL(f);
                    });
                    await supabase.from('profiles').update({ avatar_url: compressed }).eq('id', profile.id);
                    onProfileUpdate?.({ ...profile, avatar_url: compressed });
                  } catch (err) {
                    alert('Ошибка загрузки');
                    console.error(err);
                  }
                }} />
            </label>
            {profile.avatar_url && (
              <button
                onClick={async () => {
                  if (!confirm('Удалить аватарку?')) return;
                  await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id);
                  onProfileUpdate?.({ ...profile, avatar_url: null });
                }}
                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-lg"
                title="Удалить аватарку"
              >×</button>
            )}
          </motion.div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            {!editing ? (
              <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                <h1
                  className="text-3xl font-bold"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {profile.username}
                </h1>
                <motion.button
                  onClick={() => { setEditing(true); setNewName(profile.username); setNameError(''); }}
                  className="text-white/30 hover:text-yellow-400 transition-colors"
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  title="Изменить имя"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </motion.button>
              </div>
            ) : (
              <div className="mb-1">
                <div className="flex items-center gap-2 justify-center md:justify-start">
                  <input
                    value={newName}
                    onChange={(e) => { setNewName(e.target.value); setNameError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    maxLength={20}
                    autoFocus
                    className="bg-white/10 rounded-lg px-3 py-1.5 text-white border border-white/20 focus:border-yellow-400/50 focus:outline-none text-lg font-bold w-48"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  />
                  <motion.button
                    onClick={handleSaveName}
                    disabled={saving}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold text-black"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  >
                    {saving ? '...' : 'OK'}
                  </motion.button>
                  <motion.button
                    onClick={() => { setEditing(false); setNameError(''); }}
                    className="px-3 py-1.5 rounded-lg text-sm border border-white/15 text-white/50 hover:text-white/80"
                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  >
                    Отмена
                  </motion.button>
                </div>
                <AnimatePresence>
                  {nameError && (
                    <motion.p className="text-red-400 text-xs mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {nameError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            )}
            <p className="text-white/50 mb-4 text-sm">{getEloRank(realElo || profile.elo_rating)}</p>

            {/* ELO + Internal Rating */}
            <div className="flex items-center gap-6 mb-6 flex-wrap">
              <div className="inline-flex items-center gap-3">
                <span className="text-5xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
                  {realElo || profile.elo_rating}
                </span>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider">{realElo ? 'Настоящий ELO' : 'ELO рейтинг'}</div>
                  <div className="text-sm text-white/60">{getEloRank(realElo || profile.elo_rating)}</div>
                </div>
              </div>
              {internalRating && (
                <div className="inline-flex items-center gap-3">
                  <span className="text-5xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: internalRating.color }}>
                    {internalRating.rating}
                  </span>
                  <div>
                    <div className="text-xs text-white/40 uppercase tracking-wider">{t('internal_rating')}</div>
                    <div className="text-sm" style={{ color: internalRating.color }}>{internalRating.rank}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Тренер — установить настоящий ELO */}
            {isTrainer && (
              <div className="mb-4">
                {editingRealElo ? (
                  <div className="flex items-center gap-2">
                    <input type="number" value={realEloInput} onChange={e => setRealEloInput(e.target.value)} placeholder="Ваш настоящий ELO"
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm" />
                    <button onClick={async () => {
                      const val = parseInt(realEloInput) || 0;
                      await supabase.from('profiles').update({ real_elo: val > 0 ? val : null }).eq('id', profile.id);
                      setRealElo(val > 0 ? val : null);
                      setEditingRealElo(false);
                    }} className="px-3 py-2 rounded-xl text-xs font-semibold text-black bg-yellow-400">{t('save')}</button>
                    <button onClick={() => setEditingRealElo(false)} className="px-3 py-2 rounded-xl text-xs text-white/30 border border-white/10">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setEditingRealElo(true)}
                    className="text-xs text-yellow-400/60 hover:text-yellow-400 border border-yellow-400/20 px-3 py-1.5 rounded-lg">
                    {realElo ? `✏️ Изменить настоящий ELO (${realElo})` : '🏅 Добавить мой настоящий ELO'}
                  </button>
                )}
              </div>
            )}

            {/* Rank progress bar */}
            <div className="space-y-1">
              {(() => {
                const effectiveElo = realElo || profile.elo_rating;
                const prev = getPrevRankThreshold(effectiveElo);
                const next = getNextRankThreshold(effectiveElo);
                const progress = getRankProgress(effectiveElo);
                return (
                  <>
                    <div className="flex justify-between text-xs text-white/40">
                      <span>{prev}</span>
                      <span>{t('to_next_rank')}: {next - effectiveElo} ELO</span>
                      <span>{next}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #7c3aed)' }}
                        initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, delay: 0.3 }} />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Win rate ring */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <svg width="100" height="100" className="rotate-[-90deg]">
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <motion.circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
            </svg>
            <div className="mt-[-70px] text-center z-10 relative">
              <div className="text-2xl font-bold text-yellow-400">{winRate}%</div>
              <div className="text-xs text-white/40 mt-1">{t('profile_wins')}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { label: t('admin_coins'), value: profile.coins || 0, color: '#f59e0b', icon: '🪙' },
          { label: t('profile_games'), value: profile.games_played, color: '#94a3b8', icon: '♟' },
          { label: t('profile_wins'), value: profile.games_won, color: '#4ade80', icon: '🏆' },
          { label: t('profile_losses'), value: profile.games_lost, color: '#f87171', icon: '😔' },
          { label: t('profile_draws'), value: profile.games_draw, color: '#94a3b8', icon: '🤝' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass p-5 rounded-xl text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <motion.div
              className="text-3xl font-bold mb-1"
              style={{ color: stat.color, fontFamily: "'Playfair Display', serif" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            >
              {stat.value}
            </motion.div>
            <div className="text-xs text-white/40 uppercase tracking-wider">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Lichess + Puzzle Rating + Тренер */}
      <motion.div className="glass p-5 rounded-2xl mb-6 flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex-1 flex items-center gap-4">
          <span className="text-3xl">{'♞'}</span>
          <div>
            <div className="text-xs text-white/40">Lichess</div>
            {profile.lichess_username ? (
              <div>
                <span className="text-sm font-bold text-green-400">{profile.lichess_username}</span>
                <span className="text-xs text-white/30 ml-2">ELO {profile.lichess_rating || '?'}</span>
              </div>
            ) : (
              <button onClick={async () => {
                const redirectUri = `${window.location.origin}/auth/lichess`;
                const url = await getLichessAuthUrl(redirectUri);
                window.location.href = url;
              }} className="text-sm text-yellow-400 hover:text-yellow-300 underline">
                Подключить Lichess
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 flex items-center gap-4">
          <span className="text-3xl">{'🧩'}</span>
          <div>
            <div className="text-xs text-white/40">Puzzle Rating</div>
            <span className="text-sm font-bold text-purple-400">{profile.puzzle_rating || 1200}</span>
            <span className="text-xs text-white/30 ml-2">{profile.puzzle_games || 0} задач</span>
          </div>
        </div>
      </motion.div>

      {/* Выбор тренера */}
      <TrainerSelector profileId={profile.id} currentTrainerId={profile.trainer_id as string | undefined} username={profile.username} onUpdate={(updater: any) => {
        if (onProfileUpdate) {
          const updated = typeof updater === 'function' ? updater(profile) : updater;
          onProfileUpdate(updated);
        }
      }} />

      {/* Раздел "От тренера" — домашка, комментарии, расписание */}
      <TrainerSection userId={profile.id} />

      {/* Rating graph */}
      {gameHistory.length >= 2 && (
        <motion.div className="glass p-5 rounded-2xl mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
          <h2 className="text-lg font-bold playfair mb-4">{t('rating_chart')}</h2>
          <div style={{ height: 120 }}>
            <svg viewBox="0 0 400 100" className="w-full h-full">
              {(() => {
                const games = [...gameHistory].reverse().slice(-30);
                const ratings = games.map(g => g.elo_after || 0).filter(r => r > 0);
                if (ratings.length < 2) return null;
                const minR = Math.min(...ratings) - 20;
                const maxR = Math.max(...ratings) + 20;
                const range = maxR - minR || 1;
                const points = ratings.map((r, i) => {
                  const x = (i / (ratings.length - 1)) * 380 + 10;
                  const y = 90 - ((r - minR) / range) * 80;
                  return `${x},${y}`;
                });
                const lastR = ratings[ratings.length - 1];
                const firstR = ratings[0];
                const color = lastR >= firstR ? '#4ade80' : '#f87171';
                return (
                  <>
                    <defs>
                      <linearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={`10,90 ${points.join(' ')} 390,90`} fill="url(#ratingGrad)" />
                    <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                    <circle cx={390} cy={90 - ((lastR - minR) / range) * 80} r="3" fill={color} />
                    <text x="5" y="12" fill="rgba(255,255,255,0.3)" fontSize="8">{maxR}</text>
                    <text x="5" y="95" fill="rgba(255,255,255,0.3)" fontSize="8">{minR}</text>
                    <text x="370" y={85 - ((lastR - minR) / range) * 80} fill={color} fontSize="9" fontWeight="bold">{lastR}</text>
                  </>
                );
              })()}
            </svg>
          </div>
        </motion.div>
      )}

      {/* Game history table */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-bold playfair">{t('recent_games')}</h2>
        </div>

        {gameHistory.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            <div className="text-4xl mb-3">♟</div>
            <p>{t('no_games_play')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider">{t('opponent_col')}</th>
                  <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider">{t('result_col')}</th>
                  <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider">ELO</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 uppercase tracking-wider">{t('date_col')}</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.map((game, i) => (
                  <motion.tr
                    key={game.id}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-sm">
                          {game.opponent?.avatar_url ? (
                            <Image
                              src={game.opponent.avatar_url}
                              alt={game.opponent.username || 'AI'}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>🤖</span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{game.opponent?.username || 'Компьютер'}</div>
                          {game.opponent && (
                            <div className="text-xs text-white/40">ELO {game.opponent.elo_rating}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: game.result === 'win'
                            ? 'rgba(74,222,128,0.15)'
                            : game.result === 'loss'
                            ? 'rgba(248,113,113,0.15)'
                            : 'rgba(148,163,184,0.15)',
                          color: game.result === 'win' ? '#4ade80' : game.result === 'loss' ? '#f87171' : '#94a3b8',
                        }}
                      >
                        {game.result === 'win' ? '🏆 ' + t('game_over_win') : game.result === 'loss' ? '😔 ' + t('game_over_loss') : '🤝 ' + t('game_over_draw')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className="font-bold text-sm"
                        style={{ color: game.elo_change >= 0 ? '#4ade80' : '#f87171' }}
                      >
                        {game.elo_change >= 0 ? '+' : ''}{game.elo_change}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-white/40">
                      {new Date(game.played_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
