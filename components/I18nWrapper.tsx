'use client';

import { I18nProvider } from '@/lib/i18n';
import { UIThemeProvider } from '@/lib/uiTheme';

export function I18nWrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <UIThemeProvider>
        {children}
      </UIThemeProvider>
    </I18nProvider>
  );
}
