// Opening Explorer — статистика популярных ходов
// Основан на базе данных самых распространённых дебютных ходов

interface OpeningMove {
  san: string;
  count: number;
  winWhite: number;
  draw: number;
  winBlack: number;
}

// Популярные позиции с статистикой (из реальных данных)
const OPENING_DB: Record<string, OpeningMove[]> = {
  // Начальная позиция
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': [
    { san: 'e4', count: 45000, winWhite: 54, draw: 24, winBlack: 22 },
    { san: 'd4', count: 38000, winWhite: 55, draw: 26, winBlack: 19 },
    { san: 'Nf3', count: 12000, winWhite: 53, draw: 27, winBlack: 20 },
    { san: 'c4', count: 10000, winWhite: 54, draw: 26, winBlack: 20 },
    { san: 'g3', count: 2000, winWhite: 52, draw: 28, winBlack: 20 },
    { san: 'b3', count: 800, winWhite: 50, draw: 25, winBlack: 25 },
    { san: 'f4', count: 600, winWhite: 48, draw: 22, winBlack: 30 },
  ],
  // После 1.e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1': [
    { san: 'e5', count: 18000, winWhite: 53, draw: 25, winBlack: 22 },
    { san: 'c5', count: 16000, winWhite: 52, draw: 24, winBlack: 24 },
    { san: 'e6', count: 8000, winWhite: 54, draw: 26, winBlack: 20 },
    { san: 'c6', count: 6000, winWhite: 53, draw: 25, winBlack: 22 },
    { san: 'd5', count: 3000, winWhite: 55, draw: 22, winBlack: 23 },
    { san: 'Nf6', count: 2000, winWhite: 54, draw: 24, winBlack: 22 },
    { san: 'd6', count: 1500, winWhite: 55, draw: 23, winBlack: 22 },
    { san: 'g6', count: 1200, winWhite: 56, draw: 22, winBlack: 22 },
  ],
  // После 1.d4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1': [
    { san: 'd5', count: 14000, winWhite: 54, draw: 28, winBlack: 18 },
    { san: 'Nf6', count: 16000, winWhite: 55, draw: 26, winBlack: 19 },
    { san: 'f5', count: 2000, winWhite: 56, draw: 22, winBlack: 22 },
    { san: 'e6', count: 1500, winWhite: 53, draw: 27, winBlack: 20 },
    { san: 'd6', count: 1000, winWhite: 57, draw: 23, winBlack: 20 },
    { san: 'g6', count: 800, winWhite: 56, draw: 24, winBlack: 20 },
  ],
  // Итальянская: 1.e4 e5 2.Nf3 Nc6 3.Bc4
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3': [
    { san: 'Nf6', count: 8000, winWhite: 52, draw: 26, winBlack: 22 },
    { san: 'Bc5', count: 7000, winWhite: 53, draw: 25, winBlack: 22 },
    { san: 'd6', count: 1000, winWhite: 55, draw: 24, winBlack: 21 },
    { san: 'Be7', count: 500, winWhite: 54, draw: 26, winBlack: 20 },
  ],
  // Сицилианская: 1.e4 c5
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': [
    { san: 'Nf3', count: 12000, winWhite: 53, draw: 24, winBlack: 23 },
    { san: 'Nc3', count: 3000, winWhite: 52, draw: 23, winBlack: 25 },
    { san: 'c3', count: 2000, winWhite: 54, draw: 25, winBlack: 21 },
    { san: 'd4', count: 1500, winWhite: 51, draw: 22, winBlack: 27 },
    { san: 'f4', count: 800, winWhite: 50, draw: 20, winBlack: 30 },
  ],
  // Испанская: 1.e4 e5 2.Nf3 Nc6 3.Bb5
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3': [
    { san: 'a6', count: 10000, winWhite: 53, draw: 26, winBlack: 21 },
    { san: 'Nf6', count: 5000, winWhite: 54, draw: 25, winBlack: 21 },
    { san: 'd6', count: 2000, winWhite: 55, draw: 24, winBlack: 21 },
    { san: 'Bc5', count: 1000, winWhite: 52, draw: 26, winBlack: 22 },
    { san: 'f5', count: 500, winWhite: 56, draw: 20, winBlack: 24 },
  ],
  // Ферзевый гамбит: 1.d4 d5 2.c4
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2': [
    { san: 'e6', count: 8000, winWhite: 54, draw: 28, winBlack: 18 },
    { san: 'c6', count: 6000, winWhite: 53, draw: 28, winBlack: 19 },
    { san: 'dxc4', count: 4000, winWhite: 55, draw: 25, winBlack: 20 },
    { san: 'Nf6', count: 1000, winWhite: 54, draw: 26, winBlack: 20 },
    { san: 'e5', count: 500, winWhite: 56, draw: 22, winBlack: 22 },
  ],
};

export function getOpeningMoves(fen: string): OpeningMove[] | null {
  // Нормализуем FEN (убираем счётчики ходов)
  const key = fen.split(' ').slice(0, 4).join(' ');
  for (const [dbFen, moves] of Object.entries(OPENING_DB)) {
    const dbKey = dbFen.split(' ').slice(0, 4).join(' ');
    if (key === dbKey) return moves;
  }
  return null;
}
