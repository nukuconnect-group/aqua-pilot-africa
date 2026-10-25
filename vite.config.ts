import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
// These callbacks are serialized into the generated worker, not run in Node.
declare const self: { location: { origin: string } };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      // L'enregistrement passe uniquement par src/lib/pwaRegister.ts (gardes aperçu/dev).
      injectRegister: null,
      includeAssets: ['favicon.png', 'robots.txt'],
      workbox: {
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}'],
        cleanupOutdatedCaches: true,
        // Download updates silently, keep the current page's worker until it closes.
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin && !url.pathname.startsWith('/~oauth'),
            handler: 'NetworkFirst',
            options: { cacheName: 'app-pages', networkTimeoutSeconds: 5, expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 2
              },
              networkTimeoutSeconds: 5
            }
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 30
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/[^/]+-[a-zA-Z0-9_-]+\.(?:js|css)$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-resources',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7
              }
            }
          },
        ]
      },
      // Le manifeste unique reste public/manifest.json (déjà lié dans index.html).
      devOptions: {
        enabled: false
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Une seule copie de React, même si une dépendance en embarque une autre.
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  // Pré-optimise aussi les dépendances des modules chargés à la demande : sinon
  // Vite les découvre en cours de session, régénère ses chunks et l'aperçu
  // mélange deux versions de React (écran blanc, « reading 'useState' » sur null).
  optimizeDeps: {
    include: [
      "react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime",
      "react-router-dom", "@tanstack/react-query", "@supabase/supabase-js",
      "@radix-ui/react-accordion", "@radix-ui/react-alert-dialog", "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar", "@radix-ui/react-checkbox", "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu", "@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card", "@radix-ui/react-label", "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu", "@radix-ui/react-popover", "@radix-ui/react-progress",
      "@radix-ui/react-radio-group", "@radix-ui/react-scroll-area", "@radix-ui/react-select",
      "@radix-ui/react-separator", "@radix-ui/react-slider", "@radix-ui/react-slot",
      "@radix-ui/react-switch", "@radix-ui/react-tabs", "@radix-ui/react-toast",
      "@radix-ui/react-toggle", "@radix-ui/react-toggle-group", "@radix-ui/react-tooltip",
      "class-variance-authority", "clsx", "tailwind-merge", "cmdk", "date-fns", "date-fns/locale",
      "embla-carousel-react", "input-otp", "next-themes", "react-hook-form", "react-resizable-panels",
      "vaul", "lucide-react", "recharts", "sonner", "zod", "react-day-picker", "motion/react",
      "nanoid", "qrcode.react", "jsbarcode", "jspdf", "jspdf-autotable", "html2canvas",
      "html5-qrcode", "react-simple-maps", "streamdown", "use-stick-to-bottom", "eventsource-parser",
    ],
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
          ],
          'vendor-charts': ['recharts'],
          'vendor-form': ['react-hook-form', 'zod', '@hookform/resolvers'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          'vendor-tanstack': ['@tanstack/react-query'],
        },
      },
    },
    cssCodeSplit: true,
  },
}));
