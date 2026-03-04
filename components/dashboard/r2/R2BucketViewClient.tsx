"use client";

import Link from "next/link";
import { Info, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useR2ManagerStore, type R2FolderItem } from "@/lib/stores/r2-manager-store";
import { CreateFolderDialog } from "@/components/dashboard/r2/CreateFolderDialog";
import { DeleteFolderConfirm } from "@/components/dashboard/r2/DeleteFolderConfirm";
import { FolderContextMenu } from "@/components/dashboard/r2/FolderContextMenu";
import { FolderTreeSidebar } from "@/components/dashboard/r2/FolderTreeSidebar";
import { FileTable } from "@/components/dashboard/r2/FileTable";
import { MoveFolderDialog } from "@/components/dashboard/r2/MoveFolderDialog";
import { RenameFolderDialog } from "@/components/dashboard/r2/RenameFolderDialog";
import { R2ActionsToolbar } from "@/components/dashboard/r2/R2ActionsToolbar";

type DataSource = "r2" | "db";

function pathSegmentsToPrefix(segments: string[]): string {
  if (!segments.length) return "";
  return segments.join("/") + "/";
}

function prefixToPathSegments(prefix: string): string[] {
  const p = prefix.replace(/^\/+|\/+$/g, "");
  return p ? p.split("/") : [];
}

interface R2BucketViewClientProps {
  bucketSlug: string;
  /** Segment từ URL (vd. ['videos','nsh']), dùng làm nguồn prefix khi vào trang. */
  pathSegments?: string[];
}

export function R2BucketViewClient({
  bucketSlug,
  pathSegments = [],
}: R2BucketViewClientProps) {
  const currentPrefix = useR2ManagerStore((state) => state.currentPrefix);
  const setPrefix = useR2ManagerStore((state) => state.setPrefix);
  const search = useR2ManagerStore((state) => state.search);
  const setData = useR2ManagerStore((state) => state.setData);
  const setLoading = useR2ManagerStore((state) => state.setLoading);
  const clearSelection = useR2ManagerStore((state) => state.clearSelection);
  const selectedKeys = useR2ManagerStore((state) => state.selectedKeys);
  const isLoading = useR2ManagerStore((state) => state.isLoading);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<DataSource>("r2");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createFolderLoading, setCreateFolderLoading] = useState(false);
  const [contextMenuFolder, setContextMenuFolder] = useState<R2FolderItem | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [renameFolderTarget, setRenameFolderTarget] = useState<R2FolderItem | null>(null);
  const [moveFolderTarget, setMoveFolderTarget] = useState<R2FolderItem | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<R2FolderItem | null>(null);
  const [folderActionLoading, setFolderActionLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const prefixFromUrl = pathSegmentsToPrefix(pathSegments);

  const handleFolderContextMenu = useCallback((folder: R2FolderItem, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuFolder(folder);
  }, []);

  const loadFromDb = useCallback(
    async (prefix: string) => {
      try {
        setError(null);
        setLoading(true);
        clearSelection();
        const params = new URLSearchParams();
        params.set("bucket", bucketSlug);
        params.set("prefix", prefix);
        if (search && search.trim() !== "") params.set("q", search.trim());
        params.set("take", "500");
        const res = await fetch(`/api/dashboard/r2/files?${params.toString()}`);
        if (!res.ok) throw new Error("Không thể tải danh sách file từ DB");
        const json = await res.json();
        const files = (json.files ?? []).map(
          (f: {
            key: string;
            displayName: string;
            sizeBytes?: number | null;
            lastModifiedAt?: string | null;
            publicUrl?: string | null;
          }) => ({
            key: f.key,
            name: f.displayName,
            size: Number(f.sizeBytes) ?? 0,
            lastModified: f.lastModifiedAt ?? new Date().toISOString(),
            publicUrl: f.publicUrl ?? "",
          }),
        );
        const currentFolders = useR2ManagerStore.getState().folders;
        setData(currentFolders, files);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Có lỗi khi tải danh sách từ DB",
        );
      } finally {
        setLoading(false);
      }
    },
    [bucketSlug, search, setData, setLoading, clearSelection],
  );

  const loadObjects = useCallback(
    async (prefixOverride?: string) => {
      const prefix = prefixOverride ?? currentPrefix;
      if (dataSource === "db") {
        await loadFromDb(prefix);
        return;
      }
      try {
        setError(null);
        setLoading(true);
        clearSelection();
        const params = new URLSearchParams();
        params.set("prefix", prefix);
        if (search && search.trim() !== "") params.set("search", search.trim());
        params.set("bucket", bucketSlug);
        const res = await fetch(
          `/api/dashboard/r2/objects?${params.toString()}`,
          {
            method: "GET",
          },
        );
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          folders?: Array<{ name: string; prefix: string }>;
          files?: Array<{
            key: string;
            name: string;
            size: number;
            lastModified: string;
            publicUrl: string;
          }>;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Không thể tải danh sách object từ R2");
        }
        const nextFolders = Array.isArray(json.folders) ? json.folders : [];
        const nextFiles = Array.isArray(json.files) ? json.files : [];
        setData(nextFolders, nextFiles);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Có lỗi xảy ra khi tải dữ liệu R2",
        );
      } finally {
        setLoading(false);
      }
    },
    [
      dataSource,
      currentPrefix,
      search,
      bucketSlug,
      loadFromDb,
      setData,
      setLoading,
      clearSelection,
    ],
  );

  const handleRenameFolderSubmit = useCallback(
    async (folder: R2FolderItem, newName: string) => {
      const parentPath = folder.prefix.replace(/\/+$/, "").split("/").slice(0, -1).join("/");
      const toPrefix = parentPath ? `${parentPath}/${newName}/` : `${newName}/`;
      try {
        setError(null);
        setFolderActionLoading(true);
        const res = await fetch("/api/dashboard/r2/folders", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromPrefix: folder.prefix,
            toPrefix,
            bucket: bucketSlug,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Không thể đổi tên folder");
        setRenameFolderTarget(null);
        await loadObjects(prefixFromUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi khi đổi tên folder");
      } finally {
        setFolderActionLoading(false);
      }
    },
    [bucketSlug, prefixFromUrl, loadObjects],
  );

  const handleMoveFolderSubmit = useCallback(
    async (folder: R2FolderItem, toPrefix: string) => {
      const normalized = toPrefix.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/") + "/";
      try {
        setError(null);
        setFolderActionLoading(true);
        const res = await fetch("/api/dashboard/r2/folders", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromPrefix: folder.prefix,
            toPrefix: normalized,
            bucket: bucketSlug,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Không thể di chuyển folder");
        setMoveFolderTarget(null);
        await loadObjects(prefixFromUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi khi di chuyển folder");
      } finally {
        setFolderActionLoading(false);
      }
    },
    [bucketSlug, prefixFromUrl, loadObjects],
  );

  const handleDeleteFolderConfirm = useCallback(
    async (folder: R2FolderItem) => {
      try {
        setError(null);
        setFolderActionLoading(true);
        const res = await fetch("/api/dashboard/r2/folders", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: folder.prefix, bucket: bucketSlug }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(data.error ?? "Không thể xóa folder");
        setDeleteFolderTarget(null);
        await loadObjects(prefixFromUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi khi xóa folder");
      } finally {
        setFolderActionLoading(false);
      }
    },
    [bucketSlug, prefixFromUrl, loadObjects],
  );

  useEffect(() => {
    setPrefix(prefixFromUrl);
  }, [prefixFromUrl, setPrefix]);

  useEffect(() => {
    void loadObjects(prefixFromUrl);
  }, [prefixFromUrl, search, bucketSlug, dataSource, loadObjects]);

  const breadcrumbSegments = prefixToPathSegments(currentPrefix);
  const baseHref = `/dashboard/admin/r2/${encodeURIComponent(bucketSlug)}`;

  const handleSyncDb = useCallback(async () => {
    try {
      setError(null);
      setSyncMessage(null);
      setLoading(true);
      const res = await fetch("/api/dashboard/r2/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket: bucketSlug,
          prefix: currentPrefix || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Đồng bộ thất bại");
      }
      setSyncMessage(
        `Đã đồng bộ: ${data.upserted ?? 0} file vào DB, xóa ${data.deletedFromDb ?? 0} bản ghi cũ.`,
      );
      setTimeout(() => setSyncMessage(null), 5000);
      if (dataSource === "db") void loadFromDb(currentPrefix);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi khi đồng bộ DB");
    } finally {
      setLoading(false);
    }
  }, [bucketSlug, currentPrefix, dataSource, loadFromDb, setLoading]);

  const handleOpenCreateFolder = () => setCreateFolderOpen(true);

  const handleCreateFolderSubmit = useCallback(
    async (name: string) => {
      try {
        setError(null);
        setCreateFolderLoading(true);
        const res = await fetch("/api/dashboard/r2/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentPrefix: currentPrefix,
            name,
            bucket: bucketSlug,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "Không thể tạo thư mục mới");
        }
        setCreateFolderOpen(false);
        await loadObjects(prefixFromUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Có lỗi xảy ra khi tạo thư mục",
        );
      } finally {
        setCreateFolderLoading(false);
      }
    },
    [currentPrefix, bucketSlug, prefixFromUrl, loadObjects],
  );

  const handleUploadClick = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleUploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.set("bucket", bucketSlug);
        formData.set("prefix", prefixFromUrl);
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          if (file?.name) formData.append("file", file);
        }
        const res = await fetch("/api/dashboard/r2/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Upload thất bại");
        }
        await loadObjects(prefixFromUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi khi upload file");
      } finally {
        setUploading(false);
        if (uploadInputRef.current) {
          uploadInputRef.current.value = "";
        }
      }
    },
    [bucketSlug, prefixFromUrl, loadObjects],
  );

  const handleMoveSelected = async () => {
    if (selectedKeys.length === 0) return;
    const toPrefix = window.prompt(
      "Nhập prefix thư mục đích (ví dụ: videos/nsh/slug-phim/tap-1/):",
      currentPrefix,
    );
    if (!toPrefix || toPrefix.trim() === "") return;

    const trimmedPrefix = toPrefix.trim();
    try {
      setError(null);
      setLoading(true);
      for (const key of selectedKeys) {
        const res = await fetch("/api/dashboard/r2/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromKey: key,
            toPrefix: trimmedPrefix,
            bucket: bucketSlug,
          }),
        });
        if (!res.ok) throw new Error("Không thể di chuyển một số file");
      }
      await loadObjects(prefixFromUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Có lỗi xảy ra khi di chuyển file",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRenameSubmit = useCallback(
    async (fromKey: string, newName: string) => {
      if (!newName.trim()) return;
      try {
        setError(null);
        setLoading(true);
        const res = await fetch("/api/dashboard/r2/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket: bucketSlug,
            fromKey,
            newName: newName.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Không thể đổi tên file");
        }
        await loadObjects(prefixFromUrl);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Có lỗi xảy ra khi đổi tên file",
        );
      } finally {
        setLoading(false);
      }
    },
    [bucketSlug, prefixFromUrl, loadObjects],
  );

  const handleDeleteSelected = async () => {
    if (selectedKeys.length === 0) return;
    const ok = window.confirm(
      `Xóa ${selectedKeys.length} file đã chọn? Hành động không thể hoàn tác.`,
    );
    if (!ok) return;
    try {
      setError(null);
      setLoading(true);
      const res = await fetch("/api/dashboard/r2/objects/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: selectedKeys, bucket: bucketSlug }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Không thể xóa file");
      }
      await loadObjects(prefixFromUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Có lỗi xảy ra khi xóa file",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/admin/r2"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Quản lý R2
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Bucket: {bucketSlug}
        </h1>
        <nav
          className="flex min-w-0 flex-wrap items-center gap-1 rounded border border-border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground"
          aria-label="Đường dẫn thư mục"
        >
          <Link
            href={baseHref}
            className="shrink-0 font-medium hover:text-foreground hover:underline"
          >
            {bucketSlug}
          </Link>
          {breadcrumbSegments.map((segment, i) => {
            const upToHere = breadcrumbSegments.slice(0, i + 1);
            const href = `${baseHref}/${upToHere.map((s) => encodeURIComponent(s)).join("/")}`;
            const isLast = i === breadcrumbSegments.length - 1;
            return (
              <span key={href} className="flex shrink-0 items-center gap-1">
                <span className="text-muted-foreground/70">/</span>
                {isLast ? (
                  <span className="font-medium text-foreground">{segment}</span>
                ) : (
                  <Link
                    href={href}
                    className="hover:text-foreground hover:underline"
                  >
                    {segment}
                  </Link>
                )}
              </span>
            );
          })}
          {breadcrumbSegments.length === 0 && (
            <span className="text-muted-foreground/80">/</span>
          )}
        </nav>
      </div>

      <CreateFolderDialog
        open={createFolderOpen}
        onClose={() => !createFolderLoading && setCreateFolderOpen(false)}
        onSubmit={handleCreateFolderSubmit}
        isLoading={createFolderLoading}
      />

      {contextMenuFolder && (
        <FolderContextMenu
          x={contextMenuPosition.x}
          y={contextMenuPosition.y}
          folder={contextMenuFolder}
          onClose={() => setContextMenuFolder(null)}
          onRename={(folder) => {
            setContextMenuFolder(null);
            setRenameFolderTarget(folder);
          }}
          onMove={(folder) => {
            setContextMenuFolder(null);
            setMoveFolderTarget(folder);
          }}
          onDelete={(folder) => {
            setContextMenuFolder(null);
            setDeleteFolderTarget(folder);
          }}
        />
      )}

      <RenameFolderDialog
        open={!!renameFolderTarget}
        folder={renameFolderTarget}
        onClose={() => !folderActionLoading && setRenameFolderTarget(null)}
        onSubmit={handleRenameFolderSubmit}
        isLoading={folderActionLoading}
      />
      <MoveFolderDialog
        open={!!moveFolderTarget}
        folder={moveFolderTarget}
        onClose={() => !folderActionLoading && setMoveFolderTarget(null)}
        onSubmit={handleMoveFolderSubmit}
        isLoading={folderActionLoading}
      />
      <DeleteFolderConfirm
        open={!!deleteFolderTarget}
        folder={deleteFolderTarget}
        onClose={() => !folderActionLoading && setDeleteFolderTarget(null)}
        onConfirm={handleDeleteFolderConfirm}
        isLoading={folderActionLoading}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="hidden w-64 shrink-0 md:block">
          <FolderTreeSidebar
            rootLabel={bucketSlug}
            bucketSlug={bucketSlug}
            onFolderContextMenu={handleFolderContextMenu}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleUploadFiles(e.target.files)}
          />
          <R2ActionsToolbar
            onCreateFolder={handleOpenCreateFolder}
            onRefresh={() => loadObjects(prefixFromUrl)}
            onOpenUploadGuide={handleUploadClick}
            onSyncDb={handleSyncDb}
            dataSource={dataSource}
            onDataSourceChange={setDataSource}
          />

          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            {syncMessage && (
              <div className="mb-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground">
                {syncMessage}
              </div>
            )}
            {uploading && (
              <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-foreground">
                <Loader2 className="size-4 animate-spin" />
                Đang upload file...
              </div>
            )}

            {isLoading ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Đang tải danh sách object từ R2...
              </div>
            ) : (
              <FileTable
                onMoveSelected={handleMoveSelected}
                onRenameSubmit={handleRenameSubmit}
                onDeleteSelected={handleDeleteSelected}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
