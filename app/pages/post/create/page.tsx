"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { HiArrowLeft, HiChevronUpDown, HiMagnifyingGlass, HiPencilSquare, HiPlus, HiXMark } from "react-icons/hi2";
import { Button, Card, CardBody, Chip, Menu, MenuHandler, MenuItem, MenuList, Spinner, Typography } from "@/app/_types/mtw";
import AppNavbar from "@/app/_components/AppNavbar";
import AppToast, { type AppToastTone } from "@/app/_components/AppToast";
import PostComposer from "@/app/_components/PostComposer";
import TagsPicker from "@/app/_components/TagsPicker";
import { useTheme } from "@/app/_context/theme-context";
import { isAuthenticated } from "@/app/_utils/auth";
import { getThemeColorTokens } from "@/app/_utils/theme-colors";
import { attachTagsToTarget, dedupeTagNames } from "@/app/_utils/tags";

type TagResponse = {
  name?: string;
};

type JoinedCommunitiesPageResponse = {
  items?: Array<{
    id?: string;
    name?: string;
  }>;
  nextCursor?: string | null;
};

const PAGE_SIZE = 100;

export default function CreatePostPage() {
  const router = useRouter();
  const { status } = useSession();
  const { theme } = useTheme();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [postTags, setPostTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [joinedCommunities, setJoinedCommunities] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasAnyJoinedCommunity, setHasAnyJoinedCommunity] = useState(false);
  const [isLoadingCommunityOptions, setIsLoadingCommunityOptions] = useState(false);
  const [isLoadingMoreCommunityOptions, setIsLoadingMoreCommunityOptions] = useState(false);
  const [selectedCommunities, setSelectedCommunities] = useState<string[]>([]);
  const [communitySearch, setCommunitySearch] = useState("");
  const [debouncedCommunitySearch, setDebouncedCommunitySearch] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [suggestionMenuWidth, setSuggestionMenuWidth] = useState<number | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string; tone: AppToastTone }>({
    open: false,
    message: "",
    tone: "info",
  });

  const { buttonColor, accent: accentClasses } = getThemeColorTokens(theme);

  const showToast = (message: string, tone: AppToastTone = "info") => {
    setToast({ open: true, message, tone });
  };

  const communityOptionsRequestIdRef = useRef(0);
  const suggestionContainerRef = useRef<HTMLDivElement | null>(null);

  const postDisabled =
    title.trim().length === 0 ||
    content.trim().length === 0 ||
    selectedCommunities.length === 0;

  const selectedCommunitySet = useMemo(() => new Set(selectedCommunities), [selectedCommunities]);

  const suggestionOptions = useMemo(() => {
    return joinedCommunities.filter((community) => !selectedCommunitySet.has(community));
  }, [joinedCommunities, selectedCommunitySet]);

  const loadJoinedCommunities = async ({
    search,
    cursor,
    append,
  }: {
    search: string;
    cursor: string | null;
    append: boolean;
  }) => {
    const requestId = communityOptionsRequestIdRef.current + 1;
    communityOptionsRequestIdRef.current = requestId;

    if (append) {
      setIsLoadingMoreCommunityOptions(true);
    } else {
      setIsLoadingCommunityOptions(true);
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      if (search) {
        params.set("search", search);
      }
      if (cursor) {
        params.set("cursor", cursor);
      }

      const response = await fetch(`/api/user-profile/joined-communities?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        if (requestId !== communityOptionsRequestIdRef.current) {
          return;
        }
        showToast("Failed to load joined communities.", "error");
        if (!append) {
          setJoinedCommunities([]);
          setNextCursor(null);
        }
        return;
      }

      const payload = (await response.json()) as JoinedCommunitiesPageResponse;
      const incoming = Array.isArray(payload.items)
        ? payload.items
            .map((item) => (item.name ?? "").trim().toLowerCase())
            .filter(Boolean)
        : [];

      if (requestId !== communityOptionsRequestIdRef.current) {
        return;
      }

      if (append) {
        setJoinedCommunities((prev) => [...new Set([...prev, ...incoming])]);
      } else {
        setJoinedCommunities([...new Set(incoming)]);
      }

      setNextCursor(payload.nextCursor ?? null);

      if (!search) {
        setHasAnyJoinedCommunity(incoming.length > 0 || Boolean(payload.nextCursor));
      }
    } catch {
      if (requestId !== communityOptionsRequestIdRef.current) {
        return;
      }
      showToast("Failed to load joined communities.", "error");
      if (!append) {
        setJoinedCommunities([]);
        setNextCursor(null);
      }
    } finally {
      if (requestId !== communityOptionsRequestIdRef.current) {
        return;
      }
      setIsLoadingCommunityOptions(false);
      setIsLoadingMoreCommunityOptions(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedCommunitySearch(communitySearch.trim().toLowerCase());
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [communitySearch]);

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (status === "unauthenticated" && !isAuthenticated()) {
      router.replace("/");
      return;
    }

    let isMounted = true;

    const hydrateFromApi = async () => {
      try {
        const [tagsRes] = await Promise.all([
          fetch("/api/tags", { cache: "no-store" }),
        ]);

        if (!isMounted) {
          return;
        }

        if (tagsRes.ok) {
          const parsedTags = (await tagsRes.json()) as TagResponse[];
          setAvailableTags(
            dedupeTagNames(
              Array.isArray(parsedTags)
                ? parsedTags
                    .map((item) => item.name?.trim() ?? "")
                    .filter(Boolean)
                : [],
            ),
          );
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setJoinedCommunities([]);
        setNextCursor(null);
        setHasAnyJoinedCommunity(false);
        setSelectedCommunities([]);
        setAvailableTags([]);
      } finally {
        if (!isMounted) {
          return;
        }

        setIsHydrating(false);
      }
    };

    void hydrateFromApi();

    return () => {
      isMounted = false;
    };
  }, [router, status]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    void loadJoinedCommunities({ search: debouncedCommunitySearch, cursor: null, append: false });
  }, [debouncedCommunitySearch, status]);

  useEffect(() => {
    setActiveSuggestionIndex(-1);
  }, [suggestionOptions]);

  useEffect(() => {
    const element = suggestionContainerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setSuggestionMenuWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const addCommunity = (community: string) => {
    if (!community) {
      return;
    }

    setSelectedCommunities((prev) => {
      if (prev.includes(community)) {
        return prev;
      }

      return [...prev, community];
    });
    setCommunitySearch("");
    setIsSuggestionsOpen(false);
  };

  const removeCommunity = (community: string) => {
    setSelectedCommunities((prev) => prev.filter((item) => item !== community));
  };

  const clearSelectedCommunities = () => {
    setSelectedCommunities([]);
  };

  const handleAutocompleteKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionsOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      setIsSuggestionsOpen(true);
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (suggestionOptions.length === 0) {
        return;
      }
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestionOptions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (suggestionOptions.length === 0) {
        return;
      }
      setActiveSuggestionIndex((prev) => {
        if (prev <= 0) {
          return suggestionOptions.length - 1;
        }
        return prev - 1;
      });
      return;
    }

    if (event.key === "Enter") {
      if (!isSuggestionsOpen) {
        return;
      }

      event.preventDefault();
      const candidate =
        activeSuggestionIndex >= 0
          ? suggestionOptions[activeSuggestionIndex]
          : suggestionOptions[0];
      if (candidate) {
        addCommunity(candidate);
      }
      return;
    }

    if (event.key === "Escape") {
      setIsSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
    }
  };

  const loadMoreJoinedCommunities = async () => {
    if (!nextCursor || isLoadingMoreCommunityOptions) {
      return;
    }

    await loadJoinedCommunities({
      search: debouncedCommunitySearch,
      cursor: nextCursor,
      append: true,
    });
  };

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (postDisabled) {
      return;
    }

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.trim(),
        content: content.trim(),
        communities: selectedCommunities,
      }),
    });

    if (!response.ok) {
      showToast("Failed to create post. Please retry.", "error");
      return;
    }

    const created = (await response.json()) as {
      id: string;
      moderationStatus?: string;
    };

    const tagAttach = await attachTagsToTarget({
      targetType: "Post",
      targetId: created.id,
      tags: postTags,
    });

    if (tagAttach.didRetry) {
      showToast("Post tags were retried after a concurrent change.", "warning");
    }

    setAvailableTags((prev) => dedupeTagNames([...prev, ...postTags]));
    setTitle("");
    setContent("");
    setPostTags([]);

    if (created.moderationStatus === "pending") {
      showToast("Post submitted for admin approval.", "info");
      return;
    }

    showToast("Post created successfully.", "success");
  };

  if (status === "loading" || isHydrating) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="inline-flex items-center gap-3">
          <Spinner className="h-5 w-5" />
          <Typography>Loading post creator...</Typography>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <AppNavbar
        subtitle="Create post"
        maxWidthClassName="max-w-none"
        rightContent={(
          <Link href="/pages/home" className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${accentClasses.link}`}>
            <HiArrowLeft aria-hidden="true" />
            Back to Home
          </Link>
        )}
      />

      <div className="mx-auto w-full max-w-none px-6 py-8 sm:px-10 lg:px-16">
        <Card className={`mx-auto w-full max-w-4xl rounded-3xl border shadow-xl dark:bg-slate-900 ${accentClasses.sectionBorder}`}>
          <CardBody className="space-y-5 p-6 sm:p-8">
            <Typography variant="h4" className={`inline-flex items-center gap-2 ${accentClasses.heading}`}>
              <HiPencilSquare className="h-6 w-6" />
              Create New Post
            </Typography>

            <Typography className="text-slate-700 dark:text-slate-300">
              Search and add destination communities like autocomplete.
            </Typography>

            <div className="space-y-3">
              {hasAnyJoinedCommunity ? (
                <div className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div ref={suggestionContainerRef} className="w-full max-w-xl">
                    <Menu open={isSuggestionsOpen} handler={setIsSuggestionsOpen} placement="bottom-start">
                    <MenuHandler>
                      <div className="w-full">
                        <div className="mb-1 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <HiMagnifyingGlass className="h-3.5 w-3.5" />
                          Search Joined Communities
                        </div>
                        <div
                          className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 shadow-xs transition focus-within:border-slate-500 dark:border-slate-700 dark:bg-slate-900"
                          onClick={() => setIsSuggestionsOpen(true)}
                        >
                          <div className="flex flex-wrap items-center content-center gap-1.5">
                            {selectedCommunities.length > 0
                              ? selectedCommunities.slice(0, 10).map((community) => (
                                  <Chip
                                    key={`inline-selected-${community}`}
                                    value={community}
                                    size="sm"
                                    variant="ghost"
                                    color={buttonColor}
                                    className="rounded-full align-middle"
                                    onClose={() => removeCommunity(community)}
                                  />
                                ))
                              : null}

                            {selectedCommunities.length > 10 ? (
                              <Chip
                                value={`+${selectedCommunities.length - 10}`}
                                size="sm"
                                variant="ghost"
                                color="blue-gray"
                                className="rounded-full align-middle"
                              />
                            ) : null}

                            <input
                              value={communitySearch}
                              onFocus={() => setIsSuggestionsOpen(true)}
                              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                                setCommunitySearch(event.target.value);
                                setIsSuggestionsOpen(true);
                              }}
                              onKeyDown={handleAutocompleteKeyDown}
                              placeholder={selectedCommunities.length > 0 ? "Add more communities" : "Add destination community"}
                              className="h-8 min-w-48 flex-1 self-center bg-transparent text-sm leading-8 text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                            />

                            {(communitySearch || selectedCommunities.length > 0) ? (
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setCommunitySearch("");
                                  clearSelectedCommunities();
                                  setIsSuggestionsOpen(false);
                                }}
                                aria-label="Clear communities"
                                className="inline-flex h-7 w-7 items-center justify-center self-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <HiXMark className="h-4 w-4" />
                              </button>
                            ) : null}

                            <span className="inline-flex h-7 w-7 items-center justify-center self-center text-slate-500 dark:text-slate-300">
                              <HiChevronUpDown className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </MenuHandler>
                    <MenuList
                      className="z-30 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                      style={{
                        width: suggestionMenuWidth ? `${Math.floor(suggestionMenuWidth)}px` : undefined,
                        maxWidth: "calc(100vw - 3rem)",
                      }}
                    >
                      {isLoadingCommunityOptions ? (
                        <div className="flex items-center gap-2 px-2 py-2 text-sm text-slate-600 dark:text-slate-300">
                          <Spinner className="h-4 w-4" />
                          Searching communities...
                        </div>
                      ) : null}

                      {!isLoadingCommunityOptions && suggestionOptions.length === 0 ? (
                        <Typography variant="small" className="px-2 py-2 text-slate-600 dark:text-slate-300">
                          No matching joined communities.
                        </Typography>
                      ) : null}

                      {suggestionOptions.map((community, index) => (
                        <MenuItem
                          key={`suggestion-${community}`}
                          onMouseEnter={() => setActiveSuggestionIndex(index)}
                          onClick={() => addCommunity(community)}
                          className={`flex min-h-9 items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition ${
                            index === activeSuggestionIndex
                              ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                              : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate pr-2 leading-5">{community}</span>
                          <Chip
                            value="Add"
                            size="sm"
                            variant="ghost"
                            color={buttonColor}
                            className="shrink-0 rounded-full"
                            icon={<HiPlus className="h-3 w-3" />}
                          />
                        </MenuItem>
                      ))}

                      {nextCursor ? (
                        <div className="pt-2">
                          <Button
                            size="sm"
                            variant="outlined"
                            color={buttonColor}
                            className="w-full rounded-lg normal-case"
                            onClick={loadMoreJoinedCommunities}
                            disabled={isLoadingMoreCommunityOptions}
                          >
                            {isLoadingMoreCommunityOptions ? "Loading..." : "Load More Suggestions"}
                          </Button>
                        </div>
                      ) : null}
                    </MenuList>
                  </Menu>
                  </div>

                  <Typography variant="small" className="text-slate-700 dark:text-slate-300">
                    Selected destinations: {selectedCommunities.length}
                  </Typography>
                </div>
              ) : (
                <Typography variant="small" className="text-slate-700 dark:text-slate-300">
                  Join at least one community on home before creating posts.
                </Typography>
              )}

              {selectedCommunities.length === 0 ? (
                <Typography variant="small" className="text-slate-700 dark:text-slate-300">
                  No destination community selected.
                </Typography>
              ) : null}
            </div>

            <PostComposer
              heading="Post Details"
              title={title}
              content={content}
              onTitleChange={setTitle}
              onContentChange={setContent}
              onSubmit={handleCreatePost}
              disabled={postDisabled}
              buttonLabel="Publish Post"
              helperText={
                hasAnyJoinedCommunity
                  ? selectedCommunities.length > 0
                    ? `This post will be submitted to ${selectedCommunities.length} ${selectedCommunities.length === 1 ? "community" : "communities"}.`
                    : "Select at least one community for this post."
                  : "Join at least one community before publishing a post."
              }
              color={buttonColor}
              extraSection={(
                <TagsPicker
                  label="Post tags"
                  value={postTags}
                  onChange={setPostTags}
                  suggestedTags={availableTags}
                  color={buttonColor}
                  disabled={!hasAnyJoinedCommunity || postDisabled}
                />
              )}
            />
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
