"use client";

import { useEffect, useState } from "react";
import { Database, Plus, RefreshCcw, Search } from "lucide-react";
import {
  useR2ManagerStore,
  type SortByName,
} from "@/lib/stores/r2-manager-store";

type DataSource = "r2" | "db";

interface R2ActionsToolbarProps {
  onCreateFolder: () => void;
  onRefresh: () => void;
  onOpenUploadGuide: () => void;
  onSyncDb?: () => void;
  dataSource?: DataSource;
  onDataSourceChange?: (source: DataSource) => void;
}

export function R2ActionsToolbar({
  onCreateFolder,
  onRefresh,
  onOpenUploadGuide,
  onSyncDb,
  dataSource = "r2",
  onDataSourceChange,
}: R2ActionsToolbarProps) {
  const [localSearch, setLocalSearch] = useState("");
  const search = useR2ManagerStore((state) => state.search);
  const setSearch = useR2ManagerStore((state) => state.setSearch);
  const sortByName = useR2ManagerStore((state) => state.sortByName);
  const setSortByName = useR2ManagerStore((state) => state.setSortByName);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(localSearch);
    }, 400);
    return () => clearTimeout(id);
  }, [localSearch, setSearch]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-3 py-2">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            className="h-8 w-full rounded border border-border bg-background pl-7 pr-2 text-xs outline-none ring-0 placeholder:text-muted-foreground focus:border-primary"
            placeholder="Tìm theo tên file trong thư mục hiện tại..."
            value={localSearch}
            onChange={(event) => setLocalSearch(event.target.value)}
          />
        </div>
        {onDataSourceChange && (
          <div className="flex items-center gap-1 rounded border border-border bg-muted/30 px-1 py-0.5 text-xs">
            <button
              type="button"
              onClick={() => onDataSourceChange("r2")}
              className={`rounded px-2 py-1 ${dataSource === "r2" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              R2
            </button>
            <button
              type="button"
              onClick={() => onDataSourceChange("db")}
              className={`flex items-center gap-1 rounded px-2 py-1 ${dataSource === "db" ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Database className="size-3" />
              DB
            </button>
          </div>
        )}

        <div className="flex items-center gap-1 rounded border border-border bg-muted/30 px-1 py-0.5 text-xs">
          <span className="px-1.5 py-0.5 text-muted-foreground">Sắp xếp:</span>
          {(["a-z", "default"] as const).map((value: SortByName) => (
            <button
              key={value}
              type="button"
              onClick={() => setSortByName(value)}
              className={`rounded px-2 py-1 ${sortByName === value ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              {value === "a-z" ? "A-Z" : "Mặc định"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
        >
          <RefreshCcw className="size-3" />
          Tải lại
        </button>
      </div>
      <div className="flex items-center gap-2">
        {onSyncDb && (
          <button
            type="button"
            onClick={onSyncDb}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
            title="Đồng bộ danh sách file từ R2 vào DB (metadata để tìm kiếm)"
          >
            <Database className="size-3" />
            Đồng bộ DB
          </button>
        )}
        <button
          type="button"
          onClick={onCreateFolder}
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
        >
          <Plus className="size-3" />
          Thư mục
        </button>
        <button
          type="button"
          onClick={onOpenUploadGuide}
          className="inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          Upload file
        </button>
      </div>
    </div>
  );
}
