import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession() обновляет auth cookies локально (без сетевого запроса)
  // Это КРИТИЧЕСКИ важно — без этого cookies протухают при навигации
  // НЕ используем getUser() — он делает сетевой запрос и вызывает race condition
  try {
    await supabase.auth.getSession();
  } catch {
    // Игнорируем ошибки — главное не ломать навигацию
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|puzzles/|stockfish/|icons/|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json|js|mp3|wasm)$).*)',
  ],
};
