'use client';

import { useTranslation } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { lang, setLang } = useTranslation();

  return (
    <button
      onClick={() => setLang(lang === 'ru' ? 'kk' : 'ru')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 hover:border-white/25 text-white/50 hover:text-white/80 transition-all"
      title={lang === 'ru' ? 'Қазақшаға ауыстыру' : 'Переключить на русский'}
    >
      <span className="text-sm">{lang === 'ru' ? '🇰🇿' : '🇷🇺'}</span>
      <span>{lang === 'ru' ? 'Қаз' : 'Рус'}</span>
    </button>
  );
}
