"use client";

import type { Theme } from "@/app/_context/theme-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Button, Card, CardBody, Chip, Typography } from "@/app/_types/mtw";
import { useTheme } from "@/app/_context/theme-context";
import { createAuthSession, isAuthenticated, type SocialProvider } from "@/app/_utils/auth";
import { FaDiscord, FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { HiGlobeAlt } from "react-icons/hi2";
import GoogleTopRightSignIn from "@/app/_components/GoogleTopRightSignIn";

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

export default function MarketingPage() {
  const router = useRouter();
  const { status } = useSession();
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
    if (status === "authenticated" || isAuthenticated()) {
      router.replace("/pages/home");
    }
  }, [router, status]);

  const handleSocialLogin = (provider: SocialProvider) => {
    if (provider === "google") {
      void signIn("google", { callbackUrl: "/pages/home" });
      return;
    }

    createAuthSession(provider);
    router.push("/pages/home");
  };

  const renderProviderBadge = (provider: SocialProvider) => {
    if (provider === "google") {
      return (
        <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center">
          <FcGoogle className="h-5 w-5" />
        </span>
      );
    }

    if (provider === "github") {
      return (
        <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-white">
          <FaGithub className="h-4 w-4" />
        </span>
      );
    }

    return (
      <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-indigo-300 bg-indigo-500 text-white">
        <FaDiscord className="h-4 w-4" />
      </span>
    );
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-800">
      <GoogleTopRightSignIn />
      <div className={`pointer-events-none absolute -top-24 left-0 h-72 w-72 -translate-x-1/3 rounded-full blur-3xl ${activeTheme.blobA}`} />
      <div className={`pointer-events-none absolute bottom-0 right-0 h-96 w-96 translate-x-1/4 translate-y-1/4 rounded-full blur-3xl ${activeTheme.blobB}`} />

      <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 sm:px-10 lg:px-16">
          <div className={`flex items-center gap-2 ${activeTheme.headingText}`}>
            <HiGlobeAlt className="h-5 w-5" />
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

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-68px)] w-full max-w-6xl items-center px-6 py-12 sm:px-10 lg:px-16">
        <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
          <Card className="rounded-3xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/70">
            <CardBody className="p-6 sm:p-8">
              <div className={`inline-flex w-fit items-center gap-2 rounded-full border bg-white px-3 py-2 ${activeTheme.badgeBorder}`}>
                <Typography variant="small" className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${activeTheme.badgeText}`}>
                  Welcome
                </Typography>
                <Chip value="Social Login" size="sm" className="rounded-full" color={activeTheme.chipColor} />
              </div>

              <Typography
                variant="h2"
                className="mt-6 text-3xl leading-tight tracking-tight text-blue-gray-900 sm:text-4xl"
              >
                Sign in to ThreadForge
              </Typography>

              <Typography
                variant="small"
                className="mt-3 text-sm leading-7 text-slate-600"
              >
                Pick your account and join your communities in seconds. No password setup required.
              </Typography>

              <div className="mt-8 grid gap-3">
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
                className="mt-8 text-xs leading-6 text-slate-500"
              >
                By continuing, you agree to use social sign-in only with Google, GitHub, or Discord.
              </Typography>
            </CardBody>
          </Card>

          <div className="flex h-full flex-col justify-center rounded-3xl border border-white/40 bg-white/55 p-6 backdrop-blur-sm sm:p-8 lg:p-10">
            <div className={`flex items-center gap-2 ${activeTheme.headingText}`}>
                <HiGlobeAlt className="h-5 w-5" />
              <Typography variant="paragraph" className={`text-base font-semibold ${activeTheme.headingText}`}>
                ThreadForge
              </Typography>
            </div>

            <Typography
              variant="h1"
              className="mt-6 text-4xl leading-[1.03] tracking-tight text-blue-gray-900 sm:text-5xl lg:text-6xl"
            >
              Build your tribe.
              <br />
              Own the conversation.
            </Typography>

            <Typography
              variant="lead"
              className="mt-5 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg"
            >
              A modern community platform inspired by Reddit. Launch channels, reward contributors, and grow a loyal audience with smart moderation.
            </Typography>

            <div className="mt-8 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Card className="rounded-xl border border-rose-100 bg-white/90 shadow-none">
                <CardBody className="px-3 py-3 text-center">
                  <Typography variant="small" className="font-medium text-slate-700">
                    120k+ posts/day
                  </Typography>
                </CardBody>
              </Card>
              <Card className="rounded-xl border border-sky-100 bg-white/90 shadow-none">
                <CardBody className="px-3 py-3 text-center">
                  <Typography variant="small" className="font-medium text-slate-700">
                    AI moderation
                  </Typography>
                </CardBody>
              </Card>
              <Card className="rounded-xl border border-amber-100 bg-white/90 shadow-none">
                <CardBody className="px-3 py-3 text-center">
                  <Typography variant="small" className="font-medium text-slate-700">
                    Custom channels
                  </Typography>
                </CardBody>
              </Card>
              <Card className="rounded-xl border border-emerald-100 bg-white/90 shadow-none">
                <CardBody className="px-3 py-3 text-center">
                  <Typography variant="small" className="font-medium text-slate-700">
                    Live threads
                  </Typography>
                </CardBody>
              </Card>
            </div>

            <Typography variant="small" className="mt-8 text-sm text-slate-600">
              Join creators, developers, and communities moving from fragmented forums to one focused home.
            </Typography>
          </div>
        </div>
      </section>
    </main>
  );
}
