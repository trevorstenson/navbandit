import type { SimSnapshot } from '../simulator'

export function createEventLog(container: HTMLElement) {
  container.innerHTML = '<div class="panel log-panel"><h2>Event Log</h2><div class="log-content"></div></div>'
  const content = container.querySelector('.log-content')!

  return {
    update(snap: SimSnapshot) {
      if (snap.log.length === 0) {
        content.innerHTML = '<div class="empty">Click a link to start navigating</div>'
        return
      }

      // Group log entries by step
      const groups: { step: number; entries: typeof snap.log }[] = []
      let currentStep = -1
      for (const entry of snap.log) {
        if (entry.step !== currentStep) {
          groups.push({ step: entry.step, entries: [] })
          currentStep = entry.step
        }
        groups[groups.length - 1].entries.push(entry)
      }

      content.innerHTML = groups
        .map(
          (g) => `
          <div class="log-group">
            <div class="log-step">#${g.step}</div>
            <div class="log-entries">
              ${g.entries
                .map((e) => {
                  const icon =
                    e.type === 'navigate'
                      ? '→'
                      : e.type === 'reward'
                        ? '✓'
                        : e.type === 'discover'
                          ? '+'
                          : '◎'
                  return `<div class="log-entry log-${e.type}"><span class="log-icon">${icon}</span> ${e.message}</div>`
                })
                .join('')}
            </div>
          </div>
        `
        )
        .join('')
    },
  }
}
