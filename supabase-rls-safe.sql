-- ═══════════════════════════════════════════════════════════════════════════
-- RLS POLICIES для "Ход Конём" — безопасный набор для всех таблиц
-- Этот SQL можно запустить ПОЛНОСТЬЮ — он использует DROP IF EXISTS + CREATE,
-- так что повторный запуск не сломает существующие policies.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PROFILES ───────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- ── TOURNAMENTS ────────────────────────────────────────────────────────────
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tournaments_select_all" ON tournaments;
DROP POLICY IF EXISTS "tournaments_insert_admin" ON tournaments;
DROP POLICY IF EXISTS "tournaments_update_admin" ON tournaments;
DROP POLICY IF EXISTS "tournaments_delete_admin" ON tournaments;
CREATE POLICY "tournaments_select_all" ON tournaments FOR SELECT USING (true);
CREATE POLICY "tournaments_insert_admin" ON tournaments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "tournaments_update_admin" ON tournaments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "tournaments_delete_admin" ON tournaments FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ── TOURNAMENT_PARTICIPANTS ────────────────────────────────────────────────
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tp_select_all" ON tournament_participants;
DROP POLICY IF EXISTS "tp_insert_own" ON tournament_participants;
DROP POLICY IF EXISTS "tp_update_own_or_admin" ON tournament_participants;
DROP POLICY IF EXISTS "tp_delete_own_or_admin" ON tournament_participants;
CREATE POLICY "tp_select_all" ON tournament_participants FOR SELECT USING (true);
CREATE POLICY "tp_insert_own" ON tournament_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tp_update_own_or_admin" ON tournament_participants FOR UPDATE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "tp_delete_own_or_admin" ON tournament_participants FOR DELETE USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ── TOURNAMENT_MATCHES ─────────────────────────────────────────────────────
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tm_select_all" ON tournament_matches;
DROP POLICY IF EXISTS "tm_modify_admin" ON tournament_matches;
CREATE POLICY "tm_select_all" ON tournament_matches FOR SELECT USING (true);
CREATE POLICY "tm_modify_admin" ON tournament_matches FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (true);

-- ── TOURNAMENT_ROUNDS ──────────────────────────────────────────────────────
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tr_select_all" ON tournament_rounds;
DROP POLICY IF EXISTS "tr_modify_admin" ON tournament_rounds;
CREATE POLICY "tr_select_all" ON tournament_rounds FOR SELECT USING (true);
CREATE POLICY "tr_modify_admin" ON tournament_rounds FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (true);

-- ── TOURNAMENT_RESULTS ─────────────────────────────────────────────────────
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tres_select_all" ON tournament_results;
DROP POLICY IF EXISTS "tres_modify_all" ON tournament_results;
CREATE POLICY "tres_select_all" ON tournament_results FOR SELECT USING (true);
CREATE POLICY "tres_modify_all" ON tournament_results FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── GAME_HISTORY ───────────────────────────────────────────────────────────
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gh_select_own" ON game_history;
DROP POLICY IF EXISTS "gh_insert_own" ON game_history;
DROP POLICY IF EXISTS "gh_update_own" ON game_history;
DROP POLICY IF EXISTS "gh_delete_own" ON game_history;
CREATE POLICY "gh_select_own" ON game_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "gh_insert_own" ON game_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gh_update_own" ON game_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "gh_delete_own" ON game_history FOR DELETE USING (auth.uid() = user_id);

-- ── LIVE_GAMES (для смотреть онлайн) ───────────────────────────────────────
ALTER TABLE live_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lg_select_all" ON live_games;
DROP POLICY IF EXISTS "lg_modify_authenticated" ON live_games;
CREATE POLICY "lg_select_all" ON live_games FOR SELECT USING (true);
CREATE POLICY "lg_modify_authenticated" ON live_games FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── GAME_SESSIONS ──────────────────────────────────────────────────────────
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gs_select_participants" ON game_sessions;
DROP POLICY IF EXISTS "gs_modify_participants" ON game_sessions;
CREATE POLICY "gs_select_participants" ON game_sessions FOR SELECT USING (
  auth.uid() = player_white OR auth.uid() = player_black
);
CREATE POLICY "gs_modify_participants" ON game_sessions FOR ALL USING (
  auth.uid() = player_white OR auth.uid() = player_black
) WITH CHECK (true);

-- ── DAILY_GAMES (по переписке) ─────────────────────────────────────────────
ALTER TABLE daily_games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dg_select_participants" ON daily_games;
DROP POLICY IF EXISTS "dg_insert_authenticated" ON daily_games;
DROP POLICY IF EXISTS "dg_update_participants" ON daily_games;
CREATE POLICY "dg_select_participants" ON daily_games FOR SELECT USING (
  auth.uid() = white_id OR auth.uid() = black_id
);
CREATE POLICY "dg_insert_authenticated" ON daily_games FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "dg_update_participants" ON daily_games FOR UPDATE USING (
  auth.uid() = white_id OR auth.uid() = black_id
);

-- ── GAME_INVITES ───────────────────────────────────────────────────────────
ALTER TABLE game_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gi_select_all" ON game_invites;
DROP POLICY IF EXISTS "gi_insert_own" ON game_invites;
DROP POLICY IF EXISTS "gi_update_participants" ON game_invites;
DROP POLICY IF EXISTS "gi_delete_own" ON game_invites;
CREATE POLICY "gi_select_all" ON game_invites FOR SELECT USING (true);
CREATE POLICY "gi_insert_own" ON game_invites FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "gi_update_participants" ON game_invites FOR UPDATE USING (
  auth.uid() = host_id OR auth.uid() = guest_id
);
CREATE POLICY "gi_delete_own" ON game_invites FOR DELETE USING (auth.uid() = host_id);

-- ── MATCHMAKING_QUEUE ──────────────────────────────────────────────────────
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mq_select_all" ON matchmaking_queue;
DROP POLICY IF EXISTS "mq_insert_own" ON matchmaking_queue;
DROP POLICY IF EXISTS "mq_delete_all" ON matchmaking_queue;
CREATE POLICY "mq_select_all" ON matchmaking_queue FOR SELECT USING (true);
CREATE POLICY "mq_insert_own" ON matchmaking_queue FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "mq_delete_all" ON matchmaking_queue FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── FRIENDSHIPS ────────────────────────────────────────────────────────────
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fr_select_participants" ON friendships;
DROP POLICY IF EXISTS "fr_insert_own" ON friendships;
DROP POLICY IF EXISTS "fr_update_participants" ON friendships;
DROP POLICY IF EXISTS "fr_delete_participants" ON friendships;
CREATE POLICY "fr_select_participants" ON friendships FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "fr_insert_own" ON friendships FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fr_update_participants" ON friendships FOR UPDATE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);
CREATE POLICY "fr_delete_participants" ON friendships FOR DELETE USING (
  auth.uid() = user_id OR auth.uid() = friend_id
);

-- ── MESSAGES ───────────────────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "msg_select_participants" ON messages;
DROP POLICY IF EXISTS "msg_insert_own" ON messages;
DROP POLICY IF EXISTS "msg_update_own" ON messages;
CREATE POLICY "msg_select_participants" ON messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY "msg_insert_own" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "msg_update_own" ON messages FOR UPDATE USING (auth.uid() = receiver_id);

-- ── COIN_SETTINGS ──────────────────────────────────────────────────────────
ALTER TABLE coin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cs_select_all" ON coin_settings;
DROP POLICY IF EXISTS "cs_modify_admin" ON coin_settings;
CREATE POLICY "cs_select_all" ON coin_settings FOR SELECT USING (true);
CREATE POLICY "cs_modify_admin" ON coin_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (true);

-- ── COIN_TRANSACTIONS ──────────────────────────────────────────────────────
ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ct_select_own_or_admin" ON coin_transactions;
DROP POLICY IF EXISTS "ct_insert_authenticated" ON coin_transactions;
CREATE POLICY "ct_select_own_or_admin" ON coin_transactions FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "ct_insert_authenticated" ON coin_transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ── SHOP_PRODUCTS ──────────────────────────────────────────────────────────
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sp_select_all" ON shop_products;
DROP POLICY IF EXISTS "sp_modify_admin" ON shop_products;
CREATE POLICY "sp_select_all" ON shop_products FOR SELECT USING (true);
CREATE POLICY "sp_modify_admin" ON shop_products FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (true);

-- ── SHOP_ORDERS ────────────────────────────────────────────────────────────
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "so_select_own_or_admin" ON shop_orders;
DROP POLICY IF EXISTS "so_insert_own" ON shop_orders;
DROP POLICY IF EXISTS "so_update_admin" ON shop_orders;
CREATE POLICY "so_select_own_or_admin" ON shop_orders FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);
CREATE POLICY "so_insert_own" ON shop_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "so_update_admin" ON shop_orders FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
);

-- ── SCHOOL_TRAINERS ────────────────────────────────────────────────────────
ALTER TABLE school_trainers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "st_select_all" ON school_trainers;
DROP POLICY IF EXISTS "st_modify_admin" ON school_trainers;
CREATE POLICY "st_select_all" ON school_trainers FOR SELECT USING (true);
CREATE POLICY "st_modify_admin" ON school_trainers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
) WITH CHECK (true);

-- ── SCHOOL_STUDENTS ────────────────────────────────────────────────────────
ALTER TABLE school_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ss_select_all" ON school_students;
DROP POLICY IF EXISTS "ss_modify_admin_trainer" ON school_students;
CREATE POLICY "ss_select_all" ON school_students FOR SELECT USING (true);
CREATE POLICY "ss_modify_admin_trainer" ON school_students FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
) WITH CHECK (true);

-- ── TRAINER_ATTENDANCE ─────────────────────────────────────────────────────
ALTER TABLE trainer_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ta_select_all" ON trainer_attendance;
DROP POLICY IF EXISTS "ta_modify_admin_trainer" ON trainer_attendance;
CREATE POLICY "ta_select_all" ON trainer_attendance FOR SELECT USING (true);
CREATE POLICY "ta_modify_admin_trainer" ON trainer_attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
) WITH CHECK (true);

-- ── TRAINER_NOTES ──────────────────────────────────────────────────────────
ALTER TABLE trainer_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tn_select_public_or_admin" ON trainer_notes;
DROP POLICY IF EXISTS "tn_modify_admin_trainer" ON trainer_notes;
CREATE POLICY "tn_select_public_or_admin" ON trainer_notes FOR SELECT USING (
  is_private = false OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
);
CREATE POLICY "tn_modify_admin_trainer" ON trainer_notes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
) WITH CHECK (true);

-- ── TRAINER_HOMEWORK ───────────────────────────────────────────────────────
ALTER TABLE trainer_homework ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "th_select_all" ON trainer_homework;
DROP POLICY IF EXISTS "th_insert_admin_trainer" ON trainer_homework;
DROP POLICY IF EXISTS "th_update_all_authenticated" ON trainer_homework;
DROP POLICY IF EXISTS "th_delete_admin_trainer" ON trainer_homework;
CREATE POLICY "th_select_all" ON trainer_homework FOR SELECT USING (true);
CREATE POLICY "th_insert_admin_trainer" ON trainer_homework FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
);
CREATE POLICY "th_update_all_authenticated" ON trainer_homework FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "th_delete_admin_trainer" ON trainer_homework FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
);

-- ── TRAINER_AWARDS ─────────────────────────────────────────────────────────
ALTER TABLE trainer_awards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "taw_select_all" ON trainer_awards;
DROP POLICY IF EXISTS "taw_modify_admin_trainer" ON trainer_awards;
CREATE POLICY "taw_select_all" ON trainer_awards FOR SELECT USING (true);
CREATE POLICY "taw_modify_admin_trainer" ON trainer_awards FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
) WITH CHECK (true);

-- ── TRAINER_GOALS ──────────────────────────────────────────────────────────
ALTER TABLE trainer_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tg_select_all" ON trainer_goals;
DROP POLICY IF EXISTS "tg_modify_admin_trainer" ON trainer_goals;
CREATE POLICY "tg_select_all" ON trainer_goals FOR SELECT USING (true);
CREATE POLICY "tg_modify_admin_trainer" ON trainer_goals FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
) WITH CHECK (true);

-- ── TRAINER_GROUPS ─────────────────────────────────────────────────────────
ALTER TABLE trainer_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tgr_select_all" ON trainer_groups;
DROP POLICY IF EXISTS "tgr_modify_admin_trainer" ON trainer_groups;
CREATE POLICY "tgr_select_all" ON trainer_groups FOR SELECT USING (true);
CREATE POLICY "tgr_modify_admin_trainer" ON trainer_groups FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
) WITH CHECK (true);

-- ── TRAINER_SCHEDULE ───────────────────────────────────────────────────────
ALTER TABLE trainer_schedule ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tsch_select_all" ON trainer_schedule;
DROP POLICY IF EXISTS "tsch_modify_admin_trainer" ON trainer_schedule;
CREATE POLICY "tsch_select_all" ON trainer_schedule FOR SELECT USING (true);
CREATE POLICY "tsch_modify_admin_trainer" ON trainer_schedule FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (is_admin = true OR is_trainer = true))
) WITH CHECK (true);

-- ── LEARN_PROGRESS ─────────────────────────────────────────────────────────
ALTER TABLE learn_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lp_select_own" ON learn_progress;
DROP POLICY IF EXISTS "lp_insert_own" ON learn_progress;
DROP POLICY IF EXISTS "lp_update_own" ON learn_progress;
CREATE POLICY "lp_select_own" ON learn_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lp_insert_own" ON learn_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lp_update_own" ON learn_progress FOR UPDATE USING (auth.uid() = user_id);

-- ── PUZZLE_RATING_HISTORY ──────────────────────────────────────────────────
ALTER TABLE puzzle_rating_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prh_select_own" ON puzzle_rating_history;
DROP POLICY IF EXISTS "prh_insert_own" ON puzzle_rating_history;
CREATE POLICY "prh_select_own" ON puzzle_rating_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prh_insert_own" ON puzzle_rating_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Готово! Все таблицы защищены RLS, но публичные данные (рейтинги, турниры,
-- профили) остаются доступными для чтения. Запись строго по правилам.
-- ═══════════════════════════════════════════════════════════════════════════
