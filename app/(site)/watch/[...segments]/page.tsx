import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildWatchHrefTree,
  parseEpisodeSlug,
  parseLegacyWatchSlug,
} from "@/lib/watch-slug";
import { EpisodeSwitcher } from "@/components/watch/EpisodeSwitcher";
import { VideoJsPlayer } from "@/components/watch/VideoPlayer";
import { WatchPageAd } from "@/components/ads/WatchPageAd";
import { StickyBanner } from "@/components/ads/StickyBannerAds";
import { ArrowLeft } from "lucide-react";

interface WatchCatchAllPageProps {
  params: Promise<{ segments: string[] }>;
}

type ParsedVideoSource = {
  src: string;
  subtitleSrc: string | null;
  subtitleLabel: string;
  subtitleLang: string;
  vastTagUrl: string | null;
};

function isMp4Source(url: string): boolean {
  return /\.mp4($|\?)/i.test(url);
}

function parseVideoSource(rawUrl: string): ParsedVideoSource {
  try {
    const url = new URL(rawUrl);
    const subtitleSrc =
      url.searchParams.get("sub") ?? url.searchParams.get("subtitle");
    const vastTagUrl =
      url.searchParams.get("vast") ?? url.searchParams.get("vastTag");
    const subtitleLabel = url.searchParams.get("subLabel") ?? "Vietnamese";
    const subtitleLang = url.searchParams.get("subLang") ?? "vi";

    url.searchParams.delete("sub");
    url.searchParams.delete("subtitle");
    url.searchParams.delete("vast");
    url.searchParams.delete("vastTag");
    url.searchParams.delete("subLabel");
    url.searchParams.delete("subLang");

    return {
      src: url.toString(),
      subtitleSrc,
      subtitleLabel,
      subtitleLang,
      vastTagUrl,
    };
  } catch {
    return {
      src: rawUrl,
      subtitleSrc: null,
      subtitleLabel: "Vietnamese",
      subtitleLang: "vi",
      vastTagUrl: null,
    };
  }
}

async function handleLegacySlug(slug: string) {
  const parsed = parseLegacyWatchSlug(slug);
  if (!parsed) notFound();

  const { movieSlug, episodeNumber } = parsed;
  const movie = await prisma.movie.findFirst({
    where: { slug: movieSlug },
    select: { channel: true },
  });
  if (!movie) notFound();
  const channel = movie.channel || "nsh";
  const episodeSlug = `tap-${episodeNumber}`;
  permanentRedirect(buildWatchHrefTree(channel, movieSlug, episodeSlug));
}

async function handleTreePath(parts: string[]) {
  const [channel, movieSlug, episodeSlug] = parts;
  const episodeNumber = parseEpisodeSlug(episodeSlug);
  if (!episodeNumber) notFound();

  const movie = await prisma.movie.findFirst({
    where: { slug: movieSlug, channel },
    include: {
      episodes: {
        orderBy: { episodeNumber: "asc" },
        include: {
          servers: {
            where: { isActive: true },
            orderBy: { priority: "asc" },
            select: {
              id: true,
              name: true,
              embedUrl: true,
              playbackUrl: true,
              subtitleUrl: true,
              vastTagUrl: true,
            },
          },
        },
      },
    },
  });
  if (!movie) notFound();

  const currentEpisode = movie.episodes.find(
    (ep: (typeof movie.episodes)[number]) =>
      ep.episodeNumber === episodeNumber || ep.watchSlug === episodeSlug,
  );
  if (!currentEpisode) notFound();

  const primaryServer = currentEpisode.servers[0];
  const otherServers = currentEpisode.servers.filter(
    (s: (typeof currentEpisode.servers)[number]) => s.id !== primaryServer?.id,
  );
  const primarySourceUrl =
    primaryServer?.playbackUrl ?? primaryServer?.embedUrl ?? null;
  const parsedPrimarySource = primarySourceUrl
    ? parseVideoSource(primarySourceUrl)
    : null;
  const canUseVideoJs = Boolean(
    parsedPrimarySource && isMp4Source(parsedPrimarySource.src),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={`/movies/${movie.slug}`}
          className="inline-flex items-center gap-1.5 font-medium text-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          {movie.title}
        </Link>
        <span aria-hidden>/</span>
        <span>
          Tập {currentEpisode.episodeNumber}
          {currentEpisode.name ? ` — ${currentEpisode.name}` : ""}
        </span>
      </div>

      <div className="flex min-w-0 max-w-full flex-col items-center gap-2">
        <WatchPageAd />
        <div className="relative mx-auto aspect-square w-full min-w-0 max-w-full overflow-hidden rounded-xl bg-black sm:max-w-3xl">
          {canUseVideoJs && parsedPrimarySource ? (
            <VideoJsPlayer
              src={parsedPrimarySource.src}
              subtitleSrc={
                currentEpisode.subtitleUrl ??
                primaryServer?.subtitleUrl ??
                parsedPrimarySource.subtitleSrc
              }
              subtitleLabel={parsedPrimarySource.subtitleLabel}
              subtitleLang={parsedPrimarySource.subtitleLang}
              vastTagUrl={
                primaryServer?.vastTagUrl ?? parsedPrimarySource.vastTagUrl
              }
            />
          ) : primarySourceUrl ? (
            <iframe
              src={primarySourceUrl}
              title={`${movie.title} - Tập ${currentEpisode.episodeNumber}`}
              className="absolute inset-0 size-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              Chưa có link xem cho tập này.
            </div>
          )}
        </div>
      </div>

      <EpisodeSwitcher
        movieSlug={movie.slug}
        movieTitle={movie.title}
        currentEpisodeNumber={currentEpisode.episodeNumber}
        channel={movie.channel}
        episodes={movie.episodes.map((ep: (typeof movie.episodes)[number]) => ({
          episodeNumber: ep.episodeNumber,
          name: ep.name,
          episodeSlug: ep.watchSlug ?? `tap-${ep.episodeNumber}`,
        }))}
      />

      {otherServers.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Server khác
          </p>
          <ul className="flex flex-wrap gap-2">
            {otherServers.map((server: (typeof otherServers)[number]) => (
              <li key={server.id}>
                <a
                  href={server.playbackUrl ?? server.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {server.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StickyBanner />
    </div>
  );
}

export default async function WatchCatchAllPage({
  params,
}: WatchCatchAllPageProps) {
  const { segments } = await params;
  if (!Array.isArray(segments) || segments.length === 0) notFound();

  if (segments.length === 1) {
    await handleLegacySlug(segments[0]);
    return null;
  }

  if (segments.length === 3) {
    return handleTreePath(segments);
  }

  notFound();
}
