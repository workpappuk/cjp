"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { HiArrowRightOnRectangle, HiCheck, HiGlobeAlt, HiUserCircle } from "react-icons/hi2";
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
    isAdmin?: boolean;
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
        isAdmin?: boolean;
      };
      setLocalUser(parsed);
    } catch {
      setLocalUser(null);
    }
  }, [session?.user?.name, session?.user?.email, session?.user?.image]);

  useEffect(() => {
    if (!session?.user?.email) {
      return;
    }

    let isMounted = true;

    const syncUserProfile = async () => {
      try {
        const response = await fetch("/api/user-profile", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          name?: string;
          email?: string;
          image?: string;
          isAdmin?: boolean;
        };

        if (!isMounted) {
          return;
        }

        const nextProfile = {
          name: payload.name ?? "",
          email: payload.email ?? "",
          image: payload.image ?? "",
          isAdmin: Boolean(payload.isAdmin),
        };

        setLocalUser(nextProfile);

        if (typeof window !== "undefined") {
          window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(nextProfile));
        }
      } catch {
        // Fallback stays on session/local profile data when sync fails.
      }
    };

    void syncUserProfile();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.email]);

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
  const isAdmin = Boolean(localUser?.isAdmin);

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 px-6 py-3 sm:px-10 lg:px-16 ${maxWidthClassName}`}
      >
        <Link href="/pages/home" className="flex items-center gap-3 text-blue-gray-900">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <HiGlobeAlt className="h-5 w-5" />
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
                  <HiUserCircle className="h-7 w-7" />
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
                  {theme === "orange" ? <HiCheck className="h-4 w-4" /> : null}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setTheme("emerald")}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <span>Forest</span>
                  {theme === "emerald" ? <HiCheck className="h-4 w-4" /> : null}
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setTheme("sky")}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                >
                  <span>Skyline</span>
                  {theme === "sky" ? <HiCheck className="h-4 w-4" /> : null}
                </button>

                <div className="my-2 border-t border-slate-200" />

                {profileMenuContent ? (
                  <div>
                    {profileMenuContent}
                    <div className="my-2 border-t border-slate-200" />
                  </div>
                ) : null}

                {isAdmin ? (
                  <Link
                    href="/pages/admin"
                    role="menuitem"
                    className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-blue-700 hover:bg-blue-50"
                  >
                    Admin Moderation
                  </Link>
                ) : null}

                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <HiArrowRightOnRectangle className="h-4 w-4" />
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
