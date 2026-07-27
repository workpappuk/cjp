import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

function isAdminToken(token: Record<string, unknown> | null) {
  if (!token) {
    return false;
  }

  return token.isAdmin === true || token.role === "admin";
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
