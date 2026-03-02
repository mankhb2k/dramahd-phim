"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
} from "lucide-react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";

type VideoJsPlayerProps = {
  src: string;
  subtitleSrc?: string | null;
  subtitleLabel?: string;
  subtitleLang?: string;
  vastTagUrl?: string | null;
};

declare global {
  interface Window {
    google?: {
      ima?: unknown;
    };
  }
}

function loadImaSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.ima) return Promise.resolve();

  const existing = document.querySelector(
    'script[data-ima-sdk="true"]',
  ) as HTMLScriptElement | null;

  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load IMA SDK")),
        { once: true },
      );
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://imasdk.googleapis.com/js/sdkloader/ima3.js";
    script.async = true;
    script.dataset.imaSdk = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load IMA SDK"));
    document.head.appendChild(script);
  });
}

export function VideoJsPlayer({
  src,
  subtitleSrc,
  subtitleLabel = "Vietnamese",
  subtitleLang = "vi",
  vastTagUrl,
}: VideoJsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSubtitleEnabled, setIsSubtitleEnabled] = useState(
    Boolean(subtitleSrc),
  );
  const hideControlsTimerRef = useRef<number | null>(null);
  const speedOptions = [0.75, 1, 1.25, 1.5, 2] as const;
  const hasSubtitle = Boolean(subtitleSrc);

  const clearHideControlsTimer = () => {
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  };

  const scheduleHideControls = () => {
    clearHideControlsTimer();
    const player = playerRef.current;
    if (!player || player.isDisposed() || player.paused()) return;
    hideControlsTimerRef.current = window.setTimeout(() => {
      setIsControlsVisible(false);
      setIsSettingsOpen(false);
    }, 3000);
  };

  const revealControls = () => {
    setIsControlsVisible(true);
    scheduleHideControls();
  };

  const seekBy = (seconds: number) => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    const current = player.currentTime() ?? 0;
    const duration = player.duration() ?? 0;
    const next = Math.min(
      Math.max(current + seconds, 0),
      duration || Number.MAX_SAFE_INTEGER,
    );
    player.currentTime(next);
  };

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    if (player.paused()) {
      void player.play();
    } else {
      player.pause();
    }
  };

  const onSeek = (nextTime: number) => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    player.currentTime(nextTime);
  };

  const onVolumeChange = (nextVolume: number) => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    player.volume(nextVolume);
    if (nextVolume > 0 && player.muted()) {
      player.muted(false);
    }
  };

  const toggleMute = () => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    player.muted(!player.muted());
  };

  const toggleFullscreen = () => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    if (player.isFullscreen()) {
      void player.exitFullscreen();
    } else {
      void player.requestFullscreen();
    }
  };

  const setSubtitleMode = (enabled: boolean) => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    const textTracks = player.textTracks();
    if (!textTracks) return;
    const tracks = textTracks as unknown as ArrayLike<TextTrack>;

    let foundSubtitleTrack = false;
    for (let i = 0; i < textTracks.length; i += 1) {
      const track = tracks[i];
      if (!track) continue;
      if (track.kind === "subtitles" || track.kind === "captions") {
        foundSubtitleTrack = true;
        track.mode = enabled ? "showing" : "disabled";
      }
    }

    if (foundSubtitleTrack) {
      setIsSubtitleEnabled(enabled);
    }
  };

  const changePlaybackRate = (nextRate: number) => {
    const player = playerRef.current;
    if (!player || player.isDisposed()) return;
    player.playbackRate(nextRate);
    setPlaybackRate(nextRate);
  };

  const formatTime = (timeInSeconds: number): string => {
    if (!Number.isFinite(timeInSeconds) || timeInSeconds < 0) return "00:00";
    const totalSeconds = Math.floor(timeInSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const progressPercent = useMemo(() => {
    if (!duration) return 0;
    return Math.min((currentTime / duration) * 100, 100);
  }, [currentTime, duration]);

  useEffect(() => {
    let disposed = false;
    const videoElement = videoRef.current;
    if (!videoElement || !videoElement.isConnected) return;
    const mountedVideo = videoElement;

    async function initPlayer() {
      if (disposed || !mountedVideo.isConnected) return;
      if (playerRef.current && !playerRef.current.isDisposed()) return;

      const player = videojs(mountedVideo, {
        controls: false,
        bigPlayButton: false,
        controlBar: false,
        autoplay: false,
        preload: "auto",
        responsive: true,
        fluid: false,
        fill: true,
        sources: [{ src, type: "video/mp4" }],
      });

      playerRef.current = player;
      setIsReady(true);
      setIsControlsVisible(true);
      setIsSettingsOpen(false);

      const syncState = () => {
        setCurrentTime(player.currentTime() ?? 0);
        setDuration(player.duration() ?? 0);
        setVolume(player.volume() ?? 1);
        setIsMuted(player.muted() ?? false);
        setIsPlaying(!player.paused());
        setIsFullscreen(player.isFullscreen() ?? false);
        setPlaybackRate(player.playbackRate() ?? 1);

        const textTracks = player.textTracks();
        let subtitleShowing = false;
        if (textTracks) {
          const tracks = textTracks as unknown as ArrayLike<TextTrack>;
          for (let i = 0; i < textTracks.length; i += 1) {
            const track = tracks[i];
            if (!track) continue;
            if (
              (track.kind === "subtitles" || track.kind === "captions") &&
              track.mode === "showing"
            ) {
              subtitleShowing = true;
            }
          }
        }
        setIsSubtitleEnabled(subtitleShowing);
      };
      syncState();

      player.on("loadedmetadata", syncState);
      player.on("durationchange", syncState);
      player.on("timeupdate", syncState);
      player.on("play", () => {
        syncState();
        scheduleHideControls();
      });
      player.on("pause", () => {
        syncState();
        clearHideControlsTimer();
        setIsControlsVisible(true);
      });
      player.on("ended", () => {
        syncState();
        clearHideControlsTimer();
        setIsControlsVisible(true);
      });
      player.on("volumechange", syncState);
      player.on("fullscreenchange", syncState);

      if (subtitleSrc) {
        player.addRemoteTextTrack(
          {
            kind: "subtitles",
            src: subtitleSrc,
            srclang: subtitleLang,
            label: subtitleLabel,
            default: true,
          },
          false,
        );
        window.setTimeout(() => setSubtitleMode(true), 0);
      }

      if (vastTagUrl) {
        try {
          await Promise.all([
            import("videojs-contrib-ads"),
            import("videojs-ima"),
          ]);
          await loadImaSdk();

          if (
            typeof (player as unknown as { ima?: unknown }).ima === "function"
          ) {
            (
              player as unknown as {
                ima: (options: { adTagUrl: string }) => void;
              }
            ).ima({
              adTagUrl: vastTagUrl,
            });
          }
        } catch (error) {
          console.error("[VideoJsPlayer] VAST init failed", error);
        }
      }
    }

    const rafId = window.requestAnimationFrame(() => {
      void initPlayer();
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      clearHideControlsTimer();
      setIsReady(false);
      setIsSettingsOpen(false);
      setPlaybackRate(1);
      setIsSubtitleEnabled(Boolean(subtitleSrc));
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
      }
      playerRef.current = null;
    };
  }, [src, subtitleLabel, subtitleLang, subtitleSrc, vastTagUrl]);

  return (
    <div
      data-vjs-player
      className="vjs-drama-player relative w-full"
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      onClick={revealControls}
    >
      {/* Core video element managed by Video.js */}
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered size-full rounded-xl"
      />

      {isReady && (
        <>
          {/* Center overlay controls: seek/play/seek */}
          <div
            className={`absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 transition-opacity duration-200 ${
              isControlsVisible || !isPlaying
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={() => seekBy(-5)}
              className="inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/75"
              aria-label="Lùi 5 giây"
            >
              <span className="relative flex size-full items-center justify-center">
                <RotateCcw className="size-6" />
                <span className="pointer-events-none absolute text-[8px] font-bold leading-none">
                  5
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex size-16 items-center justify-center rounded-full bg-black/60 text-white shadow-2xl backdrop-blur-sm transition-colors hover:bg-black/75"
              aria-label={isPlaying ? "Tạm dừng video" : "Phát video"}
            >
              {isPlaying ? (
                <span className="flex size-full items-center justify-center">
                  <Pause className="size-9 fill-current" />
                </span>
              ) : (
                <span className="flex size-full items-center justify-center">
                  <Play className="size-9 fill-current" />
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => seekBy(5)}
              className="inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-sm transition-colors hover:bg-black/75"
              aria-label="Tiến 5 giây"
            >
              <span className="relative flex size-full items-center justify-center">
                <RotateCw className="size-6" />
                <span className="pointer-events-none absolute text-[8px] font-bold leading-none">
                  5
                </span>
              </span>
            </button>
          </div>
        </>
      )}

      {isReady && (
        <>
          {/* Bottom control bar: time, progress, audio, settings, fullscreen */}
          <div
            className={`absolute inset-x-0 bottom-0 z-40 space-y-2 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-3 text-white transition-opacity duration-200 ${
              isControlsVisible || !isPlaying
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="ml-auto text-xs tabular-nums text-white/90">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="space-y-2">
              {/* Timeline/progress seek bar */}
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-600">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-zinc-300"
                  style={{ width: `${progressPercent}%` }}
                />
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onSeek(Number(e.target.value))
                  }
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="Thanh thời lượng video"
                />
              </div>

              {/* Utility controls row */}
              <div className="relative flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
                  aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="size-4" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onVolumeChange(Number(e.target.value))
                  }
                  className="h-1.5 w-28 cursor-pointer accent-zinc-300"
                  aria-label="Âm lượng"
                />

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev: boolean) => !prev)}
                  className="relative ml-auto inline-flex size-8 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
                  aria-label="Mở cài đặt phát video"
                >
                  <Settings className="size-4" />
                  <span className="pointer-events-none absolute -right-0.5 -top-0.5 rounded bg-red-600 px-1 text-[9px] font-semibold leading-3 text-white shadow">
                    HD
                  </span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
                  aria-label={
                    isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"
                  }
                >
                  {isFullscreen ? (
                    <Minimize className="size-4" />
                  ) : (
                    <Maximize className="size-4" />
                  )}
                </button>

                {/* Popup settings panel: quality, speed, subtitle */}
                {isSettingsOpen && (
                  <div className="absolute bottom-10 right-4 z-40 min-w-52 space-y-3 rounded-lg border border-white/20 bg-black/85 p-3 text-xs shadow-xl backdrop-blur-md">
                    <div>
                      <p className="mb-2 text-white/70">Chất lượng</p>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-white transition-colors hover:bg-white/10"
                      >
                        <span className="pr-2">Auto</span>
                        <span className="rounded bg-red-600 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
                          HD
                        </span>
                      </button>
                    </div>

                    <div>
                      <p className="mb-2 text-white/70">Tốc độ phát</p>
                      <div className="grid grid-cols-3 gap-1.5 rounded-md p-1">
                        {speedOptions.map(
                          (rate: (typeof speedOptions)[number]) => (
                            <button
                              key={rate}
                              type="button"
                              onClick={() => changePlaybackRate(rate)}
                              className={`rounded border px-1 py-1 text-center transition-colors ${
                                playbackRate === rate
                                  ? "border-white/80 bg-white/30 text-white ring-1 ring-white/50"
                                  : "border-transparent bg-transparent text-white/35 hover:border-white/20 hover:bg-white/10 hover:text-white/65"
                              }`}
                            >
                              {rate}x
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-white/70">Phụ đề</p>
                      <button
                        type="button"
                        onClick={() => setSubtitleMode(!isSubtitleEnabled)}
                        disabled={!hasSubtitle}
                        className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors ${
                          hasSubtitle
                            ? "text-white hover:bg-white/10"
                            : "cursor-not-allowed text-white/40"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            className={`relative inline-flex size-4 items-center justify-center rounded-full border transition-colors ${
                              !hasSubtitle
                                ? "border-white/25"
                                : isSubtitleEnabled
                                  ? "border-emerald-400"
                                  : "border-white/60"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full transition-colors ${
                                !hasSubtitle
                                  ? "bg-white/25"
                                  : isSubtitleEnabled
                                    ? "bg-emerald-400"
                                    : "bg-white/70"
                              }`}
                            />
                          </span>
                          <span className="text-[10px] font-semibold leading-none text-white/80">
                            {hasSubtitle
                              ? isSubtitleEnabled
                                ? "Bật"
                                : "Tắt"
                              : "Unavailable"}
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
