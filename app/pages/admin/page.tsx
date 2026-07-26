"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardBody, Typography } from "@/app/_types/mtw";
import AppNavbar from "@/app/_components/AppNavbar";
import { useTheme } from "@/app/_context/theme-context";
import { isAuthenticated } from "@/app/_utils/auth";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";

export default function AdminDashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const { theme } = useTheme();
  const { accent } = getThemeColorTokens(theme);

  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" && !isAuthenticated()) {
      router.replace("/");
      return;
    }

    let isMounted = true;

    const hydrate = async () => {
      setError("");

      try {
        const profileResponse = await fetch("/api/user-profile", { cache: "no-store" });
        if (!profileResponse.ok) {
          throw new Error("Failed profile check");
        }

        const profile = (await profileResponse.json()) as { isAdmin?: boolean };
        const nextIsAdmin = Boolean(profile.isAdmin);

        if (!isMounted) {
          return;
        }

        setIsAdmin(nextIsAdmin);

        if (!nextIsAdmin) {
          router.replace("/pages/home");
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setError("Failed to load admin profile.");
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [router, status]);

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        subtitle="Admin dashboard"
        maxWidthClassName="max-w-6xl"
        rightContent={(
          <div className="flex items-center gap-2">
            <Link
              href="/pages/admin"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${accent.activePill}`}
            >
              Dashboard
            </Link>
            <Link
              href="/pages/admin/moderation"
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accent.link}`}
            >
              Moderation
            </Link>
            <Link
              href="/pages/admin/audit"
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accent.link}`}
            >
              Audit
            </Link>
            <Link
              href="/pages/home"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Back to Home
            </Link>
          </div>
        )}
      />

      <div className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8 sm:px-10 lg:px-16">
        <section className={`space-y-4 rounded-2xl border bg-gradient-to-b from-white to-slate-50 p-4 sm:p-5 dark:from-slate-900 dark:to-slate-950 ${accent.section}`}>
          <div>
            <Typography variant="h4" className={accent.title}>
              Admin Dashboard
            </Typography>
            <Typography className="text-sm text-slate-700 dark:text-slate-200">
              Choose a workspace to manage moderation actions or inspect audit history.
            </Typography>
            {error ? <Typography className="pt-2 text-sm text-red-600">{error}</Typography> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Link href="/pages/admin/moderation" className="block">
              <Card className={`h-full border border-slate-200 bg-white shadow-none transition hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 ${accent.cardHover}`}>
                <CardBody className="space-y-2">
                  <Typography variant="h5" className={accent.title}>
                    Moderation
                  </Typography>
                  <Typography className="text-sm text-slate-700 dark:text-slate-200">
                    Review and update post, community, and comment moderation statuses.
                  </Typography>
                </CardBody>
              </Card>
            </Link>

            <Link href="/pages/admin/audit" className="block">
              <Card className={`h-full border border-slate-200 bg-white shadow-none transition hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 ${accent.cardHover}`}>
                <CardBody className="space-y-2">
                  <Typography variant="h5" className={accent.title}>
                    Audit
                  </Typography>
                  <Typography className="text-sm text-slate-700 dark:text-slate-200">
                    Explore delta history, actor details, and request traces from the audit database.
                  </Typography>
                </CardBody>
              </Card>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
