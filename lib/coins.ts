import { supabase } from './supabase';

export interface CoinSettings {
  mode: string;
  win_coins: number;
  loss_coins: number;
  draw_coins: number;
}

export async function getCoinSettings(): Promise<CoinSettings[]> {
  const { data } = await supabase.from('coin_settings').select('*').order('mode');
  return data || [];
}

export async function updateCoinSettings(mode: string, win_coins: number, loss_coins: number, draw_coins: number) {
  await supabase.from('coin_settings').update({ win_coins, loss_coins, draw_coins, updated_at: new Date().toISOString() }).eq('mode', mode);
}

export async function awardCoins(userId: string, mode: string, result: 'win' | 'loss' | 'draw') {
  // Получаем настройки для этого режима
  const { data: settings } = await supabase.from('coin_settings').select('*').eq('mode', mode).single();
  if (!settings) return 0;

  const coins = result === 'win' ? settings.win_coins : result === 'loss' ? settings.loss_coins : settings.draw_coins;

  // Обновляем коины пользователя
  const { data: profile } = await supabase.from('profiles').select('coins').eq('id', userId).single();
  const currentCoins = profile?.coins || 0;
  const newCoins = Math.max(0, currentCoins + coins); // Не меньше 0

  await supabase.from('profiles').update({ coins: newCoins }).eq('id', userId);

  return coins;
}

export async function setUserCoins(userId: string, coins: number) {
  await supabase.from('profiles').update({ coins: Math.max(0, coins) }).eq('id', userId);
}

export async function getUserCoins(userId: string): Promise<number> {
  const { data } = await supabase.from('profiles').select('coins').eq('id', userId).single();
  return data?.coins || 0;
}
