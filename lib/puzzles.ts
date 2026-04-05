// 21,000 реальных задач из Lichess puzzle database (CC0 Public Domain)
// По 1000 задач на каждый из 21 разделов
// Задачи хранятся в public/puzzles/{theme}.json и загружаются по требованию

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'tactics' | 'openings' | 'endgame' | 'beginner';
  difficulty: 'easy' | 'medium' | 'hard';
  lichessTheme: string;
  puzzleCount: number;
}

// ═══ Курсы ═══════════════════════════════════════════════════════════════════

export const ALL_COURSES: Course[] = [
  // Тактика
  { id: 'mate-in-1', title: 'Мат в 1 ход', description: 'Поставьте мат одним ходом', icon: '👑', category: 'tactics', difficulty: 'easy', lichessTheme: 'mateIn1', puzzleCount: 1000 },
  { id: 'mate-in-2', title: 'Мат в 2 хода', description: 'Найдите мат в два хода', icon: '🏆', category: 'tactics', difficulty: 'medium', lichessTheme: 'mateIn2', puzzleCount: 1000 },
  { id: 'back-rank', title: 'Мат на последней горизонтали', description: 'Классический мат по 1/8 линии', icon: '💀', category: 'tactics', difficulty: 'easy', lichessTheme: 'backRankMate', puzzleCount: 1000 },
  { id: 'forks', title: 'Двойные удары и вилки', description: 'Атакуйте две фигуры одновременно', icon: '⚔️', category: 'tactics', difficulty: 'medium', lichessTheme: 'fork', puzzleCount: 1000 },
  { id: 'pins', title: 'Связка', description: 'Ограничьте фигуры связкой', icon: '📌', category: 'tactics', difficulty: 'medium', lichessTheme: 'pin', puzzleCount: 1000 },
  { id: 'skewer', title: 'Сквозной удар', description: 'Атакуйте фигуру за другой', icon: '🗡️', category: 'tactics', difficulty: 'hard', lichessTheme: 'skewer', puzzleCount: 1000 },
  { id: 'discovered', title: 'Открытое нападение', description: 'Откройте линию атаки', icon: '💥', category: 'tactics', difficulty: 'hard', lichessTheme: 'discoveredAttack', puzzleCount: 1000 },
  { id: 'deflection', title: 'Отвлечение', description: 'Отвлеките защитника', icon: '🎯', category: 'tactics', difficulty: 'hard', lichessTheme: 'deflection', puzzleCount: 1000 },
  { id: 'sacrifice', title: 'Жертва', description: 'Отдайте фигуру ради атаки', icon: '💎', category: 'tactics', difficulty: 'hard', lichessTheme: 'sacrifice', puzzleCount: 1000 },
  { id: 'kingside', title: 'Атака на короля', description: 'Штурм королевского фланга', icon: '🔥', category: 'tactics', difficulty: 'hard', lichessTheme: 'kingsideAttack', puzzleCount: 1000 },

  // Дебюты
  { id: 'opening-traps', title: 'Дебютные ловушки', description: 'Тактика в начале партии', icon: '🪤', category: 'openings', difficulty: 'easy', lichessTheme: 'opening', puzzleCount: 1000 },
  { id: 'advantage', title: 'Захват преимущества', description: 'Найдите решающий ход', icon: '📈', category: 'openings', difficulty: 'medium', lichessTheme: 'advantage', puzzleCount: 1000 },
  { id: 'attacking-f7', title: 'Атака на f7/f2', description: 'Классическая атака на слабый пункт', icon: '🎯', category: 'openings', difficulty: 'medium', lichessTheme: 'attackingF2F7', puzzleCount: 1000 },

  // Эндшпиль
  { id: 'endgame-basic', title: 'Основы эндшпиля', description: 'Базовые эндшпильные приёмы', icon: '♔', category: 'endgame', difficulty: 'easy', lichessTheme: 'endgame', puzzleCount: 1000 },
  { id: 'pawn-endgame', title: 'Пешечный эндшпиль', description: 'Оппозиция и проходные пешки', icon: '♟', category: 'endgame', difficulty: 'medium', lichessTheme: 'pawnEndgame', puzzleCount: 1000 },
  { id: 'rook-endgame', title: 'Ладейный эндшпиль', description: 'Самый частый тип эндшпиля', icon: '♜', category: 'endgame', difficulty: 'hard', lichessTheme: 'rookEndgame', puzzleCount: 1000 },
  { id: 'queen-endgame', title: 'Ферзевый эндшпиль', description: 'Техника игры с ферзём', icon: '♛', category: 'endgame', difficulty: 'medium', lichessTheme: 'queenEndgame', puzzleCount: 1000 },

  // Для начинающих
  { id: 'one-move', title: 'Задачи в 1 ход', description: 'Найдите лучший ход', icon: '🌱', category: 'beginner', difficulty: 'easy', lichessTheme: 'oneMove', puzzleCount: 1000 },
  { id: 'short-puzzles', title: 'Короткие задачи', description: 'Решите в 2-3 хода', icon: '⚡', category: 'beginner', difficulty: 'easy', lichessTheme: 'short', puzzleCount: 1000 },
  { id: 'hanging-piece', title: 'Незащищённая фигура', description: 'Заберите фигуру без защиты', icon: '🎁', category: 'beginner', difficulty: 'easy', lichessTheme: 'hangingPiece', puzzleCount: 1000 },
  { id: 'trapped-piece', title: 'Пойманная фигура', description: 'Поймайте фигуру в ловушку', icon: '🪤', category: 'beginner', difficulty: 'easy', lichessTheme: 'trappedPiece', puzzleCount: 1000 },
];

export function getCoursesByCategory(cat: Course['category']): Course[] {
  return ALL_COURSES.filter(c => c.category === cat);
}

export function getCourseById(id: string): Course | undefined {
  return ALL_COURSES.find(c => c.id === id);
}

export function getCourseByTheme(theme: string): Course | undefined {
  return ALL_COURSES.find(c => c.lichessTheme === theme);
}

// ═══ Загрузка задач ══════════════════════════════════════════════════════════

const puzzleCache: Record<string, Puzzle[]> = {};

export async function loadPuzzlesForCourse(
  course: Course,
  onProgress?: (n: number) => void
): Promise<Puzzle[]> {
  const theme = course.lichessTheme;

  // Проверяем кэш в памяти
  if (puzzleCache[theme] && puzzleCache[theme].length > 0) {
    onProgress?.(puzzleCache[theme].length);
    return puzzleCache[theme];
  }

  // Загружаем из JSON файла
  try {
    const res = await fetch(`/puzzles/${theme}.json`);
    if (res.ok) {
      const puzzles: Puzzle[] = await res.json();
      puzzleCache[theme] = puzzles;
      onProgress?.(puzzles.length);
      return puzzles;
    }
  } catch (e) {
    console.error('Failed to load puzzles:', e);
  }

  return [];
}
