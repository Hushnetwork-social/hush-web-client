"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from "react";
import { ContentCarousel } from "@/components/chat/ContentCarousel";

type ComposerMode = "full" | "compact";

type ComposerCircle = {
  feedId: string;
  name: string;
};

type DraftMediaItem = {
  id: string;
  kind: "image" | "video";
  label: string;
  sizeMb: number;
  previewUrl?: string;
};

type SocialPostComposerCardProps = {
  mode: ComposerMode;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  newPostDraft: string;
  onDraftChange: (value: string) => void;
  postAudience: "public" | "close";
  onSelectPublicAudience: () => void;
  onSelectPrivateAudience: () => void;
  includeInnerCircleForPost: boolean;
  onToggleInnerCircle: () => void;
  availableCustomCirclesForPost: ComposerCircle[];
  selectedCustomCircleIdsForPost: string[];
  onToggleCustomCircle: (feedId: string) => void;
  selectedCircleNames: string[];
  newPostAudienceError: string | null;
  draftMediaItems: DraftMediaItem[];
  newPostMediaError: string | null;
  maxMediaAttachments: number;
  maxMediaSizeMb: number;
  onAddImage: () => void;
  onAddVideo: () => void;
  onAddFiles: (files: File[] | FileList | null) => void;
  onRemoveMedia: (id: string) => void;
  onPublish: () => void;
};

export function SocialPostComposerCard({
  mode,
  isExpanded,
  onExpand,
  onCollapse,
  newPostDraft,
  onDraftChange,
  postAudience,
  onSelectPublicAudience,
  onSelectPrivateAudience,
  includeInnerCircleForPost,
  onToggleInnerCircle,
  availableCustomCirclesForPost,
  selectedCustomCircleIdsForPost,
  onToggleCustomCircle,
  selectedCircleNames,
  newPostAudienceError,
  draftMediaItems,
  newPostMediaError,
  maxMediaAttachments,
  maxMediaSizeMb,
  onAddImage,
  onAddVideo,
  onAddFiles,
  onRemoveMedia,
  onPublish,
}: SocialPostComposerCardProps) {
  const showCompactHeader = mode === "compact" && !isExpanded;
  const showComposerBody = mode === "full" || isExpanded;
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCirclePickerOpen, setIsCirclePickerOpen] = useState(false);
  const [pickerAccept, setPickerAccept] = useState<"image/*" | "video/*" | "image/*,video/*">("image/*,video/*");

  useEffect(() => {
    if (!showComposerBody) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      draftRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [showComposerBody]);

  useEffect(() => {
    if (postAudience !== "close") {
      setIsCirclePickerOpen(false);
    }
  }, [postAudience]);

  const selectedCircleCount = (includeInnerCircleForPost ? 1 : 0) + selectedCustomCircleIdsForPost.length;

  const openFilePicker = (accept: "image/*" | "video/*" | "image/*,video/*") => {
    setPickerAccept(accept);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    onAddFiles(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const handleDraftPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);

    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    onAddFiles(files);
  };

  return (
    <section data-testid="social-new-post" className="rounded-xl border border-hush-bg-hover bg-hush-bg-dark p-4">
      {showCompactHeader ? (
        <button
          type="button"
          className="w-full rounded-lg border border-hush-bg-hover bg-hush-bg-element px-3 py-2 text-left text-sm text-hush-text-accent hover:border-hush-purple/40"
          onClick={onExpand}
          data-testid="social-new-post-compact-trigger"
        >
          What do you want to show us?
        </button>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-hush-text-primary">{mode === "compact" ? "Create post" : "New Post"}</h3>
          <p className="mt-1 text-xs text-hush-text-accent">What do you want to show us?</p>
        </>
      )}

      {showComposerBody ? (
        <>
          <textarea
            ref={draftRef}
            data-testid="social-new-post-draft"
            value={newPostDraft}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
            onPaste={handleDraftPaste}
            placeholder="What do you want to show us?"
            className="mt-3 w-full min-h-28 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-3 py-2 text-sm text-hush-text-primary outline-none focus:border-hush-purple"
          />

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={pickerAccept}
            className="hidden"
            data-testid="social-new-post-file-input"
            onChange={handleFileInputChange}
          />

          <div
            className="mt-3 rounded-lg border border-hush-bg-hover p-3"
            data-testid="social-new-post-media"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onAddFiles(event.dataTransfer.files);
            }}
          >
            <p className="text-xs font-semibold text-hush-text-primary">Media</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="social-new-post-add-image"
                onClick={() => {
                  onAddImage();
                  openFilePicker("image/*");
                }}
                className="rounded-full border border-hush-bg-hover px-3 py-1 text-xs text-hush-text-accent hover:border-hush-purple/40"
              >
                + Image
              </button>
              <button
                type="button"
                data-testid="social-new-post-add-video"
                onClick={() => {
                  onAddVideo();
                  openFilePicker("video/*");
                }}
                className="rounded-full border border-hush-bg-hover px-3 py-1 text-xs text-hush-text-accent hover:border-hush-purple/40"
              >
                + Video
              </button>
            </div>
            <p className="mt-2 text-[11px] text-hush-text-accent">
              Limits: up to {maxMediaAttachments} attachments, each up to {maxMediaSizeMb}MB.
            </p>
            <p className="mt-1 text-[11px] text-hush-text-accent" data-testid="social-new-post-drop-zone">
              Paste with Ctrl+V, drag and drop files, or use + Image/+ Video.
            </p>
            {draftMediaItems.length > 0 && (
              <div className="mt-2" data-testid="social-new-post-media-preview">
                {draftMediaItems.length === 1 ? (
                  <div className="overflow-hidden rounded-md border border-hush-bg-hover bg-hush-bg-dark/40 p-1">
                    {draftMediaItems[0].kind === "video" ? (
                      <video
                        src={draftMediaItems[0].previewUrl}
                        controls
                        className="max-h-64 w-full rounded-md object-contain"
                        data-testid="social-new-post-media-preview-video"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draftMediaItems[0].previewUrl}
                        alt={draftMediaItems[0].label}
                        className="max-h-64 w-full rounded-md object-contain"
                        data-testid="social-new-post-media-preview-image"
                      />
                    )}
                  </div>
                ) : (
                  <ContentCarousel ariaLabel="Social composer media preview">
                    {draftMediaItems.map((item) => (
                      <div
                        key={item.id}
                        className="overflow-hidden rounded-md border border-hush-bg-hover bg-hush-bg-dark/40 p-1"
                      >
                        {item.kind === "video" ? (
                          <video
                            src={item.previewUrl}
                            controls
                            className="max-h-64 w-full rounded-md object-contain"
                            data-testid={`social-new-post-media-preview-video-${item.id}`}
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.previewUrl}
                            alt={item.label}
                            className="max-h-64 w-full rounded-md object-contain"
                            data-testid={`social-new-post-media-preview-image-${item.id}`}
                          />
                        )}
                      </div>
                    ))}
                  </ContentCarousel>
                )}
              </div>
            )}
            {draftMediaItems.length > 0 && (
              <ul className="mt-2 space-y-1" data-testid="social-new-post-media-list">
                {draftMediaItems.map((item) => (
                  <li
                    key={item.id}
                    data-testid={`social-new-post-media-item-${item.id}`}
                    className="flex items-center justify-between rounded-md border border-hush-bg-hover px-2 py-1"
                  >
                    <span className="text-xs text-hush-text-primary">
                      {item.label} ({item.sizeMb}MB)
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveMedia(item.id)}
                      className="text-[11px] text-hush-text-accent hover:text-hush-purple"
                      data-testid={`social-new-post-remove-media-${item.id}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {newPostMediaError && (
              <p className="mt-2 text-xs text-red-400" data-testid="social-new-post-media-error">
                {newPostMediaError}
              </p>
            )}
          </div>

          <div className="mt-4 space-y-3 rounded-lg border border-hush-bg-hover p-3">
            <p className="text-xs font-semibold text-hush-text-primary">Audience</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="social-new-post-audience-public"
                onClick={onSelectPublicAudience}
                className={`rounded-full border px-3 py-1 text-xs ${
                  postAudience === "public"
                    ? "border-hush-purple bg-hush-purple/10 text-hush-purple"
                    : "border-hush-bg-hover text-hush-text-accent"
                }`}
              >
                Public
              </button>
              <button
                type="button"
                data-testid="social-new-post-audience-close"
                onClick={onSelectPrivateAudience}
                className={`rounded-full border px-3 py-1 text-xs ${
                  postAudience === "close"
                    ? "border-hush-purple bg-hush-purple/10 text-hush-purple"
                    : "border-hush-bg-hover text-hush-text-accent"
                }`}
              >
                Close (Private)
              </button>
            </div>

            {postAudience === "close" && (
              <div className="space-y-2" data-testid="social-new-post-private-options">
                <div className="flex flex-wrap items-center gap-2">
                  {includeInnerCircleForPost ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 bg-hush-purple/10 px-2 py-1 text-xs text-hush-purple">
                      Inner Circle
                      <button
                        type="button"
                        data-testid="social-new-post-remove-inner-circle"
                        onClick={onToggleInnerCircle}
                        disabled={selectedCircleCount <= 1}
                        className="text-hush-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
                        title={selectedCircleCount <= 1 ? "At least one circle is required" : "Remove circle"}
                      >
                        {selectedCircleCount <= 1 ? "lock" : "x"}
                      </button>
                    </span>
                  ) : null}
                  {selectedCustomCircleIdsForPost.map((feedId) => {
                    const circle = availableCustomCirclesForPost.find((item) => item.feedId === feedId);
                    if (!circle) {
                      return null;
                    }

                    return (
                      <span
                        key={circle.feedId}
                        className="inline-flex items-center gap-1 rounded-full border border-hush-purple/40 bg-hush-purple/10 px-2 py-1 text-xs text-hush-purple"
                      >
                        {circle.name}
                        <button
                          type="button"
                          data-testid={`social-new-post-remove-custom-circle-${circle.feedId}`}
                          onClick={() => onToggleCustomCircle(circle.feedId)}
                          disabled={selectedCircleCount <= 1}
                          className="text-hush-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
                          title={selectedCircleCount <= 1 ? "At least one circle is required" : "Remove circle"}
                        >
                          {selectedCircleCount <= 1 ? "lock" : "x"}
                        </button>
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    data-testid="social-new-post-add-circle"
                    onClick={() => setIsCirclePickerOpen((current) => !current)}
                    className="rounded-full border border-hush-bg-hover px-3 py-1 text-xs text-hush-text-accent hover:border-hush-purple/40"
                  >
                    Add circle
                  </button>
                </div>

                {isCirclePickerOpen ? (
                  <div className="space-y-1 rounded-md border border-hush-bg-hover bg-hush-bg-dark p-2" data-testid="social-new-post-circle-picker">
                    <label className="flex items-center gap-2 text-xs text-hush-text-primary">
                      <input
                        type="checkbox"
                        checked={includeInnerCircleForPost}
                        data-testid="social-new-post-inner-circle-toggle"
                        onChange={onToggleInnerCircle}
                        disabled={selectedCircleCount <= 1 && includeInnerCircleForPost}
                      />
                      Inner Circle (default)
                    </label>
                    {availableCustomCirclesForPost.length === 0 ? (
                      <p className="text-[11px] text-hush-text-accent">No custom circles available yet.</p>
                    ) : (
                      availableCustomCirclesForPost.map((circle) => {
                        const isChecked = selectedCustomCircleIdsForPost.includes(circle.feedId);
                        return (
                          <label key={circle.feedId} className="flex items-center gap-2 text-xs text-hush-text-primary">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              data-testid={`social-new-post-custom-circle-${circle.feedId}`}
                              onChange={() => onToggleCustomCircle(circle.feedId)}
                              disabled={selectedCircleCount <= 1 && isChecked}
                            />
                            {circle.name}
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : null}

                <div className="text-[11px] text-hush-text-accent">
                  {selectedCircleCount <= 1
                    ? "At least one circle is required for private posts."
                    : "You can remove a circle by clicking x on its badge."}
                </div>
              </div>
            )}

            <div data-testid="social-new-post-selected-circles" className="text-[11px] text-hush-text-accent">
              {postAudience === "public"
                ? "Selected: Public"
                : `Selected circles: ${selectedCircleNames.length > 0 ? selectedCircleNames.join(", ") : "none"}`}
            </div>
            {newPostAudienceError && (
              <p className="text-xs text-red-400" data-testid="social-new-post-audience-error">
                {newPostAudienceError}
              </p>
            )}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            {mode === "compact" && (
              <button
                type="button"
                onClick={onCollapse}
                className="rounded-md border border-hush-bg-hover px-3 py-1.5 text-xs text-hush-text-accent"
                data-testid="social-new-post-collapse"
              >
                Collapse
              </button>
            )}
            <button
              type="button"
              data-testid="social-new-post-publish"
              onClick={onPublish}
              className="rounded-md bg-hush-purple px-3 py-1.5 text-xs font-semibold text-hush-bg-dark"
            >
              Publish
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
