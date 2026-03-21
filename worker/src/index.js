/**
 * Susi-App CORS-Proxy — Cloudflare Worker
 *
 * Routing (identisch zum lokalen Python-Proxy):
 *   /sipgate/...       → https://api.sipgate.com/v2/...
 *   /letterxpress/...  → https://api.letterxpress.de/v3/...
 *   /...               → https://api.lexware.io/v1/...
 */

export default {
  async fetch(request, env) {
    // Origin prüfen
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0];

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    let targetUrl;

    if (path.startsWith('/sipgate/')) {
      targetUrl = env.SIPGATE_BASE + path.slice('/sipgate'.length);
    } else if (path.startsWith('/sipgate')) {
      targetUrl = env.SIPGATE_BASE + path.slice('/sipgate'.length);
    } else if (path.startsWith('/letterxpress/')) {
      targetUrl = env.LETTERXPRESS_BASE + path.slice('/letterxpress'.length);
    } else if (path.startsWith('/letterxpress')) {
      targetUrl = env.LETTERXPRESS_BASE + path.slice('/letterxpress'.length);
    } else {
      // Alles andere → Lexoffice
      targetUrl = env.LEXOFFICE_BASE + path;
    }

    // Query-String weiterleiten
    if (url.search) {
      targetUrl += url.search;
    }

    // Request an Ziel-API weiterleiten
    const headers = new Headers();
    const auth = request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);
    headers.set('Accept', request.headers.get('Accept') || 'application/json');

    const contentType = request.headers.get('Content-Type');
    if (contentType) headers.set('Content-Type', contentType);

    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      body = await request.arrayBuffer();
    }

    try {
      const resp = await fetch(targetUrl, {
        method: request.method,
        headers,
        body,
      });

      const responseHeaders = new Headers(resp.headers);
      responseHeaders.set('Access-Control-Allow-Origin', corsOrigin);
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');

      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin,
        },
      });
    }
  },
};
