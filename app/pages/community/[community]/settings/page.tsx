"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button, Card, CardBody, Spinner, Typography } from "@/app/_types/mtw";
import { HiArrowLeft } from "react-icons/hi2";
import AppNavbar from "@/app/_components/AppNavbar";
import AppToast, { type AppToastTone } from "@/app/_components/AppToast";
import ImageUploadField from "@/app/_components/ImageUploadField";
import { useTheme } from "@/app/_context/theme-context";
import { isAuthenticated } from "@/app/_utils/auth";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";

type UserProfileResponse = {
  id?: string;
};

type CommunityResponse = {
  name?: string;
  createdBy?: string;
  bannerImageUrl?: string;
  titleImageUrl?: string;
};

export default function CommunitySettingsPage() {
  const router = useRouter();
  const { status } = useSession();
  const { theme } = useTheme();
  const params = useParams();

  const [profileId, setProfileId] = useState("");
  const [communityOwnerId, setCommunityOwnerId] = useState("");
  const [communityBannerImageUrl, setCommunityBannerImageUrl] = useState("");
  const [communityTitleImageUrl, setCommunityTitleImageUrl] = useState("");
  const [draftBannerImageUrls, setDraftBannerImageUrls] = useState<string[]>([]);
  const [draftTitleImageUrls, setDraftTitleImageUrls] = useState<string[]>([]);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSavingCommunityImages, setIsSavingCommunityImages] = useState(false);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: AppToastTone }>({
    open: false,
    message: "",
    tone: "info",
  });

  const { buttonColor, accent } = getThemeColorTokens(theme);

  const communityName = useMemo(() => {
    const raw = Array.isArray(params.community)
      ? params.community[0]
      : params.community;
    return decodeURIComponent(raw || "");
  }, [params.community]);

  const normalizedCommunityName = useMemo(
    () => communityName.trim().toLowerCase(),
    [communityName],
  );

  const isCommunityOwner = Boolean(profileId) && profileId === communityOwnerId;
  const hasCommunityImageChanges =
    (draftBannerImageUrls[0] ?? "") !== communityBannerImageUrl ||
    (draftTitleImageUrls[0] ?? "") !== communityTitleImageUrl;

  const showToast = (message: string, tone: AppToastTone = "info") => {
    setToast({ open: true, message, tone });
  };

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
      try {
        const [profileRes, communityRes] = await Promise.all([
          fetch("/api/user-profile", { cache: "no-store" }),
          fetch(`/api/communities/${encodeURIComponent(normalizedCommunityName)}`, {
            cache: "no-store",
          }),
        ]);

        if (!isMounted) {
          return;
        }

        if (profileRes.ok) {
          const profile = (await profileRes.json()) as UserProfileResponse;
          setProfileId(profile.id?.trim() ?? "");
        }

        if (communityRes.ok) {
          const community = (await communityRes.json()) as CommunityResponse;
          const nextOwnerId = community.createdBy?.trim() ?? "";
          const nextBannerImageUrl = community.bannerImageUrl?.trim() ?? "";
          const nextTitleImageUrl = community.titleImageUrl?.trim() ?? "";

          setCommunityOwnerId(nextOwnerId);
          setCommunityBannerImageUrl(nextBannerImageUrl);
          setCommunityTitleImageUrl(nextTitleImageUrl);
          setDraftBannerImageUrls(nextBannerImageUrl ? [nextBannerImageUrl] : []);
          setDraftTitleImageUrls(nextTitleImageUrl ? [nextTitleImageUrl] : []);
        }
      } catch {
        if (!isMounted) {
          return;
        }

        showToast("Failed to load community settings.", "error");
      } finally {
        if (!isMounted) {
          return;
        }

        setIsHydrating(false);
      }
    };

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, [normalizedCommunityName, router, status]);

  useEffect(() => {
    if (!isHydrating && profileId && communityOwnerId && profileId !== communityOwnerId) {
      router.replace(`/pages/community/${encodeURIComponent(normalizedCommunityName)}`);
    }
  }, [communityOwnerId, isHydrating, normalizedCommunityName, profileId, router]);

  const handleSaveCommunityImages = async () => {
    if (!isCommunityOwner || isSavingCommunityImages) {
      return;
    }

    setIsSavingCommunityImages(true);

    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(normalizedCommunityName)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bannerImageUrl: draftBannerImageUrls[0] ?? "",
          titleImageUrl: draftTitleImageUrls[0] ?? "",
        }),
      });

      if (!response.ok) {
        showToast("Failed to save community images.", "error");
        return;
      }

      const payload = (await response.json()) as {
        bannerImageUrl?: string;
        titleImageUrl?: string;
      };

      const nextBanner = payload.bannerImageUrl?.trim() ?? "";
      const nextTitle = payload.titleImageUrl?.trim() ?? "";
      setCommunityBannerImageUrl(nextBanner);
      setCommunityTitleImageUrl(nextTitle);
      setDraftBannerImageUrls(nextBanner ? [nextBanner] : []);
      setDraftTitleImageUrls(nextTitle ? [nextTitle] : []);
      showToast("Community images updated.", "success");
    } finally {
      setIsSavingCommunityImages(false);
    }
  };

  if (status === "loading" || isHydrating) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="inline-flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <Typography>Loading community settings...</Typography>
        </div>
      </main>
    );
  }

  if (!isCommunityOwner) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        subtitle={`Community Settings • ${communityName}`}
        maxWidthClassName="max-w-none"
        rightContent={(
          <Link href={`/pages/community/${encodeURIComponent(normalizedCommunityName)}`} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accent.link}`}>
            <HiArrowLeft aria-hidden="true" />
            Back to Community
          </Link>
        )}
      />

      <div className="mx-auto w-full max-w-none space-y-4 px-6 py-8 sm:px-10 lg:px-16">
        <Card className={`mx-auto w-full max-w-3xl rounded-2xl border bg-white shadow-none dark:bg-slate-900 ${accent.section}`}>
          <CardBody className="space-y-4 p-5 sm:p-6">
            <Typography variant="h5" className={accent.title}>
              Community Media
            </Typography>
            <Typography variant="small" className="text-slate-700 dark:text-slate-300">
              Configure banner and title images for this community. Only owners can edit these settings.
            </Typography>

            <ImageUploadField
              value={draftBannerImageUrls}
              onChange={(next) => setDraftBannerImageUrls(next.slice(0, 1))}
              scope="community"
              maxImages={1}
              color={buttonColor}
              label="Banner image"
              helperText="Recommended wide image for the page hero."
            />

            <ImageUploadField
              value={draftTitleImageUrls}
              onChange={(next) => setDraftTitleImageUrls(next.slice(0, 1))}
              scope="community"
              maxImages={1}
              color={buttonColor}
              label="Title image"
              helperText="Small image displayed near the community title."
            />

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                color={buttonColor}
                onClick={handleSaveCommunityImages}
                disabled={!hasCommunityImageChanges || isSavingCommunityImages}
              >
                {isSavingCommunityImages ? "Saving..." : "Save Changes"}
              </Button>

              {hasCommunityImageChanges ? (
                <Button
                  size="sm"
                  variant="outlined"
                  color="blue-gray"
                  onClick={() => {
                    setDraftBannerImageUrls(communityBannerImageUrl ? [communityBannerImageUrl] : []);
                    setDraftTitleImageUrls(communityTitleImageUrl ? [communityTitleImageUrl] : []);
                  }}
                  disabled={isSavingCommunityImages}
                >
                  Reset
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <AppToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      />
    </main>
  );
}
