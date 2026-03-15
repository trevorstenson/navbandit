import type { SimSnapshot } from '../simulator'
import type { Site } from '../sites'
import { allSites } from '../sites'

interface ControlCallbacks {
  onAlphaChange: (v: number) => void
  onTopKChange: (v: number) => void
  onSiteChange: (site: Site) => void
  onReset: () => void
  onAutoPlay: () => void
  onStopAutoPlay: () => void
}

export function createControls(container: HTMLElement, callbacks: ControlCallbacks) {
  container.innerHTML = `
    <div class="panel controls-panel">
      <div class="controls-row">
        <div class="control-group">
          <label>Site
            <select id="ctl-site">
              ${allSites.map((s, i) => `<option value="${i}">${s.name}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="control-group">
          <label>Alpha (exploration)
            <input type="range" id="ctl-alpha" min="0.1" max="5" step="0.1" value="1.5">
            <span id="ctl-alpha-val">1.5</span>
          </label>
        </div>
        <div class="control-group">
          <label>Top-K
            <input type="range" id="ctl-topk" min="1" max="5" step="1" value="3">
            <span id="ctl-topk-val">3</span>
          </label>
        </div>
        <div class="control-group control-buttons">
          <button id="ctl-autoplay">Auto-play</button>
          <button id="ctl-reset">Reset</button>
          <span id="ctl-step" class="step-counter">Step 0</span>
        </div>
      </div>
    </div>
  `

  const alphaSlider = container.querySelector<HTMLInputElement>('#ctl-alpha')!
  const alphaVal = container.querySelector('#ctl-alpha-val')!
  const topkSlider = container.querySelector<HTMLInputElement>('#ctl-topk')!
  const topkVal = container.querySelector('#ctl-topk-val')!
  const siteSelect = container.querySelector<HTMLSelectElement>('#ctl-site')!
  const autoplayBtn = container.querySelector<HTMLButtonElement>('#ctl-autoplay')!
  const resetBtn = container.querySelector<HTMLButtonElement>('#ctl-reset')!

  alphaSlider.addEventListener('input', () => {
    const v = parseFloat(alphaSlider.value)
    alphaVal.textContent = v.toFixed(1)
    callbacks.onAlphaChange(v)
  })

  topkSlider.addEventListener('input', () => {
    const v = parseInt(topkSlider.value)
    topkVal.textContent = String(v)
    callbacks.onTopKChange(v)
  })

  siteSelect.addEventListener('change', () => {
    callbacks.onSiteChange(allSites[parseInt(siteSelect.value)])
  })

  resetBtn.addEventListener('click', () => callbacks.onReset())

  let playing = false
  autoplayBtn.addEventListener('click', () => {
    if (playing) {
      callbacks.onStopAutoPlay()
      autoplayBtn.textContent = 'Auto-play'
      autoplayBtn.classList.remove('active')
    } else {
      callbacks.onAutoPlay()
      autoplayBtn.textContent = 'Stop'
      autoplayBtn.classList.add('active')
    }
    playing = !playing
  })

  return {
    update(snap: SimSnapshot) {
      container.querySelector('#ctl-step')!.textContent = `Step ${snap.stepCount}`
    },
    resetPlayState() {
      playing = false
      autoplayBtn.textContent = 'Auto-play'
      autoplayBtn.classList.remove('active')
    },
  }
}
