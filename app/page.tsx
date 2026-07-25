"use client";

import type { Theme } from "@/app/_context/theme-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Chip, Typography } from "@/app/_types/mtw";
import { useTheme } from "@/app/_context/theme-context";
import { createAuthSession, isAuthenticated, type SocialProvider } from "@/app/_utils/auth";

type SocialProviderOption = {
  id: SocialProvider;
  label: string;
  subLabel: string;
};

type AccentTheme = {
  blobA: string;
  blobB: string;
  badgeBorder: string;
  badgeText: string;
  headingText: string;
  chipColor: string;
  buttonColor: string;
};

function IconGlobe({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGoogleBadge() {
  return (
    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-700">
      G
    </span>
  );
}

function IconGithubBadge() {
  return (
    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs font-bold text-white">
      GH
    </span>
  );
}

function IconDiscordBadge() {
  return (
    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-300 bg-indigo-500 text-xs font-bold text-white">
      D
    </span>
  );
}

export default function MarketingPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const socialProviders: SocialProviderOption[] = [
    {
      id: "google",
      label: "Google",
      subLabel: "Best for personal creators",
    },
    {
      id: "github",
      label: "GitHub",
      subLabel: "Best for developer communities",
    },
    {
      id: "discord",
      label: "Discord",
      subLabel: "Best for real-time groups",
    },
  ];

  const accentThemes: Record<Theme, AccentTheme> = {
    orange: {
      blobA: "bg-orange-300/30",
      blobB: "bg-sky-300/20",
      badgeBorder: "border-orange-200",
      badgeText: "text-orange-700",
      headingText: "text-orange-900",
      chipColor: "orange",
      buttonColor: "orange",
    },
    emerald: {
      blobA: "bg-emerald-300/30",
      blobB: "bg-teal-300/20",
      badgeBorder: "border-emerald-200",
      badgeText: "text-emerald-700",
      headingText: "text-emerald-900",
      chipColor: "green",
      buttonColor: "green",
    },
    sky: {
      blobA: "bg-sky-300/30",
      blobB: "bg-indigo-300/20",
      badgeBorder: "border-sky-200",
      badgeText: "text-sky-700",
      headingText: "text-sky-900",
      chipColor: "blue",
      buttonColor: "blue",
    },
  };

  const activeTheme = accentThemes[theme] ?? accentThemes.orange;

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/pages/home");
    }
  }, [router]);

  const handleSocialLogin = (provider: SocialProvider) => {
    createAuthSession(provider);
    router.push("/pages/home");
  };

  const renderProviderBadge = (provider: SocialProvider) => {
    if (provider === "google") return <IconGoogleBadge />;
    if (provider === "github") return <IconGithubBadge />;
    return <IconDiscordBadge />;
  };

  return (
    <main className="relative overflow-hidden bg-slate-50 text-slate-800">
      <div className={`pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full blur-3xl ${activeTheme.blobA}`} />
      <div className={`pointer-events-none absolute top-40 right-0 h-80 w-80 rounded-full blur-3xl ${activeTheme.blobB}`} />

      <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 sm:px-10 lg:px-16">
          <div className={`flex items-center gap-2 ${activeTheme.headingText}`}>
            <IconGlobe className="h-5 w-5" />
            <Typography variant="paragraph" className={`text-base font-semibold ${activeTheme.headingText}`}>
              ThreadForge
            </Typography>
          </div>
          <div className="w-40">
            <label htmlFor="theme-select" className="sr-only">
              Theme
            </label>
            <select
              id="theme-select"
              value={theme}
              onChange={(event) => setTheme((event.target.value as Theme) ?? "orange")}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              aria-label="Theme"
            >
              <option value="orange">Sunrise</option>
              <option value="emerald">Forest</option>
              <option value="sky">Skyline</option>
            </select>
          </div>
        </div>
      </nav>

      <section className="mx-auto flex min-h-[88vh] w-full max-w-6xl flex-col justify-center px-6 py-20 sm:px-10 lg:px-16">
        <div className={`inline-flex w-fit items-center gap-2 rounded-full border bg-white/80 px-3 py-2 ${activeTheme.badgeBorder}`}>
          <Typography variant="small" className={`text-xs font-semibold uppercase tracking-[0.18em] ${activeTheme.badgeText}`}>
            New launch
          </Typography>
          <Chip value="Free Beta" size="sm" className="rounded-full" color={activeTheme.chipColor} />
        </div>

        <Typography
          variant="h1"
          className="mt-6 max-w-4xl text-4xl leading-[1.03] tracking-tight text-blue-gray-900 sm:text-5xl lg:text-7xl"
        >
          Build your tribe.
          <br />
          Own the conversation.
        </Typography>

        <Typography
          variant="lead"
          className="mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg"
        >
          Meet ThreadForge, a modern community platform inspired by Reddit. Launch topic channels, reward great contributors, and grow a loyal audience with smart moderation tools.
        </Typography>

        <div className="mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {socialProviders.map((provider) => (
            <Button
              key={provider.id}
              variant="outlined"
              color={activeTheme.buttonColor}
              className="h-auto rounded-2xl bg-white px-4 py-4 text-left"
              onClick={() => handleSocialLogin(provider.id)}
              aria-label={`Continue with ${provider.label}`}
            >
              <span className="flex items-center gap-3">
                {renderProviderBadge(provider.id)}
                <span className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">Continue with {provider.label}</span>
                  <span className="text-xs text-slate-500">{provider.subLabel}</span>
                </span>
              </span>
            </Button>
          ))}
        </div>

        <Typography
          variant="small"
          className="mt-3 text-sm text-slate-600"
        >
          Social sign-in only. Use Google, GitHub, or Discord with no password setup.
        </Typography>

        <div className="mt-10 grid max-w-3xl grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Card className="rounded-xl border border-rose-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-700">
                120k+ posts/day
              </Typography>
            </CardBody>
          </Card>
          <Card className="rounded-xl border border-sky-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-700">
                AI moderation
              </Typography>
            </CardBody>
          </Card>
          <Card className="rounded-xl border border-amber-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-700">
                Custom channels
              </Typography>
            </CardBody>
          </Card>
          <Card className="rounded-xl border border-emerald-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-700">
                Live threads
              </Typography>
            </CardBody>
          </Card>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-20 sm:px-10 lg:px-16">
        <Card className="rounded-3xl bg-white/90 shadow-2xl">
          <CardBody className="p-6 sm:p-8 lg:p-12">
            <Typography
              variant="h2"
              className="text-2xl tracking-tight text-blue-gray-900 sm:text-3xl"
            >
              Why creators switch to ThreadForge
            </Typography>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="rounded-2xl border border-slate-200 bg-amber-50 shadow-none">
                <CardBody className="p-5">
                  <Typography variant="h3" className="text-lg font-semibold text-blue-gray-900">
                    Channel-first communities
                  </Typography>
                  <Typography variant="small" className="mt-2 text-sm leading-7 text-slate-700">
                    Spin up niche channels in seconds and let members self-organize around topics they care about.
                  </Typography>
                </CardBody>
              </Card>

              <Card className="rounded-2xl border border-slate-200 bg-sky-50 shadow-none">
                <CardBody className="p-5">
                  <Typography variant="h3" className="text-lg font-semibold text-blue-gray-900">
                    Trust scoring
                  </Typography>
                  <Typography variant="small" className="mt-2 text-sm leading-7 text-slate-700">
                    Reward thoughtful posts with dynamic reputation, badges, and visibility boosts.
                  </Typography>
                </CardBody>
              </Card>

              <Card className="rounded-2xl border border-slate-200 bg-rose-50 shadow-none">
                <CardBody className="p-5">
                  <Typography variant="h3" className="text-lg font-semibold text-blue-gray-900">
                    Growth automations
                  </Typography>
                  <Typography variant="small" className="mt-2 text-sm leading-7 text-slate-700">
                    Auto-highlight trending threads and send weekly digest emails that pull users back in.
                  </Typography>
                </CardBody>
              </Card>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-24 sm:px-10 lg:px-16">
        <Card color={activeTheme.buttonColor} className="rounded-3xl text-white shadow-none">
          <CardBody className="flex flex-col gap-8 px-6 py-10 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
            <div>
              <Typography
                variant="h3"
                className="text-2xl tracking-tight text-white sm:text-3xl"
              >
                Claim your free launch spot
              </Typography>
              <Typography variant="small" className="mt-3 max-w-xl text-sm leading-7 text-white/95 sm:text-base">
                Join creators, developers, and communities already migrating from fragmented forums to one focused home.
              </Typography>
            </div>
            <Button
              color="white"
              className="w-full rounded-2xl px-6 py-4 text-sm font-semibold text-blue-gray-900 sm:w-auto"
              onClick={() => handleSocialLogin("google")}
              aria-label="Continue with Google"
            >
              <span className="inline-flex items-center gap-2">
                <IconGoogleBadge />
                Continue with Google
              </span>
            </Button>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
