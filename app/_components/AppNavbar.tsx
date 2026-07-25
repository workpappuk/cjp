"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Menu, MenuHandler, MenuItem, MenuList, Typography } from "../../types/mtw";
import {
  HiArrowRightOnRectangle,
  HiCheck,
  HiGlobeAlt,
  HiUserCircle,
} from "react-icons/hi2";
import { useTheme } from "../_context/theme-context";

const AUTH_KEY = "threadforge-auth";

type AppNavbarProps = {
  subtitle?: string;
  centerContent?: ReactNode;
  rightContent?: ReactNode;
  maxWidthClassName?: string;
};

export default function AppNavbar({
  subtitle = "Community control center",
  centerContent = null,
  rightContent = null,
  maxWidthClassName = "max-w-7xl",
}: AppNavbarProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const handleLogout = () => {
    window.localStorage.removeItem(AUTH_KEY);
    router.replace("/");
  };

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div
        className={`mx-auto flex w-full items-center justify-between gap-3 px-6 py-3 sm:px-10 lg:px-16 ${maxWidthClassName}`}
      >
        <Link href="/pages/home" className="flex items-center gap-3 text-blue-gray-900">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white">
            <HiGlobeAlt className="text-lg" aria-hidden="true" />
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

          <Menu placement="bottom-end">
            <MenuHandler>
              <Button variant="text" color="blue-gray" className="rounded-full p-2">
                <span className="inline-flex items-center gap-2">
                  <HiUserCircle className="text-2xl" aria-hidden="true" />
                  <span className="hidden text-sm font-medium sm:inline">Profile</span>
                </span>
              </Button>
            </MenuHandler>
            <MenuList className="w-56 p-2">
              <Typography
                variant="small"
                className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Theme
              </Typography>

              <MenuItem
                onClick={() => setTheme("orange")}
                className="flex items-center justify-between rounded-lg"
              >
                <span>Sunrise</span>
                {theme === "orange" ? <HiCheck aria-hidden="true" /> : null}
              </MenuItem>

              <MenuItem
                onClick={() => setTheme("emerald")}
                className="flex items-center justify-between rounded-lg"
              >
                <span>Forest</span>
                {theme === "emerald" ? <HiCheck aria-hidden="true" /> : null}
              </MenuItem>

              <MenuItem
                onClick={() => setTheme("sky")}
                className="flex items-center justify-between rounded-lg"
              >
                <span>Skyline</span>
                {theme === "sky" ? <HiCheck aria-hidden="true" /> : null}
              </MenuItem>

              <div className="my-2 border-t border-slate-200" />

              <MenuItem
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg text-red-600 focus:bg-red-50 focus:text-red-700"
              >
                <HiArrowRightOnRectangle aria-hidden="true" />
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </div>
      </div>
    </nav>
  );
}
