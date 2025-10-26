// app/manifest.ts
export const runtime = 'nodejs'; // or omit, it is fine
export const dynamic = 'force-static'; // ensure it is static on the edge

export default function manifest() {
  return {
    name: 'APU Sports',
    short_name: 'APU Sports',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0A66C2',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
