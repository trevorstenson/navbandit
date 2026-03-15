export interface SitePage {
  title: string
  links: string[]
}

export interface Site {
  name: string
  pages: Record<string, SitePage>
}

export const blog: Site = {
  name: 'Blog',
  pages: {
    '/': { title: 'Home', links: ['/about', '/posts', '/contact'] },
    '/about': { title: 'About', links: ['/', '/posts'] },
    '/posts': { title: 'Posts', links: ['/', '/posts/hello', '/posts/world', '/posts/tips'] },
    '/posts/hello': { title: 'Hello World', links: ['/posts', '/'] },
    '/posts/world': { title: 'World News', links: ['/posts', '/contact'] },
    '/posts/tips': { title: 'Tips & Tricks', links: ['/posts', '/about'] },
    '/contact': { title: 'Contact', links: ['/', '/about'] },
  },
}

export const ecommerce: Site = {
  name: 'E-commerce',
  pages: {
    '/': { title: 'Home', links: ['/products', '/cart', '/about'] },
    '/products': { title: 'Products', links: ['/', '/products/shoes', '/products/shirts', '/products/hats'] },
    '/products/shoes': { title: 'Shoes', links: ['/products', '/cart'] },
    '/products/shirts': { title: 'Shirts', links: ['/products', '/cart'] },
    '/products/hats': { title: 'Hats', links: ['/products', '/cart'] },
    '/cart': { title: 'Cart', links: ['/', '/checkout'] },
    '/checkout': { title: 'Checkout', links: ['/cart', '/'] },
    '/about': { title: 'About Us', links: ['/'] },
  },
}

export const allSites: Site[] = [blog, ecommerce]
