import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { getR2Client, getR2ConfigWithBucket } from "@/lib/r2";

const querySchema = z.object({
  bucket: z.string().min(1, "bucket là bắt buộc"),
  prefix: z.string().min(1, "prefix là bắt buộc"),
});

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const raw = {
    bucket: searchParams.get("bucket") ?? undefined,
    prefix: searchParams.get("prefix") ?? undefined,
  };

  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const cfg = getR2ConfigWithBucket(parsed.data.bucket);
    const client = getR2Client();
    const prefix = parsed.data.prefix.replace(/^\/+/, "");

    let total = 0;
    let continuationToken: string | undefined;

    do {
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: cfg.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        }),
      );
      const contents = res.Contents ?? [];
      for (const obj of contents) {
        if (!obj.Key) continue;
        const key = obj.Key;
        if (key.endsWith(".keep")) continue;
        if (key.endsWith("/")) continue;
        total += 1;
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return NextResponse.json({ count: total });
  } catch (error) {
    console.error("[GET /api/dashboard/r2/objects/count]", error);
    const message =
      error instanceof Error ? error.message : "Lỗi khi đếm object";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
