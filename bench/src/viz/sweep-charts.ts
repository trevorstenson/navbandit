import type { SweepResult, StrategyId } from '../types.js'

const NETWORKS_ORDER = ['fast-wifi', 'cable', '4g', '3g']
const PAGES_ORDER = ['50KB', '200KB', '500KB', '1000KB']

export function renderSweepHeatmap(result: SweepResult, container: HTMLElement): void {
  const heading = document.createElement('h3')
  heading.style.color = '#e6edf3'
  heading.style.marginBottom = '1rem'
  heading.textContent = 'NavBandit vs Prefetch All: Latency Advantage'
  container.appendChild(heading)

  const desc = document.createElement('p')
  desc.style.color = '#8b949e'
  desc.style.marginBottom = '1rem'
  desc.style.fontSize = '0.85rem'
  desc.textContent = 'Green = NavBandit wins (lower latency). Red = Prefetch All wins. Intensity = magnitude of difference.'
  container.appendChild(desc)

  const table = document.createElement('table')
  table.style.borderCollapse = 'collapse'
  table.style.width = '100%'
  table.style.marginBottom = '2rem'

  // Header row
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  headerRow.innerHTML = `<th style="padding:0.6rem;border:1px solid #30363d;background:#161b22;color:#8b949e">Network ↓ / Page →</th>`
  for (const page of PAGES_ORDER) {
    headerRow.innerHTML += `<th style="padding:0.6rem;border:1px solid #30363d;background:#161b22;color:#8b949e">${page}</th>`
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  // Data rows
  const tbody = document.createElement('tbody')
  for (const net of NETWORKS_ORDER) {
    const row = document.createElement('tr')
    row.innerHTML = `<td style="padding:0.6rem;border:1px solid #30363d;background:#161b22;color:#c9d1d9;font-weight:600">${net}</td>`

    for (const page of PAGES_ORDER) {
      const pageKB = parseInt(page)
      const scenario = result.scenarios.find(
        s => s.scenario.network.label === net && s.scenario.pageWeight.pageSizeKB === pageKB
      )

      if (!scenario) {
        row.innerHTML += `<td style="padding:0.6rem;border:1px solid #30363d">-</td>`
        continue
      }

      const nbLat = scenario.strategies['navbandit'].mean.expectedLatencyMs
      const paLat = scenario.strategies['prefetch-all'].mean.expectedLatencyMs
      const delta = paLat - nbLat // positive = NavBandit wins
      const nbWins = delta > 0

      // Color intensity based on ratio
      const ratio = nbWins ? delta / Math.max(paLat, 1) : -delta / Math.max(nbLat, 1)
      const intensity = Math.min(1, ratio)
      const bg = nbWins
        ? `rgba(63, 185, 80, ${0.15 + intensity * 0.6})`
        : `rgba(248, 81, 73, ${0.15 + intensity * 0.6})`

      const winner = nbWins ? 'NB' : 'PA'
      const label = Math.abs(delta) < 1 ? 'tie' : `${winner} Δ${formatMs(Math.abs(delta))}`

      const cell = document.createElement('td')
      cell.style.cssText = `padding:0.6rem;border:1px solid #30363d;background:${bg};text-align:center;color:#e6edf3;font-size:0.85rem`
      cell.innerHTML = `<div>${formatMs(nbLat)} vs ${formatMs(paLat)}</div><div style="font-size:0.75rem;opacity:0.8">${label}</div>`
      row.appendChild(cell)
    }
    tbody.appendChild(row)
  }
  table.appendChild(tbody)
  container.appendChild(table)
}

export function renderSweepDetails(result: SweepResult, container: HTMLElement): void {
  const table = document.createElement('table')
  table.style.width = '100%'

  table.innerHTML = `
    <thead>
      <tr>
        <th>Network</th>
        <th>Page Size</th>
        <th>NB Hit Rate</th>
        <th>NB Latency</th>
        <th>PA Latency</th>
        <th>NB Instant%</th>
        <th>PA Instant%</th>
        <th>Winner</th>
        <th>Δ Latency</th>
      </tr>
    </thead>
    <tbody>
      ${result.scenarios.map(({ scenario, strategies }) => {
        const nb = strategies['navbandit']
        const pa = strategies['prefetch-all']
        const nbLat = nb.mean.expectedLatencyMs
        const paLat = pa.mean.expectedLatencyMs
        const delta = paLat - nbLat
        const winner = delta > 10 ? '<span style="color:#3fb950">NavBandit</span>'
          : delta < -10 ? '<span style="color:#f85149">Prefetch All</span>'
          : '<span style="color:#8b949e">Tie</span>'
        return `<tr>
          <td>${scenario.network.label}</td>
          <td>${scenario.pageWeight.pageSizeKB}KB</td>
          <td>${(nb.mean.hitRate * 100).toFixed(1)}%</td>
          <td>${formatMs(nbLat)}</td>
          <td>${formatMs(paLat)}</td>
          <td>${(nb.mean.instantNavRate * 100).toFixed(1)}%</td>
          <td>${(pa.mean.instantNavRate * 100).toFixed(1)}%</td>
          <td>${winner}</td>
          <td>${delta > 0 ? '+' : ''}${formatMs(delta)}</td>
        </tr>`
      }).join('')}
    </tbody>
  `
  container.appendChild(table)
}

function formatMs(ms: number): string {
  if (Math.abs(ms) < 1) return '0ms'
  if (Math.abs(ms) < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
