"use client";

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
  selectedCustomCircleIdForPost: string | null;
  onSelectCustomCircle: (feedId: string) => void;
  onClearCustomCircle: () => void;
  selectedCircleNames: string[];
  newPostAudienceError: string | null;
  draftMediaItems: DraftMediaItem[];
  newPostMediaError: string | null;
  maxMediaAttachments: number;
  maxMediaSizeMb: number;
  onAddImage: () => void;
  onAddVideo: () => void;
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
  selectedCustomCircleIdForPost,
  onSelectCustomCircle,
  onClearCustomCircle,
  selectedCircleNames,
  newPostAudienceError,
  draftMediaItems,
  newPostMediaError,
  maxMediaAttachments,
  maxMediaSizeMb,
  onAddImage,
  onAddVideo,
  onRemoveMedia,
  onPublish,
}: SocialPostComposerCardProps) {
  const showCompactHeader = mode === "compact" && !isExpanded;
  const showComposerBody = mode === "full" || isExpanded;

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
            data-testid="social-new-post-draft"
            value={newPostDraft}
            onChange={(event) => onDraftChange(event.currentTarget.value)}
            placeholder="What do you want to show us?"
            className="mt-3 w-full min-h-28 rounded-md border border-hush-bg-hover bg-hush-bg-dark px-3 py-2 text-sm text-hush-text-primary outline-none focus:border-hush-purple"
          />

          <div className="mt-3 rounded-lg border border-hush-bg-hover p-3" data-testid="social-new-post-media">
            <p className="text-xs font-semibold text-hush-text-primary">Media</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="social-new-post-add-image"
                onClick={onAddImage}
                className="rounded-full border border-hush-bg-hover px-3 py-1 text-xs text-hush-text-accent hover:border-hush-purple/40"
              >
                + Image
              </button>
              <button
                type="button"
                data-testid="social-new-post-add-video"
                onClick={onAddVideo}
                className="rounded-full border border-hush-bg-hover px-3 py-1 text-xs text-hush-text-accent hover:border-hush-purple/40"
              >
                + Video
              </button>
            </div>
            <p className="mt-2 text-[11px] text-hush-text-accent">
              Limits: up to {maxMediaAttachments} attachments, each up to {maxMediaSizeMb}MB.
            </p>
            {draftMediaItems.length > 0 && (
              <ul className="mt-2 space-y-1" data-testid="social-new-post-media-list">
                {draftMediaItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between rounded-md border border-hush-bg-hover px-2 py-1">
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
                <label className="flex items-center gap-2 text-xs text-hush-text-primary">
                  <input
                    type="checkbox"
                    checked={includeInnerCircleForPost}
                    data-testid="social-new-post-inner-circle-toggle"
                    onChange={onToggleInnerCircle}
                  />
                  Inner Circle (default)
                </label>

                <div className="space-y-1">
                  <p className="text-[11px] text-hush-text-accent">Select at most one custom circle:</p>
                  {availableCustomCirclesForPost.length === 0 ? (
                    <p className="text-[11px] text-hush-text-accent">No custom circles available yet.</p>
                  ) : (
                    availableCustomCirclesForPost.map((circle) => (
                      <label key={circle.feedId} className="flex items-center gap-2 text-xs text-hush-text-primary">
                        <input
                          type="radio"
                          name="new-post-custom-circle"
                          checked={selectedCustomCircleIdForPost === circle.feedId}
                          data-testid={`social-new-post-custom-circle-${circle.feedId}`}
                          onChange={() => onSelectCustomCircle(circle.feedId)}
                        />
                        {circle.name}
                      </label>
                    ))
                  )}
                  {selectedCustomCircleIdForPost && (
                    <button
                      type="button"
                      data-testid="social-new-post-clear-custom-circle"
                      onClick={onClearCustomCircle}
                      className="rounded border border-hush-bg-hover px-2 py-1 text-[11px] text-hush-text-accent hover:bg-hush-bg-hover"
                    >
                      Clear custom circle
                    </button>
                  )}
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
