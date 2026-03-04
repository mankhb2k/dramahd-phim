import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const serverSchema = z.object({
  name: z.string().min(1, "Tên server không được để trống"),
  embedUrl: z.string().optional(),
  playbackUrl: z.string().optional(),
  objectKey: z.string().optional(),
  sourceType: z.enum(["EMBED", "DIRECT_VIDEO"]).default("EMBED"),
  storageProvider: z.enum(["EXTERNAL", "R2"]).default("EXTERNAL"),
  subtitleUrl: z.string().optional(),
  vastTagUrl: z.string().optional(),
  mimeType: z.string().optional(),
  fileSizeBytes: z.coerce.number().int().positive().optional(),
  durationSeconds: z.coerce.number().int().positive().optional(),
  isActive: z.coerce.boolean().optional().default(true),
  priority: z.coerce.number().int().min(0).optional().default(0),
}).superRefine((value, ctx) => {
  const hasUrl = Boolean(value.embedUrl?.trim() || value.playbackUrl?.trim());
  if (!hasUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cần ít nhất embedUrl hoặc playbackUrl",
      path: ["embedUrl"],
    });
  }
});

const episodeSchema = z.object({
  episodeNumber: z.coerce.number().int().min(1, "Số tập phải >= 1"),
  name: z.string().optional(),
  subtitleUrl: z.string().optional(),
  servers: z.array(serverSchema).default([]),
});

const createMovieSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống"),
  slug: z.string().min(1).optional(),
  channel: z.string().min(1).default("nsh"),
  audioType: z.enum(["NONE", "SUB", "DUBBED"]).optional().default("NONE"),
  originalTitle: z.string().optional(),
  description: z.string().optional(),
  poster: z
    .string()
    .optional()
    .refine(
      (v) => !v || v === "" || /^https?:\/\//.test(v),
      "URL không hợp lệ"
    ),
  backdrop: z
    .string()
    .optional()
    .refine(
      (v) => !v || v === "" || /^https?:\/\//.test(v),
      "URL không hợp lệ"
    ),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  status: z.enum(["ONGOING", "COMPLETED"]).default("ONGOING"),
  genreIds: z.array(z.coerce.number().int().positive()).default([]),
  tagIds: z.array(z.coerce.number().int().positive()).default([]),
  episodes: z.array(episodeSchema).default([]),
});

export type CreateMovieInput = z.infer<typeof createMovieSchema>;

/** POST /api/dashboard/movies — Thêm phim mới */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createMovieSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const data = parsed.data;

    const slug =
      data.slug?.trim() || slugify(data.title) || `phim-${Date.now()}`;
    const posterUrl =
      data.poster && data.poster !== "" ? data.poster : undefined;
    const backdropUrl =
      data.backdrop && data.backdrop !== "" ? data.backdrop : undefined;

    const existing = await prisma.movie.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Slug "${slug}" đã tồn tại. Vui lòng chọn slug khác.` },
        { status: 409 }
      );
    }

    const movie = await prisma.movie.create({
      data: {
        slug,
        channel: data.channel.trim(),
        title: data.title.trim(),
        originalTitle: data.originalTitle?.trim() || null,
        description: data.description?.trim() || null,
        poster: posterUrl ?? null,
        backdrop: backdropUrl ?? null,
        year: data.year ?? null,
        status: data.status,
        audioType: data.audioType ?? "NONE",
        genres: data.genreIds.length
          ? { connect: data.genreIds.map((id) => ({ id })) }
          : undefined,
        tags: data.tagIds.length
          ? { connect: data.tagIds.map((id) => ({ id })) }
          : undefined,
        episodes:
          data.episodes.length > 0
            ? {
                create: data.episodes.map((ep) => ({
                  episodeNumber: ep.episodeNumber,
                  watchSlug: `tap-${ep.episodeNumber}`,
                  name: ep.name?.trim() || `Tập ${ep.episodeNumber}`,
                  subtitleUrl: ep.subtitleUrl?.trim() || null,
                  servers:
                    ep.servers.length > 0
                      ? {
                          create: ep.servers.map((s, i) => ({
                            sourceType: s.sourceType,
                            storageProvider: s.storageProvider,
                            name: s.name.trim(),
                            embedUrl: (s.playbackUrl ?? s.embedUrl ?? "").trim(),
                            playbackUrl: s.playbackUrl?.trim() || null,
                            objectKey: s.objectKey?.trim() || null,
                            subtitleUrl: s.subtitleUrl?.trim() || null,
                            vastTagUrl: s.vastTagUrl?.trim() || null,
                            mimeType: s.mimeType?.trim() || null,
                            fileSizeBytes: s.fileSizeBytes ?? null,
                            durationSeconds: s.durationSeconds ?? null,
                            priority: s.priority ?? i,
                            isActive: s.isActive ?? true,
                          })),
                        }
                      : undefined,
                })),
              }
            : undefined,
      },
      include: {
        genres: { select: { id: true, slug: true, name: true } },
        tags: { select: { id: true, slug: true, name: true } },
        episodes: {
          include: {
            servers: true,
          },
        },
      },
    });

    return NextResponse.json(movie);
  } catch (error) {
    console.error("[POST /api/dashboard/movies]", error);
    return NextResponse.json({ error: "Lỗi khi thêm phim" }, { status: 500 });
  }
}
