import { NextRequest, NextResponse } from "next/server";
import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2Client, getR2ConfigWithBucket, sanitizeFilename } from "@/lib/r2";
import {
  getOrCreateR2Folder,
  getDisplayNameFromKey,
  getPrefixFromKey,
  upsertR2File,
} from "@/lib/r2-db";

const renameSchema = z.object({
  fromKey: z.string().min(1),
  newName: z.string().min(1),
  bucket: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const bucket = parsed.data.bucket;
  if (!bucket) {
    return NextResponse.json(
      { error: "Thiếu bucket" },
      { status: 400 },
    );
  }

  const cfg = getR2ConfigWithBucket(bucket);
  const client = getR2Client();

  const fromKey = parsed.data.fromKey.replace(/^\/+/, "");
  const rawName = parsed.data.newName.trim().split("/").pop() ?? parsed.data.newName.trim();
  const name = sanitizeFilename(rawName) || "file";
  const prefix = getPrefixFromKey(fromKey);
  const toKey = prefix ? `${prefix}${name}` : name;

  if (fromKey === toKey) {
    return NextResponse.json({ success: true, key: toKey });
  }

  try {
    await client.send(
      new CopyObjectCommand({
        Bucket: cfg.bucket,
        CopySource: `${cfg.bucket}/${fromKey}`,
        Key: toKey,
      }),
    );

    await client.send(
      new DeleteObjectCommand({
        Bucket: cfg.bucket,
        Key: fromKey,
      }),
    );

    const toPrefix = getPrefixFromKey(toKey);
    const folderId = toPrefix
      ? await getOrCreateR2Folder(prisma, cfg.bucket, toPrefix)
      : null;
    const existing = await prisma.r2File.findUnique({
      where: { bucket_key: { bucket: cfg.bucket, key: fromKey } },
    });
    if (existing) {
      await prisma.r2File.delete({
        where: { bucket_key: { bucket: cfg.bucket, key: fromKey } },
      });
    }
    await upsertR2File(prisma, {
      bucket: cfg.bucket,
      key: toKey,
      folderId,
      displayName: getDisplayNameFromKey(toKey),
      sizeBytes: existing?.sizeBytes ?? undefined,
      mimeType: existing?.mimeType ?? undefined,
      lastModifiedAt: existing?.lastModifiedAt ?? undefined,
    });

    return NextResponse.json({ success: true, key: toKey });
  } catch (error) {
    console.error("[POST /api/dashboard/r2/rename]", error);
    return NextResponse.json(
      { error: "Lỗi khi đổi tên file" },
      { status: 500 },
    );
  }
}
