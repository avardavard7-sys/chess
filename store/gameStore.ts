import { create } from 'zustand';

export type GameStatus = 'idle' | 'playing' | 'checkmate' | 'draw' | 'stalemate' | 'resigned' | 'threefold' | 'insufficient';
export type GameMode = 'ai' | 'local' | 'online' | 'friend';
export type Difficulty = 'kids' | 'beginner' | 'medium' | 'hard' | 'expert';

export interface MoveRecord {
  from: string;
  to: string;
  san: string;
  fen: string;
  captured?: string;
  color: string;
}

export interface OpponentProfile {
  id: string;
  username: string;
  avatar_url: string;
  elo_rating: number;
}

interface GameStore {
  currentDifficulty: Difficulty;
  currentMode: GameMode;
  currentFen: string;
  moveHistory: MoveRecord[];
  capturedPieces: { white: string[]; black: string[] };
  isPlayerTurn: boolean;
  gameStatus: GameStatus;
  onlineSessionId: string | null;
  opponentProfile: OpponentProfile | null;
  lastMove: { from: string; to: string } | null;
  eloChange: number | null;
  winner: 'white' | 'black' | null;

  setDifficulty: (difficulty: Difficulty) => void;
  setMode: (mode: GameMode) => void;
  makeMove: (move: MoveRecord, newFen: string) => void;
  resetGame: () => void;
  setPlayerTurn: (isPlayerTurn: boolean) => void;
  setGameStatus: (status: GameStatus, winner?: 'white' | 'black') => void;
  setOnlineSession: (sessionId: string | null, opponent: OpponentProfile | null) => void;
  setCapturedPieces: (captured: { white: string[]; black: string[] }) => void;
  setEloChange: (change: number) => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const useGameStore = create<GameStore>((set) => ({
  currentDifficulty: 'medium',
  currentMode: 'ai',
  currentFen: INITIAL_FEN,
  moveHistory: [],
  capturedPieces: { white: [], black: [] },
  isPlayerTurn: true,
  gameStatus: 'idle',
  onlineSessionId: null,
  opponentProfile: null,
  lastMove: null,
  eloChange: null,
  winner: null,

  setDifficulty: (difficulty) => set({ currentDifficulty: difficulty }),
  setMode: (mode) => set({ currentMode: mode }),

  makeMove: (move, newFen) =>
    set((state) => ({
      currentFen: newFen,
      moveHistory: [...state.moveHistory, move],
      lastMove: { from: move.from, to: move.to },
    })),

  resetGame: () =>
    set({
      currentFen: INITIAL_FEN,
      moveHistory: [],
      capturedPieces: { white: [], black: [] },
      isPlayerTurn: true,
      gameStatus: 'playing',
      lastMove: null,
      eloChange: null,
      winner: null,
    }),

  setPlayerTurn: (isPlayerTurn) => set({ isPlayerTurn }),
  setGameStatus: (status, winner) => set({ gameStatus: status, winner: winner || null }),
  setOnlineSession: (sessionId, opponent) =>
    set({ onlineSessionId: sessionId, opponentProfile: opponent }),
  setCapturedPieces: (captured) => set({ capturedPieces: captured }),
  setEloChange: (change) => set({ eloChange: change }),
}));
