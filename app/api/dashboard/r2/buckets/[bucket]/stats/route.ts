import { NextRequest, NextResponse } from "next/server";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSession } from "@/lib/auth";
import { getR2Client, getR2ConfigWithBucket } from "@/lib/r2";

const MAX_OBJECTS = 50_000;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ bucket: string }> },
) {
  const session = await getSession();
  if (!session || (session.role !== "ADMIN" && session.role !== "EDITOR")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { bucket } = await context.params;
  if (!bucket) {
    return NextResponse.json({ error: "Thiếu tên bucket" }, { status: 400 });
  }

  try {
    const cfg = getR2ConfigWithBucket(bucket);
    const client = getR2Client();

    let objectCount = 0;
    let totalSizeBytes = 0;
    let continuationToken: string | undefined;

    do {
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: cfg.bucket,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        }),
      );

      const contents = res.Contents ?? [];
      for (const obj of contents) {
        const key = obj.Key;
        if (!key) continue;
        if (key.endsWith(".keep")) continue;
        if (key.endsWith("/")) continue;
        objectCount += 1;
        totalSizeBytes += Number(obj.Size ?? 0);
      }
      continuationToken = res.NextContinuationToken;
      if (objectCount >= MAX_OBJECTS) break;
    } while (continuationToken);

    return NextResponse.json({
      objectCount,
      totalSizeBytes,
    });
  } catch (error) {
    console.error("[GET /api/dashboard/r2/buckets/[bucket]/stats]", error);
    return NextResponse.json(
      { error: "Lỗi khi lấy thống kê bucket" },
      { status: 500 },
    );
  }
}
