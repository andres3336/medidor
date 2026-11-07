/**
 * Zero-dependency static server for local development.
 * Serves only public/ with cache disabled, matching the deployed site.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), 'public')
const HOST = process.env.HOST ?? '127.0.0.1'
const PORT = Number(process.env.PORT ?? 5173)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.md': 'text/markdown; charset=utf-8',
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  let pathname

  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad request')
    return
  }

  if (pathname.endsWith('/')) pathname += 'index.html'
  const filePath = normalize(join(ROOT, pathname))

  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Forbidden')
    return
  }

  try {
    const body = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Medidor AYA running at http://${HOST}:${PORT}`)
})
