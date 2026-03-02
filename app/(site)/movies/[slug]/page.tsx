import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Play, Calendar, Film } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildWatchHref } from "@/lib/watch-slug";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "@/components/movie/FavoriteButton";
import { MovieDescription } from "@/components/movie/MovieDescription";

const placeholderPoster =
  "linear-gradient(135deg, oklch(0.45 0.02 264) 0%, oklch(0.25 0.03 280) 100%)";

interface MovieDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function MovieDetailPage({
  params,
}: MovieDetailPageProps) {
  const { slug } = await params;

  const movie = await prisma.movie.findUnique({
    where: { slug },
    include: {
      episodes: {
        orderBy: { episodeNumber: "asc" },
        select: { id: true, episodeNumber: true },
      },
    },
  });
  if (!movie) notFound();

  const firstEpisode = movie.episodes[0];
  const watchHref = firstEpisode
    ? buildWatchHref(movie.slug, firstEpisode.episodeNumber)
    : "#";

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        <div className="relative mx-auto aspect-[2/3] w-full max-w-[280px] shrink-0 overflow-hidden rounded-xl bg-muted sm:mx-0 sm:max-w-[240px]">
          {movie.poster ? (
            <Image
              src={movie.poster}
              alt={movie.title}
              fill
              sizes="280px"
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div
              className="size-full"
              style={{ background: placeholderPoster }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            {movie.title}
          </h1>
          {movie.originalTitle && (
            <p className="text-sm text-muted-foreground">
              {movie.originalTitle}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {movie.year && (
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4" />
                {movie.year}
              </span>
            )}
            <span
              className={cn(
                "rounded px-2 py-0.5 text-xs font-medium",
                movie.status === "ONGOING"
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {movie.status === "ONGOING" ? "Đang chiếu" : "Hoàn thành"}
            </span>
            {movie.episodes.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Film className="size-4" />
                {movie.episodes.length} tập
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {firstEpisode && (
                <Link
                  href={watchHref}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Play className="size-5 fill-current" />
                  Xem phim
                </Link>
              )}
            </div>
            {movie.description && (
              <MovieDescription
                text={movie.description}
                maxLength={500}
                className="text-sm leading-relaxed text-muted-foreground sm:text-base"
              />
            )}

            <FavoriteButton slug={slug} />
          </div>
        </div>
      </div>

      {movie.episodes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Danh sách tập
          </h2>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-3 md:grid-cols-8 lg:grid-cols-10">
            {movie.episodes.map((ep: { id: number; episodeNumber: number }) => (
              <Link
                key={ep.id}
                href={buildWatchHref(movie.slug, ep.episodeNumber)}
                className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Tập {ep.episodeNumber}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
