import crypto from 'node:crypto'

/**
 * Netlify Function: eBay Marketplace Account Deletion/Closure Notification Endpoint
 *
 * eBay requires all developers using their APIs to subscribe to (or opt out of)
 * marketplace account deletion/closure notifications. This endpoint handles:
 *
 *  GET  ?challenge_code=<code>
 *       eBay sends this to verify ownership of the endpoint. The response must
 *       contain the SHA-256 hash of (challengeCode + verificationToken + endpointUrl).
 *
 *  POST <notification payload>
 *       eBay sends deletion/closure notification JSON. We acknowledge with HTTP 200.
 *
 * Environment variable required:
 *   EBAY_VERIFICATION_TOKEN — the verification token you set in the eBay Developer
 *   Portal when subscribing to notifications. Must match exactly.
 *
 * The public endpoint URL to register in the eBay Developer Portal is:
 *   https://<your-domain>/api/ebay/marketplace-deletion
 */

const ENDPOINT_PATH = '/api/ebay/marketplace-deletion'

interface Event {
  httpMethod: string
  queryStringParameters: Record<string, string> | null
  headers: Record<string, string>
  body: string | null
}

export const handler = async (event: Event) => {
  const jsonHeaders = { 'Content-Type': 'application/json' }

  if (event.httpMethod === 'GET') {
    const challengeCode = event.queryStringParameters?.challenge_code
    if (!challengeCode) {
      return {
        statusCode: 400,
        headers: jsonHeaders,
        body: JSON.stringify({ error: 'Missing challenge_code parameter' }),
      }
    }

    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN
    if (!verificationToken) {
      return {
        statusCode: 500,
        headers: jsonHeaders,
        body: JSON.stringify({
          error:
            'Verification token not configured. Set the EBAY_VERIFICATION_TOKEN environment variable in your Netlify dashboard.',
        }),
      }
    }

    // Reconstruct the canonical public URL that was registered in the eBay portal.
    // x-forwarded-host is set by Netlify's CDN; fall back to host header.
    const host = event.headers['x-forwarded-host'] || event.headers['host'] || ''
    const endpointUrl = `https://${host}${ENDPOINT_PATH}`

    // eBay challenge response: SHA-256(challengeCode + verificationToken + endpointUrl)
    const challengeResponse = crypto
      .createHash('sha256')
      .update(challengeCode + verificationToken + endpointUrl)
      .digest('hex')

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ challengeResponse }),
    }
  }

  if (event.httpMethod === 'POST') {
    // eBay delivers marketplace account deletion/closure notifications here.
    // Respond with HTTP 200 to acknowledge receipt.
    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ acknowledged: true }),
    }
  }

  return {
    statusCode: 405,
    headers: jsonHeaders,
    body: JSON.stringify({ error: 'Method not allowed' }),
  }
}
