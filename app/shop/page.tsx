'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';

export default function ShopPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [userCoins, setUserCoins] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [buyMsg, setBuyMsg] = useState('');
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('shop_products').select('*').eq('in_stock', true).order('created_at', { ascending: false });
      setProducts(data || []);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const { data: profile } = await supabase.from('profiles').select('coins').eq('id', session.user.id).single();
        if (profile) setUserCoins(profile.coins || 0);
      }
      setLoading(false);
    };
    load();
  }, []);

  const buyProduct = async (product: any) => {
    if (!userId) { setBuyMsg('Войдите в аккаунт!'); return; }
    if (userCoins < product.price) { setBuyMsg('Не хватает коинов!'); return; }
    setBuying(true);
    // 1. Списываем коины
    const newCoins = userCoins - product.price;
    await supabase.from('profiles').update({ coins: newCoins }).eq('id', userId);
    // 2. Создаём заказ
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', userId).single();
    await supabase.from('shop_orders').insert({
      user_id: userId,
      product_id: product.id,
      product_name: product.name,
      product_price: product.price,
      buyer_name: profile?.username || 'Неизвестный',
    });
    // 3. Записываем транзакцию
    await supabase.from('coin_transactions').insert({
      user_id: userId,
      amount: -product.price,
      source: 'shop',
      description: `Покупка: ${product.name}`,
    });
    setUserCoins(newCoins);
    setBuyMsg(`✅ Вы купили "${product.name}"!`);
    setBuying(false);
    setTimeout(() => setBuyMsg(''), 3000);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div></div>;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>🛍️ Магазин</h1>
            <p className="text-white/40">Обменивай коины на призы!</p>
            <motion.div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full glass"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
              <span className="text-xl">🪙</span>
              <span className="text-lg font-bold text-yellow-400">{userCoins}</span>
              <span className="text-xs text-white/30">коинов</span>
            </motion.div>
          </motion.div>

          {products.length === 0 ? (
            <div className="glass p-10 rounded-2xl text-center">
              <div className="text-5xl mb-4">🛍️</div>
              <p className="text-white/40">Магазин пока пуст</p>
              <p className="text-white/20 text-xs mt-1">Товары скоро появятся!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p, i) => (
                <motion.div key={p.id} onClick={() => { setSelected(p); setPhotoIndex(0); }}
                  className="glass rounded-2xl overflow-hidden cursor-pointer group"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.03, y: -5 }} whileTap={{ scale: 0.97 }}>
                  {/* Фото */}
                  <div className="relative aspect-square bg-white/5 overflow-hidden">
                    {p.images && p.images.length > 0 ? (
                      <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl text-white/10">📦</div>
                    )}
                    {/* Badge кол-во фото */}
                    {p.images && p.images.length > 1 && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-black/50 text-[10px] text-white/70">
                        📷 {p.images.length}
                      </div>
                    )}
                  </div>
                  {/* Инфо */}
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-white/80 truncate mb-1">{p.name}</h3>
                    {p.description && <p className="text-[10px] text-white/30 line-clamp-2 mb-2">{p.description}</p>}
                    <motion.div className="flex items-center gap-1.5"
                      animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      <span className="text-lg">🪙</span>
                      <span className="text-lg font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>{p.price}</span>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Модал товара */}
          <AnimatePresence>
            {selected && (
              <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
                <motion.div className="relative glass rounded-2xl max-w-lg w-full overflow-hidden max-h-[90vh] overflow-y-auto"
                  initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 30 }}>
                  {/* Фото slider */}
                  <div className="relative aspect-square bg-white/5">
                    {selected.images && selected.images.length > 0 ? (
                      <>
                        <img src={selected.images[photoIndex]} alt={selected.name} className="w-full h-full object-contain" />
                        {selected.images.length > 1 && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); setPhotoIndex(Math.max(0, photoIndex - 1)); }}
                              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">←</button>
                            <button onClick={(e) => { e.stopPropagation(); setPhotoIndex(Math.min(selected.images.length - 1, photoIndex + 1)); }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70">→</button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                              {selected.images.map((_: string, idx: number) => (
                                <button key={idx} onClick={(e) => { e.stopPropagation(); setPhotoIndex(idx); }}
                                  className={`w-2 h-2 rounded-full ${idx === photoIndex ? 'bg-yellow-400' : 'bg-white/30'}`} />
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl text-white/10">📦</div>
                    )}
                    <button onClick={() => setSelected(null)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 text-lg">✕</button>
                  </div>

                  <div className="p-5">
                    <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{selected.name}</h2>
                    {selected.description && <p className="text-sm text-white/50 mb-4">{selected.description}</p>}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🪙</span>
                        <span className="text-3xl font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>{selected.price}</span>
                        <span className="text-sm text-white/30">коинов</span>
                      </div>
                      <div className="text-xs text-white/20">
                        У вас: <span className={userCoins >= selected.price ? 'text-green-400' : 'text-red-400'}>{userCoins} 🪙</span>
                      </div>
                    </div>

                    {buyMsg && (
                      <div className={`p-3 rounded-xl text-center text-sm mb-3 ${buyMsg.includes('✅') ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>{buyMsg}</div>
                    )}

                    <motion.button onClick={() => buyProduct(selected)} disabled={buying || !userId || userCoins < selected.price}
                      className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-30"
                      style={{ background: userCoins >= selected.price ? 'linear-gradient(135deg, #4ade80, #22c55e)' : 'rgba(255,255,255,0.05)', color: userCoins >= selected.price ? '#000' : 'rgba(255,255,255,0.3)' }}
                      whileHover={userCoins >= selected.price ? { scale: 1.02 } : {}} whileTap={userCoins >= selected.price ? { scale: 0.97 } : {}}>
                      {buying ? '⏳ Покупка...' : userCoins >= selected.price ? `🛒 Купить за ${selected.price} 🪙` : '❌ Не хватает коинов'}
                    </motion.button>

                    {!userId && <p className="text-xs text-white/20 text-center mt-2">Войдите в аккаунт чтобы покупать</p>}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
