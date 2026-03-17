import { RNG } from './rng.js'
import type { TopologyConfig, Page, Site } from './types.js'

export function generateTopology(config: TopologyConfig, rng: RNG): Site {
  switch (config.archetype) {
    case 'docs':
      return generateDocs(config, rng)
    case 'ecommerce':
      return generateEcommerce(config, rng)
    case 'news':
      return generateNews(config, rng)
  }
}

function generateDocs(config: TopologyConfig, rng: RNG): Site {
  const pages: Record<string, Page> = {}
  const sectionCount = config.sections
  const leavesPerSection = Math.floor((config.pageCount - 1 - sectionCount) / sectionCount)

  // Root page
  pages['/'] = { id: '/', section: -1, links: [], type: 'root' }

  // Section index pages
  const sectionIds: string[] = []
  for (let s = 0; s < sectionCount; s++) {
    const id = `/docs/section-${s}/`
    sectionIds.push(id)
    pages[id] = { id, section: s, links: [], type: 'section' }
    pages['/'].links.push(id)
  }

  // Leaf pages per section
  const sectionLeaves: Record<number, string[]> = {}
  for (let s = 0; s < sectionCount; s++) {
    sectionLeaves[s] = []
    for (let l = 0; l < leavesPerSection; l++) {
      const id = `/docs/section-${s}/page-${l}`
      sectionLeaves[s].push(id)
      pages[id] = { id, section: s, links: [], type: 'leaf' }
    }
  }

  // Wire section indexes: link to all leaves in section + other section indexes + root
  for (let s = 0; s < sectionCount; s++) {
    const sectionPage = pages[sectionIds[s]]
    sectionPage.links.push('/')
    for (const leaf of sectionLeaves[s]) {
      sectionPage.links.push(leaf)
    }
    for (const otherId of sectionIds) {
      if (otherId !== sectionIds[s]) sectionPage.links.push(otherId)
    }
  }

  // Wire leaf pages: link to section index + 2-3 siblings + root
  for (let s = 0; s < sectionCount; s++) {
    const leaves = sectionLeaves[s]
    for (let i = 0; i < leaves.length; i++) {
      const page = pages[leaves[i]]
      page.links.push(sectionIds[s])
      page.links.push('/')
      const siblingCount = rng.randomInt(2, Math.min(3, leaves.length - 1))
      const siblings = rng.shuffle(leaves.filter((_, idx) => idx !== i)).slice(0, siblingCount)
      page.links.push(...siblings)
    }
  }

  return validateSite({ pages, root: '/' })
}

function generateEcommerce(config: TopologyConfig, rng: RNG): Site {
  const pages: Record<string, Page> = {}
  const categoryCount = config.sections
  const productsPerCategory = Math.floor((config.pageCount - 3 - categoryCount) / categoryCount)

  // Root + utility pages
  pages['/'] = { id: '/', section: -1, links: [], type: 'root' }
  pages['/cart'] = { id: '/cart', section: -1, links: ['/', '/checkout'], type: 'utility' }
  pages['/checkout'] = { id: '/checkout', section: -1, links: ['/', '/cart'], type: 'utility' }

  // Category pages
  const categoryIds: string[] = []
  for (let c = 0; c < categoryCount; c++) {
    const id = `/category/${c}/`
    categoryIds.push(id)
    pages[id] = { id, section: c, links: ['/'], type: 'section' }
    pages['/'].links.push(id)
  }
  pages['/'].links.push('/cart')

  // Product pages
  const categoryProducts: Record<number, string[]> = {}
  for (let c = 0; c < categoryCount; c++) {
    categoryProducts[c] = []
    for (let p = 0; p < productsPerCategory; p++) {
      const id = `/category/${c}/product-${p}`
      categoryProducts[c].push(id)
      pages[id] = { id, section: c, links: [], type: 'leaf' }
    }
    // Category links to all its products
    pages[categoryIds[c]].links.push(...categoryProducts[c])
    // Category also links to root (already added) and other categories
    for (const otherId of categoryIds) {
      if (otherId !== categoryIds[c]) pages[categoryIds[c]].links.push(otherId)
    }
  }

  // Wire product pages: link to category, 3-5 related products (same category), cart
  for (let c = 0; c < categoryCount; c++) {
    const products = categoryProducts[c]
    for (let i = 0; i < products.length; i++) {
      const page = pages[products[i]]
      page.links.push(categoryIds[c])
      page.links.push('/cart')
      const relatedCount = rng.randomInt(3, Math.min(5, products.length - 1))
      const related = rng.shuffle(products.filter((_, idx) => idx !== i)).slice(0, relatedCount)
      page.links.push(...related)
    }
  }

  return validateSite({ pages, root: '/' })
}

function generateNews(config: TopologyConfig, rng: RNG): Site {
  const pages: Record<string, Page> = {}
  const sectionCount = Math.min(config.sections, 7)
  const articlesPerSection = Math.floor((config.pageCount - 1 - sectionCount) / sectionCount)

  // Root
  pages['/'] = { id: '/', section: -1, links: [], type: 'root' }

  // Section fronts
  const sectionIds: string[] = []
  for (let s = 0; s < sectionCount; s++) {
    const id = `/section/${s}/`
    sectionIds.push(id)
    pages[id] = { id, section: s, links: ['/'], type: 'section' }
    pages['/'].links.push(id)
  }

  // Articles per section
  const sectionArticles: Record<number, string[]> = {}
  for (let s = 0; s < sectionCount; s++) {
    sectionArticles[s] = []
    for (let a = 0; a < articlesPerSection; a++) {
      const id = `/section/${s}/article-${a}`
      sectionArticles[s].push(id)
      pages[id] = { id, section: s, links: [], type: 'leaf' }
    }
    // Section front links to its articles + other sections
    pages[sectionIds[s]].links.push(...sectionArticles[s])
    for (const otherId of sectionIds) {
      if (otherId !== sectionIds[s]) pages[sectionIds[s]].links.push(otherId)
    }
  }

  // Wire articles: link to section front + 2-3 related articles (mix same/cross section) + root
  const allArticles = Object.values(sectionArticles).flat()
  for (let s = 0; s < sectionCount; s++) {
    const articles = sectionArticles[s]
    for (let i = 0; i < articles.length; i++) {
      const page = pages[articles[i]]
      page.links.push(sectionIds[s])
      page.links.push('/')

      // 2-3 related: mix of same-section and cross-section
      const relatedCount = rng.randomInt(2, 3)
      const sameSection = rng.shuffle(articles.filter((_, idx) => idx !== i))
      const crossSection = rng.shuffle(allArticles.filter(a => pages[a].section !== s))

      const related: string[] = []
      for (let r = 0; r < relatedCount; r++) {
        if (rng.random() < 0.6 && sameSection.length > related.filter(x => pages[x].section === s).length) {
          const pick = sameSection.find(x => !related.includes(x))
          if (pick) related.push(pick)
          else if (crossSection.length > 0) related.push(crossSection.find(x => !related.includes(x))!)
        } else {
          const pick = crossSection.find(x => !related.includes(x))
          if (pick) related.push(pick)
          else if (sameSection.length > 0) related.push(sameSection.find(x => !related.includes(x))!)
        }
      }
      page.links.push(...related.filter(Boolean))
    }
  }

  return validateSite({ pages, root: '/' })
}

function validateSite(site: Site): Site {
  const pageIds = new Set(Object.keys(site.pages))
  for (const page of Object.values(site.pages)) {
    // Remove links to non-existent pages and deduplicate
    page.links = [...new Set(page.links.filter(l => pageIds.has(l) && l !== page.id))]
  }
  return site
}
