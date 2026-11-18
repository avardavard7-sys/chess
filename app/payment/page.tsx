'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/components/Header';

const KASPI_LINK = 'https://kaspi.kz/pay/CoursesUniversal?region_id=18&subservice_id=25763&started_from=QR';
const SCHOOL_WHATSAPP = process.env.NEXT_PUBLIC_SCHOOL_WHATSAPP || '+77001234567';

export default function PaymentPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(KASPI_LINK);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const openWhatsApp = () => {
    const text = encodeURIComponent('Здравствуйте! У меня вопрос по оплате занятий.');
    const cleanPhone = SCHOOL_WHATSAPP.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 100%)' }}>
      <Header />
      <main className="pt-24 pb-12 px-4 relative">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-8"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-6xl mb-3">💳</div>
            <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#ffd700' }}>
              Оплата услуг
            </h1>
            <p className="text-sm text-white/60">Шахматная школа «Ход Конём»</p>
            <p className="text-xs text-white/40 mt-1">Безопасная оплата через Kaspi.kz</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl p-4 mb-6 flex items-start gap-3"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}>
            <div className="text-2xl">ℹ️</div>
            <div className="text-sm text-white/80 leading-relaxed">
              <div className="font-semibold mb-1 text-yellow-400">Удобная оплата за обучение</div>
              <div className="text-xs text-white/60">
                Оплатите занятия по QR-коду или ссылке Kaspi — без комиссии, мгновенно, прямо из приложения Kaspi.kz
              </div>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))', border: '1px solid rgba(220,38,38,0.35)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: '#DC2626' }}>🔗</div>
                <div>
                  <h2 className="text-lg font-bold text-white">Оплата по ссылке</h2>
                  <p className="text-xs text-white/50">Быстрый переход в Kaspi.kz</p>
                </div>
              </div>

              <ul className="space-y-2 mb-4 text-xs text-white/70">
                <li className="flex gap-2"><span className="text-green-400">✓</span> Нажмите кнопку ниже</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Откроется Kaspi.kz</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Введите сумму и оплатите</li>
              </ul>

              <motion.a
                href={KASPI_LINK} target="_blank" rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="block w-full py-3 rounded-xl text-center font-bold text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}>
                💳 Перейти к оплате
              </motion.a>

              <button onClick={copyLink}
                className="block w-full mt-2 py-2 rounded-xl text-center text-xs font-medium border border-white/15 text-white/60 hover:bg-white/5 transition">
                {copied ? '✅ Скопировано!' : '📋 Скопировать ссылку'}
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="rounded-2xl p-6 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))', border: '1px solid rgba(245,158,11,0.35)' }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: '#F59E0B' }}>📱</div>
                <div>
                  <h2 className="text-lg font-bold text-white">Оплата по QR-коду</h2>
                  <p className="text-xs text-white/50">Отсканируйте камерой</p>
                </div>
              </div>

              <ul className="space-y-2 mb-4 text-xs text-white/70">
                <li className="flex gap-2"><span className="text-green-400">✓</span> Откройте Kaspi.kz на телефоне</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Нажмите «Сканировать QR»</li>
                <li className="flex gap-2"><span className="text-green-400">✓</span> Наведите камеру на QR ниже</li>
              </ul>

              <div className="bg-white p-3 rounded-xl flex items-center justify-center">
                <Image
                  src="/kaspi-qr.png"
                  alt="Kaspi QR код для оплаты"
                  width={300}
                  height={300}
                  className="w-full h-auto"
                  unoptimized
                />
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mt-6 rounded-2xl p-5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-xs text-white/40 mb-1">Получатель платежа</div>
                <div className="font-bold text-white">Mila Chess</div>
                <div className="text-xs text-white/50">Шахматная школа «Ход Конём»</div>
              </div>
              <button onClick={openWhatsApp}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2"
                style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e' }}>
                💬 Вопросы по оплате
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="mt-6 text-center text-xs text-white/30 leading-relaxed">
            🔒 Оплата проходит через защищённую систему Kaspi.kz<br/>
            После оплаты, пожалуйста, сообщите администратору в WhatsApp
          </motion.div>

          <div className="mt-8 text-center">
            <button onClick={() => router.push('/')} className="text-sm text-white/40 hover:text-white">
              ← На главную
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
