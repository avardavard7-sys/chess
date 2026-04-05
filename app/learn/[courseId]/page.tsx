'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { getCourseById, loadPuzzlesForCourse, type Puzzle } from '@/lib/puzzles';
import { updatePuzzleRating } from '@/lib/puzzle-rating';
import { supabase } from '@/lib/supabase';

type PuzzleState = 'loading' | 'thinking' | 'correct' | 'wrong' | 'complete' | 'error';

export default function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const router = useRouter();
  const course = getCourseById(courseId);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [state, setState] = useState<PuzzleState>('loading');
  const [fen, setFen] = useState('');
  const [moveStep, setMoveStep] = useState(0);
  const [showHintArrow, setShowHintArrow] = useState(false);
  const [score, setScore] = useState(0);
  const [solvedSet, setSolvedSet] = useState<Set<string>>(new Set());
  const [shaking, setShaking] = useState(false);
  const [boardWidth, setBoardWidth] = useState(400);
  const [customArrows, setCustomArrows] = useState<[Square, Square, string?][]>([]);
  const [lastMoveSquares, setLastMoveSquares] = useState<Record<string, React.CSSProperties>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const chessRef = useRef(new Chess());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const u = () => { const w = window.innerWidth; setBoardWidth(Math.min(w < 640 ? w - 32 : w < 1024 ? 380 : 440, 480)); };
    u(); window.addEventListener('resize', u); return () => window.removeEventListener('resize', u);
  }, []);

  useEffect(() => {
    if (!course) return;
    setState('loading');
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (user) {
        setUserId(user.id);
        const { data } = await supabase.from('learn_progress').select('solved_puzzles, solved_count').eq('user_id', user.id).eq('course_id', courseId).maybeSingle();
        if (data) { setSolvedSet(new Set(data.solved_puzzles || [])); setScore(data.solved_count || 0); }
      }
      const loaded = await loadPuzzlesForCourse(course, (n) => setLoadingProgress(n));
      if (loaded.length > 0) { setPuzzles(loaded); setState('thinking'); } else { setState('error'); }
    };
    load();
  }, [courseId, course]);

  const currentPuzzle = puzzles[puzzleIndex] || null;

  const initRef = useRef<string>('');

  useEffect(() => {
    if (!currentPuzzle || puzzles.length === 0) return;
    // Предотвращаем повторную инициализацию той же задачи
    const key = currentPuzzle.id + '-' + puzzleIndex;
    if (initRef.current === key) return;
    initRef.current = key;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    let chess: Chess;
    try {
      chess = new Chess(currentPuzzle.fen);
    } catch {
      console.error('Invalid FEN:', currentPuzzle.fen);
      if (puzzleIndex < puzzles.length - 1) {
        setTimeout(() => setPuzzleIndex(puzzleIndex + 1), 100);
      }
      return;
    }
    chessRef.current = chess;
    setFen(currentPuzzle.fen);
    setMoveStep(0);
    setState('thinking');
    setShowHintArrow(false);
    setCustomArrows([]);
    setLastMoveSquares({});
    setSelectedSquare(null);

    if (currentPuzzle.moves.length > 0) {
      const uci = currentPuzzle.moves[0];
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      const promo = uci.length === 5 ? uci[4] : undefined;
      timeoutRef.current = setTimeout(() => {
        try {
          const m = chess.move({ from, to, promotion: promo as 'q' | 'r' | 'b' | 'n' | undefined });
          if (m) {
            setFen(chess.fen());
            setLastMoveSquares({ [from]: { backgroundColor: 'rgba(148,163,184,0.3)' }, [to]: { backgroundColor: 'rgba(148,163,184,0.45)' } });
            setMoveStep(1);
            playSound('move');
          } else {
            // Невалидный первый ход — пропускаем задачу
            if (puzzleIndex < puzzles.length - 1) {
              initRef.current = '';
              setPuzzleIndex(puzzleIndex + 1);
            }
          }
        } catch {
          // Ошибка — пропускаем
          if (puzzleIndex < puzzles.length - 1) {
            initRef.current = '';
            setPuzzleIndex(puzzleIndex + 1);
          }
        }
      }, 600);
    }
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [puzzleIndex, puzzles.length]);

  const getPlayerColor = (): 'white' | 'black' => {
    if (!currentPuzzle) return 'white';
    try {
      const c = new Chess(currentPuzzle.fen);
      if (currentPuzzle.moves.length > 0) {
        const u = currentPuzzle.moves[0];
        c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length === 5 ? u[4] as 'q' | 'r' | 'b' | 'n' : undefined });
      }
      return c.turn() === 'w' ? 'white' : 'black';
    } catch { return 'white'; }
  };
  const playerColor = getPlayerColor();
  const triggerShake = () => { setShaking(true); setTimeout(() => setShaking(false), 500); };

  const saveProgress = useCallback(async (ns: Set<string>) => {
    if (!userId || !course) return;
    await supabase.from('learn_progress').upsert({ user_id: userId, course_id: course.id, solved_puzzles: Array.from(ns), solved_count: ns.size, updated_at: new Date().toISOString() }, { onConflict: 'user_id,course_id' });
  }, [userId, course]);

  const makeComputerMove = useCallback((puzzle: Puzzle, step: number) => {
    if (step >= puzzle.moves.length) return;
    const uci = puzzle.moves[step];
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;
    const pr = uci.length === 5 ? uci[4] : undefined;
    timeoutRef.current = setTimeout(() => {
      try {
        const m = chessRef.current.move({ from, to, promotion: pr as 'q' | 'r' | 'b' | 'n' | undefined });
        if (m) { setFen(chessRef.current.fen()); setLastMoveSquares({ [from]: { backgroundColor: 'rgba(148,163,184,0.3)' }, [to]: { backgroundColor: 'rgba(148,163,184,0.45)' } }); setMoveStep(step + 1); }
      } catch { /* skip */ }
    }, 500);
  }, []);

  const checkPlayerMove = useCallback((from: string, to: string, promotion?: string) => {
    if (!currentPuzzle || state !== 'thinking') return false;
    const exp = currentPuzzle.moves[moveStep];
    if (!exp) return false;
    const pUci = from + to + (promotion || '');
    if (pUci === exp) {
      try {
        const m = chessRef.current.move({ from: from as Square, to: to as Square, promotion: (promotion || undefined) as 'q' | 'r' | 'b' | 'n' | undefined });
        if (!m) return false;
      } catch { return false; }
      setFen(chessRef.current.fen()); setCustomArrows([]); setShowHintArrow(false);
      setLastMoveSquares({ [from]: { backgroundColor: 'rgba(74,222,128,0.3)' }, [to]: { backgroundColor: 'rgba(74,222,128,0.5)' } });
      const ns = moveStep + 1;
      if (ns >= currentPuzzle.moves.length) {
        setState('correct');
        if (!solvedSet.has(currentPuzzle.id)) { const s = new Set(solvedSet); s.add(currentPuzzle.id); setSolvedSet(s); setScore(s.size); saveProgress(s);
          if (userId) updatePuzzleRating(userId, currentPuzzle.id, currentPuzzle.rating, true).catch(() => {});
        }
        playSound('correct');
      } else { setMoveStep(ns); makeComputerMove(currentPuzzle, ns); playSound('move'); }
      return true;
    } else { setState('wrong'); triggerShake(); playSound('wrong'); setTimeout(() => setState('thinking'), 1200); return false; }
  }, [currentPuzzle, moveStep, state, solvedSet, saveProgress, makeComputerMove]);

  const onPieceDrop = useCallback((s: Square, t: Square, piece: string) => {
    if (state !== 'thinking') return false;
    // Определяем превращение: пешка идёт на 1 или 8 горизонталь
    const isPawn = piece.toLowerCase().includes('p');
    const isPromo = isPawn && (t[1] === '1' || t[1] === '8');
    if (isPromo) {
      // react-chessboard покажет диалог — пока не делаем ход
      return false;
    }
    return checkPlayerMove(s, t);
  }, [checkPlayerMove, state]);

  const onPromotion = useCallback((piece?: string, from?: Square, to?: Square): boolean => {
    if (!piece || !from || !to || state !== 'thinking') return false;
    // piece = "wQ", "wR", "wB", "wN", "bQ" etc → берём последний символ в lowercase
    const promoLetter = piece.slice(-1).toLowerCase();
    return checkPlayerMove(from, to, promoLetter);
  }, [checkPlayerMove, state]);

  const handleSquareClick = useCallback((sq: Square) => {
    if (state !== 'thinking') return;
    const chess = chessRef.current;
    const piece = chess.get(sq);
    if (selectedSquare) {
      // Проверяем превращение: если ожидаемый ход имеет 5 символов и from+to совпадают
      let promo: string | undefined;
      if (currentPuzzle) {
        const exp = currentPuzzle.moves[moveStep];
        if (exp && exp.length === 5 && exp.slice(0, 2) === selectedSquare && exp.slice(2, 4) === sq) {
          promo = exp[4];
        }
      }
      const ok = checkPlayerMove(selectedSquare, sq, promo);
      setSelectedSquare(null);
      if (!ok && piece && piece.color === chess.turn()) setSelectedSquare(sq);
      return;
    }
    if (piece && piece.color === chess.turn()) setSelectedSquare(sq);
  }, [state, selectedSquare, checkPlayerMove, currentPuzzle, moveStep]);

  const showHint = () => {
    if (!currentPuzzle || state !== 'thinking') return;
    const u = currentPuzzle.moves[moveStep];
    if (!u) return;
    setCustomArrows([[u.slice(0, 2) as Square, u.slice(2, 4) as Square, 'rgba(74,222,128,0.8)']]);
    setShowHintArrow(true);
  };

  const nextPuzzle = () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); initRef.current = ''; if (puzzleIndex < puzzles.length - 1) setPuzzleIndex(puzzleIndex + 1); else setState('complete'); };

  const retryPuzzle = () => {
    if (!currentPuzzle) return;
    initRef.current = '';
    const chess = new Chess(currentPuzzle.fen); chessRef.current = chess; setFen(currentPuzzle.fen);
    setMoveStep(0); setState('thinking'); setCustomArrows([]); setShowHintArrow(false); setLastMoveSquares({}); setSelectedSquare(null);
    if (currentPuzzle.moves.length > 0) {
      const u = currentPuzzle.moves[0];
      timeoutRef.current = setTimeout(() => { try { chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.length === 5 ? u[4] as 'q' | 'r' | 'b' | 'n' : undefined }); setFen(chess.fen()); setMoveStep(1); } catch { /* skip */ } }, 400);
    }
  };

  const playSound = (t: 'correct' | 'wrong' | 'move') => {
    try {
      const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.type = 'sine';
      if (t === 'correct') { o.frequency.value = 880; g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.3); }
      else if (t === 'wrong') { o.frequency.value = 220; g.gain.setValueAtTime(0.12, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.4); }
      else { o.frequency.value = 600; g.gain.setValueAtTime(0.08, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15); o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.15); }
    } catch { /* skip */ }
  };

  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Enter' && state === 'correct') nextPuzzle(); if (e.key === 'h' && state === 'thinking') showHint(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [state, puzzleIndex]);
  useEffect(() => { return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }; }, []);

  if (!course) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-screen pt-24">
          <div className="glass p-10 rounded-2xl text-center">
            <p className="text-white/60">Курс не найден</p>
            <motion.button onClick={() => router.push('/learn')} className="mt-4 px-6 py-2 rounded-xl text-yellow-400 border border-yellow-400/30" whileHover={{ scale: 1.02 }}>К курсам</motion.button>
          </div>
        </div>
      </div>
    );
  }

  const total = puzzles.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const sqStyles: Record<string, React.CSSProperties> = { ...lastMoveSquares };
  if (selectedSquare) sqStyles[selectedSquare] = { ...sqStyles[selectedSquare], backgroundColor: 'rgba(99,179,237,0.5)' };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="flex items-center gap-3 mb-4" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <motion.button onClick={() => router.push('/learn')} className="text-white/40 hover:text-white/80 text-sm" whileHover={{ x: -3 }}>
              {'<-'} Курсы
            </motion.button>
            <span className="text-2xl">{course.icon}</span>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{course.title}</h1>
          </motion.div>

          {state === 'loading' && (
            <motion.div className="glass p-10 rounded-2xl text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div className="text-5xl mb-4" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>{'♞'}</motion.div>
              <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Загружаем задачи...</h3>
              <p className="text-white/40 text-sm">Загружаем задачи для вас...</p>
              {loadingProgress > 0 && <p className="text-yellow-400 text-sm mt-2">{loadingProgress} задач</p>}
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div className="glass p-10 rounded-2xl text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h3 className="text-lg font-bold mb-2">Не удалось загрузить</h3>
              <div className="flex gap-3 justify-center mt-4">
                <motion.button onClick={() => window.location.reload()} className="px-6 py-3 rounded-xl font-semibold text-black" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} whileHover={{ scale: 1.03 }}>Снова</motion.button>
                <motion.button onClick={() => router.push('/learn')} className="px-6 py-3 rounded-xl border border-white/15 text-white/60" whileHover={{ scale: 1.03 }}>К курсам</motion.button>
              </div>
            </motion.div>
          )}

          {state === 'complete' && (
            <motion.div className="glass p-10 rounded-2xl text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-6xl mb-4">{'🎉'}</div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#4ade80' }}>Курс пройден!</h2>
              <p className="text-white/60 mb-6">{score} из {total} задач</p>
              <div className="flex gap-3 justify-center">
                <motion.button onClick={() => { setPuzzleIndex(0); setState('thinking'); }} className="px-6 py-3 rounded-xl font-semibold text-black" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} whileHover={{ scale: 1.03 }}>Заново</motion.button>
                <motion.button onClick={() => router.push('/learn')} className="px-6 py-3 rounded-xl border border-white/15 text-white/60" whileHover={{ scale: 1.03 }}>К курсам</motion.button>
              </div>
            </motion.div>
          )}

          {currentPuzzle && state !== 'loading' && state !== 'error' && state !== 'complete' && (
            <>
              <div className="glass p-3 rounded-xl mb-4">
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>Задача {puzzleIndex + 1} из {total} | Рейтинг: {currentPuzzle.rating}</span>
                  <span className="text-yellow-400 font-semibold">{score} решено</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #7c3aed)' }} animate={{ width: `${total > 0 ? ((puzzleIndex + 1) / total) * 100 : 0}%` }} transition={{ duration: 0.5 }} />
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-shrink-0">
                  <AnimatePresence mode="wait">
                    {state === 'correct' && (
                      <motion.div key="c" className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <span className="text-sm font-bold text-green-400">Верно!</span>
                        <motion.button onClick={nextPuzzle} className="ml-auto px-3 py-1 rounded-lg text-xs font-semibold text-black" style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }} whileHover={{ scale: 1.05 }}>{'Далее ->'}</motion.button>
                      </motion.div>
                    )}
                    {state === 'wrong' && (
                      <motion.div key="w" className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)' }} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        <span className="text-sm font-bold text-red-400">Неправильно! Попробуйте ещё</span>
                      </motion.div>
                    )}
                    {state === 'thinking' && (
                      <motion.div key="t" className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <div className={`w-4 h-4 rounded-full border-2 border-white/20 ${playerColor === 'white' ? 'bg-white' : 'bg-gray-900'}`} />
                        <span className="text-sm text-yellow-400/80">{playerColor === 'white' ? 'Ход белых' : 'Ход чёрных'} — найдите лучший ход!</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div className={shaking ? 'shake' : ''}>
                    <Chessboard position={fen} onSquareClick={handleSquareClick} onPieceDrop={onPieceDrop} onPromotionPieceSelect={onPromotion} customSquareStyles={sqStyles} customArrowColor="rgba(74,222,128,0.8)" customArrows={customArrows} boardWidth={boardWidth} customLightSquareStyle={{ backgroundColor: '#f0d9b5' }} customDarkSquareStyle={{ backgroundColor: '#b58863' }} boardOrientation={playerColor} animationDuration={200} arePiecesDraggable={state === 'thinking'} />
                  </motion.div>

                  <div className="flex gap-2 mt-3">
                    <motion.button onClick={showHint} disabled={state !== 'thinking' || showHintArrow} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Подсказка</motion.button>
                    <motion.button onClick={retryPuzzle} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-white/15 text-white/50 hover:bg-white/5" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Сначала</motion.button>
                    <motion.button onClick={nextPuzzle} disabled={puzzleIndex >= total - 1 && state !== 'correct'} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-white/15 text-white/50 hover:bg-white/5 disabled:opacity-30" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>Пропустить</motion.button>
                  </div>
                </div>

                <div className="flex-1 min-w-0 flex flex-col gap-4">
                  <div className="glass p-4 rounded-xl">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Подсказка</div>
                    <p className="text-sm text-white/70">{showHintArrow ? 'Стрелка показывает лучший ход!' : 'Нажмите "Подсказка" чтобы увидеть'}</p>
                  </div>

                  <div className="glass p-4 rounded-xl">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Рейтинг задачи</div>
                    <p className="text-sm text-white/70">Сложность: {currentPuzzle.rating}</p>
                  </div>

                  <div className="glass rounded-xl overflow-hidden flex-1">
                    <div className="p-3 border-b border-white/10">
                      <span className="text-xs text-white/40 uppercase tracking-wider">Задачи курса</span>
                    </div>
                    <div className="overflow-y-auto p-2" style={{ maxHeight: boardWidth - 100 }}>
                      {puzzles.map((p, i) => {
                        const isSolved = solvedSet.has(p.id);
                        const isCurrent = i === puzzleIndex;
                        return (
                          <button key={p.id + '-' + i} onClick={() => { initRef.current = ''; setPuzzleIndex(i); }}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${isCurrent ? 'bg-yellow-400/15 text-yellow-400' : 'hover:bg-white/5 text-white/60'}`}>
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                              style={{ background: isSolved ? 'rgba(74,222,128,0.2)' : isCurrent ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)', color: isSolved ? '#4ade80' : isCurrent ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>
                              {isSolved ? 'V' : i + 1}
                            </span>
                            <span className="truncate">Задача {i + 1}</span>
                            <span className="ml-auto text-xs text-white/20">{p.rating}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="glass p-4 rounded-xl">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>{score}</div>
                        <div className="text-xs text-white/30">Решено</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-white/80" style={{ fontFamily: "'Playfair Display', serif" }}>{total}</div>
                        <div className="text-xs text-white/30">Всего</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif", color: pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171' }}>{pct}%</div>
                        <div className="text-xs text-white/30">Прогресс</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
