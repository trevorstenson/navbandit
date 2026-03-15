import type { SimSnapshot } from '../simulator'

export function createPredictionPanel(container: HTMLElement) {
  container.innerHTML = '<div class="panel prediction-panel"><h2>Predictions</h2><div class="prediction-content"></div></div>'
  const content = container.querySelector('.prediction-content')!

  return {
    update(snap: SimSnapshot) {
      if (snap.predictions.length === 0) {
        content.innerHTML = '<div class="empty">No predictions yet</div>'
        return
      }

      const speculationRules = {
        prefetch: [{
          source: 'list',
          urls: snap.predictions.map((p) => p.url),
          eagerness: 'moderate',
        }],
      }

      content.innerHTML = `
        <div class="prediction-cards">
          ${snap.predictions
            .map(
              (p, i) => `
              <div class="prediction-card">
                <div class="prediction-rank">#${i + 1}</div>
                <div class="prediction-info">
                  <div class="prediction-url">${p.url}</div>
                  <div class="prediction-meta">
                    UCB Score: ${isFinite(p.score) ? p.score.toFixed(3) : '∞'}
                  </div>
                </div>
                <span class="eagerness-badge moderate">predicted</span>
              </div>
            `
            )
            .join('')}
        </div>
        <details class="spec-rules-details">
          <summary>Speculation Rules JSON</summary>
          <pre class="spec-rules-json">${JSON.stringify(speculationRules, null, 2)}</pre>
        </details>
      `
    },
  }
}
