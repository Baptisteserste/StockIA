import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Public routes do not require a Clerk session. Add API cron endpoint here so external
// schedulers (GitHub Actions, Cron jobs) can call it using our own bearer secret.
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
  // Allow the cron tick endpoint without Clerk auth. It performs its own Bearer check.
  '/api/cron/simulation-tick(.*)',
  // Allow the openrouter models endpoint (read-only, for UI)
  '/api/openrouter/models(.*)',
  // Public simulation page
  '/simulation(.*)'
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