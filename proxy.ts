import { convexAuthNextjsProxy, nextjsProxyRedirect } from "@/lib/convex-auth";

// Signed-in areas. Everything else (home, legal pages, webhooks) is public.
const PROTECTED_PREFIXES = ["/studio", "/studio-v2", "/settings", "/shops"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default convexAuthNextjsProxy(async (request, { isAuthenticated }) => {
  if (isProtected(request.nextUrl.pathname) && !(await isAuthenticated())) {
    return nextjsProxyRedirect(request, "/auth");
  }
});

export const config = {
  // /auth/* sets its own cookies and must stay out of the proxy. API routes
  // (Meta webhooks) don't use the session.
  matcher: ["/((?!auth(?:/|$)|api/|_next/static|_next/image|favicon.ico).*)"],
};
