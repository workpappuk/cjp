"use client";

import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import { Button, Input, Typography } from "@/app/_types/mtw";
import { dedupeTagNames, normalizeTagName } from "@/app/_utils/tags";

type TagsPickerProps = {
  label?: string;
  value: string[];
  onChange: (next: string[]) => void;
  suggestedTags?: string[];
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  color?: string;
  maxTags?: number;
};

function isValidTagName(tag: string) {
  return Boolean(tag) && tag.length <= 64 && !/\s/.test(tag);
}

function getSuggestionClasses(color: string) {
  if (color === "green") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/80 dark:bg-emerald-900/20 dark:text-emerald-200 dark:hover:bg-emerald-900/35";
  }

  if (color === "orange") {
    return "border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100 dark:border-orange-800/80 dark:bg-orange-900/20 dark:text-orange-200 dark:hover:bg-orange-900/35";
  }

  return "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-blue-800/80 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/35";
}

export default function TagsPicker({
  label = "Tags",
  value,
  onChange,
  suggestedTags = [],
  placeholder = "Add a tag and press Enter",
  helperText = "Tags must be one word. Up to 64 characters.",
  disabled = false,
  color = "blue",
  maxTags = 8,
}: TagsPickerProps) {
  const [draftTag, setDraftTag] = useState("");
  const [debouncedDraftTag, setDebouncedDraftTag] = useState("");
  const [remoteSuggestedTags, setRemoteSuggestedTags] = useState<string[]>([]);
  const [errorText, setErrorText] = useState("");
  const suggestionClasses = getSuggestionClasses(color);

  const normalizedValue = useMemo(() => dedupeTagNames(value), [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDraftTag(normalizeTagName(draftTag));
    }, 250);

    return () => clearTimeout(timer);
  }, [draftTag]);

  useEffect(() => {
    const query = debouncedDraftTag;

    if (!query) {
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        const response = await fetch(`/api/tags?search=${encodeURIComponent(query)}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as Array<{ name?: string }>;
        const names = Array.isArray(payload)
          ? payload
              .map((item) => normalizeTagName(item?.name ?? ""))
              .filter(Boolean)
          : [];

        setRemoteSuggestedTags(dedupeTagNames(names));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [debouncedDraftTag]);

  const availableSuggestions = useMemo(() => {
    if (!debouncedDraftTag) {
      return [];
    }

    const selected = new Set(normalizedValue);
    const source = remoteSuggestedTags.length > 0 ? remoteSuggestedTags : suggestedTags;

    return dedupeTagNames(source)
      .filter((tag) => tag.includes(debouncedDraftTag))
      .filter((tag) => !selected.has(tag))
      .slice(0, 12);
  }, [debouncedDraftTag, normalizedValue, remoteSuggestedTags, suggestedTags]);

  const addTag = (raw: string) => {
    const nextTag = normalizeTagName(raw);

    if (!nextTag) {
      return;
    }

    if (!isValidTagName(nextTag)) {
      setErrorText("Tag must be one word and 64 characters or fewer.");
      return;
    }

    if (normalizedValue.includes(nextTag)) {
      setDraftTag("");
      setErrorText("");
      return;
    }

    if (normalizedValue.length >= maxTags) {
      setErrorText(`You can add up to ${maxTags} tags.`);
      return;
    }

    onChange([...normalizedValue, nextTag]);
    setDraftTag("");
    setErrorText("");
  };

  const removeTag = (tagToRemove: string) => {
    onChange(normalizedValue.filter((tag) => tag !== tagToRemove));
    setErrorText("");
  };

  const handleDraftTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag(draftTag);
    }
  };

  const handleDraftTagChange = (event: { target?: { value?: string } }) => {
    setDraftTag(String(event?.target?.value ?? ""));
    if (errorText) {
      setErrorText("");
    }
  };

  return (
    <div className="space-y-2">
      <Typography variant="small" className="font-medium text-slate-700 dark:text-slate-300">
        {label}
      </Typography>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            variant="standard"
            label={placeholder}
            value={draftTag}
            onChange={handleDraftTagChange}
            onKeyDown={handleDraftTagKeyDown}
            crossOrigin={undefined}
            color={color}
            disabled={disabled}
          />
        </div>

        <Button
          type="button"
          size="sm"
          color={color}
          onClick={() => addTag(draftTag)}
          disabled={disabled}
          className="rounded-lg"
        >
          Add
        </Button>
      </div>

      {errorText ? (
        <Typography variant="small" className="text-red-600">
          {errorText}
        </Typography>
      ) : (
        <Typography variant="small" className="text-slate-500 dark:text-slate-400">
          {helperText}
        </Typography>
      )}

      {normalizedValue.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {normalizedValue.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              disabled={disabled}
              title="Remove tag"
            >
              #{tag} ×
            </button>
          ))}
        </div>
      ) : null}

      {availableSuggestions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {availableSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className={`rounded-full border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed ${suggestionClasses}`}
              disabled={disabled}
            >
              + #{tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}