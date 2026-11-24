import {readFile} from 'node:fs/promises';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {extname} from 'node:path';

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

/** The caller resolves the file and applies the CSP for its own interface. */
export async function sendWebAsset(req: IncomingMessage, res: ServerResponse, target: string, assetPath: string) {
  const extension = extname(target);
  const fingerprinted = /^\/assets\/[\w.-]+-[\w-]{8}\.(m?js|css|svg|png|woff2)$/.test(assetPath);
  let bytes: Buffer | undefined;
  if (fingerprinted && (extension === '.js' || extension === '.mjs' || extension === '.css')) {
    res.setHeader('Vary', 'Accept-Encoding');
    const encodings = (req.headers['accept-encoding'] ?? '').split(',').map(entry => entry.trim());
    if (encodings.some(entry => /^gzip(?:\s*;\s*q\s*=\s*(?:1(?:\.0+)?|0\.\d*[1-9]\d*))?$/i.test(entry))) {
      try { bytes = await readFile(target + '.gzip'); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }
  if (bytes) res.setHeader('Content-Encoding', 'gzip');
  else bytes = await readFile(target);
  if (fingerprinted) res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.setHeader('Content-Type', mime[extension] ?? 'application/octet-stream');
  res.setHeader('Content-Length', bytes.length);
  res.end(bytes);
}
