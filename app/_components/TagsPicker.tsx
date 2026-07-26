"use client";

import { type KeyboardEvent, useMemo, useState } from "react";
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
  const [errorText, setErrorText] = useState("");

  const normalizedValue = useMemo(() => dedupeTagNames(value), [value]);

  const availableSuggestions = useMemo(() => {
    const selected = new Set(normalizedValue);
    return dedupeTagNames(suggestedTags)
      .filter((tag) => !selected.has(tag))
      .slice(0, 12);
  }, [normalizedValue, suggestedTags]);

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
      <Typography variant="small" className="font-medium text-slate-700">
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
        <Typography variant="small" className="text-slate-500">
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
              className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed"
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
              className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed"
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