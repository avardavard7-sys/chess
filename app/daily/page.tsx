'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';

export default function DailyChessPage() {
  const router = useRouter();
  const [games, setGames] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGames = useCallback(async (uid: string) => {
    const { data } = await supabase.from('daily_games')
      .select('*')
      .or(`white_id.eq.${uid},black_id.eq.${uid}`)
      .order('updated_at', { ascending: false });

    if (data && data.length > 0) {
      // Сортируем: ваш ход → активные → ожидание → завершённые
      const sorted = [...data].sort((a, b) => {
        const aMyTurn = a.status === 'active' && ((a.fen?.includes(' w ') && a.white_id === uid) || (a.fen?.includes(' b ') && a.black_id === uid));
        const bMyTurn = b.status === 'active' && ((b.fen?.includes(' w ') && b.white_id === uid) || (b.fen?.includes(' b ') && b.black_id === uid));
        if (aMyTurn && !bMyTurn) return -1;
        if (!aMyTurn && bMyTurn) return 1;
        const order: Record<string, number> = { active: 0, waiting: 1, finished: 2 };
        const aO = order[a.status] ?? 3;
        const bO = order[b.status] ?? 3;
        if (aO !== bO) return aO - bO;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      setGames(sorted);

      const allIds = [...new Set(data.flatMap(g => [g.white_id, g.black_id].filter(Boolean)))];
      if (allIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', allIds);
        if (profiles) {
          const map: Record<string, string> = {};
          profiles.forEach(p => { map[p.id] = p.username; });
          setNames(map);
        }
      }
    } else {
      setGames([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let uid: string | null = null;
    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = (id: string) => {
      uid = id;
      setUserId(id);
      loadGames(id);
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(() => { if (uid) loadGames(uid); }, 3000);
    };

    // Пробуем сразу
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        startPolling(session.user.id);
      }
      setLoading(false);
    });

    // Слушаем auth — главный источник правды
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
        setGames([]);
        if (pollInterval) clearInterval(pollInterval);
      } else if (session?.user) {
        startPolling(session.user.id);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loadGames]);

  const createGame = async () => {
    if (!userId) { alert('Войдите в аккаунт'); return; }
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from('daily_games').insert({
      white_id: userId, status: 'waiting', invite_code: code,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      moves_json: [], time_per_move_hours: 24,
    });
    if (error) { alert('Ошибка: ' + error.message); return; }
    // Копируем код
    copyCode(code);
    // Обновляем список без reload
    await loadGames(userId);
  };

  const joinGame = async () => {
    if (!joinCode.trim()) return;
    if (!userId) { alert('Войдите в аккаунт'); return; }
    const { data: game } = await supabase.from('daily_games')
      .select('*').eq('invite_code', joinCode.trim()).eq('status', 'waiting').single();
    if (!game) { alert('Партия не найдена или уже началась'); return; }
    if (game.white_id === userId) { alert('Это ваша партия!'); return; }
    const { error } = await supabase.from('daily_games').update({
      black_id: userId, status: 'active', updated_at: new Date().toISOString(),
    }).eq('id', game.id);
    if (error) { alert('Ошибка: ' + error.message); return; }
    setJoinCode('');
    router.push(`/daily/${game.id}`);
  };

  const deleteGame = async (gameId: string) => {
    if (!confirm('Удалить эту партию?')) return;
    await supabase.from('daily_games').delete().eq('id', gameId);
    if (userId) await loadGames(userId);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement('textarea');
      el.value = code; el.style.position = 'fixed'; el.style.opacity = '0';
      document.body.appendChild(el); el.select(); document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(code);
    setTimeout(() => setCopied(null), 3000);
  };

  const getOpponentName = (g: any) => {
    if (!userId) return 'Соперник';
    const oppId = g.white_id === userId ? g.black_id : g.white_id;
    return oppId ? (names[oppId] || 'Соперник') : 'Ожидание...';
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Партии по переписке</h1>
            <p className="text-white/40">24 часа на каждый ход. Играйте когда удобно!</p>
          </motion.div>

          {/* Код скопирован */}
          {copied && (
            <motion.div className="mb-4 p-3 rounded-xl text-center text-sm font-semibold"
              style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
              ✅ Код {copied} скопирован! Отправьте другу
            </motion.div>
          )}

          <motion.button onClick={createGame} className="w-full py-3 rounded-xl font-semibold text-black mb-4"
            style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }} whileHover={{ scale: 1.02 }}>
            ➕ Новая партия
          </motion.button>

          {/* Ввод кода */}
          <div className="glass p-4 rounded-xl mb-6 flex gap-2">
            <input type="text" placeholder="Введите код приглашения" value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && joinGame()}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 uppercase tracking-wider"
              maxLength={8} />
            <motion.button onClick={joinGame}
              className="px-6 py-2.5 rounded-xl font-semibold text-black"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              whileHover={{ scale: 1.02 }}>
              Войти
            </motion.button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-center py-10">
              <motion.div className="text-3xl inline-block" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
            </div>
          )}

          {/* Нет партий */}
          {!loading && games.length === 0 && (
            <div className="glass p-10 rounded-2xl text-center">
              <div className="text-5xl mb-4">📬</div>
              <p className="text-white/40">Нет активных партий</p>
              <p className="text-white/20 text-sm mt-2">Создайте новую или введите код!</p>
            </div>
          )}

          {/* Список партий */}
          {!loading && games.length > 0 && (
            <div className="space-y-3">
              {games.map(g => {
                const isMyTurn = g.status === 'active' && ((g.fen?.includes(' w ') && g.white_id === userId) || (g.fen?.includes(' b ') && g.black_id === userId));
                const isWaiting = g.status === 'waiting';
                const isActive = g.status === 'active';
                const isFinished = g.status === 'finished';
                const canDelete = isWaiting && g.white_id === userId;
                const myColor = g.white_id === userId ? 'белыми' : 'чёрными';

                return (
                  <motion.div key={g.id}
                    className={`glass p-4 rounded-xl flex items-center gap-3 transition-all cursor-pointer hover:bg-white/5 ${isMyTurn ? 'ring-1 ring-green-400/40' : isActive ? 'ring-1 ring-blue-400/20' : ''}`}
                    onClick={() => {
                      if (isActive || isFinished) router.push(`/daily/${g.id}`);
                    }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.01 }}>

                    {/* Индикатор */}
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${isMyTurn ? 'bg-green-400 animate-pulse' : isActive ? 'bg-blue-400' : isWaiting ? 'bg-yellow-400' : 'bg-white/20'}`} />

                    {/* Контент */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white/70">
                        {isWaiting && 'Ожидание соперника'}
                        {isActive && `♟ vs ${getOpponentName(g)}`}
                        {isFinished && `Завершена — vs ${getOpponentName(g)}`}
                      </div>
                      <div className="text-xs text-white/30 mt-0.5">
                        {isWaiting && (
                          <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            Код: <span className="text-yellow-400 font-mono font-bold">{g.invite_code}</span>
                            <button onClick={(e) => { e.stopPropagation(); copyCode(g.invite_code); }}
                              className="ml-1 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70">
                              {copied === g.invite_code ? '✅' : '📋'}
                            </button>
                          </span>
                        )}
                        {isActive && `Играете ${myColor} · Ход ${g.moves_json?.length || 0}`}
                        {isFinished && (g.result === 'draw' ? 'Ничья' : `Результат: ${g.result}`)}
                      </div>
                    </div>

                    {/* Статус */}
                    {isMyTurn && (
                      <motion.span className="text-xs text-green-400 font-semibold px-3 py-1.5 rounded-full bg-green-400/15 flex-shrink-0"
                        animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                        Ваш ход! →
                      </motion.span>
                    )}
                    {isActive && !isMyTurn && <span className="text-xs text-blue-400 px-2 py-1 rounded-full bg-blue-400/10 flex-shrink-0">Ждём хода →</span>}
                    {isWaiting && <span className="text-lg flex-shrink-0">⏳</span>}

                    {/* Удалить */}
                    {canDelete && (
                      <button onClick={(e) => { e.stopPropagation(); deleteGame(g.id); }}
                        className="px-2 py-1.5 rounded-lg text-xs text-red-400/50 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0">
                        🗑
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
