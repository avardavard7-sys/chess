import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ход Конём — Шахматная школа',
  description: 'Профессиональная шахматная школа в Казахстане. Онлайн-игра, обучение, рейтинговые партии.',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>♞</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <div className="chess-bg" />
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}
