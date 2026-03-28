-- ============================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================

-- Friendships
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.friendships TO authenticated;

CREATE POLICY "Users see own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users create friend requests" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own friendships" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users delete own friendships" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.messages TO authenticated;

CREATE POLICY "Users see own messages" ON public.messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users send messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users update own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- Game invites
CREATE TABLE IF NOT EXISTS public.game_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  guest_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text UNIQUE NOT NULL,
  status text DEFAULT 'waiting',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.game_invites TO authenticated;

CREATE POLICY "Anyone can read invites" ON public.game_invites
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users create invites" ON public.game_invites
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users update invites" ON public.game_invites
  FOR UPDATE TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id OR guest_id IS NULL);

-- ============================================
-- REALTIME для уведомлений
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE game_invites;
