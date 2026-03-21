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
    skillLevel: 3,
    depth: 3,
    moveTime: 400,
    eloTarget: 450,
    label: 'Начинающий',
  },
  medium: {
    skillLevel: 8,
    depth: 8,
    moveTime: 1000,
    eloTarget: 1150,
    label: 'Средний',
  },
  hard: {
    skillLevel: 15,
    depth: 15,
    moveTime: 2500,
    eloTarget: 2000,
    label: 'Сложный',
  },
  expert: {
    skillLevel: 20,
    depth: 22,
    moveTime: 5000,
    eloTarget: 2600,
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
