'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/friends';

interface Notification {
  id: string;
  type: 'message' | 'invite' | 'friend_request';
  title: string;
  body: string;
  avatar?: string;
  link?: string;
  inviteCode?: string;
  timestamp: number;
}

interface NotificationSystemProps {
  userId: string | null;
}

export default function NotificationSystem({ userId }: NotificationSystemProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Создаём простой звук уведомления
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = 880;
        gain.gain.value = 0;
        // Сохраняем контекст для воспроизведения
        audioRef.current = null; // Будем использовать Web Audio API напрямую
      } catch {}
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {}
  }, []);

  const addNotification = useCallback((notif: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotif: Notification = {
      ...notif,
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
    };
    setNotifications((prev) => [...prev.slice(-4), newNotif]);
    playNotificationSound();

    // Авто-удаление через 6 секунд
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
    }, 6000);
  }, [playNotificationSound]);

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Загружаем непрочитанные при старте
  useEffect(() => {
    if (!userId) return;
    getUnreadCount(userId).then(setUnreadMessages).catch(() => {});
  }, [userId]);

  // Подписываемся на новые сообщения через Supabase Realtime
  useEffect(() => {
    if (!userId) return;

    // Слушаем новые записи в messages
    const msgChannel = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`,
        },
        async (payload) => {
          const msg = payload.new as { sender_id: string; text: string };
          // Получаем профиль отправителя
          const { data: sender } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', msg.sender_id)
            .single();

          setUnreadMessages((prev) => prev + 1);
          addNotification({
            type: 'message',
            title: sender?.username || 'Новое сообщение',
            body: msg.text.length > 50 ? msg.text.slice(0, 50) + '...' : msg.text,
            avatar: sender?.avatar_url || '',
            link: '/friends',
          });
        }
      )
      .subscribe();

    channelsRef.current.push(msgChannel);

    // Слушаем приглашения в игру
    const inviteChannel = supabase
      .channel('global-invites')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_invites',
          filter: `guest_id=eq.${userId}`,
        },
        async (payload) => {
          const invite = payload.new as { host_id: string; invite_code: string };
          const { data: host } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', invite.host_id)
            .single();

          addNotification({
            type: 'invite',
            title: 'Приглашение в игру!',
            body: `${host?.username || 'Игрок'} приглашает вас сыграть`,
            avatar: host?.avatar_url || '',
            link: `/invite/${invite.invite_code}`,
            inviteCode: invite.invite_code,
          });
        }
      )
      .subscribe();

    channelsRef.current.push(inviteChannel);

    // Слушаем запросы в друзья
    const friendChannel = supabase
      .channel('global-friends')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${userId}`,
        },
        async (payload) => {
          const req = payload.new as { user_id: string };
          const { data: sender } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', req.user_id)
            .single();

          addNotification({
            type: 'friend_request',
            title: 'Запрос в друзья',
            body: `${sender?.username || 'Игрок'} хочет добавить вас`,
            avatar: sender?.avatar_url || '',
            link: '/friends',
          });
        }
      )
      .subscribe();

    channelsRef.current.push(friendChannel);

    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe());
      channelsRef.current = [];
    };
  }, [userId, addNotification]);

  const handleNotificationClick = (notif: Notification) => {
    removeNotification(notif.id);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const getNotifIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message': return '💬';
      case 'invite': return '♞';
      case 'friend_request': return '👥';
    }
  };

  const getNotifColor = (type: Notification['type']) => {
    switch (type) {
      case 'message': return 'rgba(124,58,237,0.4)';
      case 'invite': return 'rgba(245,158,11,0.4)';
      case 'friend_request': return 'rgba(74,222,128,0.4)';
    }
  };

  return (
    <>
      {/* Notification toast container */}
      <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2 w-80 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              layout
              className="pointer-events-auto cursor-pointer"
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={() => handleNotificationClick(notif)}
            >
              <div
                className="flex items-start gap-3 p-4 rounded-2xl shadow-2xl"
                style={{
                  background: 'rgba(15,23,42,0.97)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${getNotifColor(notif.type)}`,
                  boxShadow: `0 10px 40px rgba(0,0,0,0.5), 0 0 20px ${getNotifColor(notif.type)}`,
                }}
              >
                {/* Avatar or icon */}
                <div className="flex-shrink-0">
                  {notif.avatar ? (
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-yellow-500/30">
                      <Image src={notif.avatar} alt="" width={40} height={40} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ background: getNotifColor(notif.type) }}
                    >
                      {getNotifIcon(notif.type)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white truncate">{notif.title}</span>
                    <span className="text-lg flex-shrink-0">{getNotifIcon(notif.type)}</span>
                  </div>
                  <p className="text-xs text-white/60 mt-0.5 truncate">{notif.body}</p>
                  {notif.type === 'invite' && (
                    <div
                      className="inline-block mt-2 px-3 py-1 rounded-lg text-xs font-semibold text-black"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    >
                      Принять приглашение →
                    </div>
                  )}
                </div>

                {/* Close */}
                <button
                  onClick={(e) => { e.stopPropagation(); removeNotification(notif.id); }}
                  className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors text-sm mt-0.5"
                >
                  ✕
                </button>
              </div>

              {/* Progress bar */}
              <motion.div
                className="h-0.5 rounded-full mt-0.5 mx-2"
                style={{ background: getNotifColor(notif.type) }}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 6, ease: 'linear' }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Unread badge — экспортируется наружу через window */}
      <UnreadBadgeExport count={unreadMessages} />
    </>
  );
}

// Компонент для передачи количества непрочитанных наружу
function UnreadBadgeExport({ count }: { count: number }) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, number>).__unreadMessages = count;
    }
  }, [count]);
  return null;
}

// Хук для использования количества непрочитанных
export function useUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (typeof window !== 'undefined') {
        const val = (window as unknown as Record<string, number>).__unreadMessages || 0;
        setCount(val);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
