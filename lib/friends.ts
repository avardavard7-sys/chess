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

async function fetchProfiles(ids: string[]) {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, elo_rating, rank')
    .in('id', ids);
  return data || [];
}

export async function getFriends(userId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('id, user_id, friend_id')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .eq('status', 'accepted');
  if (!data || data.length === 0) return [];

  const friendIds = data.map((f) => f.user_id === userId ? f.friend_id : f.user_id);
  const profiles = await fetchProfiles(friendIds);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return data.map((f) => {
    const friendId = f.user_id === userId ? f.friend_id : f.user_id;
    const profile = profileMap.get(friendId);
    return {
      friendshipId: f.id,
      id: friendId,
      username: profile?.username || 'Unknown',
      avatar_url: profile?.avatar_url || '',
      elo_rating: profile?.elo_rating || 0,
      rank: profile?.rank || '',
    };
  });
}

export async function getFriendRequests(userId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('id, user_id, created_at')
    .eq('friend_id', userId)
    .eq('status', 'pending');
  if (!data || data.length === 0) return [];

  const senderIds = data.map((r) => r.user_id);
  const profiles = await fetchProfiles(senderIds);
  const profileMap = new Map(profiles.map((p) => [p.id, p]));

  return data.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    created_at: r.created_at,
    user: profileMap.get(r.user_id) || { id: r.user_id, username: 'Unknown', avatar_url: '', elo_rating: 0 },
  }));
}

export async function getFriendshipStatus(userId: string, friendId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('id, status, user_id')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
    .maybeSingle();
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

export async function getUnreadByFriend(userId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('receiver_id', userId)
    .eq('read', false);
  if (!data) return {};
  const counts: Record<string, number> = {};
  data.forEach(m => { counts[m.sender_id] = (counts[m.sender_id] || 0) + 1; });
  return counts;
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
    .select('*')
    .eq('invite_code', code.toUpperCase())
    .eq('status', 'waiting')
    .maybeSingle();
  if (!data) return null;

  const { data: hostProfile } = await supabase
    .from('profiles')
    .select('username, avatar_url, elo_rating')
    .eq('id', data.host_id)
    .single();

  return { ...data, host: hostProfile };
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
    .select('*')
    .eq('guest_id', userId)
    .eq('status', 'waiting');
  return data || [];
}
