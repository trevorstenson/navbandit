# navbandit

Learns which pages to prefetch by watching how users navigate your site. One script tag, zero config, under 3KB gzipped.

## Quick Start

```html
<script src="https://unpkg.com/navbandit"></script>
```

That's it. NavBandit will automatically:

1. Discover safe same-origin links on each page
2. Learn which links users actually click (per page)
3. Prefetch the most likely next pages before the user clicks
4. Get smarter with every navigation

## How it works

NavBandit uses [Thompson Sampling](https://en.wikipedia.org/wiki/Thompson_sampling) — a Bayesian algorithm that balances exploration (trying uncertain links) with exploitation (prefetching links that have been clicked before). Each page maintains its own set of arms — so predictions from `/pricing` are independent of predictions from `/docs`. A [UCB1](https://en.wikipedia.org/wiki/Multi-armed_bandit#Upper_confidence_bound) strategy is also available as a drop-in alternative.

**Prefetch strategy** (best available method, detected automatically):

1. [Speculation Rules API](https://developer.chrome.com/docs/web-platform/prerender-pages) on Chrome/Edge 121+
2. `<link rel="prefetch">` on browsers that support it
3. `fetch()` with low priority as a universal fallback

**Bandwidth-aware**: Respects `navigator.connection.saveData` and `effectiveType`. Backs off or disables prefetching on slow connections — the model still learns from clicks, so it's ready when bandwidth returns.

**State**: Persists in browser storage with automatic expiry. Each arm stores just 3 numbers (alpha, beta, lastSeen), so the footprint is tiny.

**Safety defaults**: NavBandit skips cross-origin links, links with query strings or fragments, non-`_self` targets, `download` links, and clearly destructive route patterns like logout/delete. Add `data-navbandit-prefetch="true"` to explicitly allow a safe route that would otherwise be skipped, or `data-navbandit="false"` to opt out of discovery.

## npm Install

```bash
npm install navbandit
```

```js
import 'navbandit'
```

Or reference the built file directly:

```html
<script src="node_modules/navbandit/dist/navbandit.global.js"></script>
```

## Advanced: Service Worker Mode

For sites that want contextual learning (predictions based on time of day, session depth, scroll behavior, connection type), NavBandit also offers a Service Worker mode using a [LinUCB contextual bandit](https://arxiv.org/abs/1003.0146) with IndexedDB persistence.

**Service Worker** (`sw.ts`):

```typescript
import { createBanditSW } from 'navbandit/sw'

const bandit = createBanditSW({ discount: 0.95, alpha: 1.0 })
self.addEventListener('fetch', (e) => bandit.handleFetch(e))
self.addEventListener('message', (e) => bandit.handleMessage(e))
```

`handleFetch` never calls `respondWith()`. It only observes navigations via `waitUntil()`, so it works alongside your existing fetch handlers.

**Main thread** (`main.ts`):

```typescript
import { createBanditClient } from 'navbandit/client'

const cleanup = createBanditClient()
```

### SW Mode Config

| Option | Default | Description |
|--------|---------|-------------|
| `alpha` | `1.0` | Exploration weight; higher values try more uncertain options |
| `discount` | `0.95` | DUCB discount factor; lower values adapt faster |
| `dimensions` | `8` | Context vector size |
| `topK` | `3` | URLs to prefetch per navigation |
| `pruneAfter` | `50` | Drop arms not seen in this many navigations |
| `maxStateAgeMs` | `2592000000` | Expire persisted SW state after this many ms |
| `maxTrackedLinks` | `100` | Maximum validated links accepted from a discovery message |

## Browser support

- **Chrome/Edge 121+**: Speculation Rules API with eagerness levels
- **Other modern browsers**: `<link rel="prefetch">` fallback
- **Everything else**: `fetch()` with low priority

## License

MIT
