/**
 * Minimal static file server for the reference client.
 *
 * Deliberately dependency-free and deliberately paranoid: every request path
 * is resolved and then checked to still be inside a configured root, so
 * `../../etc/passwd` and symlink escapes both fail.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * Resolve a URL path inside a root directory, or null when it escapes.
 * @param {string} root absolute directory
 * @param {string} urlPath
 * @returns {Promise<string|null>}
 */
export async function resolveWithinRoot(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  // Strip the leading slash so `path.resolve` cannot treat it as absolute.
  const candidate = path.resolve(root, `.${path.posix.normalize(decoded)}`);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (candidate !== root && !candidate.startsWith(rootWithSep)) return null;

  try {
    // realpath defeats symlinks that point outside the root.
    const real = await fs.realpath(candidate);
    const realRoot = await fs.realpath(root);
    const realRootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
    if (real !== realRoot && !real.startsWith(realRootWithSep)) return null;
    return real;
  } catch {
    return null;
  }
}

/**
 * Create an HTTP server that serves one or more mounted directories.
 *
 * @param {{
 *   mounts: { prefix: string, root: string }[],
 *   index?: string,
 *   logger?: object,
 * }} config
 * @returns {import('node:http').Server}
 */
export function createStaticServer({ mounts, index = 'index.html', logger = console }) {
  const normalised = mounts.map((mount) => ({
    prefix: mount.prefix.endsWith('/') ? mount.prefix.slice(0, -1) : mount.prefix,
    root: path.resolve(mount.root),
  }));

  return http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' }).end('method not allowed');
      return;
    }

    const urlPath = (req.url ?? '/').split('?')[0];
    const mount = normalised.find(
      (m) => m.prefix === '' || urlPath === m.prefix || urlPath.startsWith(`${m.prefix}/`),
    );
    if (!mount) {
      res.writeHead(404).end('not found');
      return;
    }

    let relative = urlPath.slice(mount.prefix.length) || '/';
    if (relative.endsWith('/')) relative += index;

    try {
      const filePath = await resolveWithinRoot(mount.root, relative);
      if (!filePath) {
        res.writeHead(404).end('not found');
        return;
      }
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        res.writeHead(404).end('not found');
        return;
      }
      const type = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, {
        'content-type': type,
        'content-length': stat.size,
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(await fs.readFile(filePath));
    } catch (err) {
      logger.error?.('[static] failed to serve', urlPath, err);
      res.writeHead(500).end('internal error');
    }
  });
}
