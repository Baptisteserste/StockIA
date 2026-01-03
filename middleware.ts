import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes do not require a Clerk session. Add API cron endpoint here so external
// schedulers (GitHub Actions, Cron jobs) can call it using our own bearer secret.
const isPublicRoute = createRouteMatcher([
  // Auth pages
  '/sign-in(.*)',
  '/sign-up(.*)',

  // Public pages (accessible without login)
  '/',                    // Home - analyse rapide
  '/pricing(.*)',         // Pricing page
  '/privacy(.*)',         // Privacy policy (RGPD)
  '/terms(.*)',           // Terms of service
  '/simulation(.*)',      // Simulation pages (readonly for non-auth)
  '/simulation-v2(.*)',   // Simulation V2 pages

  // Public API endpoints (readonly)
  '/api/cron/simulation-tick(.*)',   // CRON - has its own Bearer check
  '/api/openrouter/models(.*)',      // Models list for UI
  '/api/simulation/status(.*)',      // Current simulation status (readonly)
  '/api/simulation/history(.*)',     // Simulation history (readonly)
  '/api/simulation/algo-config(.*)', // Algo config (GET only, PATCH protected in route)
  '/api/debug/(.*)',                 // Debug endpoints
  '/api/stock/(.*)',                 // Stock price data
  '/api/analyze-stock(.*)',          // Quick analysis (uses credits - checked in route)
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}