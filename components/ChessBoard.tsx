'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { getAIMove, parseStockfishMove, DIFFICULTY_CONFIG } from '@/lib/stockfish';
import ChessClock from '@/components/ChessClock';
import EvalBar from '@/components/EvalBar';
import { playChessSound, playGameStartSound, playGameEndSound } from '@/lib/sounds';
import { getOpeningName } from '@/lib/openings';
import { getLegalMovesForSquare, getCaptureSquares, getGameStatus, isPromotion, getCapturedPieces } from '@/lib/chess-logic';
import { useBoardTheme } from '@/lib/boardThemes';
import BoardThemeSelector from '@/components/BoardThemeSelector';
import { useTranslation } from '@/lib/i18n';
import { supabase, updateElo, getProfile } from '@/lib/supabase';
import { calculateEloChange } from '@/lib/elo';
import type { Difficulty } from '@/store/gameStore';

interface ChessBoardProps {
  difficulty: Difficulty;
  mode: 'ai' | 'local' | 'online' | 'friend';
  isKidsMode?: boolean;
  sessionId?: string;
  playerColor?: 'white' | 'black';
  resumeGameId?: string;
  timeControl?: { minutes: number; increment: number };
  tournamentMatchId?: string;
  tournamentId?: string;
  onGameOver?: (result: 'win' | 'loss' | 'draw', eloChange: number, coinChange?: number, gameId?: string, reason?: string) => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function ChessBoard({
  difficulty,
  mode,
  isKidsMode = false,
  sessionId,
  playerColor = 'white',
  resumeGameId,
  timeControl,
  tournamentMatchId,
  tournamentId,
  onGameOver,
}: ChessBoardProps) {
  const chessRef = useRef(new Chess());
  const chess = chessRef.current;
  const [fen, setFen] = useState(INITIAL_FEN);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [captureSquares, setCaptureSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });
  const [promotionSquare, setPromotionSquare] = useState<{ from: Square; to: Square } | null>(null);
  const [gameOver, setGameOver] = useState<{ status: string; winner?: string } | null>(null);
  const [playerElo, setPlayerElo] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminHint, setAdminHint] = useState<{ from: Square; to: Square } | null>(null);
  const [adminHintLoading, setAdminHintLoading] = useState(false);
  const [boardWidth, setBoardWidth] = useState(480);
  const [evaluation, setEvaluation] = useState(0);
  const [mateIn, setMateIn] = useState<number | null>(null);
  const [openingName, setOpeningName] = useState('');
  const [drawOffered, setDrawOffered] = useState(false);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isThinkingRef = useRef(false);
  const gameOverRef = useRef(false);
  const isReloadingRef = useRef(false);
  const mountTimeRef = useRef(Date.now());
  const gameReasonRef = useRef('');
  const setGameOverWithReason = (status: string, winner?: string) => {
    gameReasonRef.current = status;
    setGameOver({ status, winner });
  };
  const movesLogRef = useRef<Array<{ from: string; to: string; san: string; promotion?: string }>>([]);
  const liveGameIdRef = useRef<string | null>(null);
  const premoveRef = useRef<{ from: Square; to: Square } | null>(null);
  const [premoveSquares, setPremoveSquares] = useState<{ from: Square; to: Square } | null>(null);
  const [illegalCount, setIllegalCount] = useState(0);
  const [illegalMsg, setIllegalMsg] = useState('');
  const [hintsEnabled, setHintsEnabled] = useState(true);
  const [undoRequested, setUndoRequested] = useState(false);
  const [undoFromOpponent, setUndoFromOpponent] = useState(false);
  const [drawFromOpponent, setDrawFromOpponent] = useState(false);
  const [newGameFromOpponent, setNewGameFromOpponent] = useState(false);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      // На мобилке вычитаем EvalBar (28px) + padding (32px)
      setBoardWidth(Math.min(w < 640 ? w - 60 : w < 1024 ? 460 : 520, 560));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isMyTurn = useCallback(() => {
    if (gameOverRef.current) return false;
    if (mode === 'local') return true;
    if (mode === 'ai') return chess.turn() === 'w';
    // Online/friend — ждём пока канал подключится
    if (!channelReady) return false;
    return chess.turn() === (playerColor === 'white' ? 'w' : 'b');
  }, [mode, playerColor, chess, channelReady]);

  // Восстановление партии из live_games
  // Авто-оценка позиции — обновляет EvalBar после каждого хода
  // Используем getBestMove с depth 10 для скорости (не блокирует UI)
  useEffect(() => {
    if (gameOver) return;
    let cancelled = false;
    const evalTimer = setTimeout(async () => {
      try {
        const { getBestMove } = await import('@/lib/stockfish');
        const result = await getBestMove(fen, 10);
        if (cancelled) return;
        // Stockfish возвращает оценку с точки зрения СТОРОНЫ КОТОРАЯ ХОДИТ
        // EvalBar ожидает оценку с точки зрения БЕЛЫХ
        const turn = fen.split(' ')[1]; // 'w' или 'b'
        const evalForWhite = turn === 'w' ? result.eval_cp : -result.eval_cp;
        const mateForWhite = result.mate !== null
          ? (turn === 'w' ? result.mate : -result.mate)
          : null;
        setEvaluation(evalForWhite);
        setMateIn(mateForWhite);
      } catch { /* ignore */ }
    }, 300); // debounce 300ms — чтобы не спамить при быстрых ходах

    return () => {
      cancelled = true;
      clearTimeout(evalTimer);
    };
  }, [fen, gameOver]);

  // Секретный hotkey F1 для админов — toggle подсказки лучшего хода
  useEffect(() => {
    if (!isAdmin) return;
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key !== 'F1') return;
      e.preventDefault(); // Блокируем дефолтное поведение браузера (открытие хелпа)

      // Если подсказка уже показана — скрываем
      if (adminHint) {
        setAdminHint(null);
        return;
      }

      // Если уже идёт расчёт — игнорируем
      if (adminHintLoading) return;
      if (gameOver) return;

      setAdminHintLoading(true);
      try {
        const moveStr = await getAIMove(chess.fen(), 'expert');
        const parsed = parseStockfishMove(moveStr);
        if (parsed) {
          setAdminHint({ from: parsed.from as Square, to: parsed.to as Square });
          // Авто-скрытие через 10 секунд
          setTimeout(() => setAdminHint(null), 10000);
        }
      } catch (err) {
        console.error('Admin hint error:', err);
      }
      setAdminHintLoading(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin, adminHint, adminHintLoading, gameOver, chess]);

  useEffect(() => {
    if (!resumeGameId) return;
    const loadGame = async () => {
      const { data } = await supabase.from('live_games')
        .select('fen, moves_json, id').eq('id', resumeGameId).single();
      if (data && data.fen && data.fen !== INITIAL_FEN) {
        try {
          chess.load(data.fen);
          setFen(data.fen);
          liveGameIdRef.current = data.id;
          // Восстанавливаем историю ходов
          const moves = data.moves_json || [];
          movesLogRef.current = moves;
          setMoveHistory(moves.map((m: any) => m.san || ''));
          // Если AI режим и ход чёрных — запускаем AI
          if (mode === 'ai' && chess.turn() === 'b') {
            const { getAIMove, parseStockfishMove } = await import('@/lib/stockfish');
            const aiMoveStr = await getAIMove(data.fen, difficulty);
            const parsed = parseStockfishMove(aiMoveStr);
            const aiMove = chess.move({ from: parsed.from as Square, to: parsed.to as Square, promotion: parsed.promotion as 'q' | 'r' | 'b' | 'n' | undefined });
            if (aiMove) {
              setFen(chess.fen());
              setLastMove({ from: parsed.from as Square, to: parsed.to as Square });
              setMoveHistory(prev => [...prev, aiMove.san]);
              movesLogRef.current.push({ from: parsed.from, to: parsed.to, san: aiMove.san });
              if (liveGameIdRef.current) {
                supabase.from('live_games').update({ fen: chess.fen(), moves_json: [...movesLogRef.current] }).eq('id', liveGameIdRef.current);
              }
            }
          }
        } catch (e) { console.error('Failed to restore game:', e); }
      }
    };
    loadGame();
  }, [resumeGameId]);

  useEffect(() => {
    if (mode === 'ai' || mode === 'online' || mode === 'friend') {
      supabase.auth.getSession().then(async ({ data: { session } }) => { const user = session?.user;
        if (user) {
          const { data } = await getProfile(user.id);
          if (data) {
            setPlayerElo(data.elo_rating);
            setGamesPlayed(data.games_played || 0);
            setIsAdmin(data.is_admin === true);

            // Если восстанавливаем — не создаём новую
            if (resumeGameId) return;

            // Закрываем ВСЕ старые активные игры этого юзера
            await supabase.from('live_games').update({ status: 'finished', finished_at: new Date().toISOString() })
              .eq('status', 'active').or(`white_id.eq.${user.id},black_id.eq.${user.id}`);

            // Создаём live_game для стриминга
            const opponentName = mode === 'ai' ? `AI (${difficulty})` : mode === 'friend' ? t('opponent_name_friend') : t('opponent_name_opponent');
            const { data: game } = await supabase.from('live_games').insert({
              white_id: playerColor === 'white' ? user.id : null,
              black_id: playerColor === 'black' ? user.id : null,
              white_name: playerColor === 'white' ? (data.username || 'Игрок') : opponentName,
              black_name: playerColor === 'black' ? (data.username || 'Игрок') : opponentName,
              mode: mode,
              status: 'active',
            }).select().single();
            if (game) liveGameIdRef.current = game.id;
          }
        }
      });
    } else if (mode === 'local' && !resumeGameId) {
      // Локальная игра тоже записываем
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        const user = session?.user;
        if (user) {
          // Закрываем старые
          await supabase.from('live_games').update({ status: 'finished', finished_at: new Date().toISOString() })
            .eq('status', 'active').or(`white_id.eq.${user.id},black_id.eq.${user.id}`);
          const { data: profile } = await getProfile(user.id);
          const { data: game } = await supabase.from('live_games').insert({
            white_id: user.id,
            black_id: user.id,
            white_name: profile?.username || t('white'),
            black_name: t('black'),
            mode: 'local',
            status: 'active',
          }).select().single();
          if (game) liveGameIdRef.current = game.id;
        }
      });
    }

    // Закрываем live_game ТОЛЬКО при закрытии вкладки/браузера
    // При переходе между страницами — игра остаётся активной (чтобы можно было вернуться)
    const closeLiveGameOnTabClose = () => {
      if (liveGameIdRef.current) {
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/live_games?id=eq.${liveGameIdRef.current}`;
        const body = JSON.stringify({ status: 'finished', finished_at: new Date().toISOString() });
        try {
          navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        } catch {
          fetch(url, {
            method: 'PATCH', body, keepalive: true,
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''}`,
            },
          }).catch(() => {});
        }
      }
    };

    // Предупреждение при выходе из игры
    const warnOnLeave = (e: BeforeUnloadEvent) => {
      if (!gameOverRef.current) {
        e.preventDefault();
        e.returnValue = 'Партия ещё идёт! Выход = проигрыш.';
      }
    };

    window.addEventListener('beforeunload', closeLiveGameOnTabClose);
    window.addEventListener('beforeunload', warnOnLeave);

    return () => {
      window.removeEventListener('beforeunload', closeLiveGameOnTabClose);
      window.removeEventListener('beforeunload', warnOnLeave);
    };
  }, []);

  useEffect(() => {
    if ((mode !== 'online' && mode !== 'friend') || !sessionId) return;
    const channel = supabase.channel(`game:${sessionId}`, {
      config: { broadcast: { self: false }, presence: { key: playerColor } },
    });
    channelRef.current = channel;
    channel
      .on('broadcast', { event: 'MOVE' }, ({ payload }) => {
        const { move, fen: newFen } = payload;
        chess.load(newFen);
        setFen(newFen);
        setLastMove({ from: move.from as Square, to: move.to as Square });
        setMoveHistory((prev) => [...prev, move.san || '']);
        updateCaptured();

        // Записываем ход оппонента в лог для анализа
        movesLogRef.current.push({
          from: move.from, to: move.to, san: move.san || '',
          ...(move.promotion ? { promotion: move.promotion } : {}),
        });

        checkGameOverState();

        // Выполняем premove если был поставлен
        if (premoveRef.current && !gameOverRef.current) {
          const pm = premoveRef.current;
          premoveRef.current = null;
          setPremoveSquares(null);
          setTimeout(() => {
            // Проверяем что premove всё ещё легальный после хода соперника
            try {
              const testChess = new Chess(chess.fen());
              const valid = testChess.move({ from: pm.from, to: pm.to, promotion: 'q' });
              if (valid) {
                executeMove(pm.from, pm.to);
              }
              // Если невалидный — просто игнорируем (например, фигура была взята)
            } catch {
              // Невалидный premove — игнорируем
            }
          }, 100);
        }
      })
      .on('broadcast', { event: 'RESIGN' }, () => {
        if (isReloadingRef.current) return;
        if (Date.now() - mountTimeRef.current < 3000) return; // grace period
        if (!gameOverRef.current) {
          gameOverRef.current = true;
          setGameOverWithReason('resigned', playerColor);
          handleGameEnd('win');
        }
      })
      .on('broadcast', { event: 'DRAW_ACCEPT' }, () => {
        gameOverRef.current = true;
        setGameOverWithReason('draw', undefined);
        handleGameEnd('draw');
      })
      .on('broadcast', { event: 'DRAW_OFFER' }, () => {
        if (!gameOverRef.current) setDrawFromOpponent(true);
      })
      .on('broadcast', { event: 'DRAW_DECLINE' }, () => {
        setDrawOffered(false);
      })
      .on('broadcast', { event: 'NEW_GAME_OFFER' }, () => {
        setNewGameFromOpponent(true);
      })
      .on('broadcast', { event: 'NEW_GAME_ACCEPT' }, () => {
        // Сбрасываем состояние на месте — без перезагрузки страницы
        chess.reset();
        setFen(INITIAL_FEN);
        setMoveHistory([]);
        setCapturedPieces({ white: [], black: [] });
        setLastMove(null);
        setSelectedSquare(null);
        setLegalMoves([]);
        setCaptureSquares([]);
        setIllegalCount(0);
        setIllegalMsg('');
        gameOverRef.current = false;
        setGameOver(null); gameReasonRef.current = '';
        setNewGameOffered(false);
        setNewGameFromOpponent(false);
        setDrawOffered(false);
        setDrawFromOpponent(false);
        movesLogRef.current = [];
        setOpeningName('');
        setAdminHint(null);
        premoveRef.current = null;
        setPremoveSquares(null);
      })
      .on('broadcast', { event: 'NEW_GAME_DECLINE' }, () => {
        setNewGameOffered(false);
        setNewGameDeclined(true);
        setTimeout(() => setNewGameDeclined(false), 3000);
      })
      .on('broadcast', { event: 'TIMEOUT' }, () => {
        if (isReloadingRef.current) return;
        if (!gameOverRef.current) {
          gameOverRef.current = true;
          setGameOverWithReason('timeout', playerColor);
          handleGameEnd('win');
        }
      })
      .on('broadcast', { event: 'LEAVE' }, () => {
        if (!gameOverRef.current) {
          gameOverRef.current = true;
          setGameOverWithReason('abandoned', playerColor);
          handleGameEnd('win');
        }
      })
      .on('broadcast', { event: 'UNDO_REQUEST' }, () => {
        setUndoFromOpponent(true);
      })
      .on('broadcast', { event: 'UNDO_APPROVED' }, () => {
        setUndoRequested(false);
        // Отменяем последний ход
        const undone = chess.undo();
        if (undone) { movesLogRef.current.pop(); setMoveHistory(prev => prev.slice(0, -1)); }
        setFen(chess.fen()); setSelectedSquare(null); setLegalMoves([]); setCaptureSquares([]); setLastMove(null); updateCaptured();
      })
      .on('broadcast', { event: 'UNDO_DECLINED' }, () => {
        setUndoRequested(false);
      })
      .on('presence', { event: 'sync' }, () => {})
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (isReloadingRef.current) return;
        if (Date.now() - mountTimeRef.current < 3000) return; // grace period
        if (!gameOverRef.current && leftPresences && leftPresences.length > 0) {
          const opponentLeft = leftPresences.some((p: any) => {
            const pColor = p.color || p.presence_ref;
            return pColor !== playerColor;
          });
          if (opponentLeft) {
            gameOverRef.current = true;
            setGameOverWithReason('abandoned', playerColor);
            handleGameEnd('win');
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setChannelReady(true);
          await channel.track({ color: playerColor, online: true });
        }
      });
    return () => {
      setChannelReady(false);
      if (isReloadingRef.current) {
        // Это reload/rematch — НЕ отправляем RESIGN
        channel.unsubscribe();
      } else if (!gameOverRef.current) {
        gameOverRef.current = true;
        channel.send({ type: 'broadcast', event: 'RESIGN', payload: {} });
        handleGameEnd('loss');
        setTimeout(() => channel.unsubscribe(), 500);
      } else {
        channel.unsubscribe();
      }
    };
  }, [mode, sessionId]);

  const updateCaptured = useCallback(() => {
    const history = chess.history({ verbose: true });
    const captured = getCapturedPieces(history as Array<{ captured?: string; color: string }>);
    setCapturedPieces(captured);
  }, [chess]);

  const handleGameEnd = useCallback(async (result: 'win' | 'loss' | 'draw') => {
    const config = DIFFICULTY_CONFIG[difficulty];
    // Для friend/online используем 1500 как опорную точку (или playerElo если он выше)
    // calculateEloChange сам обеспечивает минимум ±1
    let opponentElo = playerElo;
    if (mode === 'ai') opponentElo = config.eloTarget;
    else if (mode === 'friend' || mode === 'online') opponentElo = Math.max(1500, playerElo);
    const change = mode === 'local' ? 0 : calculateEloChange(playerElo, opponentElo, result, gamesPlayed);
    const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
    if (user) {
      if (mode !== 'local') {
        console.log('[ELO Update]', { mode, playerElo, change, newElo: playerElo + change, result });
        await updateElo(user.id, playerElo + change, result, mode);
      }
      // Берём ходы из лога (chess.history не работает с chess.load в online/friend)
      const movesJson = movesLogRef.current.length > 0
        ? [...movesLogRef.current]
        : chess.history({ verbose: true }).map((m) => ({
            from: m.from, to: m.to, san: m.san,
            ...(m.promotion ? { promotion: m.promotion } : {}),
          }));
      const opponentName = mode === 'ai'
        ? `Hod Konem AI (${config.label})`
        : mode === 'local'
        ? t('opponent_name_local')
        : mode === 'friend'
        ? t('opponent_name_friend')
        : t('opponent_name_opponent');

      // Сохраняем партию (даже если 0 ходов — для отладки)
      const { data: savedGame, error } = await supabase.from('game_history').insert({
        user_id: user.id,
        result,
        elo_before: playerElo,
        elo_after: playerElo + change,
        elo_change: change,
        moves_json: movesJson,
        final_fen: chess.fen(),
        mode: mode || 'ai',
        difficulty: difficulty || 'medium',
        player_color: playerColor || 'white',
        opponent_name: opponentName,
      }).select('id').single();
      if (error) {
        console.error('Failed to save game history:', error);
      } else {
        console.log('Game saved! Moves:', movesJson.length);
      }

      // Начисляем коины
      let earnedCoins = 0;
      try {
        const coinMode = mode === 'ai' ? difficulty : mode;
        const { data: settings } = await supabase.from('coin_settings').select('win_coins, loss_coins, draw_coins').eq('mode', coinMode).single();
        if (settings) {
          earnedCoins = result === 'win' ? settings.win_coins : result === 'loss' ? settings.loss_coins : settings.draw_coins;
          const { data: profile } = await supabase.from('profiles').select('coins').eq('id', user.id).single();
          const newCoins = Math.max(0, (profile?.coins || 0) + earnedCoins);
          await supabase.from('profiles').update({ coins: newCoins }).eq('id', user.id);
          // Записываем транзакцию для аналитики
          if (earnedCoins !== 0) {
            await supabase.from('coin_transactions').insert({ user_id: user.id, amount: earnedCoins, source: 'game', description: `${result} в ${mode}` });
          }
        }
      } catch { /* coins not critical */ }

      // Закрываем live_game
      if (liveGameIdRef.current) {
        const gameId = liveGameIdRef.current;
        liveGameIdRef.current = null;
        const { error: liveErr } = await supabase.from('live_games').update({
          status: 'finished', result, finished_at: new Date().toISOString(),
          fen: chess.fen(), moves_json: [...movesLogRef.current],
        }).eq('id', gameId);
        if (liveErr) console.error('Failed to close live_game:', liveErr);
      }

      // Автозапись результата турнира
      if (tournamentMatchId && tournamentId) {
        try {
          // Определяем результат для турнира
          const tournamentResult = result === 'win'
            ? (playerColor === 'white' ? 'white' : 'black')
            : result === 'loss'
            ? (playerColor === 'white' ? 'black' : 'white')
            : 'draw';
          const winnerId = tournamentResult === 'draw' ? null : user.id;

          // Записываем результат матча
          await supabase.from('tournament_matches').update({
            result: tournamentResult,
            winner_id: winnerId,
            status: 'finished',
            end_time: new Date().toISOString(),
          }).eq('id', tournamentMatchId);

          // Обновляем статистику участника
          const field = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';
          const { data: myPart } = await supabase.from('tournament_participants')
            .select('id, wins, losses, draws, points')
            .eq('tournament_id', tournamentId)
            .eq('user_id', user.id)
            .single();
          if (myPart) {
            const newVal = (myPart[field] || 0) + 1;
            const newPoints = (myPart.points || 0) + (result === 'win' ? 1 : result === 'draw' ? 0.5 : 0);
            await supabase.from('tournament_participants').update({
              [field]: newVal, points: newPoints,
            }).eq('id', myPart.id);
          }

          // Проверяем все ли матчи раунда завершены → авто-переход
          const { data: tournament } = await supabase.from('tournaments').select('current_round').eq('id', tournamentId).single();
          if (tournament) {
            const { data: roundMatches } = await supabase.from('tournament_matches')
              .select('status')
              .eq('tournament_id', tournamentId)
              .eq('round_number', tournament.current_round);
            const allDone = roundMatches && roundMatches.every(m => m.status === 'finished');
            if (allDone) {
              // Авто-переход к следующему раунду
              const { advanceToNextRound } = await import('@/lib/tournaments');
              await advanceToNextRound(tournamentId);
              console.log('Tournament: auto-advanced to next round!');
            }
          }
        } catch (e) { console.error('Tournament result error:', e); }
      }

      onGameOver?.(result, change, earnedCoins, savedGame?.id, gameReasonRef.current);
    } else {
      console.warn('No user logged in — game not saved');
      // Закрываем live_game
      if (liveGameIdRef.current) {
        const gameId = liveGameIdRef.current;
        liveGameIdRef.current = null;
        await supabase.from('live_games').update({
          status: 'finished', result: 'draw', finished_at: new Date().toISOString(),
        }).eq('id', gameId);
      }
      onGameOver?.(result, change);
    }
  }, [difficulty, mode, playerElo, gamesPlayed, onGameOver, chess, playerColor]);

  const checkGameOverState = useCallback(() => {
    if (gameOverRef.current) return;
    const status = getGameStatus(chess.fen());
    if (status.status !== 'playing') {
      gameOverRef.current = true;
      setGameOverWithReason(status.status, status.winner);
      // Сохраняем результат для ВСЕХ режимов
      const result: 'win' | 'loss' | 'draw' =
        status.status === 'checkmate'
          ? status.winner === playerColor ? 'win' : 'loss'
          : 'draw';
      handleGameEnd(result);
    }
  }, [chess, playerColor, handleGameEnd]);

  const runAI = useCallback(async (currentFen: string) => {
    if (isThinkingRef.current || gameOverRef.current) return;
    isThinkingRef.current = true;
    setIsThinking(true);
    try {
      const aiMoveStr = await getAIMove(currentFen, difficulty);
      const parsed = parseStockfishMove(aiMoveStr);
      const aiMove = chess.move({
        from: parsed.from as Square,
        to: parsed.to as Square,
        promotion: (parsed.promotion || 'q') as 'q' | 'r' | 'b' | 'n',
      });
      if (aiMove) {
        const aiFen = chess.fen();
        setFen(aiFen);
        setLastMove({ from: parsed.from as Square, to: parsed.to as Square });
        setMoveHistory((prev) => [...prev, aiMove.san]);
        updateCaptured();

        // Записываем ход AI в лог для анализа
        movesLogRef.current.push({
          from: parsed.from, to: parsed.to, san: aiMove.san,
          ...(parsed.promotion ? { promotion: parsed.promotion } : {}),
        });

        checkGameOverState();
      }
    } catch (err) {
      console.error('AI error:', err);
    } finally {
      isThinkingRef.current = false;
      setIsThinking(false);
      // Выполняем premove после хода AI
      if (premoveRef.current && !gameOverRef.current) {
        const pm = premoveRef.current;
        premoveRef.current = null;
        setPremoveSquares(null);
        setTimeout(() => { executeMove(pm.from, pm.to); }, 100);
      }
    }
  }, [chess, difficulty, updateCaptured, checkGameOverState]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const executeMove = useCallback(async (from: Square, to: Square, promotion?: string) => {
    if (gameOverRef.current) return false;

    const move = chess.move({
      from,
      to,
      promotion: (promotion || 'q') as 'q' | 'r' | 'b' | 'n',
    });

    if (!move) {
      triggerShake();
      return false;
    }

    const newFen = chess.fen();
    setFen(newFen);
    setLastMove({ from, to });
    setSelectedSquare(null);
    setLegalMoves([]);
    setCaptureSquares([]);
    setMoveHistory((prev) => [...prev, move.san]);
    updateCaptured();

    // Звук хода
    playChessSound(move);

    // Определяем дебют (первые 6 ходов)
    const history = chess.history();
    if (history.length <= 12) {
      const name = getOpeningName(history);
      if (name) setOpeningName(name);
    }

    // Записываем ход в лог для анализа
    movesLogRef.current.push({
      from, to, san: move.san,
      ...(promotion ? { promotion } : {}),
    });

    // Обновляем live_game для стриминга
    if (liveGameIdRef.current) {
      supabase.from('live_games').update({
        fen: newFen,
        moves_json: [...movesLogRef.current],
      }).eq('id', liveGameIdRef.current).then(() => {});
    }

    setTimeout(() => {
      if (moveHistoryRef.current) {
        moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
      }
    }, 50);

    if ((mode === 'online' || mode === 'friend') && channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'MOVE',
        payload: { move: { from, to, promotion, san: move.san }, fen: newFen },
      });
    }

    checkGameOverState();

    if (mode === 'ai' && !chess.isGameOver()) {
      await runAI(newFen);
    }

    return true;
  }, [chess, mode, updateCaptured, checkGameOverState, runAI]);

  // Объяснение почему ход невозможный
  const getIllegalMoveReason = useCallback((from: Square, to: Square): string => {
    const piece = chess.get(from);
    if (!piece) return t('illegal_no_piece');
    if (piece.color !== chess.turn()) return t('illegal_not_your_turn');
    const target = chess.get(to);
    if (target && target.color === piece.color) return t('illegal_own_piece');
    if (chess.isCheck()) return t('illegal_king_check');
    // Проверяем может ли фигура вообще туда пойти
    const moves = chess.moves({ square: from, verbose: true });
    if (moves.length === 0) return t('illegal_cant_move');
    const pieceNames: Record<string, string> = { p: t('piece_pawn'), n: t('piece_knight'), b: t('piece_bishop'), r: t('piece_rook'), q: t('piece_queen'), k: t('piece_king') };
    return `${pieceNames[piece.type] || 'Фигура'} не может так ходить`;
  }, [chess]);

  // ✅ DRAG AND DROP — AI отвечает после перетаскивания
  const onPieceDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    if (!isMyTurn()) {
      if (mode === 'online' || mode === 'friend' || (mode === 'ai' && isThinkingRef.current)) {
        premoveRef.current = { from: sourceSquare, to: targetSquare };
        setPremoveSquares({ from: sourceSquare, to: targetSquare });
      }
      // Принудительно возвращаем фигуру на место (react-chessboard не всегда откатывает сам)
      setFen(chess.fen());
      return false;
    }

    if (isPromotion(chess.fen(), sourceSquare, targetSquare)) {
      setPromotionSquare({ from: sourceSquare, to: targetSquare });
      setFen(chess.fen());
      return false;
    }

    let testMove = null;
    try {
      const testChess = new Chess(chess.fen());
      testMove = testChess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    } catch { /* invalid move */ }
    if (!testMove) {
      triggerShake();
      const reason = getIllegalMoveReason(sourceSquare, targetSquare);
      setIllegalMsg(reason);
      setTimeout(() => setIllegalMsg(''), 3000);
      const newCount = illegalCount + 1;
      setIllegalCount(newCount);
      if (newCount >= 3 && !gameOver) {
        gameOverRef.current = true;
        setGameOverWithReason('illegal', chess.turn() === 'w' ? 'black' : 'white');
        setIllegalMsg('⛔ ' + t('illegal_moves_loss'));
        // Сообщаем сопернику
        if ((mode === 'online' || mode === 'friend') && channelRef.current) {
          channelRef.current.send({ type: 'broadcast', event: 'RESIGN', payload: {} });
        }
        handleGameEnd('loss');
      }
      // Принудительно возвращаем фигуру на место
      setFen(chess.fen());
      return false;
    }

    executeMove(sourceSquare, targetSquare);
    return true;
  }, [chess, isMyTurn, executeMove, getIllegalMoveReason, illegalCount, gameOver, onGameOver]);

  // ✅ CLICK handler
  const handleSquareClick = useCallback(async (square: Square) => {
    // На ходу соперника (online/friend) разрешаем клик чтобы отменить premove
    if (!isMyTurn() || isThinkingRef.current) {
      if ((mode === 'online' || mode === 'friend') && premoveRef.current) {
        premoveRef.current = null;
        setPremoveSquares(null);
      }
      return;
    }

    const piece = chess.get(square);

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        if (isPromotion(chess.fen(), selectedSquare, square)) {
          setPromotionSquare({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalMoves([]);
          setCaptureSquares([]);
          return;
        }
        await executeMove(selectedSquare, square);
      } else if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        setLegalMoves(getLegalMovesForSquare(chess.fen(), square));
        setCaptureSquares(getCaptureSquares(chess.fen(), square));
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
        setCaptureSquares([]);
      }
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setLegalMoves(getLegalMovesForSquare(chess.fen(), square));
      setCaptureSquares(getCaptureSquares(chess.fen(), square));
    }
  }, [chess, selectedSquare, legalMoves, isMyTurn, executeMove, mode]);

  const handlePromotion = (piece: string) => {
    if (!promotionSquare) return;
    executeMove(promotionSquare.from, promotionSquare.to, piece);
    setPromotionSquare(null);
  };

  const handleResign = async () => {
    if (gameOverRef.current) return;
    if (!confirm(t('resign_confirm'))) return;
    if ((mode === 'online' || mode === 'friend') && channelRef.current) {
      await channelRef.current.send({ type: 'broadcast', event: 'RESIGN', payload: {} });
    }
    gameOverRef.current = true;
    setGameOverWithReason('resigned');
    await handleGameEnd('loss');
  };

  const [newGameOffered, setNewGameOffered] = useState(false);
  const [newGameDeclined, setNewGameDeclined] = useState(false);

  const handleNewGame = async () => {
    if (mode === 'friend' || mode === 'online') {
      if (newGameOffered) return;
      // Отправляем предложение новой игры
      if (channelRef.current) {
        setNewGameOffered(true);
        setNewGameDeclined(false);
        await channelRef.current.send({ type: 'broadcast', event: 'NEW_GAME_OFFER', payload: {} });
        setTimeout(() => setNewGameOffered(false), 10000);
      }
      return;
    }
    chess.reset();
    gameOverRef.current = false;
    isThinkingRef.current = false;
    movesLogRef.current = [];

    // Закрываем старую live_game и создаём новую
    if (liveGameIdRef.current) {
      supabase.from('live_games').update({ status: 'finished', finished_at: new Date().toISOString() }).eq('id', liveGameIdRef.current);
      liveGameIdRef.current = null;
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await getProfile(session.user.id);
        const opponentName = mode === 'ai' ? `AI (${difficulty})` : t('black');
        const { data: game } = await supabase.from('live_games').insert({
          white_id: session.user.id, white_name: profile?.username || 'Игрок',
          black_name: opponentName, mode, status: 'active',
        }).select().single();
        if (game) liveGameIdRef.current = game.id;
      }
    });
    setFen(INITIAL_FEN);
    setSelectedSquare(null);
    setLegalMoves([]);
    setCaptureSquares([]);
    setLastMove(null);
    setMoveHistory([]);
    setCapturedPieces({ white: [], black: [] });
    setGameOver(null);
    setIsThinking(false);
  };

  // Square styles
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(99,179,237,0.5)' };
  }
  legalMoves.forEach((sq) => {
    if (!hintsEnabled) return;
    if (!captureSquares.includes(sq)) {
      customSquareStyles[sq] = { background: 'radial-gradient(circle, rgba(99,179,237,0.6) 28%, transparent 32%)' };
    }
  });
  captureSquares.forEach((sq) => {
    if (!hintsEnabled) return;
    customSquareStyles[sq] = { background: 'radial-gradient(circle, rgba(239,68,68,0.6) 42%, transparent 46%)' };
  });
  if (lastMove) {
    customSquareStyles[lastMove.from] = { ...customSquareStyles[lastMove.from], backgroundColor: 'rgba(245,158,11,0.3)' };
    customSquareStyles[lastMove.to] = { ...customSquareStyles[lastMove.to], backgroundColor: 'rgba(245,158,11,0.45)' };
  }
  // Premove подсветка (синяя)
  if (premoveSquares) {
    customSquareStyles[premoveSquares.from] = { ...customSquareStyles[premoveSquares.from], backgroundColor: 'rgba(59,130,246,0.4)' };
    customSquareStyles[premoveSquares.to] = { ...customSquareStyles[premoveSquares.to], backgroundColor: 'rgba(59,130,246,0.5)' };
  }

  const { theme: boardTheme, themeId: boardThemeId, setTheme: setBoardTheme } = useBoardTheme();
  const { t } = useTranslation();
  const boardColors = isKidsMode
    ? { light: '#fce7f3', dark: '#a78bfa' }
    : { light: boardTheme.light, dark: boardTheme.dark };

  const handleTimeOut = useCallback((color: 'white' | 'black') => {
    if (gameOverRef.current) return;
    // В онлайн/friend: timeout определяет ТОЛЬКО тот игрок, чей клок обнулился
    // Чужой timeout приходит через broadcast TIMEOUT
    if ((mode === 'online' || mode === 'friend') && color !== playerColor) return;
    gameOverRef.current = true;
    const result: 'win' | 'loss' | 'draw' = color === playerColor ? 'loss' : 'win';
    setGameOverWithReason('timeout', color === 'white' ? 'black' : 'white');
    // Сообщаем сопернику
    if ((mode === 'online' || mode === 'friend') && channelRef.current && color === playerColor) {
      channelRef.current.send({ type: 'broadcast', event: 'TIMEOUT', payload: {} });
    }
    handleGameEnd(result);
  }, [playerColor, handleGameEnd, mode]);

  // Часы запускаются только после первого хода для всех режимов
  // Это решает рассинхрон таймера между игроками (оба начинают с одного момента)
  const clockRunning = !gameOver && moveHistory.length > 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto">
      <div className="flex-shrink-0">
        {/* Opening name */}
        {openingName && (
          <motion.div className="mb-2 px-3 py-1.5 rounded-lg text-xs text-white/50 text-center" style={{ background: 'rgba(255,255,255,0.05)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {'📖'} {openingName}
          </motion.div>
        )}

        {/* Chess Clock */}
        {timeControl && timeControl.minutes > 0 && (
          <div className="mb-3">
            <ChessClock
              whiteTime={timeControl.minutes * 60}
              blackTime={timeControl.minutes * 60}
              isWhiteTurn={chess.turn() === 'w'}
              isRunning={clockRunning}
              increment={timeControl.increment}
              onTimeOut={handleTimeOut}
            />
          </div>
        )}

        {/* Board + EvalBar */}
        <div className="flex gap-1">
          <EvalBar evaluation={evaluation} mate={mateIn} height={boardWidth} orientation={playerColor} />
          <motion.div className={`relative ${shaking ? 'shake' : ''}`}>
          <AnimatePresence>
            {isThinking && (
              <motion.div
                className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center gap-2 py-2 rounded-t-lg text-sm font-medium"
                style={{ background: 'rgba(124,58,237,0.92)', color: 'white' }}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              >
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>♞</motion.span>
                {t('ai_thinking')}
              </motion.div>
            )}
          </AnimatePresence>

          <Chessboard
            position={fen}
            onSquareClick={handleSquareClick}
            onPieceDrop={onPieceDrop}
            customSquareStyles={customSquareStyles}
            boardWidth={boardWidth}
            customLightSquareStyle={{ backgroundColor: boardColors.light, ...boardTheme.lightStyle }}
            customDarkSquareStyle={{ backgroundColor: boardColors.dark, ...boardTheme.darkStyle }}
            boardOrientation={playerColor}
            animationDuration={180}
            areArrowsAllowed={false}
            customArrows={adminHint ? [[adminHint.from, adminHint.to, 'rgba(168,85,247,0.85)']] : []}
            isDraggablePiece={({ piece }) => {
              // Локальная игра — таскаем все фигуры
              if (mode === 'local') return true;
              // AI — только белые
              if (mode === 'ai') return piece[0] === 'w';
              // Online/friend — всегда свой цвет (для premove на ходу соперника)
              return piece[0] === (playerColor === 'white' ? 'w' : 'b');
            }}
          />
        </motion.div>
        </div>{/* close flex gap-1 (EvalBar + Board) */}

        {/* Сообщение о невозможном ходе */}
        <AnimatePresence>
          {illegalMsg && (
            <motion.div className="mt-2 px-4 py-2 rounded-xl text-center text-sm font-medium"
              style={{ background: illegalMsg.includes('проиграна') ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.15)', color: illegalMsg.includes('проиграна') ? '#f87171' : '#fbbf24' }}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {illegalMsg} {illegalCount > 0 && illegalCount < 3 && <span className="text-white/30 ml-2">({illegalCount}/3)</span>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Запрос отмены хода от соперника */}
        <AnimatePresence>
          {undoFromOpponent && (
            <motion.div className="mt-2 px-4 py-3 rounded-xl text-center"
              style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-sm text-blue-400 font-medium mb-2">{t('opponent_undo_request')}</div>
              <div className="flex gap-2 justify-center">
                <button onClick={async () => {
                  setUndoFromOpponent(false);
                  const undone = chess.undo();
                  if (undone) { movesLogRef.current.pop(); setMoveHistory(prev => prev.slice(0, -1)); }
                  setFen(chess.fen()); setSelectedSquare(null); setLegalMoves([]); setCaptureSquares([]); setLastMove(null); updateCaptured();
                  if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'UNDO_APPROVED', payload: {} });
                }} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30">✓ Разрешить</button>
                <button onClick={async () => {
                  setUndoFromOpponent(false);
                  if (channelRef.current) channelRef.current.send({ type: 'broadcast', event: 'UNDO_DECLINED', payload: {} });
                }} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30">✕ Отклонить</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Предложение ничьей от соперника */}
        <AnimatePresence>
          {drawFromOpponent && (
            <motion.div className="mt-2 px-4 py-3 rounded-xl text-center"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-sm text-yellow-400 font-medium mb-2">🤝 {t('opponent_draw_offer')}</div>
              <div className="flex gap-2 justify-center">
                <button onClick={async () => {
                  setDrawFromOpponent(false);
                  gameOverRef.current = true;
                  setGameOverWithReason('draw', undefined);
                  if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'DRAW_ACCEPT', payload: {} });
                  await handleGameEnd('draw');
                }} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30">✓ {t('accept')}</button>
                <button onClick={async () => {
                  setDrawFromOpponent(false);
                  if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'DRAW_DECLINE', payload: {} });
                }} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30">✕ {t('decline')}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Предложение новой игры от соперника */}
        <AnimatePresence>
          {newGameFromOpponent && (
            <motion.div className="mt-2 px-4 py-3 rounded-xl text-center"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <div className="text-sm text-green-400 font-medium mb-2">🔄 {t('opponent_new_game')}</div>
              <div className="flex gap-2 justify-center">
                <button onClick={async () => {
                  setNewGameFromOpponent(false);
                  if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'NEW_GAME_ACCEPT', payload: {} });
                  // Сбрасываем состояние на месте
                  chess.reset();
                  setFen(INITIAL_FEN);
                  setMoveHistory([]);
                  setCapturedPieces({ white: [], black: [] });
                  setLastMove(null);
                  setSelectedSquare(null);
                  setLegalMoves([]);
                  setCaptureSquares([]);
                  setIllegalCount(0);
                  setIllegalMsg('');
                  gameOverRef.current = false;
                  setGameOver(null); gameReasonRef.current = '';
                  setNewGameOffered(false);
                  setDrawOffered(false);
                  setDrawFromOpponent(false);
                  movesLogRef.current = [];
                  setOpeningName('');
                  setAdminHint(null);
                  premoveRef.current = null;
                  setPremoveSquares(null);
                }} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-green-500/20 text-green-400 hover:bg-green-500/30">✓ {t('accept')}</button>
                <button onClick={async () => {
                  setNewGameFromOpponent(false);
                  if (channelRef.current) await channelRef.current.send({ type: 'broadcast', event: 'NEW_GAME_DECLINE', payload: {} });
                }} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30">✕ {t('decline')}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mt-4">
          <motion.button onClick={handleResign} disabled={!!gameOver}
            className="flex-1 py-2 px-3 rounded-xl text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            {'🏳️'} {t('resign')}
          </motion.button>
          {mode === 'ai' && (
          <motion.button onClick={() => {
              if (gameOverRef.current || moveHistory.length === 0) return;
              const undoCount = 2;
              for (let i = 0; i < undoCount; i++) {
                const undone = chess.undo();
                if (undone) {
                  movesLogRef.current.pop();
                  setMoveHistory(prev => prev.slice(0, -1));
                }
              }
              setFen(chess.fen());
              setSelectedSquare(null);
              setLegalMoves([]);
              setCaptureSquares([]);
              setLastMove(null);
              updateCaptured();
              if (liveGameIdRef.current) {
                supabase.from('live_games').update({ fen: chess.fen(), moves_json: [...movesLogRef.current] }).eq('id', liveGameIdRef.current);
              }
            }} disabled={!!gameOver || moveHistory.length === 0}
            className="flex-1 py-2 px-3 rounded-xl text-sm font-medium border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 disabled:opacity-40 transition-all"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            {'↩️'} {t('undo')}
          </motion.button>
          )}
          <motion.button onClick={async () => {
              if (mode === 'ai' || mode === 'local') {
                gameOverRef.current = true; setGameOverWithReason('draw'); await handleGameEnd('draw');
              } else {
                setDrawOffered(true);
                if (channelRef.current) { await channelRef.current.send({ type: 'broadcast', event: 'DRAW_OFFER', payload: {} }); }
                setTimeout(() => setDrawOffered(false), 5000);
              }
            }} disabled={!!gameOver || drawOffered}
            className="flex-1 py-2 px-3 rounded-xl text-sm font-medium border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40 transition-all"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            {drawOffered ? t('draw_offered') : '🤝 ' + t('draw_offer')}
          </motion.button>
          <motion.button onClick={handleNewGame} disabled={newGameOffered}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${newGameOffered ? 'border border-yellow-500/30 text-yellow-400 opacity-60' : 'border border-green-500/30 text-green-400 hover:bg-green-500/10'}`}
            whileHover={!newGameOffered ? { scale: 1.02 } : {}} whileTap={!newGameOffered ? { scale: 0.97 } : {}}>
            {newGameOffered ? '⏳ ' + t('new_game_waiting') : '🔄 ' + t('new_game')}
          </motion.button>
        </div>

        {/* Уведомление — друг отклонил новую игру */}
        <AnimatePresence>
          {newGameDeclined && (
            <motion.div className="mt-2 px-4 py-2 rounded-xl text-center text-sm"
              style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171' }}
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {t('opponent_declined_new')}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Подсказки + Тема доски */}
        <div className="flex justify-center gap-2 mt-2 flex-wrap">
          <button onClick={() => setHintsEnabled(!hintsEnabled)}
            className={`px-4 py-1.5 rounded-xl text-xs font-medium transition-all ${hintsEnabled ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-white/5 text-white/30 border border-white/10'}`}>
            {hintsEnabled ? '💡 ' + t('hints_on') : '💡 ' + t('hints_off')}
          </button>
          <BoardThemeSelector currentThemeId={boardThemeId} onSelect={setBoardTheme} />
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="glass p-4 rounded-xl flex items-center justify-between"
          style={isKidsMode ? { background: 'rgba(255,255,255,0.85)', border: '2px solid #a78bfa' } : {}}>
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full border-2 border-white/20 ${chess.turn() === 'w' ? 'bg-white shadow-md' : 'bg-gray-900'}`} />
            <span className="text-sm font-medium" style={isKidsMode ? { color: '#4c1d95' } : {}}>
              Ход: {chess.turn() === 'w' ? t('white') : t('black')}
            </span>
          </div>
          {chess.isCheck() && !chess.isCheckmate() && (
            <motion.span className="text-red-400 text-sm font-bold px-2 py-0.5 rounded-lg bg-red-500/15"
              animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
              ⚠️ Шах!
            </motion.span>
          )}
        </div>

        <div className="glass p-4 rounded-xl" style={isKidsMode ? { background: 'rgba(255,255,255,0.85)' } : {}}>
          <div className="text-xs text-white/50 mb-2 uppercase tracking-wider" style={isKidsMode ? { color: '#6d28d9' } : {}}>
            Взятые фигуры
          </div>
          <div className="flex items-start gap-1 mb-1">
            <span className="text-xs text-white/40 w-16 mt-0.5" style={isKidsMode ? { color: '#7c3aed' } : {}}>{t('analysis_white')}:</span>
            <span className="text-base leading-tight flex-1">{capturedPieces.white.join('') || '–'}</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="text-xs text-white/40 w-16 mt-0.5" style={isKidsMode ? { color: '#7c3aed' } : {}}>{t('analysis_black')}:</span>
            <span className="text-base leading-tight flex-1">{capturedPieces.black.join('') || '–'}</span>
          </div>
        </div>

        <div className="glass p-4 rounded-xl flex-1 flex flex-col" style={isKidsMode ? { background: 'rgba(255,255,255,0.85)' } : {}}>
          <div className="text-xs text-white/50 mb-3 uppercase tracking-wider flex items-center justify-between"
            style={isKidsMode ? { color: '#6d28d9' } : {}}>
            <span>{t('analysis_moves')}</span>
            <span className="text-white/30">{Math.ceil(moveHistory.length / 2)} ход{moveHistory.length >= 2 ? 'а' : ''}</span>
          </div>
          <div ref={moveHistoryRef} className="overflow-y-auto" style={{ maxHeight: '220px' }}>
            {moveHistory.length === 0 ? (
              <p className="text-white/30 text-sm italic">{t('no_moves_yet')}</p>
            ) : (
              <div className="space-y-0.5">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                  <div key={i} className="flex gap-2 text-sm font-mono py-0.5 rounded px-1 hover:bg-white/5">
                    <span className="text-white/25 w-7 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="text-white/85 w-14 flex-shrink-0">{moveHistory[i * 2]}</span>
                    {moveHistory[i * 2 + 1] && (
                      <span className="text-white/65">{moveHistory[i * 2 + 1]}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass p-3 rounded-xl text-center text-xs text-white/40"
          style={isKidsMode ? { background: 'rgba(255,255,255,0.7)', color: '#6d28d9' } : {}}>
          {mode === 'ai' && `🤖 Hod Konem AI · ${DIFFICULTY_CONFIG[difficulty].label} · ELO ${DIFFICULTY_CONFIG[difficulty].eloTarget}`}
          {mode === 'local' && '👥 Игра вдвоём на одном экране'}
          {mode === 'online' && '🌐 Онлайн матч · Рейтинговая партия'}
          {mode === 'friend' && '👥 Игра с другом'}
        </div>
      </div>

      {/* Promotion modal */}
      <AnimatePresence>
        {promotionSquare && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="glass p-6 rounded-2xl text-center"
              initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }}>
              <h3 className="text-xl font-bold mb-5 playfair text-yellow-400">{t('piece_pawn')}</h3>
              <div className="flex gap-4">
                {[{ p: 'q', s: '♛', n: 'Ферзь' }, { p: 'r', s: '♜', n: 'Ладья' }, { p: 'b', s: '♝', n: 'Слон' }, { p: 'n', s: '♞', n: 'Конь' }].map(({ p, s, n }) => (
                  <motion.button key={p} onClick={() => handlePromotion(p)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 hover:bg-white/10 hover:border-yellow-400/40 transition-all"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <span className="text-5xl">{s}</span>
                    <span className="text-xs text-white/60">{n}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
