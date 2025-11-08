export interface NewsArticle {
  title: string
  url: string
  source: string
  publishedAt: Date
  content?: string
  imageUrl?: string
  categories: string[]
  teamNames?: string[] // Team names extracted by AI
}

export interface RSSSource {
  name: string
  url: string
}
