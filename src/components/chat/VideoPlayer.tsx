"use client";

import { useState, useRef, useCallback, useEffect, memo } from "react";
import { Play, Pause } from "lucide-react";
import { formatDuration } from "./VideoThumbnail";

interface VideoPlayerProps {
  /** Blob URL for the decrypted video file */
  src: string;
  /** Poster image (thumbnail frame blob URL) */
  poster?: string;
  /** Accessible file name */
  fileName: string;
}

/**
 * FEAT-068: Custom video player with progress bar, play/pause, and scrubbing.
 *
 * - Click on video to toggle play/pause
 * - Progress bar at bottom (click or drag to seek)
 * - Touch-drag on progress bar for mobile scrubbing
 * - Auto-hide controls after 3s during playback
 * - Time display (current / total)
 */
export const VideoPlayer = memo(function VideoPlayer({
  src,
  poster,
  fileName,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // --- Playback controls ---

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  // --- Seeking ---

  const seekToFraction = useCallback(
    (clientX: number) => {
      const bar = progressRef.current;
      const video = videoRef.current;
      if (!bar || !video || !duration) return;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      video.currentTime = fraction * duration;
    },
    [duration],
  );

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsSeeking(true);
      seekToFraction(e.clientX);
    },
    [seekToFraction],
  );

  const handleProgressTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.stopPropagation();
      setIsSeeking(true);
      seekToFraction(e.touches[0].clientX);
    },
    [seekToFraction],
  );

  // Global move/end handlers while seeking
  useEffect(() => {
    if (!isSeeking) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      seekToFraction(clientX);
    };
    const handleEnd = () => setIsSeeking(false);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isSeeking, seekToFraction]);

  // --- Video element events ---

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setShowControls(true);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    video.addEventListener("ended", onEnded);

    // If metadata already loaded (e.g. from cache)
    if (video.duration) setDuration(video.duration);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  // --- Auto-hide controls ---

  const resetHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setShowControls(true);
    if (isPlaying && !isSeeking) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying, isSeeking]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [resetHideTimer]);

  const controlsVisible = showControls || !isPlaying;

  return (
    <div
      className="relative max-w-[90vw] max-h-[85vh] select-none"
      onMouseMove={resetHideTimer}
      data-testid="video-player"
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
        preload="metadata"
        playsInline
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
          resetHideTimer();
        }}
        aria-label={fileName}
        data-testid="video-player-element"
      />

      {/* Center play/pause overlay - container is pointer-events-none,
           but the icon button itself is pointer-events-auto so Playwright
           (and users) can click it directly without fighting autoplay policy. */}
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
        data-testid={isPlaying ? "video-state-playing" : "video-state-paused"}
      >
        {isPlaying ? (
          <div
            className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center pointer-events-auto cursor-pointer"
            data-testid="video-pause-icon"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
              resetHideTimer();
            }}
          >
            <Pause className="w-8 h-8 text-white fill-white" />
          </div>
        ) : (
          <div
            className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center pointer-events-auto cursor-pointer"
            data-testid="video-play-icon"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
              resetHideTimer();
            }}
          >
            <Play className="w-8 h-8 text-white fill-white ml-0.5" />
          </div>
        )}
      </div>

      {/* Bottom controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8 rounded-b-lg transition-opacity duration-200 ${
          controlsVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-1.5 bg-white/30 rounded-full cursor-pointer group relative"
          onMouseDown={handleProgressMouseDown}
          onTouchStart={handleProgressTouchStart}
          data-testid="video-progress-bar"
        >
          {/* Played portion */}
          <div
            className="h-full bg-hush-purple rounded-full pointer-events-none"
            style={{ width: `${progress}%` }}
          />
          {/* Scrub handle - visible on hover or while seeking */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md transition-opacity ${
              isSeeking ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            style={{ left: `calc(${progress}% - 7px)` }}
          />
        </div>

        {/* Time display */}
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-white/80" data-testid="video-current-time">
            {formatDuration(currentTime)}
          </span>
          <span className="text-xs text-white/80" data-testid="video-duration">
            {duration > 0 ? formatDuration(duration) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
});
