"use client";

import type { Theme } from "./_context/theme-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Chip, Option, Select, Typography } from "../types/mtw";
import { FcGoogle } from "react-icons/fc";
import {
  HiBolt,
  HiChartBar,
  HiGlobeAlt,
  HiShieldCheck,
  HiSparkles,
  HiSwatch,
  HiUsers,
} from "react-icons/hi2";
import { useTheme } from "./_context/theme-context";


const AUTH_KEY = "threadforge-auth";

type AccentTheme = {
  blobA: string;
  blobB: string;
  badgeBorder: string;
  badgeText: string;
  headingText: string;
  chipColor: string;
  selectColor: string;
  buttonColor: string;
};

export default function MarketingPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const accentThemes: Record<Theme, AccentTheme> = {
    orange: {
      blobA: "bg-orange-300/30",
      blobB: "bg-sky-300/20",
      badgeBorder: "border-orange-200",
      badgeText: "text-orange-700",
      headingText: "text-orange-900",
      chipColor: "orange",
      selectColor: "orange",
      buttonColor: "orange",
    },
    emerald: {
      blobA: "bg-emerald-300/30",
      blobB: "bg-teal-300/20",
      badgeBorder: "border-emerald-200",
      badgeText: "text-emerald-700",
      headingText: "text-emerald-900",
      chipColor: "green",
      selectColor: "green",
      buttonColor: "green",
    },
    sky: {
      blobA: "bg-sky-300/30",
      blobB: "bg-indigo-300/20",
      badgeBorder: "border-sky-200",
      badgeText: "text-sky-700",
      headingText: "text-sky-900",
      chipColor: "blue",
      selectColor: "blue",
      buttonColor: "blue",
    },
  };

  const activeTheme = accentThemes[theme] ?? accentThemes.orange;

  useEffect(() => {
    if (window.localStorage.getItem(AUTH_KEY) === "google") {
      router.replace("/pages/pages/home");
    }
  }, [router]);

  const handleGoogleLogin = () => {
    window.localStorage.setItem(AUTH_KEY, "google");
    router.push("/pages/pages/home");
  };

  return (
    <main className="relative overflow-hidden bg-slate-50 text-slate-800">
      <div className={`pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full blur-3xl ${activeTheme.blobA}`} />
      <div className={`pointer-events-none absolute top-40 right-0 h-80 w-80 rounded-full blur-3xl ${activeTheme.blobB}`} />

      <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3 sm:px-10 lg:px-16">
          <div className={`flex items-center gap-2 ${activeTheme.headingText}`}>
            <HiGlobeAlt className="text-lg" aria-hidden="true" />
            <Typography variant="h6" className={activeTheme.headingText}>
              ThreadForge
            </Typography>
          </div>
          <div className="w-40">
            <Select
              label="Theme"
              value={theme}
              onChange={(value: string | undefined) => setTheme(value ?? "orange")}
              color={activeTheme.selectColor}
            >
              <Option value="orange">
                <span className="inline-flex items-center gap-2">
                  <HiSparkles aria-hidden="true" />
                  Sunrise
                </span>
              </Option>
              <Option value="emerald">
                <span className="inline-flex items-center gap-2">
                  <HiSwatch aria-hidden="true" />
                  Forest
                </span>
              </Option>
              <Option value="sky">
                <span className="inline-flex items-center gap-2">
                  <HiChartBar aria-hidden="true" />
                  Skyline
                </span>
              </Option>
            </Select>
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
          className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg"
        >
          Meet ThreadForge, a modern community platform inspired by Reddit. Launch topic channels, reward great contributors, and grow a loyal audience with smart moderation tools.
        </Typography>

        <div className="mt-10 flex w-full max-w-lg flex-col gap-3">
          <Button
            variant="outlined"
            color={activeTheme.buttonColor}
            className="h-13 rounded-2xl bg-white px-6 text-sm font-semibold"
            onClick={handleGoogleLogin}
          >
            <span className="inline-flex items-center gap-3">
              <FcGoogle className="text-xl" aria-hidden="true" />
              Continue with Google
            </span>
          </Button>
        </div>

        <Typography
          variant="small"
          className="mt-3 text-sm text-slate-500"
        >
          Google sign-in only. No password to remember and no credit card needed.
        </Typography>

        <div className="mt-10 grid max-w-3xl grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Card className="rounded-xl border border-rose-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-600">
                <HiChartBar aria-hidden="true" />
                120k+ posts/day
              </Typography>
            </CardBody>
          </Card>
          <Card className="rounded-xl border border-sky-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-600">
                <HiShieldCheck aria-hidden="true" />
                AI moderation
              </Typography>
            </CardBody>
          </Card>
          <Card className="rounded-xl border border-amber-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-600">
                <HiUsers aria-hidden="true" />
                Custom channels
              </Typography>
            </CardBody>
          </Card>
          <Card className="rounded-xl border border-emerald-100 bg-white/90 shadow-none">
            <CardBody className="px-3 py-3 text-center">
              <Typography variant="small" className="inline-flex items-center gap-2 font-medium text-slate-600">
                <HiBolt aria-hidden="true" />
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
                  <Typography variant="h5" className="inline-flex items-center gap-2 text-lg font-semibold text-blue-gray-900">
                    <HiUsers aria-hidden="true" />
                    Channel-first communities
                  </Typography>
                  <Typography variant="small" className="mt-2 text-sm leading-7 text-slate-600">
                    Spin up niche channels in seconds and let members self-organize around topics they care about.
                  </Typography>
                </CardBody>
              </Card>

              <Card className="rounded-2xl border border-slate-200 bg-sky-50 shadow-none">
                <CardBody className="p-5">
                  <Typography variant="h5" className="inline-flex items-center gap-2 text-lg font-semibold text-blue-gray-900">
                    <HiShieldCheck aria-hidden="true" />
                    Trust scoring
                  </Typography>
                  <Typography variant="small" className="mt-2 text-sm leading-7 text-slate-600">
                    Reward thoughtful posts with dynamic reputation, badges, and visibility boosts.
                  </Typography>
                </CardBody>
              </Card>

              <Card className="rounded-2xl border border-slate-200 bg-rose-50 shadow-none">
                <CardBody className="p-5">
                  <Typography variant="h5" className="inline-flex items-center gap-2 text-lg font-semibold text-blue-gray-900">
                    <HiBolt aria-hidden="true" />
                    Growth automations
                  </Typography>
                  <Typography variant="small" className="mt-2 text-sm leading-7 text-slate-600">
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
              <Typography variant="small" className="mt-3 max-w-xl text-sm leading-7 text-blue-gray-100 sm:text-base">
                Join creators, developers, and communities already migrating from fragmented forums to one focused home.
              </Typography>
            </div>
            <Button
              color="white"
              className="w-full rounded-2xl px-6 py-4 text-sm font-semibold text-blue-gray-900 sm:w-auto"
              onClick={handleGoogleLogin}
            >
              <span className="inline-flex items-center gap-2">
                <FcGoogle className="text-xl" aria-hidden="true" />
                Continue with Google
              </span>
            </Button>
          </CardBody>
        </Card>
      </section>
    </main>
  );
}
