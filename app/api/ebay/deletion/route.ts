import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Next.js (App Router) – eBay Marketplace Account Deletion/Closure Notification Endpoint
 *
 * eBay requires all developers using their APIs to subscribe to marketplace
 * account deletion/closure notifications. This route handles:
 *
 *  GET  ?challenge_code=<code>
 *       eBay sends this to verify ownership of the endpoint. The response must
 *       contain the SHA-256 hash of (challengeCode + verificationToken + endpointUrl).
 *
 *  POST <notification payload>
 *       eBay sends deletion/closure notification JSON. We acknowledge with HTTP 200.
 *
 * ─── Deployment steps ────────────────────────────────────────────────────────
 * 1. Deploy this project to Vercel.
 * 2. In the Vercel dashboard add the environment variable:
 *      EBAY_VERIFICATION_TOKEN=<the token you created in the eBay Developer Portal>
 * 3. In the eBay Developer Portal → Notifications, enter the endpoint URL:
 *      https://<your-vercel-domain>/api/ebay/deletion
 * ─────────────────────────────────────────────────────────────────────────────
 */

const ENDPOINT_PATH = "/api/ebay/deletion";

export async function GET(req: NextRequest) {
  const challengeCode = req.nextUrl.searchParams.get("challenge_code");

  if (!challengeCode) {
    return NextResponse.json(
      { error: "Missing challenge_code parameter" },
      { status: 400 }
    );
  }

  const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
  if (!verificationToken) {
    return NextResponse.json(
      {
        error:
          "Verification token not configured. Set the EBAY_VERIFICATION_TOKEN environment variable in your Vercel dashboard.",
      },
      { status: 500 }
    );
  }

  // Derive the canonical endpoint URL from the incoming request so no
  // hard-coded domain is needed. req.nextUrl.origin gives us
  // "https://<your-vercel-domain>" on every deployment automatically.
  const endpointUrl = `${req.nextUrl.origin}${ENDPOINT_PATH}`;

  // eBay challenge response: SHA-256(challengeCode + verificationToken + endpointUrl)
  const challengeResponse = crypto
    .createHash("sha256")
    .update(challengeCode + verificationToken + endpointUrl)
    .digest("hex");

  return NextResponse.json({ challengeResponse });
}

export async function POST(req: NextRequest) {
  // eBay delivers marketplace account deletion/closure notifications here.
  // Acknowledge with HTTP 200. We intentionally avoid logging the request
  // body because it may contain PII (userId, username, etc.).
  console.log(
    "eBay deletion notification received at",
    new Date().toISOString()
  );

  return NextResponse.json({ acknowledged: true });
}
