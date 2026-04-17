'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import EvalBar from '@/components/EvalBar';
import { supabase } from '@/lib/supabase';
import {
  analyzeGame, terminateAnalysisWorker, CLASSIFICATION_CONFIG,
  type GameAnalysis, type AnalyzedMove, type MoveClassification,
} from '@/lib/analysis';
import { useBoardTheme } from '@/lib/boardThemes';
import BoardThemeSelector from '@/components/BoardThemeSelector';
import { useTranslation } from '@/lib/i18n';

interface GameRecord {
  id: string; result: string; elo_change: number; played_at: string;
  mode: string; difficulty: string; player_color: string; opponent_name: string;
  moves_json: Array<{ from: string; to: string; san: string; promotion?: string }>;
  analysis_json: GameAnalysis | null; accuracy_white: number | null; accuracy_black: number | null;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// Тренеры с разными стилями
const COACHES = [
  { id: 'default', name: 'Тренер', icon: '🎓', style: 'normal' },
  { id: 'strict', name: 'Строгий', icon: '👨‍🏫', style: 'strict' },
  { id: 'friendly', name: 'Дружелюбный', icon: '😊', style: 'friendly' },
  { id: 'funny', name: 'Весёлый', icon: '😄', style: 'funny' },
] as const;

type CoachStyle = typeof COACHES[number]['style'];

// Coach объяснения
function getCoachComment(move: AnalyzedMove, playerColor: string, style: CoachStyle = 'normal'): string {
  const cls = move.classification;
  const isPlayerMove = (move.color === 'w' && playerColor === 'white') || (move.color === 'b' && playerColor === 'black');
  const evalDrop = move.eval_drop;
  const best = move.best_move_san;

  if (style === 'strict') {
    if (cls === 'brilliant') return isPlayerMove ? 'Превосходно. Жертва с точным расчётом.' : 'Соперник нашёл сильнейшее продолжение.';
    if (cls === 'great') return isPlayerMove ? 'Хорошая работа. Позиция значительно улучшена.' : 'Сильный ход. Будьте внимательны.';
    if (cls === 'best') return isPlayerMove ? 'Точно. Это лучший ход.' : 'Соперник играет точно.';
    if (cls === 'good') return isPlayerMove ? 'Приемлемо. Позиция стабильна.' : 'Соперник держит позицию.';
    if (cls === 'book') return 'Теория. Запомните этот вариант.';
    if (cls === 'inaccuracy') return isPlayerMove ? `Неточно. Потеряно ${(evalDrop / 100).toFixed(1)} пешки. Следовало играть ${best}. Работайте над расчётом.` : `Соперник допустил неточность.`;
    if (cls === 'mistake') return isPlayerMove ? `Грубо. ${best} было обязательно. Потеряно ${(evalDrop / 100).toFixed(1)} пешки.` : `Ошибка соперника. Нужно было наказать.`;
    if (cls === 'blunder') return isPlayerMove ? `Недопустимо! ${best} — единственный ход. Потеряно ${(evalDrop / 100).toFixed(1)} пешки. Такие ходы проигрывают партии.` : `Серьёзная ошибка соперника.`;
    if (cls === 'miss') return isPlayerMove ? `Упущена тактика! ${best} выигрывало. Решайте больше задач.` : 'Соперник не увидел тактику.';
  }

  if (style === 'friendly') {
    if (cls === 'brilliant') return isPlayerMove ? 'Вау, блестящий ход! Ты нашёл жертву, которая ведёт к победе! 🌟' : 'Соперник сыграл очень красиво!';
    if (cls === 'great') return isPlayerMove ? 'Отличный ход! Ты на правильном пути! 👏' : 'Хороший ход от соперника, но ты справишься!';
    if (cls === 'best') return isPlayerMove ? 'Идеально! Именно так бы сыграл движок! 🎯' : 'Соперник нашёл лучший ход.';
    if (cls === 'good') return isPlayerMove ? 'Хороший ход! Позиция стабильна 👍' : 'Неплохо от соперника.';
    if (cls === 'book') return 'Это теоретический ход! Ты знаешь дебют! 📖';
    if (cls === 'inaccuracy') return isPlayerMove ? `Небольшая неточность, не переживай! Лучше было ${best}. В следующий раз получится! 💪` : 'Соперник немного ошибся!';
    if (cls === 'mistake') return isPlayerMove ? `Ошибочка! Правильно было ${best}. Ничего страшного, все ошибаются! 🤗` : 'Соперник ошибся! Шанс для тебя!';
    if (cls === 'blunder') return isPlayerMove ? `Ой, зевок! Нужно было ${best}. Не расстраивайся, главное — учиться! 📚` : 'Соперник зевнул! Используй момент!';
    if (cls === 'miss') return isPlayerMove ? `Упустил возможность! ${best} было бы круто. В следующий раз заметишь! 👀` : 'Соперник упустил шанс!';
  }

  if (style === 'funny') {
    if (cls === 'brilliant') return isPlayerMove ? 'ГЕНИАЛЬНО! Магнус, это ты?! 🤯' : 'Ого, соперник включил режим Каспарова!';
    if (cls === 'great') return isPlayerMove ? 'Красавчик! Этот ход заслуживает аплодисментов! 👏' : 'Соперник тоже умеет играть, оказывается!';
    if (cls === 'best') return isPlayerMove ? 'Точно в яблочко! Stockfish одобряет! 🎯' : 'Соперник нашёл идеальный ход. Бывает...';
    if (cls === 'good') return isPlayerMove ? 'Нормально. Не гениально, но и не позорно! 😎' : 'Соперник играет адекватно.';
    if (cls === 'book') return 'Теория! Кто-то учил дебюты! 🤓';
    if (cls === 'inaccuracy') return isPlayerMove ? `Эх, чуть мимо! ${best} было бы вкуснее. Но бывает! 🤷` : 'Соперник чуть промахнулся!';
    if (cls === 'mistake') return isPlayerMove ? `Упс! ${best} — вот где была магия! А ты выбрал... ну такое 😅` : 'Соперник накосячил! Праздник!';
    if (cls === 'blunder') return isPlayerMove ? `ЗЕВОК! ${best} кричал тебе, но ты не услышал! 🙈 RIP ${(evalDrop / 100).toFixed(1)} пешки` : 'Соперник зевнул! Новогодний подарок! 🎁';
    if (cls === 'miss') return isPlayerMove ? `${best} — тут была БОМБА, а ты прошёл мимо! 💣` : 'Соперник прошёл мимо бриллианта!';
  }

  // Default style
  if (cls === 'brilliant') return isPlayerMove ? 'Блестящий ход! Жертва которая ведёт к решающему преимуществу.' : 'Соперник нашёл блестящий ход с жертвой.';
  if (cls === 'great') return isPlayerMove ? 'Отличный ход! Значительно улучшает позицию.' : 'Сильный ход соперника.';
  if (cls === 'best') return isPlayerMove ? 'Лучший ход в позиции. Так играет движок!' : 'Соперник нашёл лучший ход.';
  if (cls === 'good') return isPlayerMove ? 'Хороший ход. Позиция остаётся стабильной.' : 'Неплохой ход соперника.';
  if (cls === 'book') return 'Теоретический ход из дебютной теории.';
  if (cls === 'inaccuracy') {
    if (evalDrop > 50) return isPlayerMove ? `Неточность. Потеряно ~${(evalDrop / 100).toFixed(1)} пешки преимущества. Лучше было ${best}.` : `Неточность соперника, вы могли получить больше.`;
    return isPlayerMove ? `Небольшая неточность. Лучше ${best}.` : 'Лёгкая неточность соперника.';
  }
  if (cls === 'mistake') return isPlayerMove ? `Ошибка! Потеря ${(evalDrop / 100).toFixed(1)} пешки. Правильно было ${best}.` : `Ошибка соперника! Можно было использовать момент.`;
  if (cls === 'blunder') return isPlayerMove ? `Грубая ошибка! Потеряно ${(evalDrop / 100).toFixed(1)} пешки. Нужно было играть ${best}.` : `Зевок соперника! Серьёзная потеря.`;
  if (cls === 'miss') return isPlayerMove ? `Упущена возможность! ${best} давало решающее преимущество.` : 'Соперник упустил шанс.';
  return '';
}

// Performance Rating расчёт
function calcPerformanceRating(accuracy: number): number {
  if (accuracy >= 98) return 2800;
  if (accuracy >= 95) return 2500;
  if (accuracy >= 90) return 2200;
  if (accuracy >= 85) return 2000;
  if (accuracy >= 80) return 1800;
  if (accuracy >= 70) return 1500;
  if (accuracy >= 60) return 1200;
  if (accuracy >= 50) return 1000;
  if (accuracy >= 40) return 800;
  return 600;
}

// Оценка фазы игры
function getPhaseGrades(moves: AnalyzedMove[], color: 'w' | 'b'): { opening: number; middlegame: number; endgame: number } {
  const playerMoves = moves.filter(m => m.color === color);
  const total = playerMoves.length;
  if (total === 0) return { opening: 0, middlegame: 0, endgame: 0 };

  const openingEnd = Math.min(Math.floor(total * 0.25), 10);
  const endgameStart = Math.max(Math.floor(total * 0.7), total - 10);

  const calcAccuracy = (subset: AnalyzedMove[]) => {
    if (subset.length === 0) return 100;
    const good = subset.filter(m => ['brilliant', 'great', 'best', 'good', 'book'].includes(m.classification)).length;
    return Math.round((good / subset.length) * 100);
  };

  return {
    opening: calcAccuracy(playerMoves.slice(0, openingEnd)),
    middlegame: calcAccuracy(playerMoves.slice(openingEnd, endgameStart)),
    endgame: calcAccuracy(playerMoves.slice(endgameStart)),
  };
}

// Иконка фазы
function phaseIcon(acc: number): string {
  if (acc >= 80) return '✅';
  if (acc >= 60) return '⚠️';
  return '❌';
}

export default function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<GameRecord | null>(null);
  const { theme: boardTheme, themeId: boardThemeId, setTheme: setBoardTheme } = useBoardTheme();
  const { t } = useTranslation();
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [currentFen, setCurrentFen] = useState(INITIAL_FEN);
  const [boardWidth, setBoardWidth] = useState(400);
  const [showBestMove, setShowBestMove] = useState(false);
  const [retryMode, setRetryMode] = useState(false);
  const [retryResult, setRetryResult] = useState<'correct' | 'wrong' | null>(null);
  const [showLine, setShowLine] = useState(false);
  const [lineStep, setLineStep] = useState(0);
  const [selectedCoach, setSelectedCoach] = useState<CoachStyle>('normal');
  const [showThreats, setShowThreats] = useState(false);
  const chessRef = useRef(new Chess());
  const retryChessRef = useRef(new Chess());

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setBoardWidth(Math.min(w < 640 ? w - 32 : w < 1024 ? 480 : 580, 620));
    };
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    supabase.from('game_history').select('*').eq('id', id).single().then(({ data }) => {
      if (data) { setGame(data as GameRecord); if (data.analysis_json) setAnalysis(data.analysis_json as GameAnalysis); }
      setLoading(false);
    });
    return () => terminateAnalysisWorker();
  }, [id]);

  const startAnalysis = useCallback(async () => {
    if (!game?.moves_json || game.moves_json.length === 0) return;
    setAnalyzing(true);
    try {
      const result = await analyzeGame(game.moves_json, (c, t) => setProgress({ current: c, total: t }), 12);
      if (result && result.moves && result.moves.length > 0) {
        setAnalysis(result);
        await supabase.from('game_history').update({
          analysis_json: result,
          accuracy_white: result.accuracy_white,
          accuracy_black: result.accuracy_black
        }).eq('id', game.id);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      // Пересоздаём воркер на случай если сломался
      terminateAnalysisWorker();
    }
    setAnalyzing(false);
  }, [game]);

  const goToMove = useCallback((index: number) => {
    const chess = new Chess();
    if (game?.moves_json) {
      for (let i = 0; i <= index && i < game.moves_json.length; i++) {
        const m = game.moves_json[i];
        chess.move({ from: m.from, to: m.to, promotion: m.promotion as 'q' | 'r' | 'b' | 'n' | undefined });
      }
    }
    setCurrentFen(chess.fen()); setCurrentMoveIndex(index); setShowBestMove(false);
    setRetryMode(false); setRetryResult(null); setShowLine(false); setLineStep(0);
    chessRef.current = chess;
  }, [game]);

  const goToStart = () => { setCurrentFen(INITIAL_FEN); setCurrentMoveIndex(-1); setShowBestMove(false); setRetryMode(false); setRetryResult(null); };
  const goForward = () => { if (game && currentMoveIndex < (game.moves_json?.length || 0) - 1) goToMove(currentMoveIndex + 1); };
  const goBack = () => { if (currentMoveIndex > 0) goToMove(currentMoveIndex - 1); else goToStart(); };
  const goToEnd = () => { if (game?.moves_json) goToMove(game.moves_json.length - 1); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (retryMode) return;
      if (e.key === 'ArrowLeft') goBack();
      else if (e.key === 'ArrowRight') goForward();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentMoveIndex, game, retryMode]);

  // Retry — попробуй найти лучший ход
  const startRetry = () => {
    if (!currentAnalyzedMove) return;
    const chess = new Chess(currentAnalyzedMove.fen_before);
    retryChessRef.current = chess;
    setRetryMode(true); setRetryResult(null);
    setCurrentFen(currentAnalyzedMove.fen_before);
  };

  const handleRetryDrop = (from: Square, to: Square): boolean => {
    if (!currentAnalyzedMove || !retryMode) return false;
    const uci = from + to;
    const bestUci = currentAnalyzedMove.best_move_uci;
    if (uci === bestUci.slice(0, 4)) {
      const move = retryChessRef.current.move({ from, to, promotion: bestUci.length === 5 ? bestUci[4] as 'q' | 'r' | 'b' | 'n' : undefined });
      if (move) { setCurrentFen(retryChessRef.current.fen()); setRetryResult('correct'); }
      return true;
    }
    setRetryResult('wrong');
    setTimeout(() => setRetryResult(null), 1500);
    return false;
  };

  // Show Line — анимация лучшего варианта
  const startShowLine = () => {
    if (!currentAnalyzedMove) return;
    setShowLine(true); setLineStep(0);
    // Показываем позицию ДО хода
    setCurrentFen(currentAnalyzedMove.fen_before);
    // Через 1 сек делаем лучший ход
    setTimeout(() => {
      const chess = new Chess(currentAnalyzedMove.fen_before);
      const uci = currentAnalyzedMove.best_move_uci;
      chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] as 'q' | 'r' | 'b' | 'n' : undefined });
      setCurrentFen(chess.fen()); setLineStep(1);
    }, 1000);
  };

  const currentAnalyzedMove = analysis?.moves[currentMoveIndex] || null;
  const playerColor = game?.player_color || 'white';
  const playerColorChar = playerColor === 'white' ? 'w' : 'b';

  // Подсветка угроз — какие клетки под атакой
  const getThreatSquares = (): Record<string, React.CSSProperties> => {
    if (!showThreats || !currentFen || currentFen === INITIAL_FEN) return {};
    try {
      const chess = new Chess(currentFen);
      const threats: Record<string, React.CSSProperties> = {};
      const turn = chess.turn(); // Чья сейчас очередь ходить
      const opponentColor = turn === 'w' ? 'b' : 'w';

      // Проходим по всем клеткам, ищем фигуры соперника под атакой
      const board = chess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (!piece) continue;
          const sq = (String.fromCharCode(97 + c) + (8 - r)) as Square;

          if (piece.color === opponentColor && chess.isAttacked(sq, turn)) {
            // Фигура соперника под атакой
            threats[sq] = { backgroundColor: 'rgba(239,68,68,0.35)', boxShadow: 'inset 0 0 8px rgba(239,68,68,0.5)' };
          } else if (piece.color === turn && chess.isAttacked(sq, opponentColor)) {
            // Наша фигура под атакой
            threats[sq] = { backgroundColor: 'rgba(245,158,11,0.3)', boxShadow: 'inset 0 0 8px rgba(245,158,11,0.4)' };
          }
        }
      }
      return threats;
    } catch { return {}; }
  };

  // Стрелки лучшего хода
  const customArrows: [Square, Square, string?][] = [];
  if (showBestMove && currentAnalyzedMove) {
    const from = currentAnalyzedMove.best_move_uci.slice(0, 2) as Square;
    const to = currentAnalyzedMove.best_move_uci.slice(2, 4) as Square;
    customArrows.push([from, to, 'rgba(74,222,128,0.8)']);
  }

  // Performance rating
  const perfRating = analysis ? calcPerformanceRating(playerColor === 'white' ? analysis.accuracy_white : analysis.accuracy_black) : 0;

  // Phase grades
  const phases = analysis ? getPhaseGrades(analysis.moves, playerColorChar as 'w' | 'b') : null;

  if (loading) return <div className="min-h-screen flex items-center justify-center"><motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div></div>;
  if (!game) return <div className="min-h-screen"><Header /><div className="flex items-center justify-center min-h-screen pt-24"><div className="glass p-10 rounded-2xl text-center"><div className="text-5xl mb-4">❌</div><p className="text-white/60">{t('profile_no_profile')}</p><motion.button onClick={() => router.push('/analysis')} className="mt-4 px-6 py-2 rounded-xl text-yellow-400 border border-yellow-400/30" whileHover={{ scale: 1.02 }}>{t('back')}</motion.button></div></div></div>;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div className="flex items-center gap-3 mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <motion.button onClick={() => router.push('/analysis')} className="text-white/40 hover:text-white/80" whileHover={{ x: -3 }}>← Назад</motion.button>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{t('analysis_title')}</h1>
            <span className="text-xs text-white/30">vs {game.opponent_name} · {new Date(game.played_at).toLocaleDateString('ru-RU')}</span>
          </motion.div>

          {/* Analyzing */}
          <AnimatePresence>
            {analyzing && (
              <motion.div className="glass p-6 rounded-2xl mb-6 text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="text-4xl mb-3" animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{t('loading')}</h3>
                <p className="text-white/50 text-sm mb-4">{t('move_label')} {progress.current} {t('puzzle_of')} {progress.total}</p>
                <div className="max-w-xs mx-auto h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                  <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #f59e0b, #7c3aed)' }}
                    animate={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }} />
                </div>
                <motion.button onClick={() => { terminateAnalysisWorker(); setAnalyzing(false); router.push('/analysis'); }}
                  className="px-6 py-2 rounded-xl text-sm border border-red-400/30 text-red-400 hover:bg-red-500/10"
                  whileTap={{ scale: 0.95 }}>
                  ✕ Отменить и выйти
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Start analysis */}
          {!analysis && !analyzing && (
            <motion.div className="glass p-8 rounded-2xl mb-6 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-5xl mb-4">🔬</div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{t('analysis_start')}</h3>
              <p className="text-white/50 text-sm mb-6">{t('analysis_stockfish')}</p>
              <motion.button onClick={startAnalysis} className="px-8 py-4 rounded-xl font-bold text-black text-lg"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #7c3aed)' }}
                whileHover={{ scale: 1.03, boxShadow: '0 10px 40px rgba(245,158,11,0.4)' }} whileTap={{ scale: 0.97 }}>
                ⚡ {t('analysis_btn')}
              </motion.button>
            </motion.div>
          )}

          {/* Re-analyze button */}
          {analysis && !analyzing && (
            <div className="flex justify-end mb-2">
              <button onClick={() => { setAnalysis(null); setTimeout(startAnalysis, 100); }}
                className="text-xs text-white/20 hover:text-white/50 px-2 py-1 rounded">
                🔄 {t('analysis_reanalyze')}
              </button>
            </div>
          )}

          {/* Results */}
          {analysis && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
                <div className="glass p-3 rounded-xl text-center">
                  <div className="text-xs text-white/40 mb-1">♔ {t('analysis_white')}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: analysis.accuracy_white >= 80 ? '#4ade80' : analysis.accuracy_white >= 50 ? '#fbbf24' : '#f87171' }}>{analysis.accuracy_white}%</div>
                </div>
                <div className="glass p-3 rounded-xl text-center">
                  <div className="text-xs text-white/40 mb-1">♚ {t('analysis_black')}</div>
                  <div className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: analysis.accuracy_black >= 80 ? '#4ade80' : analysis.accuracy_black >= 50 ? '#fbbf24' : '#f87171' }}>{analysis.accuracy_black}%</div>
                </div>
                <div className="glass p-3 rounded-xl text-center">
                  <div className="text-xs text-white/40 mb-1">{t('opening_label')}</div>
                  <div className="text-xs font-semibold text-white/80 leading-tight">{analysis.opening}</div>
                </div>
                <div className="glass p-3 rounded-xl text-center">
                  <div className="text-xs text-white/40 mb-1">{t('analysis_result')}</div>
                  <div className="text-xl">{game.result === 'win' ? '🏆' : game.result === 'loss' ? '😔' : '🤝'}</div>
                </div>
                {/* Performance Rating */}
                <div className="glass p-3 rounded-xl text-center">
                  <div className="text-xs text-white/40 mb-1">{t('stats_label')}</div>
                  <div className="text-2xl font-bold text-purple-400" style={{ fontFamily: "'Playfair Display', serif" }}>{perfRating}</div>
                  <div className="text-[10px] text-white/20">ELO уровень</div>
                </div>
                {/* Phase grades */}
                {phases && (
                  <div className="glass p-3 rounded-xl text-center">
                    <div className="text-xs text-white/40 mb-1">{t('stats_label')}</div>
                    <div className="flex justify-center gap-2 text-xs">
                      <span title={`Дебют: ${phases.opening}%`}>{phaseIcon(phases.opening)}</span>
                      <span title={`Миттельшпиль: ${phases.middlegame}%`}>{phaseIcon(phases.middlegame)}</span>
                      <span title={`Эндшпиль: ${phases.endgame}%`}>{phaseIcon(phases.endgame)}</span>
                    </div>
                    <div className="flex justify-center gap-1 mt-1 text-[9px] text-white/20">
                      <span>{t('opening_label').slice(0,3)}</span><span>{t('opening_label').slice(0,3)}</span><span>{t('puzzle_endgame').slice(0,3)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Move summary */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                {(['white', 'black'] as const).map(color => (
                  <div key={color} className="glass p-3 rounded-xl">
                    <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{color === 'white' ? '♔ ' + t('analysis_white') : '♚ ' + t('analysis_black')}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(analysis.summary[color]) as [MoveClassification, number][]).filter(([, c]) => c > 0).map(([cls, count]) => {
                        const cfg = CLASSIFICATION_CONFIG[cls];
                        return <div key={cls} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs" style={{ background: cfg.bgColor, color: cfg.color }}>
                          <span>{cfg.symbol}</span><span className="font-bold">{count}</span><span className="hidden sm:inline">{cfg.label}</span>
                        </div>;
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Eval graph */}
              <div className="glass p-3 rounded-xl mb-6 cursor-pointer">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{t('stats_label')}</div>
                <div className="h-20 relative">
                  <svg width="100%" height="100%" viewBox={`0 0 ${analysis.moves.length} 100`} preserveAspectRatio="none">
                    <line x1="0" y1="50" x2={analysis.moves.length} y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
                    <polygon fill="rgba(255,255,255,0.06)" points={`0,50 ${analysis.moves.map((m, i) => { const y = Math.min(50, 50 - (Math.max(-500, Math.min(500, m.eval_after)) / 500) * 45); return `${i},${y}`; }).join(' ')} ${analysis.moves.length - 1},50`} />
                    <polyline fill="none" stroke="#f59e0b" strokeWidth="1.5" points={analysis.moves.map((m, i) => `${i},${50 - (Math.max(-500, Math.min(500, m.eval_after)) / 500) * 45}`).join(' ')} />
                    {analysis.moves.map((m, i) => { if (!['blunder', 'mistake', 'brilliant', 'great', 'miss'].includes(m.classification)) return null; return <circle key={i} cx={i} cy={50 - (Math.max(-500, Math.min(500, m.eval_after)) / 500) * 45} r="2.5" fill={CLASSIFICATION_CONFIG[m.classification].color} className="cursor-pointer" onClick={() => goToMove(i)} />; })}
                    {currentMoveIndex >= 0 && <line x1={currentMoveIndex} y1="0" x2={currentMoveIndex} y2="100" stroke="rgba(245,158,11,0.6)" strokeWidth="1" />}
                  </svg>
                </div>
              </div>
            </>
          )}

          {/* Board + Sidebar */}
          <div className="flex flex-col lg:flex-row gap-4">
            {/* EvalBar + Board */}
            <div className="flex-shrink-0 flex gap-1">
              {/* Eval Bar сбоку доски */}
              {currentAnalyzedMove && (
                <EvalBar
                  evaluation={currentAnalyzedMove.eval_after}
                  mate={currentAnalyzedMove.is_mate_after ? currentAnalyzedMove.mate_in_after || null : null}
                  height={boardWidth}
                  orientation={playerColor as 'white' | 'black'}
                />
              )}

              <div>
                {/* Coach comment */}
                {currentAnalyzedMove && (
                  <motion.div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-xl"
                    style={{ background: CLASSIFICATION_CONFIG[currentAnalyzedMove.classification].bgColor, border: `1px solid ${CLASSIFICATION_CONFIG[currentAnalyzedMove.classification].color}30`, maxWidth: boardWidth }}
                    key={`${currentMoveIndex}-${selectedCoach}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <span className="text-lg flex-shrink-0">{COACHES.find(c => c.style === selectedCoach)?.icon || '🎓'}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: CLASSIFICATION_CONFIG[currentAnalyzedMove.classification].color }}>
                        {CLASSIFICATION_CONFIG[currentAnalyzedMove.classification].symbol} {currentAnalyzedMove.san} — {CLASSIFICATION_CONFIG[currentAnalyzedMove.classification].label}
                      </div>
                      <div className="text-xs text-white/50 mt-0.5 leading-relaxed">
                        {getCoachComment(currentAnalyzedMove, playerColor, selectedCoach)}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Retry result */}
                {retryMode && retryResult && (
                  <motion.div className={`mb-2 px-3 py-2 rounded-xl text-sm font-semibold text-center ${retryResult === 'correct' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    {retryResult === 'correct' ? '✅ Правильно! Вы нашли лучший ход!' : '❌ Попробуйте ещё раз'}
                  </motion.div>
                )}

                <Chessboard
                  position={currentFen}
                  boardWidth={boardWidth}
                  customLightSquareStyle={{ backgroundColor: boardTheme.light, ...boardTheme.lightStyle }}
                  customDarkSquareStyle={{ backgroundColor: boardTheme.dark, ...boardTheme.darkStyle }}
                  boardOrientation={playerColor as 'white' | 'black'}
                  animationDuration={200}
                  arePiecesDraggable={retryMode && !retryResult}
                  onPieceDrop={retryMode ? handleRetryDrop : undefined}
                  customArrows={customArrows}
                  customSquareStyles={{
                    ...(showBestMove && currentAnalyzedMove ? {
                      [currentAnalyzedMove.best_move_uci.slice(0, 2)]: { backgroundColor: 'rgba(74,222,128,0.4)' },
                      [currentAnalyzedMove.best_move_uci.slice(2, 4)]: { backgroundColor: 'rgba(74,222,128,0.6)' },
                    } : {}),
                    ...getThreatSquares(),
                  }}
                />

                {/* Controls */}
                <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
                  <motion.button onClick={goToStart} className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-xs" whileTap={{ scale: 0.9 }}>⏮</motion.button>
                  <motion.button onClick={goBack} className="p-2 px-3 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5" whileTap={{ scale: 0.9 }}>◀</motion.button>
                  <motion.button onClick={goForward} className="p-2 px-3 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5" whileTap={{ scale: 0.9 }}>▶</motion.button>
                  <motion.button onClick={goToEnd} className="p-2 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/5 text-xs" whileTap={{ scale: 0.9 }}>⏭</motion.button>
                  {currentAnalyzedMove && (
                    <>
                      <motion.button onClick={() => setShowBestMove(!showBestMove)}
                        className={`p-2 px-2 rounded-lg text-xs font-semibold ${showBestMove ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'border border-white/10 text-white/50'}`}
                        whileTap={{ scale: 0.95 }}>💡</motion.button>
                      {['inaccuracy', 'mistake', 'blunder', 'miss'].includes(currentAnalyzedMove.classification) && !retryMode && (
                        <motion.button onClick={startRetry}
                          className="p-2 px-2 rounded-lg text-xs font-semibold border border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          whileTap={{ scale: 0.95 }}>🔄</motion.button>
                      )}
                      {!retryMode && (
                        <motion.button onClick={startShowLine}
                          className="p-2 px-2 rounded-lg text-xs font-semibold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                          whileTap={{ scale: 0.95 }}>▶️</motion.button>
                      )}
                      {retryMode && (
                        <motion.button onClick={() => { setRetryMode(false); setRetryResult(null); goToMove(currentMoveIndex); }}
                          className="p-2 px-2 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400"
                          whileTap={{ scale: 0.95 }}>✕</motion.button>
                      )}
                      <motion.button onClick={() => setShowThreats(!showThreats)}
                        className={`p-2 px-2 rounded-lg text-xs font-semibold ${showThreats ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'border border-white/10 text-white/50'}`}
                        whileTap={{ scale: 0.95 }} title="Подсветка угроз">⚡</motion.button>
                    </>
                  )}
                </div>

                <div className="flex justify-center mt-1">
                  <BoardThemeSelector currentThemeId={boardThemeId} onSelect={setBoardTheme} />
                </div>

                {/* Coach selector */}
                <div className="flex items-center justify-center gap-1 mt-1">
                  {COACHES.map(c => (
                    <motion.button key={c.id} onClick={() => setSelectedCoach(c.style)}
                      className={`px-2 py-1 rounded-lg text-xs ${selectedCoach === c.style ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' : 'border border-white/5 text-white/30 hover:text-white/50'}`}
                      whileTap={{ scale: 0.95 }}>
                      <span className="mr-0.5">{c.icon}</span>{c.name}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {/* Топ ошибки */}
            {analysis && (() => {
              const pColor = playerColorChar;
              const mistakes = analysis.moves
                .map((m: any, i: number) => ({ ...m, index: i }))
                .filter((m: any) => ['blunder', 'mistake', 'inaccuracy'].includes(m.classification) && m.color === pColor);
              if (mistakes.length === 0) return null;
              const firstMistake = mistakes[0];
              return (
                <div className="glass rounded-xl p-3 mb-3">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-2">⚠️ {t('analysis_your_errors')} ({mistakes.length})</div>
                  <div className="space-y-1 mb-3">
                    {mistakes.slice(0, 5).map((m: any) => (
                      <div key={m.index} onClick={() => goToMove(m.index)}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg text-xs hover:bg-white/5 cursor-pointer">
                        <span style={{ color: m.classification === 'blunder' ? '#f87171' : m.classification === 'mistake' ? '#fb923c' : '#fbbf24' }}>
                          {m.classification === 'blunder' ? '??' : m.classification === 'mistake' ? '?' : '?!'}
                        </span>
                        <span className="text-white/60">{t('move_label')} {m.moveNumber}: {m.san}</span>
                        <span className="text-white/20 ml-auto">-{(m.eval_drop / 100).toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  <motion.button onClick={() => {
                    goToMove(firstMistake.index);
                    setTimeout(() => startRetry(), 100);
                  }}
                    className="w-full py-2 rounded-xl text-xs font-semibold border border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    whileTap={{ scale: 0.97 }}>
                    ▶ {t('analysis_retry_errors')}
                  </motion.button>
                </div>
              );
            })()}

            {/* Move list */}
            <div className="flex-1 min-w-0">
              <div className="glass rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: boardWidth + 80 }}>
                <div className="p-3 border-b border-white/10 flex justify-between items-center">
                  <span className="text-xs text-white/40 uppercase tracking-wider">{t('analysis_moves')}</span>
                  {retryMode && <span className="text-xs text-blue-400">🔄 Найдите лучший ход!</span>}
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {game.moves_json && game.moves_json.length > 0 ? (
                    <div className="space-y-0.5">
                      {Array.from({ length: Math.ceil(game.moves_json.length / 2) }, (_, i) => {
                        const wI = i * 2; const bI = i * 2 + 1;
                        const wM = game.moves_json[wI]; const bM = game.moves_json[bI];
                        const wA = analysis?.moves[wI]; const bA = analysis?.moves[bI];
                        return (
                          <div key={i} className="flex gap-0.5 text-sm font-mono">
                            <span className="text-white/20 w-6 text-right flex-shrink-0 py-0.5 text-xs">{i + 1}.</span>
                            <button onClick={() => goToMove(wI)}
                              className={`flex items-center gap-0.5 px-1 py-0.5 rounded flex-1 min-w-0 text-left transition-all ${currentMoveIndex === wI ? 'bg-yellow-400/20 text-yellow-400' : 'hover:bg-white/5 text-white/80'}`}>
                              {wA && <span className="text-[10px] flex-shrink-0">{CLASSIFICATION_CONFIG[wA.classification].symbol}</span>}
                              <span className="truncate text-xs">{wM?.san}</span>
                            </button>
                            {bM && (
                              <button onClick={() => goToMove(bI)}
                                className={`flex items-center gap-0.5 px-1 py-0.5 rounded flex-1 min-w-0 text-left transition-all ${currentMoveIndex === bI ? 'bg-yellow-400/20 text-yellow-400' : 'hover:bg-white/5 text-white/60'}`}>
                                {bA && <span className="text-[10px] flex-shrink-0">{CLASSIFICATION_CONFIG[bA.classification].symbol}</span>}
                                <span className="truncate text-xs">{bM.san}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-white/30 text-sm text-center py-8">{t('no_moves')}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
