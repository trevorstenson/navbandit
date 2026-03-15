import type { SimSnapshot } from '../simulator'

export function createArmTable(container: HTMLElement) {
  container.innerHTML = '<div class="panel arm-panel"><h2>Arm Scores</h2><div class="arm-content"></div></div>'
  const content = container.querySelector('.arm-content')!

  return {
    update(snap: SimSnapshot) {
      if (snap.arms.length === 0) {
        content.innerHTML = '<div class="empty">No arms yet — navigate to discover links</div>'
        return
      }

      const maxUCB = Math.max(...snap.arms.map((a) => Math.abs(a.ucb)), 0.01)
      const maxMean = Math.max(...snap.arms.map((a) => Math.abs(a.mean)), 0.01)
      const maxExplore = Math.max(...snap.arms.map((a) => a.exploration), 0.01)
      const barScale = Math.max(maxMean + maxExplore, 0.01)

      content.innerHTML = `
        <table class="arm-table">
          <thead>
            <tr>
              <th class="col-url">URL</th>
              <th class="col-bar">Score (mean + exploration)</th>
              <th class="col-ucb">UCB</th>
              <th class="col-pulls">Pulls</th>
              <th class="col-conf">Confidence</th>
            </tr>
          </thead>
          <tbody>
            ${snap.arms
              .map((arm) => {
                const meanPct = Math.max(0, (arm.mean / barScale) * 100)
                const explorePct = (arm.exploration / barScale) * 100
                const confidence = arm.mean / (arm.mean + arm.exploration + 1e-9)
                const confPct = Math.max(0, Math.min(100, confidence * 100))
                const eagerness =
                  confidence > 0.7 ? 'eager' : confidence > 0.3 ? 'moderate' : 'conservative'

                return `<tr class="${arm.isPredicted ? 'predicted-row' : ''}">
                  <td class="col-url" title="${arm.url}">${arm.url}</td>
                  <td class="col-bar">
                    <div class="score-bar-container">
                      <div class="score-bar-mean" style="width: ${meanPct.toFixed(1)}%"></div>
                      <div class="score-bar-explore" style="width: ${explorePct.toFixed(1)}%; left: ${meanPct.toFixed(1)}%"></div>
                    </div>
                  </td>
                  <td class="col-ucb">${arm.ucb.toFixed(3)}</td>
                  <td class="col-pulls">${arm.pulls}</td>
                  <td class="col-conf">
                    <span class="eagerness-badge ${eagerness}">${confPct.toFixed(0)}%</span>
                  </td>
                </tr>`
              })
              .join('')}
          </tbody>
        </table>
      `
    },
  }
}
