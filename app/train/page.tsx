'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import Header from '@/components/Header';
import ChessClock from '@/components/ChessClock';
import TimeControlSelector from '@/components/TimeControlSelector';
import { getAIMove, parseStockfishMove, getBestMove } from '@/lib/stockfish';
import { playChessSound } from '@/lib/sounds';
import { useBoardTheme } from '@/lib/boardThemes';
import { useTranslation } from '@/lib/i18n';

interface Coach {
  id: string;
  name: string;
  avatar: string;
  description: string;
  style: 'friendly' | 'serious';
}

const COACHES: Coach[] = [
  {
    id: 'aliya', name: 'Алия', avatar: '👩‍🏫',
    description: 'Мягко подскажу и помогу найти лучший ход. Идеально для начинающих!',
    style: 'friendly',
  },
  {
    id: 'pavel', name: 'Павел', avatar: '👨‍💼',
    description: 'Покажу как играют профессионалы. Разберём каждый ход вместе!',
    style: 'serious',
  },
];

function getTrainerComment(
  san: string, bestSan: string, evalDiff: number, style: 'friendly' | 'serious', isBest: boolean
): string {
  if (isBest) {
    if (style === 'friendly') {
      const msgs = [
        `Отличный ход ${san}! Именно так бы сыграл движок! 🎯`,
        `Молодец! ${san} — лучший ход в позиции! 👏`,
        `Прекрасно! ${san} контролирует ключевые поля! ⭐`,
        `${san} — точно! Ты играешь всё лучше! 💪`,
      ];
      return msgs[Math.floor(Math.random() * msgs.length)];
    }
    const msgs = [
      `${san} — точный ход. Позиция стабильна.`,
      `Верно. ${san} — объективно лучшее продолжение.`,
      `${san} — правильное решение. Хороший расчёт.`,
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  // Неточность/ошибка
  const drop = Math.abs(evalDiff) / 100;

  if (drop < 0.3) {
    return style === 'friendly'
      ? `${san} — неплохо! Но ${bestSan} было чуть точнее. Разница небольшая 😊`
      : `${san} — приемлемо. ${bestSan} точнее на ~${drop.toFixed(1)} пешки.`;
  }
  if (drop < 1.0) {
    return style === 'friendly'
      ? `${san} — небольшая неточность. Попробуй ${bestSan} — ${drop < 0.5 ? 'контролирует центр лучше' : 'даёт инициативу'}! Хочешь вернуть ход? 🤔`
      : `Неточность. ${bestSan} сохраняло преимущество ~${drop.toFixed(1)} пешки. ${san} ослабляет позицию.`;
  }
  if (drop < 3.0) {
    return style === 'friendly'
      ? `Ой! ${san} — ошибка. ${bestSan} было намного лучше — ты ${drop > 1.5 ? 'теряешь фигуру' : 'упускаешь инициативу'}. Давай назад! 😅`
      : `Ошибка. ${san} теряет ${drop.toFixed(1)} пешки. Правильно ${bestSan}. Пересмотрите расчёт.`;
  }
  return style === 'friendly'
    ? `Ай! ${san} — серьёзный зевок! ${bestSan} спасало позицию. Не расстраивайся, давай вернём ход! 💪`
    : `Грубая ошибка. ${san} проигрывает ${drop.toFixed(1)} пешки. Единственный ход — ${bestSan}.`;
}

export default function TrainPage() {
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [timeControl, setTimeControl] = useState<{ minutes: number; increment: number } | null>(null);
  const [phase, setPhase] = useState<'select' | 'time' | 'playing' | 'over'>('select');
  const { theme: boardTheme } = useBoardTheme();
  const { t } = useTranslation();
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [messages, setMessages] = useState<Array<{ text: string; type: 'good' | 'warning' | 'error' | 'info' }>>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [hintMove, setHintMove] = useState<string>('');
  const [hintUci, setHintUci] = useState<string>('');
  const [hintExplanation, setHintExplanation] = useState('');
  const [accuracy, setAccuracy] = useState({ good: 0, total: 0 });
  const [boardWidth, setBoardWidth] = useState(400);
  const [clockRunning, setClockRunning] = useState(false);
  const chessRef = useRef(new Chess());
  const msgEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setBoardWidth(Math.min(window.innerWidth < 640 ? window.innerWidth - 24 : window.innerWidth < 1024 ? 480 : 580, 620));
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const addMessage = (text: string, type: 'good' | 'warning' | 'error' | 'info') => {
    setMessages(prev => [...prev.slice(-15), { text, type }]);
  };

  const startGame = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setPhase('playing');
    setMessages([{ text: `Привет! Я ${selectedCoach!.name}. Давай сыграем! Ты играешь белыми. Удачи! ${selectedCoach!.style === 'friendly' ? '😊' : '🎯'}`, type: 'info' }]);
    setMoveHistory([]);
    setGameOver(false);
    setAccuracy({ good: 0, total: 0 });
    setClockRunning(true);
  };

  // AI ход
  const doAIMove = useCallback(async () => {
    if (chessRef.current.isGameOver() || gameOver) return;
    setIsThinking(true);
    try {
      const aiMoveStr = await getAIMove(chessRef.current.fen(), 'hard');
      const parsed = parseStockfishMove(aiMoveStr);
      const move = chessRef.current.move({ from: parsed.from as Square, to: parsed.to as Square, promotion: (parsed.promotion || 'q') as 'q' | 'r' | 'b' | 'n' });
      if (move) {
        setFen(chessRef.current.fen());
        setMoveHistory(prev => [...prev, move.san]);
        playChessSound(move);
        if (chessRef.current.isGameOver()) {
          setGameOver(true); setClockRunning(false);
          setPhase('over');
          const pct = accuracy.total > 0 ? Math.round((accuracy.good / accuracy.total) * 100) : 0;
          addMessage(chessRef.current.isCheckmate() ? `Мат! Партия завершена. Точность: ${pct}%` : `Партия завершена. Точность: ${pct}%`, 'info');
        }
      }
    } catch (e) { console.error('AI error:', e); }
    setIsThinking(false);
  }, [gameOver, accuracy]);

  // Анализ хода в фоне (не блокирует UI)
  const analyzePlayerMove = useCallback(async (san: string, playerUci: string, fenBefore: string) => {
    try {
      const best = await getBestMove(fenBefore, 6);
      const bestUci = best.bestmove;
      const isBest = bestUci.startsWith(playerUci);

      let bestSan = bestUci;
      try {
        const tempChess = new Chess(fenBefore);
        const bm = tempChess.move({ from: bestUci.slice(0, 2) as Square, to: bestUci.slice(2, 4) as Square, promotion: bestUci.length === 5 ? bestUci[4] as 'q' : undefined });
        if (bm) bestSan = bm.san;
      } catch {}

      const evalDiff = isBest ? 0 : Math.abs(best.eval_cp) * 0.3 + 50;

      setAccuracy(prev => ({
        good: prev.good + (isBest ? 1 : 0),
        total: prev.total + 1,
      }));

      const comment = getTrainerComment(san, bestSan, isBest ? 0 : evalDiff, selectedCoach!.style, isBest);
      const type = isBest ? 'good' : evalDiff < 80 ? 'warning' : 'error';
      addMessage(comment, type as 'good' | 'warning' | 'error');
    } catch {
      addMessage(`${san} — ход сделан!`, 'info');
    }
  }, [selectedCoach]);

  // Ход игрока — синхронный (не тормозит)
  const handleDrop = useCallback((from: Square, to: Square): boolean => {
    if (gameOver || isThinking || chessRef.current.turn() !== 'w') return false;

    const fenBefore = chessRef.current.fen();
    // chess.js v1 бросает исключение на невалидном ходе
    let move = null;
    try {
      move = chessRef.current.move({ from, to, promotion: 'q' });
    } catch {
      move = null;
    }
    if (!move) {
      // Принудительно возвращаем фигуру
      setFen(chessRef.current.fen());
      return false;
    }

    setFen(chessRef.current.fen());
    setMoveHistory(prev => [...prev, move.san]);
    playChessSound(move);
    setShowHint(false);
    setHintUci('');

    const playerUci = from + to;

    // Анализ в фоне — не блокирует доску
    analyzePlayerMove(move.san, playerUci, fenBefore);

    // Проверяем конец игры
    if (chessRef.current.isGameOver()) {
      setGameOver(true); setClockRunning(false); setPhase('over');
      const pct = accuracy.total > 0 ? Math.round((accuracy.good / (accuracy.total + 1)) * 100) : 0;
      addMessage(chessRef.current.isCheckmate() ? `Мат! Отличная партия! Точность: ${pct}%` : `Партия завершена. Точность: ${pct}%`, 'info');
      return true;
    }

    // Ход AI
    setTimeout(() => doAIMove(), 300);
    return true;
  }, [gameOver, isThinking, selectedCoach, doAIMove, accuracy, analyzePlayerMove]);

  // Подсказка
  const getHint = async () => {
    if (chessRef.current.turn() !== 'w' || gameOver || isThinking) return;
    try {
      const best = await getBestMove(chessRef.current.fen(), 6);
      if (!best || !best.bestmove) { addMessage('Не удалось получить подсказку', 'info'); return; }
      const uci = best.bestmove;
      const tempChess = new Chess(chessRef.current.fen());
      const move = tempChess.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci.length === 5 ? uci[4] as 'q' : undefined });
      if (move) {
        setHintMove(move.san);
        setHintUci(uci);
        const explanations = selectedCoach?.style === 'friendly'
          ? [`Попробуй ${move.san}! Это сейчас самый сильный ход 💡`, `${move.san} — вот что бы сыграл движок! Попробуй! 🎯`]
          : [`Рекомендую ${move.san}. Объективно лучшее продолжение.`, `${move.san} — точный ход. Сохраняет инициативу.`];
        setHintExplanation(explanations[Math.floor(Math.random() * explanations.length)]);
        setShowHint(true);
      }
    } catch (e) {
      console.error('Hint error:', e);
    }
  };

  // Возврат хода
  const undoMove = () => {
    if (moveHistory.length < 2 || isThinking || gameOver) return;
    const undo1 = chessRef.current.undo(); // undo AI
    const undo2 = chessRef.current.undo(); // undo player
    if (!undo1 && !undo2) {
      // Полный сброс если undo не сработал
      const chess = new Chess();
      const moves = moveHistory.slice(0, -2);
      for (const san of moves) {
        try { chess.move(san); } catch { break; }
      }
      chessRef.current = chess;
      setFen(chess.fen());
      setMoveHistory(moves);
    } else {
      setFen(chessRef.current.fen());
      setMoveHistory(prev => prev.slice(0, undo1 && undo2 ? -2 : -1));
    }
    setShowHint(false);
    setHintUci('');
    setIsThinking(false);
    setGameOver(false);
    addMessage(selectedCoach?.style === 'friendly' ? 'Вернули ход! Попробуй ещё раз 😊' : 'Ход отменён. Найдите лучшее продолжение.', 'info');
  };

  const msgColors = { good: '#4ade80', warning: '#fbbf24', error: '#f87171', info: '#94a3b8' };
  const msgBg = { good: 'rgba(74,222,128,0.1)', warning: 'rgba(251,191,36,0.1)', error: 'rgba(248,113,113,0.1)', info: 'rgba(148,163,184,0.1)' };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Select Coach */}
          {phase === 'select' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
                  Учись с ИИ-тренером
                </h1>
                <p className="text-white/40">{t('train_realtime')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                {COACHES.map(coach => (
                  <motion.button key={coach.id} onClick={() => { setSelectedCoach(coach); setPhase('time'); }}
                    className="glass p-6 rounded-2xl text-left hover:ring-1 hover:ring-yellow-400/30 transition-all"
                    whileHover={{ scale: 1.03, y: -5 }} whileTap={{ scale: 0.98 }}>
                    <div className="text-5xl mb-3">{coach.avatar}</div>
                    <h3 className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{coach.name}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{coach.description}</p>
                    <div className="mt-4 text-xs px-3 py-1.5 rounded-full inline-block" style={{ background: coach.style === 'friendly' ? 'rgba(74,222,128,0.15)' : 'rgba(139,92,246,0.15)', color: coach.style === 'friendly' ? '#4ade80' : '#8b5cf6' }}>
                      {coach.style === 'friendly' ? '😊 Для начинающих' : '🎯 Для продвинутых'}
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Select time */}
          {phase === 'time' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-4">
                <span className="text-3xl">{selectedCoach?.avatar}</span>
                <h2 className="text-xl font-bold mt-2" style={{ fontFamily: "'Playfair Display', serif" }}>{t('train_with')} {selectedCoach?.name}</h2>
              </div>
              <TimeControlSelector title="Выберите время" onSelect={(_, minutes, increment) => {
                setTimeControl(minutes > 0 ? { minutes, increment } : null);
                startGame();
              }} />
            </motion.div>
          )}

          {/* Playing */}
          {(phase === 'playing' || phase === 'over') && (
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Board */}
              <div className="flex-shrink-0">
                {/* Последнее сообщение тренера — компактно над доской */}
                {messages.length > 0 && (
                  <motion.div className="mb-2 px-3 py-2 rounded-xl text-xs leading-relaxed lg:hidden"
                    style={{ background: msgBg[messages[messages.length - 1].type], borderLeft: `3px solid ${msgColors[messages[messages.length - 1].type]}`, maxWidth: boardWidth }}
                    key={messages.length} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                    <span className="mr-1">{selectedCoach?.avatar}</span>
                    <span style={{ color: msgColors[messages[messages.length - 1].type] }}>{messages[messages.length - 1].text}</span>
                  </motion.div>
                )}

                {/* Thinking indicator */}
                {isThinking && (
                  <motion.div className="mb-2 px-3 py-2 rounded-xl text-sm text-center" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    {selectedCoach?.name} думает...
                  </motion.div>
                )}

                <Chessboard
                  position={fen}
                  boardWidth={boardWidth}
                  onPieceDrop={handleDrop}
                  customLightSquareStyle={{ backgroundColor: boardTheme.light, ...boardTheme.lightStyle }}
                  customDarkSquareStyle={{ backgroundColor: boardTheme.dark, ...boardTheme.darkStyle }}
                  boardOrientation="white"
                  arePiecesDraggable={!gameOver && !isThinking && chessRef.current.turn() === 'w'}
                  animationDuration={200}
                  customArrows={showHint && hintUci.length >= 4 ? [[hintUci.slice(0, 2) as Square, hintUci.slice(2, 4) as Square, 'rgba(245,158,11,0.8)']] : []}
                />

                {/* Controls */}
                <div className="flex gap-2 mt-3">
                  <motion.button onClick={undoMove} disabled={moveHistory.length < 2 || gameOver}
                    className="flex-1 py-2 rounded-xl text-sm border border-blue-500/30 text-blue-400 disabled:opacity-30"
                    whileTap={{ scale: 0.95 }}>↩️ Назад</motion.button>
                  <motion.button onClick={getHint} disabled={gameOver || isThinking || chessRef.current.turn() !== 'w'}
                    className="flex-1 py-2 rounded-xl text-sm border border-yellow-500/30 text-yellow-400 disabled:opacity-30"
                    whileTap={{ scale: 0.95 }}>💡 Подсказка</motion.button>
                  <motion.button onClick={() => { setPhase('select'); setMessages([]); setGameOver(false); }}
                    className="flex-1 py-2 rounded-xl text-sm border border-green-500/30 text-green-400"
                    whileTap={{ scale: 0.95 }}>🔄 Новая</motion.button>
                </div>

                {/* Hint */}
                <AnimatePresence>
                  {showHint && (
                    <motion.div className="mt-2 px-3 py-2 rounded-xl text-sm" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
                      initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <span className="text-yellow-400 font-bold">{hintMove}</span>
                      <span className="text-white/50 ml-2">{hintExplanation}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Chat — на мобильном компактный */}
              <div className="flex-1 min-w-0">
                <div className="glass rounded-2xl flex flex-col h-[200px] lg:h-[460px]">
                  <div className="p-3 border-b border-white/10 flex items-center gap-2">
                    <span className="text-xl">{selectedCoach?.avatar}</span>
                    <span className="text-sm font-bold text-yellow-400">{selectedCoach?.name}</span>
                    {accuracy.total > 0 && (
                      <span className="ml-auto text-xs text-white/30">{t('accuracy_label')}: {Math.round((accuracy.good / accuracy.total) * 100)}%</span>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.map((msg, i) => (
                      <motion.div key={i} className="px-3 py-2 rounded-xl text-sm leading-relaxed"
                        style={{ background: msgBg[msg.type], borderLeft: `3px solid ${msgColors[msg.type]}` }}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                        <span style={{ color: msgColors[msg.type] }}>{msg.text}</span>
                      </motion.div>
                    ))}
                    <div ref={msgEndRef} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
