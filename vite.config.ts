import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';
import zlib from 'zlib';

function createBrandPng(width: number, height: number, isMaskable: boolean): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  function crc32(buf: Buffer) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return (c ^ -1) >>> 0;
  }
  function chunk(type: string, data: Buffer) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  const pad = isMaskable ? Math.floor(width * 0.28) : Math.floor(width * 0.22);
  const gap = Math.floor(width * 0.04);
  const mid = Math.floor(width / 2);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + 1 + x * 4;
      let r = 15,
        g = 23,
        b = 42;
      const inBox1 = x >= pad && x < mid - gap && y >= pad && y < mid - gap;
      const inBox2 = x >= mid + gap && x < width - pad && y >= pad && y < mid - gap;
      const inBox3 = x >= pad && x < mid - gap && y >= mid + gap && y < height - pad;
      const inBox4 = x >= mid + gap && x < width - pad && y >= mid + gap && y < height - pad;
      if (inBox1) {
        r = 37;
        g = 99;
        b = 235;
      } else if (inBox2 || inBox3 || inBox4) {
        r = 248;
        g = 250;
        b = 252;
      }
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function ensurePwaIconsPlugin() {
  return {
    name: 'ensure-pwa-icons',
    buildStart() {
      const pubDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, {recursive: true});
      const files = [
        {name: 'pwa-192x192.png', w: 192, h: 192, mask: false},
        {name: 'pwa-512x512.png', w: 512, h: 512, mask: false},
        {name: 'pwa-maskable-512x512.png', w: 512, h: 512, mask: true},
        {name: 'apple-touch-icon.png', w: 180, h: 180, mask: false},
      ];
      for (const f of files) {
        const target = path.join(pubDir, f.name);
        if (!fs.existsSync(target)) {
          fs.writeFileSync(target, createBrandPng(f.w, f.h, f.mask));
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      ensurePwaIconsPlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          id: '/',
          name: 'کاوش | دستیار جامع زندگی (Kavosh Life OS)',
          short_name: 'کاوش',
          description:
            'اپلیکیشن جامع مدیریت تمرکز روزانه، کارها و عادت‌ها، برنامه ورزشی و مدیریت مالی شخصی',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          dir: 'rtl',
          lang: 'fa',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,otf}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
