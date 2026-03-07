"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Film,
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
import { useTheaterMode } from "@/components/watch/TheaterModeContext";
import Artplayer from "artplayer";

type ArtplayerInstance = InstanceType<typeof Artplayer>;

function getArtplayerVideo(art: ArtplayerInstance | null):
  | (HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitExitFullscreen?: () => void;
      webkitDisplayingFullscreen?: boolean;
    })
  | undefined {
  if (!art) return undefined;
  const a = art as unknown as {
    $video?: HTMLVideoElement;
    video?: HTMLVideoElement;
  };
  return (a.$video ?? a.video) as
    | (HTMLVideoElement & {
        webkitEnterFullscreen?: () => void;
        webkitExitFullscreen?: () => void;
        webkitDisplayingFullscreen?: boolean;
      })
    | undefined;
}

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reports as Mac, but has touch points
  const isIPadOS =
    /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === "number"
      ? navigator.maxTouchPoints > 1
      : false;
  return isIOS || isIPadOS;
}

type VideoJsPlayerProps = {
  src: string;
  subtitleSrc?: string | null;
  subtitleLabel?: string;
  subtitleLang?: string;
  vastTagUrl?: string | null;
};

export function VideoJsPlayer({
  src,
  subtitleSrc,
  subtitleLabel = "Vietnamese",
  subtitleLang = "vi",
  vastTagUrl: _vastTagUrl,
}: VideoJsPlayerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<ArtplayerInstance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isSubtitleEnabled, setIsSubtitleEnabled] = useState(
    Boolean(subtitleSrc),
  );
  const hideControlsTimerRef = useRef<number | null>(null);
  const suppressRevealUntilRef = useRef<number>(0);
  const lastTouchHandledRef = useRef<number>(0);
  const scrollLockRef = useRef<{
    scrollY: number;
    htmlOverflow: string;
    bodyPosition: string;
    bodyTop: string;
    bodyLeft: string;
    bodyRight: string;
    bodyWidth: string;
  } | null>(null);
  const subtitleBlobUrlRef = useRef<string | null>(null);
  const speedOptions = [0.75, 1, 1.25, 1.5, 2] as const;
  const hasSubtitle = Boolean(subtitleSrc);
  const isIOS = useMemo(() => isIOSDevice(), []);
  const theaterModeCtx = useTheaterMode();

  const clearHideControlsTimer = () => {
    if (hideControlsTimerRef.current !== null) {
      window.clearTimeout(hideControlsTimerRef.current);
      hideControlsTimerRef.current = null;
    }
  };

  const scheduleHideControls = () => {
    clearHideControlsTimer();
    const art = playerRef.current;
    if (!art || art.isDestroy || !art.playing) return;
    hideControlsTimerRef.current = window.setTimeout(() => {
      setIsControlsVisible(false);
      setIsSettingsOpen(false);
    }, 2000);
  };

  const hideControlsImmediately = () => {
    clearHideControlsTimer();
    setIsControlsVisible(false);
    setIsSettingsOpen(false);
    suppressRevealUntilRef.current = Date.now() + 280;
  };

  const revealControls = (byMouseMove = false) => {
    if (byMouseMove && Date.now() < suppressRevealUntilRef.current) return;
    setIsControlsVisible(true);
    scheduleHideControls();
  };

  const handleWrapperPointer = (e: React.MouseEvent | React.TouchEvent) => {
    const isTouch = e.nativeEvent.type.startsWith("touch");
    const isClick = e.nativeEvent.type === "click";
    // Trên mobile: touch xong trình duyệt còn fire thêm click → gọi 2 lần gây nhấp nháy. Bỏ qua click nếu vừa xử lý touch.
    if (isClick && Date.now() - lastTouchHandledRef.current < 400) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isTouch) lastTouchHandledRef.current = Date.now();

    const target = e.target as Node;
    const isControlsArea =
      target instanceof Element &&
      target.closest("[data-controls-area]") !== null;
    if (isControlsArea) {
      revealControls();
      return;
    }
    // Chạm vùng trống: đang phát thì toggle (hiện → ẩn ngay, ẩn → hiện); dừng thì hiện
    if (isPlaying) {
      if (isControlsVisible) {
        hideControlsImmediately();
      } else {
        revealControls();
      }
    } else {
      revealControls();
    }
  };

  const seekBy = (seconds: number) => {
    const art = playerRef.current;
    if (!art || art.isDestroy) return;
    const current = art.currentTime;
    const dur = art.duration;
    const next = Math.min(
      Math.max(current + seconds, 0),
      dur || Number.MAX_SAFE_INTEGER,
    );
    art.currentTime = next;
  };

  const togglePlay = () => {
    const art = playerRef.current;
    if (!art || art.isDestroy) return;
    if (art.playing) {
      art.pause();
    } else {
      void art.play();
    }
  };

  const onSeek = (nextTime: number) => {
    const art = playerRef.current;
    if (!art || art.isDestroy) return;
    art.currentTime = nextTime;
  };

  const onVolumeChange = (nextVolume: number) => {
    const art = playerRef.current;
    if (!art || art.isDestroy) return;
    art.volume = nextVolume;
    if (nextVolume > 0 && art.muted) {
      art.muted = false;
    }
  };

  const toggleMute = () => {
    const art = playerRef.current;
    if (!art || art.isDestroy) return;
    art.muted = !art.muted;
  };

  const toggleFullscreen = () => {
    const wrapper = wrapperRef.current;
    const art = playerRef.current;
    if (!wrapper) return;

    const video = getArtplayerVideo(art);
    const isIOS =
      typeof navigator !== "undefined" &&
      /iPad|iPhone|iPod/.test(navigator.userAgent);

    if (isIOS && video) {
      const displaying = video.webkitDisplayingFullscreen === true;
      if (displaying && typeof video.webkitExitFullscreen === "function") {
        video.webkitExitFullscreen();
      } else if (
        !displaying &&
        typeof video.webkitEnterFullscreen === "function"
      ) {
        video.webkitEnterFullscreen();
      }
      return;
    }

    if (typeof wrapper.requestFullscreen !== "function") return;
    if (document.fullscreenElement === wrapper) {
      void document.exitFullscreen();
    } else {
      void wrapper.requestFullscreen();
    }
  };

  const setSubtitleMode = (enabled: boolean) => {
    const art = playerRef.current;
    if (!art || art.isDestroy) return;
    art.subtitle.show = enabled;
    setIsSubtitleEnabled(enabled);
  };

  const changePlaybackRate = (nextRate: number) => {
    const art = playerRef.current;
    if (!art || art.isDestroy) return;
    art.playbackRate = nextRate as ArtplayerInstance["playbackRate"];
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
    const containerEl = containerRef.current;
    if (!containerEl || !containerEl.isConnected) return;

    function initPlayer() {
      const el = containerRef.current;
      if (disposed || !el?.isConnected) return;
      if (playerRef.current && !playerRef.current.isDestroy) return;

      Artplayer.NOTICE_TIME = 0;
      const videoUrl = src + (src.includes("#") ? "" : "#t=0.001");
      const art = new Artplayer({
        container: el,
        url: videoUrl,
        autoplay: false,
        theme: "#f59e0b",
        volume: 1,
        muted: false,
        setting: false,
        fullscreen: false,
        fullscreenWeb: false,
        pip: false,
        playbackRate: false,
        hotkey: true,
        moreVideoAttr: {
          preload: "auto",
          playsInline: true,
        },
      });

      playerRef.current = art;

      const syncState = () => {
        setCurrentTime(art.currentTime);
        setDuration(art.duration);
        setVolume(art.volume);
        setIsMuted(art.muted);
        setIsPlaying(art.playing);
        setIsFullscreen(art.fullscreen);
        setPlaybackRate(art.playbackRate as number);
        setIsSubtitleEnabled(art.subtitle.show);
      };

      art.on("ready", () => {
        setIsReady(true);
        setIsControlsVisible(true);
        setIsSettingsOpen(false);
        syncState();

        const noticeEl = el.querySelector(".art-notice");
        if (noticeEl instanceof HTMLElement) {
          noticeEl.style.setProperty("display", "none", "important");
          noticeEl.style.setProperty("visibility", "hidden", "important");
        }

        art.on("video:timeupdate", syncState);
        art.on("video:durationchange", syncState);
        art.on("video:volumechange", syncState);
        art.on("video:play", () => {
          syncState();
          scheduleHideControls();
          requestAnimationFrame(() => {
            if (!art.isDestroy) art.notice.show = "";
          });
        });
        art.on("video:pause", () => {
          syncState();
          clearHideControlsTimer();
          setIsControlsVisible(true);
          requestAnimationFrame(() => {
            if (!art.isDestroy) art.notice.show = "";
          });
        });
        art.on("video:ended", () => {
          syncState();
          clearHideControlsTimer();
          setIsControlsVisible(true);
        });
        art.on("fullscreen", () => {
          syncState();
        });

        const vid = getArtplayerVideo(art);
        if (vid) {
          const onWebkitEndFullscreen = () => setIsFullscreen(false);
          const onWebkitBeginFullscreen = () => setIsFullscreen(true);
          vid.addEventListener("webkitendfullscreen", onWebkitEndFullscreen);
          vid.addEventListener(
            "webkitbeginfullscreen",
            onWebkitBeginFullscreen,
          );
          art.on("destroy", () => {
            vid.removeEventListener(
              "webkitendfullscreen",
              onWebkitEndFullscreen,
            );
            vid.removeEventListener(
              "webkitbeginfullscreen",
              onWebkitBeginFullscreen,
            );
          });
        }

        const rawSubSrc = subtitleSrc?.trim();
        if (rawSubSrc) {
          const resolveSubSrc = async (): Promise<string> => {
            const isExternal = /^https?:\/\//i.test(rawSubSrc);
            if (isExternal) {
              const res = await fetch(
                `/api/subtitle?url=${encodeURIComponent(rawSubSrc)}`,
              );
              if (!res.ok) throw new Error(`Subtitle ${res.status}`);
              const vttText = await res.text();
              const blob = new Blob([vttText], { type: "text/vtt" });
              const blobUrl = URL.createObjectURL(blob);
              subtitleBlobUrlRef.current = blobUrl;
              return blobUrl;
            }
            return rawSubSrc;
          };

          resolveSubSrc()
            .then(async (trackSrc) => {
              if (art.isDestroy) return;
              await art.subtitle.switch(trackSrc, { name: "CC" });
              art.subtitle.show = true;
              art.subtitle.style({
                color: "#fff",
                textShadow: "none",
                webkitTextStroke: "1px #000",
              });
              setIsSubtitleEnabled(true);
            })
            .catch((err) => {
              console.error("[VideoJsPlayer] Load sub qua proxy failed", err);
            });
        }
      });

      // VAST/IMA: defer to phase 2 or use artplayer-plugin-ads when needed
    }

    initPlayer();

    return () => {
      disposed = true;
      clearHideControlsTimer();
      setIsReady(false);
      setIsSettingsOpen(false);
      setPlaybackRate(1);
      setIsSubtitleEnabled(Boolean(subtitleSrc));
      if (subtitleBlobUrlRef.current) {
        URL.revokeObjectURL(subtitleBlobUrlRef.current);
        subtitleBlobUrlRef.current = null;
      }
      if (playerRef.current && !playerRef.current.isDestroy) {
        playerRef.current.destroy(true);
      }
      playerRef.current = null;
    };
  }, [src, subtitleLabel, subtitleLang, subtitleSrc]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === wrapper);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="art-drama-player absolute inset-0 size-full"
      onMouseMove={() => revealControls(true)}
      onTouchStart={handleWrapperPointer}
      onClick={handleWrapperPointer}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 size-full rounded-xl [&_.art-video-player]:!rounded-xl [&_.art-bottom]:!hidden [&_.art-center]:!hidden"
      />

      {isReady && (
        <>
          <div
            data-controls-area
            className={`absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 transition-opacity duration-200 ${
              isControlsVisible || !isPlaying
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            <button
              type="button"
              onClick={() => seekBy(-5)}
              className="inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition-colors hover:bg-black/75"
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
              className="inline-flex size-16 items-center justify-center rounded-full bg-black/60 text-white shadow-2xl transition-colors hover:bg-black/75"
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
              className="inline-flex size-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg transition-colors hover:bg-black/75"
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
          <div
            data-controls-area
            className={`absolute inset-x-0 bottom-0 z-40 space-y-2 bg-gradient-to-t from-black/50 via-black/20 to-transparent p-3 text-white transition-opacity duration-200 ${
              isControlsVisible || !isPlaying
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            <div className="hidden items-center gap-2 md:flex">
              <span className="ml-auto text-xs tabular-nums text-white/90">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="space-y-2">
              <div className="relative flex h-4 w-full items-center">
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
                <div
                  className="pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-300 bg-white shadow-md"
                  style={{ left: `${progressPercent}%` }}
                  aria-hidden
                />
              </div>

              <div className="relative flex w-full items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="inline-flex size-6 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
                  aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="size-4" />
                  ) : (
                    <Volume2 className="size-4" />
                  )}
                </button>

                <span className="min-w-20 shrink-0 text-xs tabular-nums text-white/90 md:hidden">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onVolumeChange(Number(e.target.value))
                  }
                  className="hidden h-1.5 w-26 cursor-pointer accent-zinc-300 md:block"
                  aria-label="Âm lượng"
                />

                {theaterModeCtx && (
                  <button
                    type="button"
                    onClick={theaterModeCtx.toggleTheaterMode}
                    className={`md:hidden inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-white/25 ${
                      theaterModeCtx.theaterMode
                        ? "bg-white/25 text-amber-400"
                        : "bg-white/15"
                    }`}
                    aria-label={
                      theaterModeCtx.theaterMode
                        ? "Thoát chế độ rạp chiếu phim"
                        : "Chế độ rạp chiếu phim"
                    }
                    title="Chế độ rạp chiếu phim"
                  >
                    <Film className="size-4" />
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen((prev: boolean) => !prev)}
                    className="relative inline-flex size-8 items-center justify-center rounded-full bg-white/15 transition-colors hover:bg-white/25"
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
                </div>

                {isSettingsOpen && (
                  <div className="absolute bottom-10 right-4 z-40 min-w-52 space-y-3 rounded-lg border border-white/20 bg-black/85 p-3 text-xs shadow-xl backdrop-blur-md">
                    <div>
                      <p className="mb-2 text-white/70">Chất lượng</p>
                      <div className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-white">
                        <span>Auto</span>
                        <span className="rounded bg-red-600 px-1 py-0.5 text-[10px] font-semibold leading-none text-white">
                          HD
                        </span>
                      </div>
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
                      <div
                        className={`flex items-center gap-2 rounded px-1 py-1 ${
                          !hasSubtitle ? "cursor-not-allowed opacity-60" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => hasSubtitle && setSubtitleMode(true)}
                          disabled={!hasSubtitle}
                          className={`inline-flex items-center gap-0.5 rounded px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                            hasSubtitle
                              ? isSubtitleEnabled
                                ? "bg-white/20 text-white"
                                : "text-white/60 hover:bg-white/10 hover:text-white/80"
                              : "cursor-not-allowed text-white/40"
                          }`}
                          aria-label="Bật phụ đề"
                        >
                          <span
                            className={`relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
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
                          <span
                            className={`px-1 ${
                              hasSubtitle && isSubtitleEnabled
                                ? "text-white"
                                : "text-white/70"
                            }`}
                          >
                            Bật
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => hasSubtitle && setSubtitleMode(false)}
                          disabled={!hasSubtitle}
                          className={`inline-flex items-center gap-0.5 rounded px-2 py-1.5 text-[10px] font-semibold transition-colors ${
                            hasSubtitle
                              ? !isSubtitleEnabled
                                ? "bg-white/20 text-white"
                                : "text-white/60 hover:bg-white/10 hover:text-white/80"
                              : "cursor-not-allowed text-white/40"
                          }`}
                          aria-label="Tắt phụ đề"
                        >
                          <span
                            className={`relative inline-flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                              !hasSubtitle
                                ? "border-white/25"
                                : !isSubtitleEnabled
                                  ? "border-emerald-400"
                                  : "border-white/60"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full transition-colors ${
                                !hasSubtitle
                                  ? "bg-white/25"
                                  : !isSubtitleEnabled
                                    ? "bg-emerald-400"
                                    : "bg-white/70"
                              }`}
                            />
                          </span>
                          <span
                            className={`px-1 ${
                              hasSubtitle && !isSubtitleEnabled
                                ? "text-white"
                                : "text-white/70"
                            }`}
                          >
                            Tắt
                          </span>
                        </button>
                      </div>
                      {!hasSubtitle && (
                        <p className="mt-1 text-[10px] text-white/50">
                          Không có phụ đề
                        </p>
                      )}
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
