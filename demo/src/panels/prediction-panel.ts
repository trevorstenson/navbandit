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
        prefetch: Object.entries(
          snap.predictions.reduce(
            (groups, p) => {
              ;(groups[p.eagerness] ??= []).push(p.url)
              return groups
            },
            {} as Record<string, string[]>
          )
        ).map(([eagerness, urls]) => ({ source: 'list', urls, eagerness })),
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
                    Score: ${p.score.toFixed(3)} &middot;
                    Confidence: ${(p.confidence * 100).toFixed(0)}%
                  </div>
                </div>
                <span class="eagerness-badge ${p.eagerness}">${p.eagerness}</span>
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
