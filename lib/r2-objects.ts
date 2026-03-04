import {
  ListObjectsV2Command,
  _Object as S3Object,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { getR2Client, getR2Config, getR2ConfigWithBucket } from "@/lib/r2";

const listObjectsInputSchema = z.object({
  prefix: z.string().default("videos/"),
  search: z.string().optional(),
  continuationToken: z.string().optional(),
  bucket: z.string().min(1).optional(),
});

export type ListObjectsInput = z.infer<typeof listObjectsInputSchema>;

export type R2FolderItem = {
  name: string;
  prefix: string;
  totalFiles?: number;
};

export type R2FileItem = {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  publicUrl: string;
};

export type ListObjectsResult = {
  prefix: string;
  folders: R2FolderItem[];
  files: R2FileItem[];
  nextContinuationToken?: string;
};

function extractNameFromPrefix(prefix: string, parentPrefix: string): string {
  const trimmed = prefix.replace(parentPrefix, "").replace(/\/+$/, "");
  const parts = trimmed.split("/");
  return parts[0] ?? "";
}

function mapS3ObjectToFileItem(
  obj: S3Object,
  prefix: string,
  publicBaseUrl: string
): R2FileItem | null {
  if (!obj.Key) return null;
  const key = obj.Key;
  const name = key.replace(prefix, "").split("/").pop() ?? key;
  if (!name || name === ".keep") {
    return null;
  }
  const size = Number(obj.Size ?? 0);
  const lastModified = obj.LastModified?.toISOString() ?? new Date().toISOString();
  const publicUrl = `${publicBaseUrl}/${key.replace(/^\/+/, "")}`;
  return { key, name, size, lastModified, publicUrl };
}

export async function listR2Objects(rawInput: ListObjectsInput): Promise<ListObjectsResult> {
  const input = listObjectsInputSchema.parse(rawInput);
  const cfg = input.bucket ? getR2ConfigWithBucket(input.bucket) : getR2Config();
  const client = getR2Client();

  const prefix = input.prefix.startsWith("/") ? input.prefix.slice(1) : input.prefix;

  const command = new ListObjectsV2Command({
    Bucket: cfg.bucket,
    Prefix: prefix,
    Delimiter: "/",
    ContinuationToken: input.continuationToken,
  });

  const response = await client.send(command);

  const folderSet = new Map<string, R2FolderItem>();

  if (response.CommonPrefixes) {
    for (const cp of response.CommonPrefixes) {
      if (!cp.Prefix) continue;
      const name = extractNameFromPrefix(cp.Prefix, prefix);
      if (!name) continue;
      folderSet.set(cp.Prefix, {
        name,
        prefix: cp.Prefix,
      });
    }
  }

  const publicBaseUrl = cfg.publicBaseUrl.replace(/\/+$/, "");
  const files: R2FileItem[] = [];
  if (response.Contents) {
    for (const obj of response.Contents) {
      const file = mapS3ObjectToFileItem(obj, prefix, publicBaseUrl);
      if (!file) continue;
      files.push(file);
    }
  }

  let filteredFiles = files;
  if (input.search && input.search.trim() !== "") {
    const q = input.search.toLowerCase();
    filteredFiles = files.filter((file: R2FileItem) =>
      file.name.toLowerCase().includes(q),
    );
  }

  const folders = Array.from(folderSet.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    prefix,
    folders,
    files: filteredFiles,
    nextContinuationToken: response.NextContinuationToken,
  };
}

