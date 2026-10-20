import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** Refresca la sesión de Supabase y redirige según esté o no autenticado. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(list: { name: string; value: string; options: CookieOptions }[]) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = path === '/login' || path === '/recuperar' || path === '/auth/callback';

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // Con sesión abierta no tiene sentido ver el login ni pedir un enlace.
  if (user && (path === '/login' || path === '/recuperar')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return response;
}
