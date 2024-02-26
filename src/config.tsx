import { Theme } from 'core/client/hooks'

export const enableRenderPerformanceDebugging = false

export const websocketsEnabled = true

export const defaultTheme: Theme = 'light'
export const forceTheme: Theme = 'light'

export const title = 'Next-Hearts'
export const description = 'Open-source multiplayer Hearts card game made with Next.js'

// Preconnect to load assets like fonts faster
export const preconnectURLs: { link: string; crossOrigin?: boolean }[] = [
	{ link: 'https://fonts.gstatic.com', crossOrigin: true },
	{ link: 'https://fonts.googleapis.com' },
]
