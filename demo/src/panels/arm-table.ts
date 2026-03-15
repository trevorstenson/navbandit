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

      const maxUCB = Math.max(...snap.arms.filter((a) => isFinite(a.ucb)).map((a) => a.ucb), 0.01)

      content.innerHTML = `
        <table class="arm-table">
          <thead>
            <tr>
              <th class="col-url">URL</th>
              <th class="col-bar">UCB Score</th>
              <th class="col-ucb">Score</th>
              <th class="col-pulls">Pulls</th>
              <th class="col-conf">Hit Rate</th>
            </tr>
          </thead>
          <tbody>
            ${snap.arms
              .map((arm) => {
                const barPct = isFinite(arm.ucb) ? Math.min(100, (arm.ucb / maxUCB) * 100) : 100
                const ratePct = (arm.rewardRate * 100).toFixed(0)

                return `<tr class="${arm.isPredicted ? 'predicted-row' : ''}">
                  <td class="col-url" title="${arm.url}">${arm.url}</td>
                  <td class="col-bar">
                    <div class="score-bar-container">
                      <div class="score-bar-mean" style="width: ${barPct.toFixed(1)}%"></div>
                    </div>
                  </td>
                  <td class="col-ucb">${isFinite(arm.ucb) ? arm.ucb.toFixed(3) : '∞'}</td>
                  <td class="col-pulls">${arm.pulls}</td>
                  <td class="col-conf">
                    <span class="eagerness-badge ${arm.isPredicted ? 'eager' : 'moderate'}">${ratePct}%</span>
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
