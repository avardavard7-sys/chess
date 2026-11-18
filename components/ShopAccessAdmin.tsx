'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Person {
  id: string;
  username: string;
  shop_access: boolean;
  fullName?: string;
}

async function searchPeople(q: string): Promise<Person[]> {
  const like = `%${q.replace(/[%_]/g, ' ').trim()}%`;
  const [byNick, byName] = await Promise.all([
    supabase.from('profiles').select('id, username, shop_access').ilike('username', like).limit(20),
    supabase.from('school_students').select('full_name, profile_id').ilike('full_name', like).not('profile_id', 'is', null).limit(20),
  ]);
  const map = new Map<string, Person>();
  for (const p of (byNick.data as Person[]) || []) map.set(p.id, p);
  const students = ((byName.data as { full_name: string; profile_id: string }[]) || []).filter((s) => s.profile_id);
  const missing = students.map((s) => s.profile_id).filter((id) => !map.has(id));
  if (missing.length) {
    const { data } = await supabase.from('profiles').select('id, username, shop_access').in('id', missing);
    for (const p of (data as Person[]) || []) map.set(p.id, p);
  }
  for (const s of students) {
    const p = map.get(s.profile_id);
    if (p) p.fullName = s.full_name;
  }
  return [...map.values()];
}

export default function ShopAccessAdmin() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  const [allowed, setAllowed] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, username, shop_access').eq('shop_access', true).order('username');
    setAllowed((data as Person[]) || []);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const doSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setResults(await searchPeople(query).catch(() => []));
  };

  const setAccess = async (p: Person, value: boolean) => {
    setBusy(p.id);
    const { error } = await supabase.from('profiles').update({ shop_access: value }).eq('id', p.id);
    setBusy(null);
    if (error) return;
    setResults((r) => (r ? r.map((x) => (x.id === p.id ? { ...x, shop_access: value } : x)) : r));
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="glass p-5 rounded-2xl">
        <p className="text-sm text-white/50 mb-3">Найдите ученика по ФИО или нику и нажмите «Разрешить» — доступ к покупкам появится у него сразу.</p>
        <form onSubmit={doSearch} className="flex gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ФИО или ник пользователя"
            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30" />
          <button type="submit" className="px-5 rounded-xl bg-green-500/20 text-green-400 font-semibold hover:bg-green-500/30">Найти</button>
        </form>
        {results !== null && results.length === 0 && <p className="text-sm text-white/40 mt-3">Никого не найдено</p>}
        <div className="mt-3 divide-y divide-white/5">
          {(results || []).map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.fullName || p.username}</div>
                {p.fullName && <div className="text-xs text-white/40 truncate">@{p.username}</div>}
              </div>
              {p.shop_access ? (
                <span className="text-sm text-green-400">✓ уже есть доступ</span>
              ) : (
                <button onClick={() => setAccess(p, true)} disabled={busy === p.id}
                  className="px-4 py-1.5 rounded-lg bg-green-500 text-white text-sm font-semibold disabled:opacity-50">Разрешить</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass p-5 rounded-2xl">
        <h3 className="font-bold mb-2">Доступ к магазину есть: {allowed.length}</h3>
        {allowed.length === 0 && <p className="text-sm text-white/40">Пока никому не выдан доступ</p>}
        <div className="divide-y divide-white/5">
          {allowed.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <span>🛍️</span>
              <div className="flex-1 font-semibold truncate">{p.username}</div>
              <button onClick={() => setAccess(p, false)} disabled={busy === p.id}
                className="px-3 py-1.5 rounded-lg border border-red-400/50 text-red-400 text-sm disabled:opacity-50">Убрать доступ</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
