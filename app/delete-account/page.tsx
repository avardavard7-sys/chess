import type { Metadata } from 'next';
import Link from 'next/link';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: `Удаление аккаунта — ${LEGAL.appName}`,
  description: `Как удалить аккаунт ${LEGAL.appName} и связанные с ним данные`,
};

export default function DeleteAccountPage() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-10 text-white/80 leading-relaxed">
      <h1 className="text-3xl font-black text-white">Удаление аккаунта «{LEGAL.appName}»</h1>

      <h2 className="text-xl font-bold text-white mt-8 mb-3">Способ 1 — в приложении</h2>
      <p>Откройте приложение → вкладка «Ещё» → «Удалить аккаунт» → подтвердите дважды. Аккаунт удаляется сразу.</p>

      <h2 className="text-xl font-bold text-white mt-8 mb-3">Способ 2 — по запросу</h2>
      <p>
        Если доступа к приложению нет, напишите нам в WhatsApp <a href={LEGAL.whatsappUrl} className="underline text-white">{LEGAL.contactWhatsApp}</a>
        {LEGAL.contactEmail ? (
          <>
            {' '}или на почту <a href={`mailto:${LEGAL.contactEmail}`} className="underline text-white">{LEGAL.contactEmail}</a>
          </>
        ) : null}{' '}
        с темой «Удаление аккаунта» и укажите никнейм или почту аккаунта. Мы удалим аккаунт в течение 10 рабочих дней и подтвердим это в ответе.
      </p>

      <h2 className="text-xl font-bold text-white mt-8 mb-3">Что удаляется</h2>
      <p>Профиль и вход, рейтинг, история партий и их разбор, сообщения, друзья, приглашения, прогресс задач и курсов, достижения, монеты и их история, заказы, настройки и адреса устройств для уведомлений, технические журналы.</p>

      <h2 className="text-xl font-bold text-white mt-8 mb-3">Что остаётся</h2>
      <p>Партии и турнирные встречи, сыгранные с другими игроками, остаются у соперников, но обезличиваются — без связи с вашим аккаунтом. Учётная запись ученика шахматной школы ведётся школой и удаляется по отдельному запросу родителя.</p>

      <p className="mt-8"><Link href="/privacy" className="underline text-white">Политика конфиденциальности</Link></p>
    </main>
  );
}
