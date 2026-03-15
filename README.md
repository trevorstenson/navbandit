# precog

LinUCB contextual bandit that learns which pages to prefetch per-user. Runs in a Service Worker, observes navigations, and feeds predictions into the [Speculation Rules API](https://developer.chrome.com/docs/web-platform/prerender-pages). No dependencies, no server.

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

`handleFetch` never calls `respondWith()` — it only observes navigations via `waitUntil()`, so it composes with your existing fetch handlers.

**Main thread** (`main.ts`):

```typescript
import { createBanditClient } from 'precog/client'

const cleanup = createBanditClient()
```

The client discovers same-origin links on each page, listens for predictions from the SW, and inserts `<script type="speculationrules">` (falling back to `<link rel="prefetch">`). When users navigate to a predicted URL, the SW records the reward automatically.

## Config

| Option | Default | Description |
|--------|---------|-------------|
| `alpha` | `1.0` | Exploration weight — higher = more exploration |
| `discount` | `0.95` | DUCB discount factor — lower = faster adaptation |
| `dimensions` | `8` | Context vector size |
| `topK` | `3` | URLs to prefetch per navigation |
| `pruneAfter` | `50` | Drop arms not seen in this many navigations |

## How it works

On each navigation the SW builds an 8-dimensional context vector (route hash, time of day, session depth, connection type, etc.) and scores all candidate URLs with LinUCB upper confidence bounds. The top-K predictions go to the main thread via `postMessage`, which inserts Speculation Rules grouped by confidence level (eager / moderate / conservative).

When a user navigates to a predicted URL the bandit gets reward=1 and updates the arm with Sherman-Morrison (incremental rank-1 update, no matrix inversion). DUCB discounting scales the design matrix so the model adapts when navigation patterns shift. State persists in IndexedDB across sessions.

## Browser support

- **Chrome/Edge 121+**: Speculation Rules API with eagerness levels
- **Other browsers**: falls back to `<link rel="prefetch">`

## License

MIT
