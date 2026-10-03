import { defineConfig, type Plugin } from 'vite';

/**
 * `vite dev` has no Cloudflare Pages runtime, so serve /api/* by calling the
 * same Function modules that ship to production.
 */
function pagesFunctionsDev(): Plugin {
  return {
    name: 'pages-functions-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = url.pathname.match(/^\/api\/([a-z]+)$/);
        if (!match) return next();
        try {
          const mod = await server.ssrLoadModule(`/functions/api/${match[1]}.ts`);
          const out: Response = await mod.onRequest({ request: new Request(url, { method: 'GET' }) });
          res.statusCode = out.status;
          for (const [key, value] of out.headers) res.setHeader(key, value);
          res.end(Buffer.from(await out.arrayBuffer()));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    }
  };
}

export default defineConfig({
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  plugins: [pagesFunctionsDev()]
});
