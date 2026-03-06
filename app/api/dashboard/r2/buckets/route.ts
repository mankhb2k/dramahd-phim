import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

const createBucketSchema = z.object({
  name: z
    .string()
    .min(3, "Tên bucket từ 3–63 ký tự")
    .max(63, "Tên bucket từ 3–63 ký tự")
    .refine(
      (v) => BUCKET_NAME_REGEX.test(v),
      "Chỉ dùng chữ thường, số và gạch ngang, không bắt đầu/kết thúc bằng gạch ngang",
    ),
});

function getCloudflareConfig(): {
  accountId: string;
  apiToken: string;
} {
  const accountId = process.env.R2_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error(
      "Thiếu R2_ACCOUNT_ID hoặc CLOUDFLARE_API_TOKEN trong .env",
    );
  }
  return { accountId, apiToken };
}

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { accountId, apiToken } = getCloudflareConfig();
    const allBuckets: Array<{ name: string; creation_date: string }> = [];
    let cursor: string | undefined;

    do {
      const url = new URL(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      );
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(String(url), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      });
      const data = (await res.json()) as {
        success?: boolean;
        result?: Array<{ name: string; creation_date: string }> | Record<string, { name?: string; creation_date?: string }>;
        buckets?: Array<{ name: string; creation_date: string }>;
        result_info?: { cursor?: string; count?: number };
        errors?: Array<{ message: string }>;
      };

      if (!res.ok || !data.success) {
        const msg =
          data.errors?.[0]?.message ?? "Không thể lấy danh sách bucket";
        return NextResponse.json({ error: msg }, { status: res.status });
      }

      type RawBucketList =
        | Array<{ name: string; creation_date: string }>
        | Record<string, { name?: string; creation_date?: string }>
        | undefined;
      let raw: RawBucketList = data.result ?? data.buckets;
      if (raw && typeof raw === "object" && !Array.isArray(raw) && "buckets" in raw) {
        raw = (raw as { buckets?: RawBucketList }).buckets;
      }
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (item && typeof item === "object" && "name" in item) {
            allBuckets.push({
              name: String((item as { name?: string }).name ?? ""),
              creation_date: String((item as { creation_date?: string }).creation_date ?? ""),
            });
          }
        }
      } else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const entries = Object.entries(raw).map(
          ([key, item]: [string, { name?: string; creation_date?: string }]) => ({
            name: String((item && typeof item === "object" && item.name) ?? key),
            creation_date: String((item && typeof item === "object" && item.creation_date) ?? ""),
          }),
        );
        allBuckets.push(...entries);
      }

      cursor = data.result_info?.cursor;
      if (data.result_info?.count === 0) break;
    } while (cursor);

    const defaultBucket =
      process.env.R2_BUCKET ?? process.env.R2_BUCKET_NAME ?? "";

    return NextResponse.json({
      buckets: allBuckets,
      defaultBucket: defaultBucket || null,
    });
  } catch (error) {
    console.error("[GET /api/dashboard/r2/buckets]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Lỗi khi lấy danh sách bucket",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createBucketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dữ liệu không hợp lệ",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const { accountId, apiToken } = getCloudflareConfig();
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: parsed.data.name }),
      },
    );
    const data = (await res.json()) as {
      success?: boolean;
      result?: { name: string };
      errors?: Array<{ message: string }>;
    };

    if (!res.ok || !data.success) {
      const msg =
        data.errors?.[0]?.message ?? "Không thể tạo bucket";
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    return NextResponse.json({
      bucket: data.result ?? { name: parsed.data.name },
    });
  } catch (error) {
    console.error("[POST /api/dashboard/r2/buckets]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Lỗi khi tạo bucket",
      },
      { status: 500 },
    );
  }
}
