# precog

Contextual bandit prefetching. Learns which pages to prefetch per-user in real-time using LinUCB with DUCB discounting, integrated with the [Speculation Rules API](https://developer.chrome.com/docs/web-platform/prerender-pages).

Zero dependencies. Runs entirely in a Service Worker + main thread. No server required.

## Install

```bash
npm install precog
```

## Usage

**Service Worker** (`sw.ts`):

```typescript
import { createBanditSW } from 'precog/sw'

const bandit = createBanditSW({ discount: 0.95, alpha: 1.0 })
self.addEventListener('fetch', (e) => bandit.handleFetch(e))
self.addEventListener('message', (e) => bandit.handleMessage(e))
```

**Main thread** (`main.ts`):

```typescript
import { createBanditClient } from 'precog/client'

const cleanup = createBanditClient()
```

That's it. The client automatically:
- Discovers same-origin links on each page
- Listens for predictions from the SW
- Inserts `<script type="speculationrules">` (or `<link rel="prefetch">` fallback)
- Reports rewards when users navigate to predicted URLs

## Config

| Option | Default | Description |
|--------|---------|-------------|
| `alpha` | `1.0` | Exploration parameter — higher = more exploration |
| `discount` | `0.95` | DUCB discount factor — lower = faster adaptation to changing patterns |
| `dimensions` | `8` | Context vector size (don't change unless you know what you're doing) |
| `topK` | `3` | Number of URLs to prefetch per navigation |
| `pruneAfter` | `50` | Drop arms not seen in this many navigations |

## How it works

1. On each navigation, the SW builds an 8-dimensional context vector (route hash, time of day, session depth, connection type, etc.)
2. LinUCB scores all candidate URLs using upper confidence bounds — balancing exploitation (prefetch what's likely) with exploration (try uncertain options)
3. Top-K predictions are sent to the main thread via `postMessage`
4. The client inserts Speculation Rules grouped by confidence (eager/moderate/conservative)
5. When a user navigates to a predicted URL, reward=1 updates the bandit — Sherman-Morrison incremental updates, no matrix inversions
6. DUCB discounting lets the model adapt when user behavior changes over time
7. State persists in IndexedDB across sessions

## Browser support

- **Chrome/Edge 121+**: Full Speculation Rules API with eagerness levels
- **Other browsers**: Automatic fallback to `<link rel="prefetch">`

## License

MIT
