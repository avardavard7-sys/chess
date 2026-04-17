export interface DifficultyConfig {
  skillLevel: number;
  depth: number;
  moveTime: number;
  eloTarget: number;
  label: string;
}

export const DIFFICULTY_CONFIG: Record<string, DifficultyConfig> = {
  kids: {
    skillLevel: 0,
    depth: 1,
    moveTime: 100,
    eloTarget: 100,
    label: 'Детский',
  },
  beginner: {
    skillLevel: 4,
    depth: 4,
    moveTime: 450,
    eloTarget: 600,
    label: 'Начинающий',
  },
  medium: {
    skillLevel: 10,
    depth: 10,
    moveTime: 1100,
    eloTarget: 1300,
    label: 'Средний',
  },
  hard: {
    skillLevel: 16,
    depth: 16,
    moveTime: 2700,
    eloTarget: 2100,
    label: 'Сложный',
  },
  expert: {
    skillLevel: 20,
    depth: 20,
    moveTime: 3200,
    eloTarget: 2500,
    label: 'Эксперт',
  },
};

let worker: Worker | null = null;
let isReady = false;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker('/stockfish/stockfish.js');
    worker.postMessage('uci');
    worker.addEventListener('message', (e) => {
      if (e.data === 'uciok') isReady = true;
    });
  }
  return worker;
}

export function terminateStockfish() {
  if (worker) {
    worker.terminate();
    worker = null;
    isReady = false;
  }
}

function waitForReady(w: Worker): Promise<void> {
  if (isReady) return Promise.resolve();
  return new Promise((resolve) => {
    const handler = (e: MessageEvent) => {
      if (e.data === 'uciok' || e.data === 'readyok') {
        w.removeEventListener('message', handler);
        isReady = true;
        resolve();
      }
    };
    w.addEventListener('message', handler);
    w.postMessage('isready');
  });
}

function addHumanDelay(config: DifficultyConfig): Promise<void> {
  const baseDelay = config.skillLevel <= 3 ? Math.random() * 800 + 300 : 0;
  return new Promise((resolve) => setTimeout(resolve, baseDelay));
}

export async function getAIMove(fen: string, difficulty: string): Promise<string> {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  const w = getWorker();
  await waitForReady(w);

  await addHumanDelay(config);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Stockfish timeout'));
    }, 30000);

    const handler = (e: MessageEvent) => {
      const msg: string = e.data;
      if (msg.startsWith('bestmove')) {
        clearTimeout(timeout);
        w.removeEventListener('message', handler);
        const parts = msg.split(' ');
        const move = parts[1];
        if (move && move !== '(none)') {
          resolve(move);
        } else {
          reject(new Error('No valid move from Stockfish'));
        }
      }
    };

    w.addEventListener('message', handler);

    w.postMessage('ucinewgame');
    // Только безопасные опции — остальные могут зависать Stockfish в браузере
    w.postMessage(`setoption name Skill Level value ${config.skillLevel}`);
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${config.depth} movetime ${config.moveTime}`);
  });
}

export function parseStockfishMove(moveStr: string): { from: string; to: string; promotion?: string } {
  const from = moveStr.slice(0, 2);
  const to = moveStr.slice(2, 4);
  const promotion = moveStr.length === 5 ? moveStr[4] : undefined;
  return { from, to, ...(promotion && { promotion }) };
}

// Получить лучший ход с оценкой (для тренера)
export interface BestMoveResult {
  bestmove: string; // UCI формат (e2e4)
  eval_cp: number;  // оценка в сантипешках
  mate: number | null; // мат в N ходов
}

export async function getBestMove(fen: string, depth: number = 12): Promise<BestMoveResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker('/stockfish/stockfish.js');
    let evalCp = 0;
    let mate: number | null = null;
    const timeout = setTimeout(() => { w.terminate(); reject(new Error('Timeout')); }, 10000);
    w.onmessage = (e) => {
      const msg = e.data;
      if (typeof msg === 'string') {
        if (msg.startsWith('info') && msg.includes('score')) {
          const cpMatch = msg.match(/score cp (-?\d+)/);
          const mateMatch = msg.match(/score mate (-?\d+)/);
          if (cpMatch) { evalCp = parseInt(cpMatch[1]); mate = null; }
          if (mateMatch) { mate = parseInt(mateMatch[1]); }
        }
        if (msg.startsWith('bestmove')) {
          clearTimeout(timeout);
          const bestmove = msg.split(' ')[1];
          w.terminate();
          resolve({ bestmove, eval_cp: evalCp, mate });
        }
      }
    };
    w.postMessage('uci');
    w.postMessage('isready');
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  });
}
