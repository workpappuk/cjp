import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";

const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const googleOAuthClient = googleClientId ? new OAuth2Client(googleClientId) : null;

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
  providers: [
    ...(hasGoogleProvider
      ? [
          Google({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),
    Credentials({
      id: "google-one-tap",
      name: "Google One Tap",
      credentials: {
        credential: { label: "Credential", type: "text" },
      },
      async authorize(credentials) {
        const credential =
          typeof credentials?.credential === "string"
            ? credentials.credential
            : "";

        if (!credential || !googleOAuthClient) {
          return null;
        }

        try {
          const ticket = await googleOAuthClient.verifyIdToken({
            idToken: credential,
            audience: googleClientId,
          });

          const payload = ticket.getPayload();
          if (!payload?.sub || !payload.email) {
            return null;
          }

          return {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            image: payload.picture,
            idToken: credential,
          } as {
            id: string;
            email: string;
            name?: string;
            image?: string;
            idToken: string;
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.provider) {
        token.provider = account.provider;
      }

      if (account?.provider === "google-one-tap") {
        const typedUser = user as { idToken?: string } | undefined;
        if (typedUser?.idToken) {
          token.accessToken = typedUser.idToken;
        }
      } else if (account?.access_token) {
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
