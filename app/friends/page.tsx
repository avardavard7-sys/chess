'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Header from '@/components/Header';
import FriendChat from '@/components/FriendChat';
import GameInviteModal from '@/components/GameInviteModal';
import { supabase } from '@/lib/supabase';
import {
  searchUsers, sendFriendRequest, acceptFriendRequest, declineFriendRequest,
  getFriends, getFriendRequests, getFriendshipStatus, createGameInvite,
} from '@/lib/friends';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  elo_rating: number;
  rank?: string;
}

interface FriendData extends Profile {
  friendshipId: string;
}

export default function FriendsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'friends' | 'requests' | 'search'>('friends');

  const [friends, setFriends] = useState<FriendData[]>([]);
  const [requests, setRequests] = useState<{ id: string; user_id: string; user: Profile }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  const [chatFriend, setChatFriend] = useState<Profile | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      await refreshData(user.id);
      setLoading(false);
    };
    load();
  }, []);

  const refreshData = async (uid: string) => {
    const [friendsData, requestsData] = await Promise.all([
      getFriends(uid),
      getFriendRequests(uid),
    ]);
    setFriends(friendsData as FriendData[]);
    setRequests(requestsData as typeof requests);
  };

  const handleSearch = async () => {
    if (!userId || searchQuery.trim().length < 2) return;
    setSearching(true);
    const results = await searchUsers(searchQuery.trim(), userId);
    setSearchResults(results as Profile[]);
    setSearching(false);
  };

  const handleAddFriend = async (friendId: string) => {
    if (!userId) return;
    const existing = await getFriendshipStatus(userId, friendId);
    if (existing) return;
    await sendFriendRequest(userId, friendId);
    setSentRequests((prev) => new Set(prev).add(friendId));
  };

  const handleAccept = async (requestId: string) => {
    if (!userId) return;
    await acceptFriendRequest(requestId);
    await refreshData(userId);
  };

  const handleDecline = async (requestId: string) => {
    if (!userId) return;
    await declineFriendRequest(requestId);
    await refreshData(userId);
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!userId) return;
    const { data } = await createGameInvite(userId, friendId);
    if (data) {
      const channel = supabase.channel(`dm:${[userId, friendId].sort().join(':')}`);
      await channel.send({
        type: 'broadcast',
        event: 'GAME_INVITE',
        payload: { from: userId, invite_code: data.invite_code },
      });
      channel.unsubscribe();

      const inviteChannel = supabase.channel(`invite:${data.id}`);
      inviteChannel
        .on('broadcast', { event: 'ACCEPTED' }, () => {
          window.location.href = `/game/medium?mode=friend&session=${data.id}&color=white`;
        })
        .subscribe();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-screen pt-24 px-4">
          <motion.div className="glass p-10 rounded-2xl text-center max-w-md w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-6xl mb-5">👥</div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Друзья</h2>
            <p className="text-white/60 mb-8">Войдите для доступа к друзьям</p>
            <motion.button
              onClick={() => import('@/lib/supabase').then((m) => m.signInWithGoogle())}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-black"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              Войти через Google
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  if (chatFriend) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="pt-24 pb-12 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="glass rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
              <FriendChat
                userId={userId}
                friend={chatFriend}
                onClose={() => setChatFriend(null)}
                onInvite={handleInviteFriend}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div className="flex items-center justify-between mb-6" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Друзья</h1>
            <motion.button
              onClick={() => setInviteOpen(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-black"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            >
              Пригласить в игру
            </motion.button>
          </motion.div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {([
              { id: 'friends' as const, label: 'Друзья', count: friends.length },
              { id: 'requests' as const, label: 'Запросы', count: requests.length },
              { id: 'search' as const, label: 'Поиск', count: 0 },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-yellow-500/20 text-yellow-400' : 'text-white/40 hover:text-white/60'}`}
              >
                {t.label}
                {t.count > 0 && <span className="ml-1.5 text-xs opacity-60">({t.count})</span>}
              </button>
            ))}
          </div>

          {/* Friends list */}
          {tab === 'friends' && (
            <div className="space-y-2">
              {friends.length === 0 ? (
                <div className="glass p-8 rounded-2xl text-center">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-white/40 text-sm">Пока нет друзей. Найдите друзей через поиск!</p>
                </div>
              ) : (
                friends.map((f) => (
                  <motion.div key={f.friendshipId} className="glass p-4 rounded-xl flex items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="w-11 h-11 rounded-full overflow-hidden border border-yellow-500/30 flex-shrink-0">
                      {f.avatar_url ? (
                        <Image src={f.avatar_url} alt={f.username} width={44} height={44} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-lg font-bold text-yellow-400">
                          {f.username[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{f.username}</div>
                      <div className="text-xs text-yellow-400">ELO {f.elo_rating}</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <motion.button
                        onClick={() => setChatFriend(f)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-white/15 text-white/60 hover:text-white/90 hover:border-white/30 transition-all"
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      >
                        Написать
                      </motion.button>
                      <motion.button
                        onClick={() => handleInviteFriend(f.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black"
                        style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      >
                        Играть
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Friend requests */}
          {tab === 'requests' && (
            <div className="space-y-2">
              {requests.length === 0 ? (
                <div className="glass p-8 rounded-2xl text-center">
                  <p className="text-white/40 text-sm">Нет входящих запросов</p>
                </div>
              ) : (
                requests.map((r) => (
                  <motion.div key={r.id} className="glass p-4 rounded-xl flex items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-yellow-500/20 flex items-center justify-center text-lg font-bold text-yellow-400 flex-shrink-0">
                      {(r.user as Profile)?.avatar_url ? (
                        <Image src={(r.user as Profile).avatar_url} alt={(r.user as Profile).username} width={44} height={44} className="w-full h-full object-cover" />
                      ) : (r.user as Profile)?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{(r.user as Profile)?.username}</div>
                      <div className="text-xs text-white/40">Хочет добавить вас в друзья</div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <motion.button onClick={() => handleAccept(r.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black"
                        style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      >
                        Принять
                      </motion.button>
                      <motion.button onClick={() => handleDecline(r.id)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10"
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      >
                        Отклонить
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Search */}
          {tab === 'search' && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Введите ник игрока..."
                  className="flex-1 bg-white/8 rounded-xl px-4 py-3 text-white placeholder-white/30 border border-white/15 focus:border-yellow-400/50 focus:outline-none"
                />
                <motion.button
                  onClick={handleSearch}
                  disabled={searching || searchQuery.trim().length < 2}
                  className="px-5 py-3 rounded-xl font-semibold text-black disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                >
                  {searching ? '...' : 'Найти'}
                </motion.button>
              </div>

              <div className="space-y-2">
                {searchResults.map((u) => (
                  <motion.div key={u.id} className="glass p-4 rounded-xl flex items-center gap-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-yellow-500/20 flex items-center justify-center text-lg font-bold text-yellow-400 flex-shrink-0">
                      {u.avatar_url ? (
                        <Image src={u.avatar_url} alt={u.username} width={44} height={44} className="w-full h-full object-cover" />
                      ) : u.username[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{u.username}</div>
                      <div className="text-xs text-yellow-400">ELO {u.elo_rating}</div>
                    </div>
                    <motion.button
                      onClick={() => handleAddFriend(u.id)}
                      disabled={sentRequests.has(u.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black disabled:opacity-50 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                    >
                      {sentRequests.has(u.id) ? 'Отправлено' : 'Добавить'}
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      <GameInviteModal
        userId={userId}
        friends={friends}
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </div>
  );
}
