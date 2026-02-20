
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

  // Define route groups
  const adminPaths = [
    '/dashboard',
    '/agents',
    '/clients',
    '/admin',
    '/chimi-vuelos',
    '/chimi-giros',
    '/chimi-encomiendas'
  ]
  const clientPaths = ['/portal']

  const pathname = request.nextUrl.pathname
  const isAdminPath = adminPaths.some(path => pathname.startsWith(path))
  const isClientPath = clientPaths.some(path => pathname.startsWith(path))
  const isAuthPath = pathname === '/login' || pathname === '/'

  // User Role
  const role = user?.user_metadata?.role || 'client'

  // 1. SESSION CHECK: If no user and trying to access any protected path
  if (!user && (isAdminPath || isClientPath)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    const response = NextResponse.redirect(url)
    // Even if no user, we might want to clear old cookies/headers
    return response
  }

  // 2. ROLE CHECK: If user is logged in
  if (user) {
    // Prevent clients from entering Admin areas
    if (isAdminPath && role === 'client') {
      const url = request.nextUrl.clone()
      url.pathname = '/portal'
      const response = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie.name, cookie.value))
      return response
    }

    // Prevent Admins/Agents from entering Client portal
    if (isClientPath && role !== 'client') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      const response = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie.name, cookie.value))
      return response
    }

    // 3. AUTH PAGE REDIRECT: Redirect already logged in users to their respective homes
    if (isAuthPath) {
      const url = request.nextUrl.clone()
      url.pathname = role === 'client' ? '/portal' : '/dashboard'
      
      const response = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        response.cookies.set(cookie.name, cookie.value)
      })
      return response
    }
  }

  return supabaseResponse
}
