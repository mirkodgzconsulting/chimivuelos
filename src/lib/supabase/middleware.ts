
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Create the supabase client.
  // This client will handle refreshing the session if it's expired.
  // The refresh logic happens automatically when we access `getUser`.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          
          supabaseResponse = NextResponse.next({
            request,
          })
          
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.


  const {
    data: { user },
  } = await supabase.auth.getUser()

  const protectedPaths = [
    '/dashboard',
    '/agents',
    '/clients',
    '/flights',
    '/chimi-transfers',
    '/parcels'
  ]

  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isProtectedPath && !user) {
    // If user is not signed in and targeting a protected route, redirect to login
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Also protect server actions/API routes if necessary, but middleware is mainly for pages
  
  if (user) {
    if (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/') {
        // If user is signed in and visits login or root, redirect to dashboard
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new Response object with NextResponse.redirect, ensure cookies are handled (usually automatic for redirects unless we need to persist session refreshes)
  return supabaseResponse
}
