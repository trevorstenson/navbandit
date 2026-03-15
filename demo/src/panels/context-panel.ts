import type { SimSnapshot } from '../simulator'

export function createContextPanel(container: HTMLElement) {
  container.innerHTML = '<div class="panel context-panel"><h2>Context Vector</h2><div class="context-content"></div></div>'
  const content = container.querySelector('.context-content')!

  return {
    update(snap: SimSnapshot) {
      content.innerHTML = snap.contextLabels
        .map((label, i) => {
          const value = snap.context[i] ?? 0
          const pct = (value * 100).toFixed(1)
          return `
            <div class="context-row">
              <span class="context-label">${label}</span>
              <div class="context-bar-container">
                <div class="context-bar" style="width: ${pct}%"></div>
              </div>
              <span class="context-value">${value.toFixed(2)}</span>
            </div>
          `
        })
        .join('')
    },
  }
}
