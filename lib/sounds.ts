// Звуки ходов как на chess.com — генерируются через Web Audio API
const audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  if (!audioCtx) return;
  try {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch { /* ignore */ }
}

export function playMoveSound() {
  playTone(600, 0.08, 0.1);
}

export function playCaptureSound() {
  playTone(400, 0.12, 0.15);
  setTimeout(() => playTone(300, 0.08, 0.1), 30);
}

export function playCheckSound() {
  playTone(800, 0.1, 0.12);
  setTimeout(() => playTone(1000, 0.15, 0.1), 60);
}

export function playCastleSound() {
  playTone(500, 0.06, 0.08);
  setTimeout(() => playTone(600, 0.06, 0.08), 80);
  setTimeout(() => playTone(500, 0.06, 0.08), 160);
}

export function playPromoteSound() {
  playTone(700, 0.08, 0.1);
  setTimeout(() => playTone(900, 0.1, 0.1), 80);
  setTimeout(() => playTone(1100, 0.15, 0.12), 160);
}

export function playGameEndSound() {
  playTone(500, 0.15, 0.1);
  setTimeout(() => playTone(400, 0.15, 0.08), 150);
  setTimeout(() => playTone(300, 0.3, 0.06), 300);
}

export function playGameStartSound() {
  playTone(500, 0.08, 0.08);
  setTimeout(() => playTone(700, 0.12, 0.1), 100);
}

export function playChessSound(move: { san?: string; captured?: string; flags?: string } | null) {
  if (!move) { playMoveSound(); return; }
  const san = move.san || '';
  if (san.includes('#')) { playGameEndSound(); return; }
  if (san.includes('+')) { playCheckSound(); return; }
  if (san === 'O-O' || san === 'O-O-O') { playCastleSound(); return; }
  if (san.includes('=')) { playPromoteSound(); return; }
  if (move.captured || san.includes('x')) { playCaptureSound(); return; }
  playMoveSound();
}
