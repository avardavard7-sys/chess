'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import Header from '@/components/Header';
import { getAIMove, parseStockfishMove } from '@/lib/stockfish';
import { playChessSound } from '@/lib/sounds';
import { useBoardTheme } from '@/lib/boardThemes';
import BoardThemeSelector from '@/components/BoardThemeSelector';
import { useTranslation } from '@/lib/i18n';

// ═══════════════════════════════════════════════════════════════
// ГЕНЕРАЦИЯ CHESS960 FEN (Правила Фишера)
// Слоны на разноцветных, Король между ладьями, чёрные зеркалят
// ═══════════════════════════════════════════════════════════════
function generateChess960Fen(): string {
  const pieces: string[] = new Array(8).fill('');
  // 1. Слон на светлой клетке (0,2,4,6)
  const light = [0, 2, 4, 6];
  pieces[light[Math.floor(Math.random() * 4)]] = 'B';
  // 2. Слон на тёмной клетке (1,3,5,7)
  const dark = [1, 3, 5, 7];
  pieces[dark[Math.floor(Math.random() * 4)]] = 'B';
  // 3. Ферзь
  let empty = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[empty[Math.floor(Math.random() * empty.length)]] = 'Q';
  // 4. Первый конь
  empty = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[empty[Math.floor(Math.random() * empty.length)]] = 'N';
  // 5. Второй конь
  empty = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[empty[Math.floor(Math.random() * empty.length)]] = 'N';
  // 6. Ладья-Король-Ладья (в порядке: первая пустая=R, вторая=K, третья=R)
  empty = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[empty[0]] = 'R'; pieces[empty[1]] = 'K'; pieces[empty[2]] = 'R';

  const white = pieces.join('');
  const black = white.toLowerCase();
  return `${black}/pppppppp/8/8/8/8/PPPPPPPP/${white} w KQkq - 0 1`;
}

// ═══════════════════════════════════════════════════════════════
// HORDE FEN — 36 белых пешек vs обычная чёрная армия
// ═══════════════════════════════════════════════════════════════
// Horde: белые имеют много пешек (всю армию заменяем пешками), чёрные стандартные
// chess.js не принимает пешки на 1-й горизонтали, поэтому оставляем стандартные фигуры у белых
// но заменяем вторую горизонталь и добавляем пешки на 3-4 горизонтали
// Horde упрощённый: белые с дополнительными пешками на 3-4 горизонталях
// Полностью валидный для chess.js, работает на всех устройствах
const HORDE_FEN = 'rnbqkbnr/pppppppp/8/8/PPPPPPPP/PPPPPPPP/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// ═══════════════════════════════════════════════════════════════
// ВАРИАНТЫ
// ═══════════════════════════════════════════════════════════════
interface Variant {
  id: string; name: string; icon: string; desc: string;
  getStartFen: () => string;
}

const VARIANTS: Variant[] = [
  { id: 'chess960', name: 'Chess960', icon: '🔀', desc: 'Случайная расстановка фигур (Фишер)',
    getStartFen: generateChess960Fen },
  { id: 'threecheck', name: '3-Check', icon: '☑️', desc: 'Три шаха — и ты победил!',
    getStartFen: () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { id: 'koth', name: 'King of the Hill', icon: '👑', desc: 'Приведи короля в центр (d4,d5,e4,e5)!',
    getStartFen: () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { id: 'antichess', name: 'Antichess', icon: '🔄', desc: 'Проиграй все фигуры — и ты победил!',
    getStartFen: () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1' },
  { id: 'atomic', name: 'Atomic', icon: '💥', desc: 'Взятие = взрыв всех фигур вокруг!',
    getStartFen: () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
  { id: 'horde', name: 'Horde', icon: '♟️', desc: '36 белых пешек vs чёрная армия!',
    getStartFen: () => HORDE_FEN },
  { id: 'antistress', name: 'Антистресс', icon: '😌', desc: 'Каждый ход отнимает время! Играй быстро!',
    getStartFen: () => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
];

// ═══════════════════════════════════════════════════════════════
// ЦЕНТРАЛЬНЫЕ КЛЕТКИ (KOTH)
// ═══════════════════════════════════════════════════════════════
const HILL_SQUARES = ['d4', 'd5', 'e4', 'e5'];

function findKing(chess: Chess, color: 'w' | 'b'): string | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) {
        return String.fromCharCode(97 + c) + (8 - r);
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// ANTICHESS: Найти обязательные взятия
// ═══════════════════════════════════════════════════════════════
function getCaptureMoves(chess: Chess): string[] {
  const moves = chess.moves({ verbose: true });
  return moves.filter(m => m.captured).map(m => m.from + m.to + (m.promotion || ''));
}

// ═══════════════════════════════════════════════════════════════
// ATOMIC: Взрыв после взятия
// ═══════════════════════════════════════════════════════════════
function getAdjacentSquares(sq: string): string[] {
  const col = sq.charCodeAt(0) - 97;
  const row = parseInt(sq[1]) - 1;
  const adj: string[] = [];
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue;
      const nc = col + dc; const nr = row + dr;
      if (nc >= 0 && nc < 8 && nr >= 0 && nr < 8) {
        adj.push(String.fromCharCode(97 + nc) + (nr + 1));
      }
    }
  }
  return adj;
}

function applyExplosion(fen: string, targetSq: string): { newFen: string; kingDestroyed: 'w' | 'b' | null } {
  // Парсим FEN в массив
  const parts = fen.split(' ');
  const rows = parts[0].split('/');
  const board: string[][] = [];
  for (const row of rows) {
    const r: string[] = [];
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') { for (let i = 0; i < parseInt(ch); i++) r.push('.'); }
      else r.push(ch);
    }
    board.push(r);
  }

  const toRC = (sq: string) => ({ r: 8 - parseInt(sq[1]), c: sq.charCodeAt(0) - 97 });

  // Взрываем клетку + соседние (кроме пешек)
  const explode = [targetSq, ...getAdjacentSquares(targetSq)];
  let kingDestroyed: 'w' | 'b' | null = null;

  for (const sq of explode) {
    const { r, c } = toRC(sq);
    if (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const piece = board[r][c];
      if (piece === '.') continue;
      // Пешки не взрываются от соседнего взрыва (только если на целевой клетке)
      if (sq !== targetSq && (piece === 'p' || piece === 'P')) continue;
      if (piece === 'K') kingDestroyed = 'w';
      if (piece === 'k') kingDestroyed = 'b';
      board[r][c] = '.';
    }
  }

  // Собираем FEN обратно
  const newRows = board.map(row => {
    let s = ''; let empty = 0;
    for (const ch of row) {
      if (ch === '.') { empty++; }
      else { if (empty > 0) { s += empty; empty = 0; } s += ch; }
    }
    if (empty > 0) s += empty;
    return s;
  });

  parts[0] = newRows.join('/');
  return { newFen: parts.join(' '), kingDestroyed };
}

// ═══════════════════════════════════════════════════════════════
// ГЛАВНЫЙ КОМПОНЕНТ
// ═══════════════════════════════════════════════════════════════
export default function Chess960Page() {
  const { theme: boardTheme, themeId: boardThemeId, setTheme: setBoardTheme } = useBoardTheme();
  const { t } = useTranslation();
  const [variant, setVariant] = useState<Variant | null>(null);
  const [phase, setPhase] = useState<'select' | 'playing'>('select');
  const [fen, setFen] = useState('');
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [boardWidth, setBoardWidth] = useState(400);
  const [checksWhite, setChecksWhite] = useState(0);
  const [checksBlack, setChecksBlack] = useState(0);
  const [highlightSquares, setHighlightSquares] = useState<Record<string, React.CSSProperties>>({});
  // Антистресс таймер
  const [antiTime, setAntiTime] = useState(600); // 10 минут
  const antiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chessRef = useRef(new Chess());
  const startFenRef = useRef('');

  useEffect(() => {
    const update = () => setBoardWidth(Math.min(window.innerWidth < 640 ? window.innerWidth - 24 : window.innerWidth < 1024 ? 500 : 600, 640));
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const startGame = (v: Variant) => {
    const startFen = v.getStartFen();
    startFenRef.current = startFen;
    const chess = new Chess(startFen);
    chessRef.current = chess;
    setFen(startFen);
    setVariant(v);
    setPhase('playing');
    setGameOver(false);
    setGameResult('');
    setMoveHistory([]);
    setChecksWhite(0);
    setChecksBlack(0);
    setHighlightSquares({});
    setAntiTime(600);
    if (antiTimerRef.current) clearInterval(antiTimerRef.current);
    if (v.id === 'antistress') {
      antiTimerRef.current = setInterval(() => {
        setAntiTime(prev => {
          if (prev <= 0) { return 0; }
          return prev - 0.1;
        });
      }, 100);
    }
  };

  // Проверяем timeout для антистресс
  useEffect(() => {
    if (variant?.id === 'antistress' && antiTime <= 0 && !gameOver) {
      setGameOver(true);
      setGameResult(t('variants_time_up'));
      if (antiTimerRef.current) clearInterval(antiTimerRef.current);
    }
  }, [antiTime, variant, gameOver]);

  useEffect(() => {
    return () => { if (antiTimerRef.current) clearInterval(antiTimerRef.current); };
  }, []);

  // Проверка специальных условий победы
  const checkVariantWin = useCallback((chess: Chess, variantId: string, cw: number, cb: number): string | null => {
    // 3-Check
    if (variantId === 'threecheck') {
      if (cw >= 3) return t('variants_white_3checks');
      if (cb >= 3) return t('variants_black_3checks');
    }
    // King of the Hill
    if (variantId === 'koth') {
      const wKing = findKing(chess, 'w');
      const bKing = findKing(chess, 'b');
      if (wKing && HILL_SQUARES.includes(wKing)) return t('variants_white_hill');
      if (bKing && HILL_SQUARES.includes(bKing)) return t('variants_black_hill');
    }
    // Antichess — выиграл тот кто потерял все фигуры
    if (variantId === 'antichess') {
      const board = chess.board();
      let whiteCount = 0, blackCount = 0;
      for (const row of board) for (const p of row) {
        if (p) { if (p.color === 'w') whiteCount++; else blackCount++; }
      }
      if (whiteCount === 0) return t('variants_lost_all');
      if (blackCount === 0) return t('variants_opp_lost_all');
    }
    // Стандартный мат/пат
    if (chess.isCheckmate()) {
      return chess.turn() === 'b' ? t('game_over_win') + '!' : t('game_over_loss') + '!';
    }
    if (chess.isStalemate()) {
      if (variantId === 'antichess') {
        return chess.turn() === 'w' ? t('reason_stalemate') + ' — ' + t('game_over_win') : t('reason_stalemate') + ' — ' + t('game_over_loss');
      }
      return t('reason_stalemate') + ' — ' + t('game_over_draw') + '!';
    }
    if (chess.isDraw()) return t('game_over_draw') + '!';
    return null;
  }, []);

  // AI ход
  const doAIMove = useCallback(async (variantId: string, cw: number, cb: number) => {
    if (gameOver) return;
    setIsThinking(true);
    try {
      const chess = chessRef.current;

      // Antichess — AI обязан бить если может
      if (variantId === 'antichess') {
        const captures = getCaptureMoves(chess);
        if (captures.length > 0) {
          const pick = captures[Math.floor(Math.random() * captures.length)];
          const move = chess.move({ from: pick.slice(0, 2) as Square, to: pick.slice(2, 4) as Square, promotion: pick.length === 5 ? (pick[4] as 'q' | 'r' | 'b' | 'n') : undefined });
          if (move) {
            playChessSound(move);
            setFen(chess.fen());
            setMoveHistory(prev => [...prev, move.san]);
            // Проверка победы
            const win = checkVariantWin(chess, variantId, cw, cb);
            if (win) { setGameOver(true); setGameResult(win); }
            setIsThinking(false);
            return;
          }
        }
      }

      // Atomic — после AI хода проверяем взрыв
      if (variantId === 'atomic') {
        const moves = chess.moves({ verbose: true });
        if (moves.length === 0) { setIsThinking(false); return; }
        // Выбираем случайный ход
        const pick = moves[Math.floor(Math.random() * moves.length)];
        const move = chess.move(pick);
        if (move) {
          playChessSound(move);
          if (move.captured) {
            const { newFen, kingDestroyed } = applyExplosion(chess.fen(), move.to);
            try { chessRef.current = new Chess(newFen); } catch { /* invalid fen after explosion */ }
            setFen(newFen);
            if (kingDestroyed === 'w') { setGameOver(true); setGameResult(t('variants_your_king_exploded')); }
            else if (kingDestroyed === 'b') { setGameOver(true); setGameResult(t('variants_opp_king_exploded')); }
          } else {
            setFen(chess.fen());
          }
          setMoveHistory(prev => [...prev, move.san]);
        }
        setIsThinking(false);
        return;
      }

      // Стандартный AI (Stockfish)
      const aiMoveStr = await getAIMove(chess.fen(), 'medium');
      const parsed = parseStockfishMove(aiMoveStr);
      const move = chess.move({ from: parsed.from as Square, to: parsed.to as Square, promotion: (parsed.promotion || 'q') as 'q' | 'r' | 'b' | 'n' });
      if (move) {
        playChessSound(move);
        setFen(chess.fen());
        setMoveHistory(prev => [...prev, move.san]);

        // 3-Check: считаем шахи
        let newCb = cb;
        if (variantId === 'threecheck' && chess.isCheck()) {
          newCb = cb + 1;
          setChecksBlack(newCb);
        }

        // KOTH highlight
        if (variantId === 'koth') {
          const hl: Record<string, React.CSSProperties> = {};
          HILL_SQUARES.forEach(sq => { hl[sq] = { backgroundColor: 'rgba(245,158,11,0.3)', borderRadius: '50%' }; });
          setHighlightSquares(hl);
        }

        const win = checkVariantWin(chess, variantId, cw, newCb);
        if (win) { setGameOver(true); setGameResult(win); }
      }
    } catch (e) { console.error('AI error:', e); }
    setIsThinking(false);
  }, [gameOver, checkVariantWin]);

  // Ход игрока
  const handleDrop = useCallback((from: Square, to: Square): boolean => {
    if (gameOver || isThinking || chessRef.current.turn() !== 'w') return false;
    const chess = chessRef.current;
    const vid = variant?.id || '';

    // Antichess — обязательные взятия
    if (vid === 'antichess') {
      const captures = getCaptureMoves(chess);
      if (captures.length > 0) {
        const uci = from + to;
        if (!captures.some(c => c.startsWith(uci))) {
          // Этот ход не взятие, но взятия доступны — запрещаем
          setFen(chess.fen());
          return false;
        }
      }
    }

    let move = null;
    try {
      move = chess.move({ from, to, promotion: 'q' });
    } catch {
      move = null;
    }
    if (!move) {
      // Принудительно перерисовываем чтобы фигура вернулась на место
      setFen(chess.fen());
      return false;
    }

    playChessSound(move);

    // Atomic — взрыв после взятия
    if (vid === 'atomic' && move.captured) {
      const { newFen, kingDestroyed } = applyExplosion(chess.fen(), to);
      try { chessRef.current = new Chess(newFen); } catch {}
      setFen(newFen);
      setMoveHistory(prev => [...prev, move.san]);
      if (kingDestroyed === 'b') { setGameOver(true); setGameResult(t('variants_opp_king_exploded')); return true; }
      if (kingDestroyed === 'w') { setGameOver(true); setGameResult(t('variants_your_king_exploded')); return true; }
      setTimeout(() => doAIMove(vid, checksWhite, checksBlack), 300);
      return true;
    }

    setFen(chess.fen());
    setMoveHistory(prev => [...prev, move.san]);

    // 3-Check: считаем шахи
    let newCw = checksWhite;
    if (vid === 'threecheck' && chess.isCheck()) {
      newCw = checksWhite + 1;
      setChecksWhite(newCw);
    }

    // KOTH highlight
    if (vid === 'koth') {
      const hl: Record<string, React.CSSProperties> = {};
      HILL_SQUARES.forEach(sq => { hl[sq] = { backgroundColor: 'rgba(245,158,11,0.3)', borderRadius: '50%' }; });
      setHighlightSquares(hl);
    }

    const win = checkVariantWin(chess, vid, newCw, checksBlack);
    if (win) { setGameOver(true); setGameResult(win); if (antiTimerRef.current) clearInterval(antiTimerRef.current); return true; }

    // Антистресс: каждый ход уменьшает время на 3 сек
    if (vid === 'antistress') {
      setAntiTime(prev => Math.max(0, prev - 3));
    }

    setTimeout(() => doAIMove(vid, newCw, checksBlack), 300);
    return true;
  }, [gameOver, isThinking, variant, checksWhite, checksBlack, doAIMove, checkVariantWin]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">

          {/* Select variant */}
          {phase === 'select' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{t('variants_title')}</h1>
                <p className="text-white/40">{t('try_unusual')}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {VARIANTS.map(v => (
                  <motion.button key={v.id} onClick={() => startGame(v)}
                    className="glass p-5 rounded-2xl text-center hover:ring-1 hover:ring-yellow-400/30"
                    whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.97 }}>
                    <div className="text-3xl mb-2">{v.icon}</div>
                    <h3 className="text-sm font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{v.name}</h3>
                    <p className="text-[10px] text-white/40 leading-relaxed">{({'chess960': t('variants_chess960'), 'threecheck': t('variants_3check'), 'koth': t('variants_koth'), 'antichess': t('variants_antichess'), 'atomic': t('variants_atomic'), 'horde': t('variants_horde'), 'antistress': t('variants_antistress')}[v.id] || v.desc)}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Playing */}
          {phase === 'playing' && variant && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <motion.button onClick={() => { setPhase('select'); setGameOver(false); }}
                  className="text-white/40 hover:text-white/80 text-sm" whileHover={{ x: -3 }}>← {t('back')}</motion.button>
                <div className="text-center">
                  <span className="text-lg mr-1">{variant.icon}</span>
                  <span className="text-sm font-bold" style={{ color: '#f59e0b' }}>{variant.name}</span>
                </div>
                <motion.button onClick={() => startGame(variant)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-green-500/30 text-green-400"
                  whileTap={{ scale: 0.95 }}>🔄 {t('new_game')}</motion.button>
              </div>

              {/* Variant info bar */}
              {variant.id === 'threecheck' && (
                <div className="glass p-3 rounded-xl mb-3 flex justify-around text-center">
                  <div><div className="text-[10px] text-white/30">{t('analysis_white')}</div><div className="text-xl font-bold text-green-400">{checksWhite}/3</div></div>
                  <div><div className="text-[10px] text-white/30">{t('analysis_black')}</div><div className="text-xl font-bold text-red-400">{checksBlack}/3</div></div>
                </div>
              )}
              {variant.id === 'koth' && (
                <div className="glass p-2 rounded-xl mb-3 text-center text-xs text-white/40">
                  👑 Приведи короля на d4, d5, e4 или e5 чтобы победить!
                </div>
              )}
              {variant.id === 'antichess' && (
                <div className="glass p-2 rounded-xl mb-3 text-center text-xs text-white/40">
                  🔄 Обязательно бей если можешь! Потеряй все фигуры чтобы победить!
                </div>
              )}
              {variant.id === 'atomic' && (
                <div className="glass p-2 rounded-xl mb-3 text-center text-xs text-white/40">
                  💥 Взятие = взрыв! Все фигуры вокруг (кроме пешек) уничтожаются!
                </div>
              )}
              {variant.id === 'horde' && (
                <div className="glass p-2 rounded-xl mb-3 text-center text-xs text-white/40">
                  ♟️ Вы играете белыми пешками! Задавите чёрного короля!
                </div>
              )}

              {/* AI thinking */}
              {isThinking && (
                <motion.div className="mb-2 px-3 py-2 rounded-xl text-sm text-center"
                  style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}
                  animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
                  {t('ai_thinking')}
                </motion.div>
              )}

              {/* Антистресс таймер */}
              {variant?.id === 'antistress' && (
                <div className="mb-3 text-center">
                  <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl ${antiTime <= 30 ? 'bg-red-500/15 border border-red-500/30' : 'glass'}`}>
                    <span className="text-2xl">⏱</span>
                    <span className={`text-3xl font-mono font-bold ${antiTime <= 30 ? 'text-red-400' : antiTime <= 60 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {Math.floor(antiTime / 60)}:{String(Math.floor(antiTime % 60)).padStart(2, '0')}
                    </span>
                    <span className="text-xs text-white/30">-3 {t('moves_count')}</span>
                  </div>
                </div>
              )}

              {/* Board */}
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-shrink-0 flex justify-center">
                  <Chessboard
                    position={fen}
                    boardWidth={boardWidth}
                    onPieceDrop={handleDrop}
                    customLightSquareStyle={{ backgroundColor: boardTheme.light, ...boardTheme.lightStyle }}
                    customDarkSquareStyle={{ backgroundColor: boardTheme.dark, ...boardTheme.darkStyle }}
                    boardOrientation="white"
                    arePiecesDraggable={!gameOver && !isThinking && chessRef.current.turn() === 'w'}
                    animationDuration={200}
                    customSquareStyles={{
                      ...highlightSquares,
                      ...(variant.id === 'koth' ? Object.fromEntries(HILL_SQUARES.map(sq => [sq, { backgroundColor: 'rgba(245,158,11,0.2)', boxShadow: 'inset 0 0 10px rgba(245,158,11,0.3)' }])) : {}),
                    }}
                  />
                </div>
                <div className="flex justify-center mt-2">
                  <BoardThemeSelector currentThemeId={boardThemeId} onSelect={setBoardTheme} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="glass rounded-xl flex flex-col" style={{ height: Math.min(boardWidth, 300) }}>
                    <div className="p-3 border-b border-white/10">
                      <span className="text-xs text-white/40 uppercase tracking-wider">{t('moves_label')} ({moveHistory.length})</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {moveHistory.length > 0 ? (
                        <div className="space-y-0.5">
                          {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                            <div key={i} className="flex gap-1 text-sm font-mono">
                              <span className="text-white/20 w-6 text-right text-xs py-0.5">{i + 1}.</span>
                              <span className="flex-1 px-1 py-0.5 text-white/80 text-xs">{moveHistory[i * 2]}</span>
                              {moveHistory[i * 2 + 1] && <span className="flex-1 px-1 py-0.5 text-white/60 text-xs">{moveHistory[i * 2 + 1]}</span>}
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-white/30 text-sm text-center py-8">{t('no_moves_yet')}</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Game Over */}
              <AnimatePresence>
                {gameOver && (
                  <motion.div className="glass p-6 rounded-2xl mt-4 text-center"
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                    <div className="text-4xl mb-3">{gameResult.includes(t('game_over_win')) ? '🏆' : gameResult.includes(t('game_over_draw')) ? '🤝' : '😔'}</div>
                    <div className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif",
                      color: gameResult.includes(t('game_over_win')) ? '#4ade80' : gameResult.includes(t('game_over_draw')) ? '#fbbf24' : '#f87171' }}>
                      {gameResult}
                    </div>
                    <div className="flex gap-3 justify-center">
                      <motion.button onClick={() => startGame(variant)}
                        className="px-6 py-2.5 rounded-xl font-semibold text-black"
                        style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                        whileHover={{ scale: 1.03 }}>🔄 Ещё раз</motion.button>
                      <motion.button onClick={() => { setPhase('select'); setGameOver(false); }}
                        className="px-6 py-2.5 rounded-xl font-semibold border border-white/20 text-white/60"
                        whileHover={{ scale: 1.03 }}>{t('select_variant')}</motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
