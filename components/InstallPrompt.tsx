'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Проверяем, уже установлено ли приложение
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return; // Уже установлено — не показываем

    // Проверяем, было ли закрыто ранее
    const dismissed = localStorage.getItem('install_dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      // Показываем снова через 7 дней
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return;
    }

    // Определяем iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    // iOS — показываем баннер с инструкцией через 3 секунды
    if (isIOSDevice) {
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Desktop Chrome — слушаем beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setTimeout(() => setShowBanner(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Fallback — если через 4 секунды не было beforeinstallprompt, показываем
    // только если не iOS и не standalone
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt.current && !isIOSDevice) {
        setShowBanner(true);
      }
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt.current) {
      await deferredPrompt.current.prompt();
      const { outcome } = await deferredPrompt.current.userChoice;
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
      deferredPrompt.current = null;
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('install_dismissed', Date.now().toString());
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          className="fixed bottom-0 left-0 right-0 z-[70] p-4"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div
            className="max-w-lg mx-auto rounded-2xl p-5 flex flex-col gap-4"
            style={{
              background: 'rgba(15,23,42,0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(245,158,11,0.3)',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(245,158,11,0.2)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b, #7c3aed)',
                  boxShadow: '0 4px 15px rgba(245,158,11,0.4)',
                }}
              >
                ♞
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Установите Ход Конём
                </h3>
                <p className="text-xs text-white/50 mt-0.5">
                  {isIOS
                    ? 'Добавьте на рабочий стол для быстрого доступа'
                    : 'Установите приложение для лучшего опыта'}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-white/30 hover:text-white/60 transition-colors text-lg flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Преимущества */}
            <div className="flex gap-3">
              {[
                { icon: '⚡', text: 'Быстрый запуск' },
                { icon: '📱', text: 'Как приложение' },
                { icon: '🔔', text: 'Уведомления' },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs text-white/60">{item.text}</span>
                </div>
              ))}
            </div>

            {isIOS ? (
              /* iOS инструкция */
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <span className="text-2xl">📤</span>
                <div>
                  <p className="text-sm text-white/80">
                    Нажмите <span className="text-yellow-400 font-semibold">«Поделиться»</span> внизу экрана
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Затем <span className="text-yellow-400">«На экран Домой»</span>
                  </p>
                </div>
              </div>
            ) : (
              /* Android / Desktop кнопка */
              <div className="flex gap-3">
                <motion.button
                  onClick={handleInstall}
                  className="flex-1 py-3 rounded-xl font-bold text-black text-sm"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  📲 Установить приложение
                </motion.button>
                <motion.button
                  onClick={handleDismiss}
                  className="px-4 py-3 rounded-xl border border-white/15 text-white/50 text-sm hover:text-white/70 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Позже
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
