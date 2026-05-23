import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import fs from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      name: 'image-upload',
      configureServer(server) {
        // Serve src/assets/ as static files at /src/assets/ URL path
        const MIME: Record<string, string> = {
          '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
          '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.avif': 'image/avif',
        };
        server.middlewares.use('/src/assets', (req: any, res: any, next: any) => {
          if (req.method !== 'GET') { next(); return; }
          const url = req.url as string;
          // Let Vite handle module imports (they have query params like ?import, ?t=xxx)
          if (url.includes('?')) { next(); return; }
          const filePath = path.resolve(__dirname, 'src/assets', url.replace(/^\//, ''));
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const mime = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
            res.end(fs.readFileSync(filePath));
          } else {
            next();
          }
        });

        server.middlewares.use('/api/upload', (req: any, res: any) => {
          if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            try {
              const { name, data } = JSON.parse(Buffer.concat(chunks).toString()) as { name: string; data: string };
              const base64 = data.split(',')[1];
              const ext = data.split(';')[0].split('/')[1]?.replace('jpeg','jpg') || 'jpg';
              const baseName = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
              const safeName = `${Date.now()}-${baseName}.${ext}`;
              const uploadDir = path.resolve(__dirname, 'src/assets');
              if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
              fs.writeFileSync(path.join(uploadDir, safeName), Buffer.from(base64, 'base64'));
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ url: `/src/assets/${safeName}` }));
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(e) }));
            }
          });
        });

        // Save stories to public/data.json
        server.middlewares.use('/api/save-data', (req: any, res: any) => {
          if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => {
            try {
              const body = Buffer.concat(chunks).toString();
              JSON.parse(body); // validate JSON
              const filePath = path.resolve(__dirname, 'public/data.json');
              fs.writeFileSync(filePath, body, 'utf8');
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(e) }));
            }
          });
        });
      },
    },
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
