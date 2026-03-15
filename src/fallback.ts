/** Insert <link rel="prefetch"> elements for given URLs, removing stale ones */
export function insertPrefetchLinks(urls: string[]): void {
  // Remove existing navbandit prefetch links
  removePrefetchLinks()

  for (const url of urls) {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = url
    link.dataset.navbandit = 'true'
    document.head.appendChild(link)
  }
}

/** Remove all navbandit-managed prefetch links */
export function removePrefetchLinks(): void {
  const existing = document.querySelectorAll<HTMLLinkElement>('link[data-navbandit]')
  for (const el of existing) el.remove()
}
