'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LOGIN_RE, normalizeLogin, SIGNUP_ERRORS, toAuthEmail } from '@/lib/loginRules';

export default function LoginPasswordForm({ onDone }: { onDone?: () => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const finish = () => (onDone ? onDone() : window.location.reload());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!login.trim() || !password) return setErr('Заполните логин и пароль');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: toAuthEmail(login), password });
        if (error) setErr(error.message.toLowerCase().includes('invalid') ? 'Неверный логин или пароль' : error.message);
        else finish();
        return;
      }
      if (!LOGIN_RE.test(normalizeLogin(login))) return setErr(SIGNUP_ERRORS.bad_login);
      if (password.length < 6) return setErr(SIGNUP_ERRORS.bad_password);
      const { data, error } = await supabase.functions.invoke('login-account', {
        body: { action: 'signup', login: normalizeLogin(login), password },
      });
      if (error || !data?.ok) {
        let code: string | undefined = data?.error;
        try {
          const ctx = (error as { context?: Response } | null)?.context;
          if (ctx) code = (await ctx.json())?.error;
        } catch {}
        return setErr(SIGNUP_ERRORS[code ?? ''] ?? 'Не удалось зарегистрироваться, попробуйте ещё раз');
      }
      const { error: e2 } = await supabase.auth.signInWithPassword({ email: toAuthEmail(login), password });
      if (e2) setErr(e2.message);
      else finish();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 text-left">
      <div className="flex rounded-xl bg-white/5 p-1 mb-4">
        {(['login', 'register'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setErr(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === m ? 'bg-white/15 text-white' : 'text-white/50'}`}>
            {m === 'login' ? 'Вход' : 'Регистрация'}
          </button>
        ))}
      </div>
      <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username"
        placeholder={mode === 'login' ? 'Логин или почта' : 'Придумайте логин'}
        className="w-full mb-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30" />
      {mode === 'register' && <p className="text-xs text-white/40 mb-2">3–20 символов: латиница, цифры и _</p>}
      <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Пароль"
        className="w-full mb-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30" />
      {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
      <button type="submit" disabled={busy}
        className="w-full py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/15 text-white disabled:opacity-50">
        {busy ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
      </button>
    </form>
  );
}
