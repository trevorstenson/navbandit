import type { SimSnapshot } from '../simulator'
import type { Site } from '../sites'

export function createNavPanel(
  container: HTMLElement,
  site: Site,
  onNavigate: (url: string) => void
) {
  container.innerHTML = '<div class="panel nav-panel"><h2>Navigation</h2><div class="nav-content"></div></div>'
  const content = container.querySelector('.nav-content')!

  return {
    update(snap: SimSnapshot, currentSite: Site) {
      const page = currentSite.pages[snap.currentPage]
      if (!page) return

      const predictedUrls = new Set(snap.predictions.map((p) => p.url))

      content.innerHTML = `
        <div class="current-page">
          <span class="page-label">Current:</span>
          <span class="page-title">${page.title}</span>
          <span class="page-path">${snap.currentPage}</span>
        </div>
        <div class="nav-links">
          <span class="links-label">Links on this page:</span>
          ${page.links
            .map((link) => {
              const isPredicted = predictedUrls.has(link)
              const linkPage = currentSite.pages[link]
              return `<button class="nav-link ${isPredicted ? 'predicted' : ''}" data-url="${link}">
                <span class="link-title">${linkPage?.title ?? link}</span>
                <span class="link-path">${link}</span>
                ${isPredicted ? '<span class="predicted-badge">predicted</span>' : ''}
              </button>`
            })
            .join('')}
        </div>
      `

      content.querySelectorAll<HTMLButtonElement>('.nav-link').forEach((btn) => {
        btn.addEventListener('click', () => onNavigate(btn.dataset.url!))
      })
    },
  }
}
