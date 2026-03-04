import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSession } from "@/lib/auth";
import { buildR2ObjectKey, getR2Client, getR2ConfigWithBucket } from "@/lib/r2";

const MAX_FILE_SIZE_MB = 512;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const bucket = formData.get("bucket");
    const prefix = formData.get("prefix");

    if (typeof bucket !== "string" || !bucket.trim()) {
      return NextResponse.json(
        { error: "Thiếu hoặc sai bucket" },
        { status: 400 },
      );
    }

    const prefixStr = typeof prefix === "string" ? prefix : "";
    const cfg = getR2ConfigWithBucket(bucket.trim());
    const client = getR2Client();

    const files = formData.getAll("file") as File[];
    if (!files.length) {
      return NextResponse.json(
        { error: "Không có file nào được gửi lên" },
        { status: 400 },
      );
    }

    const uploaded: string[] = [];
    for (const file of files) {
      if (!(file instanceof File) || !file.name) continue;
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `File "${file.name}" vượt quá ${MAX_FILE_SIZE_MB}MB` },
          { status: 400 },
        );
      }
      const key = buildR2ObjectKey(prefixStr, file.name);
      const bytes = await file.arrayBuffer();
      await client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key,
          Body: new Uint8Array(bytes),
          ContentType: file.type || "application/octet-stream",
        }),
      );
      uploaded.push(key);
    }

    return NextResponse.json({
      success: true,
      uploaded: uploaded.length,
      keys: uploaded,
    });
  } catch (error) {
    console.error("[POST /api/dashboard/r2/upload]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Lỗi khi upload file lên R2",
      },
      { status: 500 },
    );
  }
}
