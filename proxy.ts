import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { randomUUID } from "crypto";
import logger from "./app/_lib/logger";

function isAdminToken(token: Record<string, unknown> | null) {
  if (!token) {
    return false;
  }

  return token.isAdmin === true || token.role === "admin";
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const correlationId = randomUUID(); // unique ID per request
  const { method, url, headers, nextUrl } = request;

  logger.info("🌐 Incoming request", {
    correlationId,
    method,
    url,
    pathname: nextUrl.pathname,
    query: nextUrl.searchParams.toString(),
    userAgent: headers.get("user-agent"),
    ip: headers.get("x-forwarded-for") || "unknown",
    host: headers.get("host"),
    contentType: headers.get("content-type"),
  });


  if (pathname.startsWith("/testing/public")) {
    return NextResponse.next();
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname.startsWith("/testing/protected/admin") && !isAdminToken(token)) {
    return NextResponse.redirect(new URL("/testing/protected", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-test-auth", "authenticated");

  if (typeof token.sub === "string" && token.sub) {
    response.cookies.set("tf-test-sub", token.sub, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: ["/testing/public/:path*", "/testing/protected/:path*"],
};
