"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, Cloud, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  R2MovieFolderPickerModal,
  type R2ApplyItem,
} from "@/components/dashboard/r2/R2MovieFolderPickerModal";
import {
  R2SubtitleFolderPickerModal,
  type R2SubApplyItem,
} from "@/components/dashboard/r2/R2SubtitleFolderPickerModal";

type Genre = { id: number; slug: string; name: string };
type Tag = { id: number; slug: string; name: string };

type ServerRow = {
  id: string;
  name: string;
  embedUrl: string;
  playbackUrl: string;
  objectKey: string;
  sourceType: "EMBED" | "DIRECT_VIDEO";
  storageProvider: "EXTERNAL" | "R2";
  subtitleUrl: string;
  vastTagUrl: string;
  mimeType: string;
  fileSizeBytes?: number;
  priority: number;
  isActive: boolean;
};
type EpisodeRow = {
  id: string;
  episodeNumber: number;
  name: string;
  subtitleUrl: string;
  servers: ServerRow[];
};

type MovieResponse = {
  id: number;
  slug: string;
  channel: string;
  title: string;
  originalTitle: string | null;
  description: string | null;
  poster: string | null;
  backdrop: string | null;
  year: number | null;
  status: "ONGOING" | "COMPLETED";
  audioType?: "NONE" | "SUB" | "DUBBED";
  genres: Genre[];
  tags: Tag[];
  episodes: Array<{
    id: number;
    episodeNumber: number;
    name: string;
    subtitleUrl?: string | null;
    servers: Array<{
      id: number;
      name: string;
      embedUrl: string;
      playbackUrl: string | null;
      objectKey: string | null;
      sourceType: "EMBED" | "DIRECT_VIDEO";
      storageProvider: "EXTERNAL" | "R2";
      subtitleUrl: string | null;
      vastTagUrl: string | null;
      mimeType: string | null;
      fileSizeBytes: number | null;
      priority: number;
      isActive: boolean;
    }>;
  }>;
};

function genId() {
  return Math.random().toString(36).slice(2);
}

export default function EditMoviePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug as string | undefined;

  const [genres, setGenres] = useState<Genre[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [channel, setChannel] = useState("nsh");
  const [originalTitle, setOriginalTitle] = useState("");
  const [description, setDescription] = useState("");
  const [poster, setPoster] = useState("");
  const [backdrop, setBackdrop] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState<"ONGOING" | "COMPLETED">("ONGOING");
  const [audioType, setAudioType] = useState<"NONE" | "SUB" | "DUBBED">("NONE");
  const [genreIds, setGenreIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeRow[]>([]);
  const [r2MoviePickerOpen, setR2MoviePickerOpen] = useState(false);
  const [r2SubPickerOpen, setR2SubPickerOpen] = useState(false);

  const fetchMovieAndOptions = useCallback(async () => {
    if (!slug) return;
    try {
      const [movieRes, genresRes, tagsRes] = await Promise.all([
        fetch(`/api/dashboard/movies/${encodeURIComponent(slug)}`),
        fetch("/api/dashboard/genres"),
        fetch("/api/dashboard/tags"),
      ]);
      if (!movieRes.ok) {
        setMessage({ type: "error", text: "Không tìm thấy phim." });
        setLoading(false);
        return;
      }
      const movie: MovieResponse = await movieRes.json();
      if (genresRes.ok) setGenres(await genresRes.json());
      if (tagsRes.ok) setTags(await tagsRes.json());

      setTitle(movie.title);
      setSlugInput(movie.slug);
      setChannel(movie.channel ?? "nsh");
      setOriginalTitle(movie.originalTitle ?? "");
      setDescription(movie.description ?? "");
      setPoster(movie.poster ?? "");
      setBackdrop(movie.backdrop ?? "");
      setYear(movie.year != null ? String(movie.year) : "");
      setStatus(movie.status);
      setAudioType(movie.audioType ?? "NONE");
      setGenreIds(movie.genres.map((g) => g.id));
      setTagIds(movie.tags.map((t) => t.id));
      setEpisodes(
        movie.episodes.map((ep) => ({
          id: genId(),
          episodeNumber: ep.episodeNumber,
          name: ep.name ?? "",
          subtitleUrl: ep.subtitleUrl ?? "",
          servers: ep.servers.map((s) => ({
            id: genId(),
            name: s.name,
            embedUrl: s.embedUrl,
            playbackUrl: s.playbackUrl ?? "",
            objectKey: s.objectKey ?? "",
            sourceType: s.sourceType,
            storageProvider: s.storageProvider,
            subtitleUrl: s.subtitleUrl ?? "",
            vastTagUrl: s.vastTagUrl ?? "",
            mimeType: s.mimeType ?? "",
            fileSizeBytes: s.fileSizeBytes ?? undefined,
            priority: s.priority,
            isActive: s.isActive,
          })),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchMovieAndOptions();
  }, [fetchMovieAndOptions]);

  const toggleGenre = (id: number) => {
    setGenreIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };
  const toggleTag = (id: number) => {
    setTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const addEpisode = () => {
    const nextNum =
      episodes.length === 0
        ? 1
        : Math.max(...episodes.map((e) => e.episodeNumber)) + 1;
    setEpisodes((prev) => [
      ...prev,
      {
        id: genId(),
        episodeNumber: nextNum,
        name: "",
        subtitleUrl: "",
        servers: [],
      },
    ]);
  };
  const removeEpisode = (id: string) => {
    setEpisodes((prev) => prev.filter((e) => e.id !== id));
  };
  const updateEpisode = (
    id: string,
    field: keyof EpisodeRow,
    value: number | string | ServerRow[],
  ) => {
    setEpisodes((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    );
  };
  const addServer = (episodeId: string) => {
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === episodeId
          ? {
              ...e,
              servers: [
                ...e.servers,
                {
                  id: genId(),
                  name: "",
                  embedUrl: "",
                  playbackUrl: "",
                  objectKey: "",
                  sourceType: "EMBED",
                  storageProvider: "EXTERNAL",
                  subtitleUrl: "",
                  vastTagUrl: "",
                  mimeType: "",
                  priority: e.servers.length,
                  isActive: true,
                },
              ],
            }
          : e,
      ),
    );
  };
  const removeServer = (episodeId: string, serverId: string) => {
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === episodeId
          ? { ...e, servers: e.servers.filter((s) => s.id !== serverId) }
          : e,
      ),
    );
  };
  const handleR2Apply = useCallback((items: R2ApplyItem[]) => {
    if (items.length === 0) return;
    const maxEp = Math.max(...items.map((i: R2ApplyItem) => i.episodeNumber));
    setEpisodes((prev) => {
      const byNum = new Map(prev.map((e) => [e.episodeNumber, e]));
      for (let n = 1; n <= maxEp; n++) {
        if (!byNum.has(n)) {
          byNum.set(n, {
            id: genId(),
            episodeNumber: n,
            name: "",
            subtitleUrl: "",
            servers: [],
          });
        }
      }
      const next = Array.from(byNum.values()).sort(
        (a, b) => a.episodeNumber - b.episodeNumber,
      );
      return next.map((ep) => {
        const item = items.find(
          (i: R2ApplyItem) => i.episodeNumber === ep.episodeNumber,
        );
        if (!item) return ep;
        const existingR2 = ep.servers.find((s) => s.storageProvider === "R2");
        if (existingR2) {
          return {
            ...ep,
            servers: ep.servers.map((s) =>
              s.id === existingR2.id
                ? {
                    ...s,
                    name: s.name || "R2",
                    objectKey: item.objectKey,
                    playbackUrl: item.playbackUrl,
                    embedUrl: item.playbackUrl,
                    storageProvider: "R2" as const,
                    sourceType: "DIRECT_VIDEO" as const,
                  }
                : s,
            ),
          };
        }
        return {
          ...ep,
          servers: [
            ...ep.servers,
            {
              id: genId(),
              name: "R2",
              embedUrl: item.playbackUrl,
              playbackUrl: item.playbackUrl,
              objectKey: item.objectKey,
              sourceType: "DIRECT_VIDEO",
              storageProvider: "R2",
              subtitleUrl: "",
              vastTagUrl: "",
              mimeType: "",
              priority: ep.servers.length,
              isActive: true,
            },
          ],
        };
      });
    });
    setR2MoviePickerOpen(false);
  }, []);

  const handleR2SubApply = useCallback((items: R2SubApplyItem[]) => {
    if (items.length === 0) return;
    setEpisodes((prev) =>
      prev.map((ep) => {
        const item = items.find(
          (i: R2SubApplyItem) => i.episodeNumber === ep.episodeNumber,
        );
        if (!item) return ep;
        return { ...ep, subtitleUrl: item.subtitleUrl };
      }),
    );
    setR2SubPickerOpen(false);
  }, []);

  const updateServer = (
    episodeId: string,
    serverId: string,
    field: keyof ServerRow,
    value: ServerRow[keyof ServerRow],
  ) => {
    setEpisodes((prev) =>
      prev.map((e) =>
        e.id === episodeId
          ? {
              ...e,
              servers: e.servers.map((s) =>
                s.id === serverId ? { ...s, [field]: value } : s,
              ),
            }
          : e,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!slug) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slugInput.trim() || undefined,
        channel: channel.trim() || "nsh",
        audioType,
        originalTitle: originalTitle.trim() || undefined,
        description: description.trim() || undefined,
        poster: poster.trim() || undefined,
        backdrop: backdrop.trim() || undefined,
        year: year === "" ? undefined : Number(year),
        status,
        genreIds,
        tagIds,
        episodes: episodes.map((ep) => ({
          episodeNumber: ep.episodeNumber,
          name: ep.name.trim() || undefined,
          subtitleUrl: ep.subtitleUrl?.trim() || undefined,
          servers: ep.servers
            .filter(
              (s) =>
                s.name.trim() && (s.playbackUrl.trim() || s.embedUrl.trim()),
            )
            .map((s, i) => ({
              name: s.name.trim(),
              embedUrl: s.embedUrl.trim(),
              playbackUrl: s.playbackUrl.trim() || undefined,
              objectKey: s.objectKey.trim() || undefined,
              sourceType: s.sourceType,
              storageProvider: s.storageProvider,
              subtitleUrl: s.subtitleUrl.trim() || undefined,
              vastTagUrl: s.vastTagUrl.trim() || undefined,
              mimeType: s.mimeType.trim() || undefined,
              fileSizeBytes: s.fileSizeBytes ?? undefined,
              priority: i,
              isActive: s.isActive,
            })),
        })),
      };
      const res = await fetch(
        `/api/dashboard/movies/${encodeURIComponent(slug)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({
          type: "error",
          text: data.error ?? "Cập nhật thất bại.",
        });
        return;
      }
      setMessage({ type: "success", text: "Cập nhật phim thành công." });
      if (data.slug && data.slug !== slug) {
        router.replace(`/dashboard/admin/movies/${data.slug}/edit`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!slug) return;
    const confirmed = window.confirm(
      "Bạn có chắc muốn xóa phim này? Hành động không thể hoàn tác.",
    );
    if (!confirmed) return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/dashboard/movies/${encodeURIComponent(slug)}`,
        {
          method: "DELETE",
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Xóa phim thất bại." });
        return;
      }
      router.push("/dashboard/admin/movies");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  if (!slug) {
    return <div className="text-muted-foreground">Thiếu slug phim.</div>;
  }

  if (loading) {
    return <p className="text-muted-foreground">Đang tải...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link
            href="/dashboard/admin/movies"
            aria-label="Trở về danh sách phim"
          >
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
            Sửa phim
          </h1>
          <p className="text-muted-foreground">{slug}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex max-w-3xl flex-col gap-8 rounded-xl border border-border bg-card p-6 shadow-sm"
      >
        {message && (
          <div
            className={
              message.type === "success"
                ? "rounded-md bg-green-500/10 text-green-700 dark:text-green-400"
                : "rounded-md bg-destructive/10 text-destructive"
            }
          >
            <p className="px-3 py-2 text-sm font-medium">{message.text}</p>
          </div>
        )}

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            Thông tin phim
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label
                htmlFor="title"
                className="text-sm font-medium text-foreground"
              >
                Tiêu đề <span className="text-destructive">*</span>
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="VD: Trùm Quỷ Dương"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="slug"
                className="text-sm font-medium text-foreground"
              >
                Slug
              </label>
              <input
                id="slug"
                type="text"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="VD: trum-quy-duong"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="channel"
                className="text-sm font-medium text-foreground"
              >
                Channel URL
              </label>
              <input
                id="channel"
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="nsh"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="year"
                className="text-sm font-medium text-foreground"
              >
                Năm
              </label>
              <input
                id="year"
                type="number"
                min={1900}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="2024"
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label
                htmlFor="originalTitle"
                className="text-sm font-medium text-foreground"
              >
                Tên gốc
              </label>
              <input
                id="originalTitle"
                type="text"
                value={originalTitle}
                onChange={(e) => setOriginalTitle(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="VD: Devil's Sun"
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label
                htmlFor="description"
                className="text-sm font-medium text-foreground"
              >
                Mô tả
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="Tóm tắt nội dung phim..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="poster"
                className="text-sm font-medium text-foreground"
              >
                Poster (URL)
              </label>
              <input
                id="poster"
                type="url"
                value={poster}
                onChange={(e) => setPoster(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-2">
              <label
                htmlFor="backdrop"
                className="text-sm font-medium text-foreground"
              >
                Backdrop (URL)
              </label>
              <input
                id="backdrop"
                type="url"
                value={backdrop}
                onChange={(e) => setBackdrop(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder="https://..."
              />
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label
                htmlFor="status"
                className="text-sm font-medium text-foreground"
              >
                Trạng thái
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "ONGOING" | "COMPLETED")
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ONGOING">Đang chiếu</option>
                <option value="COMPLETED">Đã hoàn thành</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <label
                htmlFor="audioType"
                className="text-sm font-medium text-foreground"
              >
                Loại phim
              </label>
              <select
                id="audioType"
                value={audioType}
                onChange={(e) =>
                  setAudioType(e.target.value as "NONE" | "SUB" | "DUBBED")
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="NONE">Không xác định</option>
                <option value="SUB">Phim sub</option>
                <option value="DUBBED">Phim lồng tiếng</option>
              </select>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">
                Thể loại
              </span>
              <div className="flex flex-wrap gap-2">
                {genres.map((g: Genre) => (
                  <label
                    key={g.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input
                      type="checkbox"
                      checked={genreIds.includes(g.id)}
                      onChange={() => toggleGenre(g.id)}
                      className="size-4 rounded border-input"
                    />
                    {g.name}
                  </label>
                ))}
                {genres.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Chưa có thể loại.
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">Tag</span>
              <div className="flex flex-wrap gap-2">
                {tags.map((t: Tag) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/10"
                  >
                    <input
                      type="checkbox"
                      checked={tagIds.includes(t.id)}
                      onChange={() => toggleTag(t.id)}
                      className="size-4 rounded border-input"
                    />
                    {t.name}
                  </label>
                ))}
                {tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    Chưa có tag.
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Tập phim & Link server
            </h2>
            <div className="flex items-center gap-2">
              {audioType === "SUB" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setR2SubPickerOpen(true)}
                  className="inline-flex items-center gap-2"
                >
                  <Subtitles className="size-4" />
                  Gắn R2 sub cho các tập
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setR2MoviePickerOpen(true)}
                className="inline-flex items-center gap-2"
              >
                <Cloud className="size-4" />
                Gắn R2 cho tất cả tập
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEpisode}
                className="inline-flex items-center gap-2"
              >
                <Plus className="size-4" />
                Thêm tập
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Mỗi tập có thể có nhiều server. Điền tên server và link embed
            (iframe src).
          </p>

          {episodes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-muted-foreground">
              Chưa có tập. Bấm &quot;Thêm tập&quot; để thêm.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  className="rounded-lg border border-border bg-muted/20 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={ep.episodeNumber}
                      onChange={(e) =>
                        updateEpisode(
                          ep.id,
                          "episodeNumber",
                          Number(e.target.value) || 1,
                        )
                      }
                      className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-sm font-medium text-foreground">
                      Tập
                    </span>
                    <input
                      type="text"
                      value={ep.name}
                      onChange={(e) =>
                        updateEpisode(ep.id, "name", e.target.value)
                      }
                      className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Tên tập (tùy chọn)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEpisode(ep.id)}
                      className="shrink-0 text-destructive hover:bg-destructive/10"
                      aria-label="Xóa tập"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  {audioType === "SUB" && (
                    <div className="mb-3 flex flex-col gap-1">
                      <label
                        htmlFor={`sub-${ep.id}`}
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Link sub tập {ep.episodeNumber}
                      </label>
                      <input
                        id={`sub-${ep.id}`}
                        type="url"
                        value={ep.subtitleUrl ?? ""}
                        onChange={(e) =>
                          updateEpisode(ep.id, "subtitleUrl", e.target.value)
                        }
                        className="rounded-md border border-input bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Link server (embed URL)
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => addServer(ep.id)}
                        className="inline-flex items-center gap-1 text-xs"
                      >
                        <Plus className="size-3" />
                        Thêm server
                      </Button>
                    </div>
                    {ep.servers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Chưa thêm server.
                      </p>
                    ) : (
                      ep.servers.map((srv) => (
                        <div
                          key={srv.id}
                          className="flex flex-wrap items-center gap-2 rounded border border-border bg-background p-2"
                        >
                          <input
                            type="text"
                            value={srv.name}
                            onChange={(e) =>
                              updateServer(
                                ep.id,
                                srv.id,
                                "name",
                                e.target.value,
                              )
                            }
                            className="w-28 rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                            placeholder="VD: R2 Storage"
                          />
                          <input
                            type="url"
                            value={srv.embedUrl}
                            onChange={(e) =>
                              updateServer(
                                ep.id,
                                srv.id,
                                "embedUrl",
                                e.target.value,
                              )
                            }
                            className="min-w-0 flex-1 rounded border border-input bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                            placeholder="https://cdn.com/video.mp4?"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeServer(ep.id, srv.id)}
                            className="shrink-0 text-destructive hover:bg-destructive/10"
                            aria-label="Xóa server"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Đang cập nhật..." : "Cập nhật"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/dashboard/admin/movies">Hủy</Link>
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? "Đang xóa..." : "Xóa phim"}
          </Button>
        </div>
      </form>
      <R2SubtitleFolderPickerModal
        open={r2SubPickerOpen}
        onClose={() => setR2SubPickerOpen(false)}
        episodes={episodes.map((ep) => ({ episodeNumber: ep.episodeNumber }))}
        onApply={handleR2SubApply}
      />
      <R2MovieFolderPickerModal
        open={r2MoviePickerOpen}
        onClose={() => setR2MoviePickerOpen(false)}
        episodes={episodes.map((ep) => ({ episodeNumber: ep.episodeNumber }))}
        onApply={handleR2Apply}
      />
    </div>
  );
}
