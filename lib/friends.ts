import { supabase } from './supabase';

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchUsers(query: string, currentUserId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, elo_rating, rank')
    .ilike('username', `%${query}%`)
    .neq('id', currentUserId)
    .limit(10);
  return data || [];
}

// ─── Friends ──────────────────────────────────────────────────────────────────

export async function sendFriendRequest(userId: string, friendId: string) {
  return supabase.from('friendships').insert({ user_id: userId, friend_id: friendId, status: 'pending' });
}

export async function acceptFriendRequest(friendshipId: string) {
  return supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
}

export async function declineFriendRequest(friendshipId: string) {
  return supabase.from('friendships').delete().eq('id', friendshipId);
}

export async function removeFriend(friendshipId: string) {
  return supabase.from('friendships').delete().eq('id', friendshipId);
}

export async function getFriends(userId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id, created_at, user:profiles!friendships_user_id_fkey(id, username, avatar_url, elo_rating, rank), friend:profiles!friendships_friend_id_fkey(id, username, avatar_url, elo_rating, rank)')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (!data) return [];
  return data.map((f) => {
    const isMe = f.user_id === userId;
    const profile = isMe ? f.friend : f.user;
    return { friendshipId: f.id, ...(profile as { id: string; username: string; avatar_url: string; elo_rating: number; rank: string }) };
  });
}

export async function getFriendRequests(userId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('id, user_id, created_at, user:profiles!friendships_user_id_fkey(id, username, avatar_url, elo_rating)')
    .eq('friend_id', userId)
    .eq('status', 'pending');
  return data || [];
}

export async function getFriendshipStatus(userId: string, friendId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('id, status, user_id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
    .single();
  return data;
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(userId: string, friendId: string, limit = 50) {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${userId},receiver_id.eq.${friendId}),and(sender_id.eq.${friendId},receiver_id.eq.${userId})`)
    .order('created_at', { ascending: true })
    .limit(limit);
  return data || [];
}

export async function sendMessage(senderId: string, receiverId: string, text: string) {
  return supabase.from('messages').insert({ sender_id: senderId, receiver_id: receiverId, text });
}

export async function markMessagesRead(userId: string, friendId: string) {
  return supabase
    .from('messages')
    .update({ read: true })
    .eq('sender_id', friendId)
    .eq('receiver_id', userId)
    .eq('read', false);
}

export async function getUnreadCount(userId: string) {
  const { count } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', userId)
    .eq('read', false);
  return count || 0;
}

// ─── Game Invites ─────────────────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function createGameInvite(hostId: string, guestId?: string) {
  const invite_code = generateCode();
  const { data, error } = await supabase
    .from('game_invites')
    .insert({ host_id: hostId, guest_id: guestId || null, invite_code, status: 'waiting' })
    .select()
    .single();
  return { data, error };
}

export async function getInviteByCode(code: string) {
  const { data } = await supabase
    .from('game_invites')
    .select('*, host:profiles!game_invites_host_id_fkey(username, avatar_url, elo_rating)')
    .eq('invite_code', code.toUpperCase())
    .eq('status', 'waiting')
    .single();
  return data;
}

export async function acceptGameInvite(inviteId: string, guestId: string) {
  return supabase
    .from('game_invites')
    .update({ status: 'accepted', guest_id: guestId })
    .eq('id', inviteId);
}

export async function cancelGameInvite(inviteId: string) {
  return supabase.from('game_invites').update({ status: 'cancelled' }).eq('id', inviteId);
}

export async function getPendingInvitesForUser(userId: string) {
  const { data } = await supabase
    .from('game_invites')
    .select('*, host:profiles!game_invites_host_id_fkey(username, avatar_url, elo_rating)')
    .eq('guest_id', userId)
    .eq('status', 'waiting');
  return data || [];
}
