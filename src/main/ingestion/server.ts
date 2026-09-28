import { timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import type { Clock } from '../../domain/lifecycle';
import type { OfficeProjection } from '../../domain/office-reducer';
import { adaptCursorHook, sanitizeCursorPayload } from '../cursor/cursor-adapter';
import type { OfficeStore } from '../storage/office-store';

export const MAX_BODY_BYTES = 64 * 1024;

export interface IngestionServer {
  port: number;
  close: () => Promise<void>;
}

export interface IngestionDeps {
  token: string;
  store: OfficeStore;
  clock: Clock;
  onProjection?: (projection: OfficeProjection) => void;
}

/**
 * Loopback ingestion endpoint. Authenticates before JSON parsing.
 * Never logs request bodies or tokens.
 */
export function startIngestionServer(deps: IngestionDeps): Promise<IngestionServer> {
  const server = http.createServer((req, res) => {
    void handle(req, res, deps);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind ingestion server'));
        return;
      }
      resolve({
        port: address.port,
        close: () =>
          new Promise((resClose, rejClose) => {
            server.close((err) => (err ? rejClose(err) : resClose()));
          }),
      });
    });
  });
}

async function handle(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: IngestionDeps,
): Promise<void> {
  try {
    if (req.method !== 'POST' || req.url !== '/ingest') {
      res.writeHead(404);
      res.end();
      return;
    }

    const auth = req.headers.authorization;
    if (!auth || !timingSafeEqualBearer(auth, deps.token)) {
      res.writeHead(401);
      res.end();
      return;
    }

    const body = await readBodyCapped(req, MAX_BODY_BYTES);
    if (body === null) {
      res.writeHead(413);
      res.end();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    const hookNameHeader = req.headers['x-cursor-office-hook'];
    const hookName = typeof hookNameHeader === 'string' ? hookNameHeader : '';
    const sanitized = sanitizeCursorPayload(parsed);
    if (!sanitized) {
      res.writeHead(204);
      res.end();
      return;
    }

    const fact = adaptCursorHook(hookName, sanitized, deps.clock.now());
    if (!fact) {
      res.writeHead(204);
      res.end();
      return;
    }

    const result = deps.store.ingest(fact);
    deps.onProjection?.(result.projection);
    res.writeHead(204);
    res.end();
  } catch {
    // Fail open from Cursor's perspective — the wrapper already returned.
    if (!res.headersSent) {
      res.writeHead(500);
      res.end();
    }
  }
}

function readBodyCapped(
  req: http.IncomingMessage,
  maxBytes: number,
): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let overflow = false;
    let settled = false;

    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on('data', (chunk: Buffer) => {
      if (overflow) {
        return;
      }
      total += chunk.length;
      if (total > maxBytes) {
        overflow = true;
        chunks.length = 0;
        // Stop consuming; still wait for end so we can answer 413 cleanly.
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (overflow) {
        settle(null);
        return;
      }
      settle(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', () => settle(null));
  });
}

function timingSafeEqualBearer(header: string, token: string): boolean {
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) {
    return false;
  }
  const provided = header.slice(prefix.length);
  const a = Buffer.from(provided);
  const b = Buffer.from(token);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
