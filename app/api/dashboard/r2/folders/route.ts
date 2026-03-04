import { NextRequest, NextResponse } from "next/server";
import { CopyObjectCommand, DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getR2Client, getR2Config, getR2ConfigWithBucket, normalizeSegment } from "@/lib/r2";

const createFolderSchema = z.object({
  parentPrefix: z.string().default("videos/"),
  name: z.string().min(1),
  bucket: z.string().min(1).optional(),
});

const renameFolderSchema = z.object({
  fromPrefix: z.string().min(1),
  toPrefix: z.string().min(1),
  bucket: z.string().min(1).optional(),
});

const deleteFolderSchema = z.object({
  prefix: z.string().min(1),
  bucket: z.string().min(1).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createFolderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cfg = parsed.data.bucket
    ? getR2ConfigWithBucket(parsed.data.bucket)
    : getR2Config();
  const client = getR2Client();

  const parentPrefix = parsed.data.parentPrefix.replace(/^\/+/, "").replace(/\/+$/, "") || "";
  const name = normalizeSegment(parsed.data.name);
  if (!name || name.endsWith("-") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    return NextResponse.json(
      { error: "Tên thư mục chỉ được dùng chữ thường, số và dấu gạch ngang (-), không kết thúc bằng -." },
      { status: 400 },
    );
  }
  const folderPrefix = parentPrefix === ""
    ? `${name}/`
    : `${parentPrefix}/${name}/`;
  const key = `${folderPrefix}.keep`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: new Uint8Array(0),
      }),
    );
  } catch (err) {
    console.error("[POST /api/dashboard/r2/folders] PutObject failed:", err);
    return NextResponse.json(
      { error: "Không thể tạo thư mục trên R2. Kiểm tra quyền và tên bucket." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    name,
    prefix: folderPrefix,
  });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = renameFolderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cfg = parsed.data.bucket
    ? getR2ConfigWithBucket(parsed.data.bucket)
    : getR2Config();
  const client = getR2Client();

  const fromPrefix = parsed.data.fromPrefix.replace(/^\/+/, "");
  const toPrefix = parsed.data.toPrefix.replace(/^\/+/, "");

  if (fromPrefix === toPrefix) {
    return NextResponse.json({ success: true });
  }

  let continuationToken: string | undefined;

  try {
    do {
      const listResp = await client.send(
        new ListObjectsV2Command({
          Bucket: cfg.bucket,
          Prefix: fromPrefix,
          ContinuationToken: continuationToken,
        }),
      );

      const contents = listResp.Contents ?? [];
      for (const obj of contents) {
        if (!obj.Key) continue;
        const newKey = obj.Key.replace(fromPrefix, toPrefix);
        await client.send(
          new CopyObjectCommand({
            Bucket: cfg.bucket,
            CopySource: `${cfg.bucket}/${obj.Key}`,
            Key: newKey,
          }),
        );
        await client.send(
          new DeleteObjectCommand({
            Bucket: cfg.bucket,
            Key: obj.Key,
          }),
        );
      }

      continuationToken = listResp.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUT /api/dashboard/r2/folders]", error);
    return NextResponse.json(
      { error: "Lỗi khi đổi tên thư mục" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = deleteFolderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const cfg = parsed.data.bucket
    ? getR2ConfigWithBucket(parsed.data.bucket)
    : getR2Config();
  const client = getR2Client();

  const prefixRaw = parsed.data.prefix.replace(/^\/+/, "");
  const prefix = prefixRaw.endsWith("/") ? prefixRaw : `${prefixRaw}/`;

  let continuationToken: string | undefined;

  try {
    do {
      const listResp = await client.send(
        new ListObjectsV2Command({
          Bucket: cfg.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const contents = listResp.Contents ?? [];
      for (const obj of contents) {
        if (!obj.Key) continue;
        await client.send(
          new DeleteObjectCommand({
            Bucket: cfg.bucket,
            Key: obj.Key,
          }),
        );
      }

      continuationToken = listResp.NextContinuationToken;
    } while (continuationToken);

    const deletedFolder = await prisma.r2Folder.findUnique({
      where: { bucket_prefix: { bucket: cfg.bucket, prefix } },
      select: { id: true },
    });
    if (deletedFolder) {
      await prisma.r2Folder.delete({
        where: { id: deletedFolder.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/dashboard/r2/folders]", error);
    return NextResponse.json(
      { error: "Lỗi khi xoá thư mục" },
      { status: 500 },
    );
  }
}

