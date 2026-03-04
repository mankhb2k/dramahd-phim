import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  buildR2ObjectKey,
  buildR2VideoKey,
  getR2Client,
  getR2Config,
  getR2ConfigWithBucket,
} from "@/lib/r2";

const signUploadSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  channel: z.string().min(1).optional(),
  movieSlug: z.string().optional(),
  episodeSlug: z.string().optional(),
  bucket: z.string().min(1).optional(),
  prefix: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = signUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    const usePrefixMode =
      data.bucket != null && data.prefix !== undefined;

    let objectKey: string;
    let r2Config = data.bucket
      ? getR2ConfigWithBucket(data.bucket)
      : getR2Config();

    if (usePrefixMode) {
      const prefix = (data.prefix ?? "").replace(/^\/+/, "");
      objectKey = buildR2ObjectKey(prefix, data.filename);
    } else {
      const channel = data.channel ?? "nsh";
      const movieSlug = data.movieSlug ?? "";
      const episodeSlug = data.episodeSlug ?? "";
      if (!movieSlug || !episodeSlug) {
        return NextResponse.json(
          { error: "Thiếu channel/movieSlug/episodeSlug hoặc bucket+prefix để upload." },
          { status: 400 },
        );
      }
      objectKey = buildR2VideoKey({
        channel,
        movieSlug,
        episodeSlug,
        filename: data.filename,
      });
      if (!data.bucket) {
        r2Config = getR2Config();
      }
    }

    const maxSizeBytes = r2Config.maxVideoSizeMb * 1024 * 1024;
    if (data.sizeBytes > maxSizeBytes) {
      return NextResponse.json(
        {
          error: `File vượt quá giới hạn ${r2Config.maxVideoSizeMb}MB`,
        },
        { status: 400 },
      );
    }

    const publicBaseUrl = r2Config.publicBaseUrl.replace(/\/+$/, "");
    const publicPlaybackUrl = `${publicBaseUrl}/${objectKey.replace(/^\/+/, "")}`;

    const command = new PutObjectCommand({
      Bucket: r2Config.bucket,
      Key: objectKey,
      ContentType: data.mimeType,
    });

    const uploadUrl = await getSignedUrl(getR2Client(), command, {
      expiresIn: 60 * 10,
    });

    return NextResponse.json({
      uploadUrl,
      objectKey,
      publicPlaybackUrl,
      expiresInSeconds: 60 * 10,
      maxSizeBytes,
    });
  } catch (error) {
    console.error("[POST /api/dashboard/r2/sign-upload]", error);
    return NextResponse.json(
      { error: "Lỗi khi tạo URL upload" },
      { status: 500 },
    );
  }
}
