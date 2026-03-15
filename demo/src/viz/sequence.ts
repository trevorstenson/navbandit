/**
 * Deterministic navigation sequence designed to showcase navbandit's advantage.
 *
 * The user has a clear habit: Home → Posts → Hello World → back to Posts → Home.
 * Naive wastes bandwidth prefetching every link on every page.
 * The bandit quickly learns the loop and only prefetches what matters.
 */
export const NAVIGATION_SEQUENCE: string[] = [
  // Phase 1: Teach the pattern (steps 1-8)
  '/posts', '/posts/hello', '/posts', '/',
  '/posts', '/posts/hello', '/posts', '/',

  // Phase 2: Reinforce (steps 9-16)
  '/posts', '/posts/hello', '/posts', '/',
  '/posts', '/posts/hello', '/posts', '/',

  // Phase 3: Locked in (steps 17-24)
  '/posts', '/posts/hello', '/posts', '/',
  '/posts', '/posts/hello', '/posts', '/',

  // Phase 4: Bandit is fully converged (steps 25-32)
  '/posts', '/posts/hello', '/posts', '/',
  '/posts', '/posts/hello', '/posts', '/',
]
