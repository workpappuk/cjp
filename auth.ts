import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import { randomUUID } from "crypto";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

const hasGoogleProvider = Boolean(
  googleClientId && googleClientSecret,
);

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers: hasGoogleProvider
    ? [
        Google({
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        }),
      ]
    : [],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider) {
        token.provider = account.provider;
      }

      if (account?.access_token) {
        token.accessToken = account.access_token;
      } else if (!token.accessToken) {
        token.accessToken = `tf_${randomUUID()}`;
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken =
        typeof token.accessToken === "string" ? token.accessToken : "";
      session.provider =
        typeof token.provider === "string" ? token.provider : "google";
      return session;
    },
  },
};
