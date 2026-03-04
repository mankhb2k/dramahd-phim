import { randomUUID } from "crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";

const r2EnvSchema = z.object({
  R2_ENDPOINT: z.string().url(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PUBLIC_BASE_URL: z.string().url().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  R2_MAX_VIDEO_SIZE_MB: z
    .string()
    .optional()
    .transform((v: string | undefined) => Number(v ?? "2048")),
});

type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
  maxVideoSizeMb: number;
};

let cachedConfig: R2Config | null = null;
let cachedClient: S3Client | null = null;

function getR2EnvConfig(): R2Config {
  if (cachedConfig) return cachedConfig;
  const parsed = r2EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error("Missing/invalid R2 env configuration");
  }
  const bucket = parsed.data.R2_BUCKET ?? parsed.data.R2_BUCKET_NAME;
  const publicBaseUrl = parsed.data.R2_PUBLIC_BASE_URL ?? parsed.data.R2_PUBLIC_URL;
  if (!bucket || !publicBaseUrl) {
    throw new Error("Cần R2_BUCKET (hoặc R2_BUCKET_NAME) và R2_PUBLIC_BASE_URL (hoặc R2_PUBLIC_URL)");
  }
  cachedConfig = {
    endpoint: parsed.data.R2_ENDPOINT,
    bucket,
    accessKeyId: parsed.data.R2_ACCESS_KEY_ID,
    secretAccessKey: parsed.data.R2_SECRET_ACCESS_KEY,
    publicBaseUrl: publicBaseUrl.replace(/\/+$/, ""),
    maxVideoSizeMb: parsed.data.R2_MAX_VIDEO_SIZE_MB,
  };
  return cachedConfig;
}

/** Cấu hình R2 mặc định (bucket từ env). */
export function getR2Config(): R2Config {
  return getR2EnvConfig();
}

/** Cấu hình R2 với bucket cụ thể (cho dashboard đa bucket). */
export function getR2ConfigWithBucket(bucketOverride: string): R2Config {
  const base = getR2EnvConfig();
  return { ...base, bucket: bucketOverride };
}

export function getR2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const cfg = getR2Config();
  cachedClient = new S3Client({
    region: "auto",
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return cachedClient;
}

export function normalizeSegment(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Key cho upload file vào thư mục (prefix) bất kỳ. */
export function buildR2ObjectKey(prefix: string, filename: string): string {
  const p = prefix.replace(/^\/+|\/+$/g, "");
  const name = sanitizeFilename(filename) || "file";
  return p ? `${p}/${name}` : name;
}

export function buildR2VideoKey(params: {
  channel: string;
  movieSlug: string;
  episodeSlug: string;
  filename: string;
}): string {
  const channel = normalizeSegment(params.channel) || "nsh";
  const movieSlug = normalizeSegment(params.movieSlug);
  const episodeSlug = normalizeSegment(params.episodeSlug);
  const filename = sanitizeFilename(params.filename);
  return `videos/${channel}/${movieSlug}/${episodeSlug}/${Date.now()}-${randomUUID()}-${filename}`;
}

export function buildR2PublicUrl(objectKey: string): string {
  const cfg = getR2Config();
  return `${cfg.publicBaseUrl}/${objectKey.replace(/^\/+/, "")}`;
}
