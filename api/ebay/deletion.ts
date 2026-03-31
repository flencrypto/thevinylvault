/**
 * Vercel Edge Function – eBay Marketplace Account Deletion/Closure Notification Endpoint
 *
 * eBay requires all developers using their APIs to subscribe to marketplace
 * account deletion/closure notifications. This function handles:
 *
 *  GET  ?challenge_code=<code>
 *       eBay sends this to verify ownership of the endpoint. The response must
 *       contain the SHA-256 hash of (challengeCode + verificationToken + endpointUrl).
 *
 *  POST <notification payload>
 *       eBay sends deletion/closure notification JSON. We acknowledge with HTTP 200.
 *
 * ─── Deployment steps ────────────────────────────────────────────────────────
 * 1. Deploy this project to Vercel (it auto-detects Vite; no extra config needed).
 * 2. In the Vercel dashboard → Environment Variables, add:
 *      EBAY_VERIFICATION_TOKEN = <token you created in the eBay Developer Portal>
 * 3. In the eBay Developer Portal → Notifications, enter the endpoint URL:
 *      https://<your-vercel-domain>/api/ebay/deletion
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * This file lives in the root api/ directory, which is how Vercel serves
 * serverless/edge functions for non-Next.js projects. The route is:
 *   /api/ebay/deletion  →  api/ebay/deletion.ts
 */

export const config = { runtime: 'edge' };

const ENDPOINT_PATH = '/api/ebay/deletion';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const challengeCode = url.searchParams.get('challenge_code');
    if (!challengeCode) {
      return Response.json(
        { error: 'Missing challenge_code parameter' },
        { status: 400 },
      );
    }

    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
    if (!verificationToken) {
      return Response.json(
        {
          error:
            'Verification token not configured. Set the EBAY_VERIFICATION_TOKEN environment variable in your Vercel dashboard.',
        },
        { status: 500 },
      );
    }

    // Derive the canonical endpoint URL from the incoming request so no
    // hard-coded domain is needed. url.origin gives us
    // "https://<your-vercel-domain>" on every deployment automatically.
    const endpointUrl = `${url.origin}${ENDPOINT_PATH}`;

    // eBay challenge response: SHA-256(challengeCode + verificationToken + endpointUrl)
    // Uses the Web Crypto API available in the Edge runtime (no Node.js import needed).
    const encoder = new TextEncoder();
    const data = encoder.encode(challengeCode + verificationToken + endpointUrl);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const challengeResponse = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return Response.json({ challengeResponse });
  }

  if (req.method === 'POST') {
    // eBay delivers marketplace account deletion/closure notifications here.
    // Acknowledge with HTTP 200. We intentionally avoid logging the request
    // body because it may contain PII (userId, username, etc.).
    console.log('eBay deletion notification received at', new Date().toISOString());
    return Response.json({ acknowledged: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
