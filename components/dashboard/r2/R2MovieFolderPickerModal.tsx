"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, FolderOpen, Loader2 } from "lucide-react";

export type R2ApplyItem = {
  episodeNumber: number;
  objectKey: string;
  playbackUrl: string;
};

type FolderItem = { name: string; prefix: string };

interface R2MovieFolderPickerModalProps {
  open: boolean;
  onClose: () => void;
  episodes: { episodeNumber: number }[];
  onApply: (items: R2ApplyItem[]) => void;
}

export function R2MovieFolderPickerModal({
  open,
  onClose,
  episodes,
  onApply,
}: R2MovieFolderPickerModalProps) {
  const [buckets, setBuckets] = useState<Array<{ name: string }>>([]);
  const [bucket, setBucket] = useState<string>("");
  const [prefix, setPrefix] = useState<string>("");
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingApply, setLoadingApply] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pathSegments = prefix ? prefix.replace(/\/+$/, "").split("/") : [];
  const isAtMovieFolder =
    pathSegments.length >= 2 &&
    pathSegments[0] === "video" &&
    pathSegments.length === 2;

  const fetchBuckets = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/r2/buckets");
      const data = (await res.json()) as {
        buckets?: Array<{ name: string }>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách bucket");
      }
      const list = Array.isArray(data.buckets) ? data.buckets : [];
      setBuckets(list);
      if (list.length > 0 && !bucket) {
        setBucket(list[0].name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi tải bucket");
    } finally {
      setLoading(false);
    }
  }, [bucket]);

  const fetchObjects = useCallback(
    async (b: string, p: string) => {
      if (!b) return;
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("bucket", b);
        params.set("prefix", p);
        const res = await fetch(`/api/dashboard/r2/objects?${params.toString()}`);
        const data = (await res.json()) as {
          folders?: FolderItem[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? "Không thể tải danh sách");
        }
        setFolders(Array.isArray(data.folders) ? data.folders : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi tải thư mục");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    setPrefix("");
    setError(null);
    void fetchBuckets();
  }, [open, fetchBuckets]);

  useEffect(() => {
    if (!open || !bucket) return;
    void fetchObjects(bucket, prefix);
  }, [open, bucket, prefix, fetchObjects]);

  const handleSelectBucket = (b: string) => {
    setBucket(b);
    setPrefix("");
  };

  const handleSelectFolder = (folder: FolderItem) => {
    setPrefix(folder.prefix);
  };

  const handleBack = () => {
    if (pathSegments.length <= 1) {
      setPrefix("");
      return;
    }
    setPrefix(pathSegments.slice(0, -1).join("/") + "/");
  };

  const handleApply = useCallback(async () => {
    if (!bucket || !prefix) return;
    setError(null);
    setLoadingApply(true);
    try {
      const params = new URLSearchParams();
      params.set("bucket", bucket);
      params.set("prefix", prefix);
      const res = await fetch(
        `/api/dashboard/r2/objects?${params.toString()}`,
      );
      const data = (await res.json()) as {
        files?: Array<{ key: string; name: string; publicUrl: string }>;
        folders?: Array<{ name: string; prefix: string }>;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Không thể tải danh sách file");
      }

      const tapNumFromName = (name: string): number | null => {
        const m = name.match(/^tap-(\d+)(?:\.[^/]*)?$/i);
        return m ? parseInt(m[1], 10) : null;
      };

      const episodeToFile = new Map<number, { key: string; publicUrl: string }>();

      if (Array.isArray(data.files)) {
        for (const f of data.files) {
          if (f.key.endsWith(".keep")) continue;
          const n = tapNumFromName(f.name);
          if (n != null && !episodeToFile.has(n)) {
            episodeToFile.set(n, { key: f.key, publicUrl: f.publicUrl });
          }
        }
      }

      if (Array.isArray(data.folders)) {
        for (const folder of data.folders) {
          const n = tapNumFromName(folder.name);
          if (n == null || episodeToFile.has(n)) continue;
          const subParams = new URLSearchParams();
          subParams.set("bucket", bucket);
          subParams.set("prefix", folder.prefix);
          const subRes = await fetch(
            `/api/dashboard/r2/objects?${subParams.toString()}`,
          );
          const subData = (await subRes.json()) as {
            files?: Array<{ key: string; publicUrl: string }>;
          };
          const firstFile = Array.isArray(subData.files)
            ? subData.files.find((x: { key: string }) => !x.key.endsWith(".keep")) ?? subData.files[0]
            : undefined;
          if (firstFile?.key && firstFile?.publicUrl) {
            episodeToFile.set(n, { key: firstFile.key, publicUrl: firstFile.publicUrl });
          }
        }
      }

      const items: R2ApplyItem[] = Array.from(episodeToFile.entries())
        .sort(([a], [b]) => a - b)
        .map(([episodeNumber, { key, publicUrl }]) => ({
          episodeNumber,
          objectKey: key,
          playbackUrl: publicUrl,
        }));

      if (items.length === 0) {
        setError("Không tìm thấy file tap-N nào trong thư mục này (tap-1.mp4, tap-2, ...).");
        return;
      }
      onApply(items);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi áp dụng");
    } finally {
      setLoadingApply(false);
    }
  }, [bucket, prefix, onApply, onClose]);

  const handleClose = () => {
    if (!loadingApply) {
      setPrefix("");
      setBucket("");
      setError(null);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="r2-movie-picker-title"
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2
            id="r2-movie-picker-title"
            className="text-lg font-semibold text-foreground"
          >
            Gắn R2 cho tất cả tập
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={loadingApply}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">
              Chọn bucket (channel)
            </span>
            {loading && !bucket ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Đang tải bucket...
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {buckets.map((b) => (
                  <button
                    key={b.name}
                    type="button"
                    onClick={() => handleSelectBucket(b.name)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      bucket === b.name
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {bucket && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  Đường dẫn
                </span>
                <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-sm">
                  <button
                    type="button"
                    onClick={() => setPrefix("")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {bucket}
                  </button>
                  {pathSegments.map((seg, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <ChevronRight className="size-4 text-muted-foreground" />
                      <button
                        type="button"
                        onClick={() =>
                          setPrefix(
                            pathSegments
                              .slice(0, i + 1)
                              .join("/")
                              .concat("/"),
                          )
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {seg}
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {pathSegments.length > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="self-start text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Quay lại
                </button>
              )}

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-foreground">
                  {prefix
                    ? "Chọn thư mục phim (hoặc bấm Áp dụng nếu đã chọn đúng thư mục)"
                    : "Chọn thư mục video"}
                </span>
                {loading ? (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Đang tải...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {folders.map((folder) => (
                      <button
                        key={folder.prefix}
                        type="button"
                        onClick={() => handleSelectFolder(folder)}
                        className="flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-muted"
                      >
                        <FolderOpen className="size-5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">
                          {folder.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {isAtMovieFolder && (
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void handleApply()}
                disabled={loadingApply}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loadingApply ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Đang quét R2...
                  </>
                ) : (
                  <>Quét R2 và gắn tất cả tập</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
