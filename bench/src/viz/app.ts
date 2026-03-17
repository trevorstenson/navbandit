import { renderCharts, renderCards, renderTable } from './charts.js'
import type { BenchmarkResult } from '../types.js'

const fileInput = document.getElementById('fileInput') as HTMLInputElement
const content = document.getElementById('content') as HTMLDivElement
const status = document.getElementById('status') as HTMLSpanElement

// Try to load results.json automatically
async function tryAutoLoad() {
  try {
    const resp = await fetch('/results.json')
    if (resp.ok) {
      const data = await resp.json()
      loadData(data)
      status.textContent = 'Auto-loaded results.json'
    }
  } catch {
    // No auto-load available
  }
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const data = JSON.parse(text)
    loadData(data)
    status.textContent = `Loaded ${file.name}`
  } catch (e) {
    status.textContent = `Error: ${e}`
  }
})

function loadData(data: BenchmarkResult | BenchmarkResult[]) {
  const results = Array.isArray(data) ? data : [data]

  content.innerHTML = ''

  for (const result of results) {
    const section = document.createElement('div')
    section.style.marginBottom = '3rem'

    const heading = document.createElement('h2')
    heading.style.color = '#e6edf3'
    heading.style.marginBottom = '1.5rem'
    heading.textContent = `${result.topology.archetype.toUpperCase()} — ${result.trials} trials × ${result.navigationsPerTrial} navigations`
    section.appendChild(heading)

    // Summary cards
    const cardsDiv = document.createElement('div')
    cardsDiv.className = 'cards'
    section.appendChild(cardsDiv)
    renderCards(result, cardsDiv)

    // Charts
    const chartsDiv = document.createElement('div')
    chartsDiv.className = 'charts'
    section.appendChild(chartsDiv)
    renderCharts(result, chartsDiv)

    // Data table
    const tableHeading = document.createElement('h3')
    tableHeading.style.color = '#e6edf3'
    tableHeading.style.margin = '1.5rem 0 1rem'
    tableHeading.textContent = 'Full Results'
    section.appendChild(tableHeading)
    renderTable(result, section)

    content.appendChild(section)
  }
}

tryAutoLoad()
