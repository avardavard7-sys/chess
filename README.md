# Ход Конём — Шахматная школа

Полнофункциональная шахматная платформа: AI-соперник (Stockfish), онлайн-матчмейкинг, ELO рейтинг, детский режим.

## Стек технологий

- **Next.js 15** (App Router)
- **TypeScript + Tailwind CSS**
- **Framer Motion** — анимации
- **Supabase** — база данных, авторизация (Google), Realtime
- **chess.js** — логика шахмат
- **react-chessboard** — UI доски
- **Stockfish.js (WASM)** — AI движок

## Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Stockfish WASM (обязательно!)
Скачайте `stockfish.js` и `stockfish.wasm` с:
https://github.com/lichess-org/stockfish.wasm/releases/latest

Положите файлы в `public/stockfish/`

### 3. Supabase
Выполните SQL из `supabase/schema.sql` в вашем Supabase проекте:
- Dashboard → SQL Editor → вставьте и выполните

Включите Google OAuth:
- Dashboard → Authentication → Providers → Google
- Добавьте redirect URL: `https://ваш-домен.vercel.app/auth/callback`

### 4. Переменные окружения
Файл `.env.local` уже создан. При необходимости обновите ключи.

### 5. Запуск
```bash
npm run dev
```

## Деплой на Vercel

```bash
# Подключите GitHub репозиторий к Vercel
# Vercel автоматически определит Next.js
# Добавьте переменные окружения из .env.local в настройках Vercel
```

## Структура проекта

```
hod-konem/
├── app/
│   ├── page.tsx              ← Сплэш + главное меню
│   ├── game/[mode]/page.tsx  ← Игровой экран
│   ├── online/page.tsx       ← Онлайн матчмейкинг
│   ├── profile/page.tsx      ← Профиль пользователя
│   └── auth/callback/route.ts
├── components/
│   ├── SplashScreen.tsx      ← Анимированный сплэш
│   ├── Header.tsx            ← Шапка + WhatsApp кнопка
│   ├── MainMenu.tsx          ← 5 карточек уровней
│   ├── GameModeSelector.tsx  ← Выбор режима игры
│   ├── ChessBoard.tsx        ← Шахматная доска (AI/local/online)
│   ├── GameOverModal.tsx     ← Итоги партии + конфетти
│   ├── KidsBackground.tsx    ← Детский анимированный фон
│   ├── OnlineMatchmaking.tsx ← Поиск онлайн-соперника
│   └── ProfileCard.tsx       ← Профиль + история партий
├── lib/
│   ├── supabase.ts           ← Supabase клиент + helpers
│   ├── stockfish.ts          ← Stockfish Web Worker UCI
│   ├── elo.ts                ← ELO расчёт + ранги
│   └── chess-logic.ts        ← Шахматная логика
├── store/
│   └── gameStore.ts          ← Zustand состояние
└── supabase/
    └── schema.sql            ← Таблицы + RLS + триггер
```

## Уровни сложности

| Уровень | Skill Level | Depth | ELO |
|---------|------------|-------|-----|
| Детский | 0 | 1 | ~100 |
| Начинающий | 3 | 3 | ~450 |
| Средний | 8 | 8 | ~1150 |
| Сложный | 15 | 15 | ~2000 |
| Эксперт | 20 | 22 | ~2600 |
