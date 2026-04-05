-- ═══════════════════════════════════════════════════════════════════
-- МИГРАЦИЯ v12 — Магазин + Аналитика коинов
-- Выполни в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Товары магазина
CREATE TABLE IF NOT EXISTS shop_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  images TEXT[] DEFAULT '{}',
  in_stock BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE shop_products DISABLE ROW LEVEL SECURITY;
GRANT ALL ON shop_products TO authenticated;
GRANT SELECT ON shop_products TO anon;

-- 2. История начисления коинов (для аналитики)
CREATE TABLE IF NOT EXISTS coin_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE coin_transactions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON coin_transactions TO authenticated;

-- 3. Заказы магазина
CREATE TABLE IF NOT EXISTS shop_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES shop_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_price INTEGER NOT NULL,
  buyer_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE shop_orders DISABLE ROW LEVEL SECURITY;
GRANT ALL ON shop_orders TO authenticated;
