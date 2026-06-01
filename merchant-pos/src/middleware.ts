import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Used with `cloudflared --http-host-header` so each tunnel arrives with a
// distinct Host header. Merchant host requires Basic Auth; customer host is
// open (wallet-connect gates real interaction on that page).
const MERCHANT_HOST = "merchant.local";
const CUSTOMER_HOST = "customer.local";

// Operator MUST set SITE_PASSWORD_MERCHANT before exposing the merchant site
// publicly. We intentionally don't ship a default — an empty value causes the
// realm to reject every request (fails closed).
const MERCHANT_PASSWORD = process.env.SITE_PASSWORD_MERCHANT ?? "";
const CRED_MERCHANT = MERCHANT_PASSWORD ? `merchant:${MERCHANT_PASSWORD}` : null;

function unauthorized(realm: string) {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": `Basic realm="${realm}"` },
  });
}

function checkAuth(req: NextRequest, expected: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) return false;
  try {
    const decoded = atob(header.slice(6).trim());
    return decoded === expected;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase().split(":")[0];

  if (host === MERCHANT_HOST) {
    if (!CRED_MERCHANT) return unauthorized("Merchant POS — set SITE_PASSWORD_MERCHANT");
    if (!checkAuth(req, CRED_MERCHANT)) return unauthorized("Merchant POS");
    return NextResponse.next();
  }

  if (host === CUSTOMER_HOST) {
    // No auth — wallet-connect on the customer page gates real interaction.
    const url = req.nextUrl.clone();
    if (url.pathname === "/" || url.pathname === "") {
      url.pathname = "/customer";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Direct localhost / other hosts pass through unauthenticated
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
