import { Simulator } from './simulator'
import { blog, allSites } from './sites'
import type { Site } from './sites'
import { createNavPanel } from './panels/nav-panel'
import { createArmTable } from './panels/arm-table'
import { createContextPanel } from './panels/context-panel'
import { createPredictionPanel } from './panels/prediction-panel'
import { createEventLog } from './panels/event-log'
import { createControls } from './panels/controls'
import './styles.css'

let currentSite: Site = blog
const sim = new Simulator(currentSite)

// Create panel containers
const app = document.getElementById('app')!
app.innerHTML = `
  <header class="app-header">
    <h1>navbandit</h1>
    <span class="subtitle">contextual bandit debug dashboard</span>
  </header>
  <div id="controls-slot"></div>
  <div class="grid-top">
    <div id="nav-slot"></div>
    <div id="context-slot"></div>
  </div>
  <div id="arms-slot"></div>
  <div class="grid-bottom">
    <div id="predictions-slot"></div>
    <div id="log-slot"></div>
  </div>
`

// Initialize panels
const navPanel = createNavPanel(
  document.getElementById('nav-slot')!,
  currentSite,
  (url) => sim.navigate(url)
)

const armTable = createArmTable(document.getElementById('arms-slot')!)
const contextPanel = createContextPanel(document.getElementById('context-slot')!)
const predictionPanel = createPredictionPanel(document.getElementById('predictions-slot')!)
const eventLog = createEventLog(document.getElementById('log-slot')!)

const controls = createControls(document.getElementById('controls-slot')!, {
  onAlphaChange: (v) => sim.setConfig({ alpha: v }),
  onDiscountChange: (v) => sim.setConfig({ discount: v }),
  onTopKChange: (v) => sim.setConfig({ topK: v }),
  onSiteChange: (site) => {
    currentSite = site
    sim.setSite(site)
    controls.resetPlayState()
  },
  onReset: () => {
    sim.stopAutoPlay()
    sim.reset()
    controls.resetPlayState()
  },
  onAutoPlay: () => sim.startAutoPlay(),
  onStopAutoPlay: () => sim.stopAutoPlay(),
})

// Render loop
function render() {
  const snap = sim.snapshot()
  navPanel.update(snap, currentSite)
  armTable.update(snap)
  contextPanel.update(snap)
  predictionPanel.update(snap)
  eventLog.update(snap)
  controls.update(snap)
}

sim.addEventListener('change', render)
render() // initial render
