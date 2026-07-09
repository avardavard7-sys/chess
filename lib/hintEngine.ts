const SF18_PATH = '/stockfish/sf18.js';
const SF18_WASM = '/stockfish/sf18.wasm';
const LEGACY_PATH = '/stockfish/stockfish.js';

const BOOT_TIMEOUT = 20000;
const SEARCH_TIMEOUT = 30000;

export interface HintResult {
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  depth: number;
  scoreCp: number | null;
  mateIn: number | null;
  engine: 'sf18' | 'legacy';
  pv: string[];
}

let enginePromise: Promise<{ worker: Worker; kind: 'sf18' | 'legacy' }> | null = null;

function bootWorker(path: string, isSf18: boolean): Promise<Worker> {
  return new Promise((resolve, reject) => {
    let w: Worker;
    try {
      const url = isSf18 ? `${path}#${SF18_WASM}` : path;
      w = new Worker(url);
    } catch (e) {
      reject(e);
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { w.terminate(); } catch {}
      reject(new Error('engine boot timeout'));
    }, BOOT_TIMEOUT);

    const onMsg = (ev: MessageEvent) => {
      const line = typeof ev.data === 'string' ? ev.data : '';
      if (line.includes('uciok') || line.includes('readyok')) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        w.removeEventListener('message', onMsg);
        resolve(w);
      }
    };

    w.addEventListener('message', onMsg);
    w.addEventListener('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { w.terminate(); } catch {}
      reject(new Error('engine error'));
    });

    w.postMessage('uci');
    w.postMessage('isready');
  });
}

async function getEngine(): Promise<{ worker: Worker; kind: 'sf18' | 'legacy' }> {
  if (enginePromise) return enginePromise;

  enginePromise = (async () => {
    try {
      const w = await bootWorker(SF18_PATH, true);
      return { worker: w, kind: 'sf18' as const };
    } catch {
      const w = await bootWorker(LEGACY_PATH, false);
      return { worker: w, kind: 'legacy' as const };
    }
  })();

  try {
    return await enginePromise;
  } catch (e) {
    enginePromise = null;
    throw e;
  }
}

export function preloadHintEngine(): void {
  getEngine().catch(() => {});
}

export function isHintEngineReady(): boolean {
  return enginePromise !== null;
}

export async function getMaxStrengthHint(fen: string): Promise<HintResult | null> {
  let engine;
  try {
    engine = await getEngine();
  } catch {
    return null;
  }

  const { worker, kind } = engine;
  const maxDepth = kind === 'sf18' ? 24 : 20;
  const moveTime = kind === 'sf18' ? 6000 : 4000;

  return new Promise((resolve) => {
    let bestDepth = 0;
    let scoreCp: number | null = null;
    let mateIn: number | null = null;
    let pv: string[] = [];
    let settled = false;

    const cleanup = () => {
      worker.removeEventListener('message', onMsg);
      clearTimeout(timer);
    };

    const finish = (uci: string | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!uci || uci === '(none)' || uci.length < 4) {
        resolve(null);
        return;
      }
      resolve({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
        uci,
        depth: bestDepth,
        scoreCp,
        mateIn,
        engine: kind,
        pv,
      });
    };

    const timer = setTimeout(() => {
      try { worker.postMessage('stop'); } catch {}
      setTimeout(() => finish(null), 800);
    }, SEARCH_TIMEOUT);

    const onMsg = (ev: MessageEvent) => {
      const line = typeof ev.data === 'string' ? ev.data : '';
      if (!line) return;

      if (line.startsWith('info') && line.includes(' pv ')) {
        const dMatch = line.match(/ depth (\d+)/);
        if (dMatch) bestDepth = Math.max(bestDepth, parseInt(dMatch[1], 10));

        const mateMatch = line.match(/score mate (-?\d+)/);
        if (mateMatch) {
          mateIn = parseInt(mateMatch[1], 10);
          scoreCp = null;
        } else {
          const cpMatch = line.match(/score cp (-?\d+)/);
          if (cpMatch) {
            scoreCp = parseInt(cpMatch[1], 10);
            mateIn = null;
          }
        }

        const pvMatch = line.match(/ pv (.+)$/);
        if (pvMatch) pv = pvMatch[1].trim().split(/\s+/).slice(0, 6);
      }

      if (line.startsWith('bestmove')) {
        const parts = line.split(/\s+/);
        finish(parts[1] || null);
      }
    };

    worker.addEventListener('message', onMsg);

    worker.postMessage('ucinewgame');
    worker.postMessage('setoption name Skill Level value 20');
    worker.postMessage('setoption name MultiPV value 1');
    worker.postMessage(`position fen ${fen}`);
    worker.postMessage(`go depth ${maxDepth} movetime ${moveTime}`);
  });
}

export function formatHintScore(h: HintResult): string {
  if (h.mateIn !== null) {
    return h.mateIn > 0 ? `Мат в ${h.mateIn}` : `Мат через ${Math.abs(h.mateIn)}`;
  }
  if (h.scoreCp === null) return '';
  const pawns = h.scoreCp / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(1)}`;
}

export function terminateHintEngine(): void {
  if (!enginePromise) return;
  enginePromise
    .then(({ worker }) => {
      try { worker.postMessage('quit'); } catch {}
      try { worker.terminate(); } catch {}
    })
    .catch(() => {});
  enginePromise = null;
}
