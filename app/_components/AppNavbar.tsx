"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { Button, Typography } from "@/app/_types/mtw";
import { useTheme } from "@/app/_context/theme-context";
import { USER_PROFILE_KEY, clearAuthSession } from "@/app/_utils/auth";

type AppNavbarProps = {
  subtitle?: string;
  centerContent?: ReactNode;
  rightContent?: ReactNode;
  profileMenuContent?: ReactNode;
  maxWidthClassName?: string;
};

function IconGlobeAlt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3a15.3 15.3 0 0 1 4 9 15.3 15.3 0 0 1-4 9 15.3 15.3 0 0 1-4-9 15.3 15.3 0 0 1 4-9Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUserCircle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.8 18a6.2 6.2 0 0 1 10.4 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className} aria-hidden="true">
      <path d="m5 12 4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrowRightOnRectangle({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path d="M14 8l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 12h12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 4h7a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20h7a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppNavbar({
  subtitle = "Community control center",
  centerContent = null,
  rightContent = null,
  profileMenuContent = null,
  maxWidthClassName = "max-w-7xl",
}: AppNavbarProps) {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [localUser, setLocalUser] = useState<{
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) {
      setLocalUser(null);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as {
        name?: string | null;
        email?: string | null;
        image?: string | null;
      };
      setLocalUser(parsed);
    } catch {
      setLocalUser(null);
    }
  }, [session?.user?.name, session?.user?.email, session?.user?.image]);

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current) return;
      if (profileMenuRef.current.contains(event.target as Node)) return;
      setIsProfileMenuOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileMenuOpen]);

  const handleLogout = async () => {
    clearAuthSession();
    await signOut({ callbackUrl: "/" });
  };

  const profileName = session?.user?.name ?? localUser?.name ?? "Profile";
  const profileEmail = session?.user?.email ?? localUser?.email ?? "";
  const profileImage = session?.user?.image ?? localUser?.image ?? "";

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 px-6 py-3 sm:px-10 lg:px-16 ${maxWidthClassName}`}
      >
        <Link href="/pages/home" className="flex items-center gap-3 text-blue-gray-900">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <IconGlobeAlt className="h-5 w-5" />
          </span>
          <div>
            <Typography variant="h6" className="leading-tight text-blue-gray-900">
              ThreadForge
            </Typography>
            <Typography variant="small" className="hidden text-slate-500 sm:block">
              {subtitle}
            </Typography>
          </div>
        </Link>

        <div className="hidden items-center gap-2 md:flex">{centerContent}</div>

        <div className="flex items-center gap-2">
          {rightContent}

          <div className="relative" ref={profileMenuRef}>
            <Button
              variant="text"
              color="blue-gray"
              className="rounded-full p-2"
              aria-label="Open profile menu"
              aria-expanded={isProfileMenuOpen}
              aria-controls="profile-menu"
              onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            >
              <span className="inline-flex items-center gap-2">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={profileName}
                    className="h-7 w-7 rounded-full border border-slate-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <IconUserCircle className="h-7 w-7" />
                )}
                <span className="hidden max-w-36 truncate text-sm font-medium sm:inline">{profileName}</span>
              </span>
            </Button>

            {isProfileMenuOpen ? (
              <div
                id="profile-menu"
                role="menu"
                aria-label="Profile menu"
                className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg"
              >
                <div className="mb-2 rounded-lg bg-slate-50 px-3 py-2">
                  <Typography variant="small" className="truncate text-sm font-semibold text-blue-gray-900">
                    {profileName}
                  </Typography>
                  {profileEmail ? (
                    <Typography variant="small" className="truncate text-xs text-slate-500">
                      {profileEmail}
                    </Typography>
                  ) : null}
                </div>

                <Typography
                  variant="small"
                  className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600"
                >
                  Theme
                </Typography>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setTheme("orange")}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <span>Sunrise</span>
                  {theme === "orange" ? <IconCheck className="h-4 w-4" /> : null}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setTheme("emerald")}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <span>Forest</span>
                  {theme === "emerald" ? <IconCheck className="h-4 w-4" /> : null}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setTheme("sky")}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <span>Skyline</span>
                  {theme === "sky" ? <IconCheck className="h-4 w-4" /> : null}
                </button>

                <div className="my-2 border-t border-slate-200" />

                {profileMenuContent ? (
                  <div>
                    {profileMenuContent}
                    <div className="my-2 border-t border-slate-200" />
                  </div>
                ) : null}

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <IconArrowRightOnRectangle className="h-4 w-4" />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
