"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

// Genre list: used for visible tabs + overflow dropdown
const genreLinks = [
  { href: "/", label: "Home" },
  { href: "/the-loai/tinh-cam", label: "Tình cảm" },
  { href: "/the-loai/drama", label: "Drama" },
  { href: "/the-loai/gia-dinh", label: "Gia đình" },
  { href: "/the-loai/hoc-duong", label: "Học đường" },
  { href: "/the-loai/cong-so", label: "Công sở" },
  { href: "/the-loai/tong-tai", label: "Tổng tài" },
  { href: "/the-loai/trinh-tham", label: "Trinh thám" },
  { href: "/the-loai/trung-sinh", label: "Trùng Sinh" },
  { href: "/the-loai/xuyen-khong", label: "Xuyên Không" },
  { href: "/the-loai/hoat-hinh", label: "Hoạt Hình" },
] as const;

const MIN_VISIBLE_GENRES = 2;
const ESTIMATED_GENRE_WIDTH_DESKTOP = 92;
/** Khu vực bên phải mobile: dropdown (size-9) + profile (size-9) + gap-2 */
const MOBILE_RIGHT_WIDTH = 36 + 36 + 8;

/**
 * Ước lượng width mỗi item mobile theo độ dài label để tránh hiện nửa chữ.
 * 26px ~ padding + khoảng icon/spacing, 7px ~ average glyph width ở text-sm.
 */
const estimateMobileGenreWidth = (label: string): number => {
  const charCount = Array.from(label).length;
  return 26 + charCount * 7;
};

export function Header() {
  // ----- Global header state -----
  const user = useAuthStore((s) => s.user);
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const [visibleGenreCount, setVisibleGenreCount] = useState(10);
  const genreNavRefMobile = useRef<HTMLDivElement>(null);
  const genreNavRefDesktop = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // ----- Responsive genre allocation (visible tabs vs dropdown) -----
  useEffect(() => {
    const updateVisible = () => {
      const mobileW = genreNavRefMobile.current?.offsetWidth ?? 0;
      const desktopW = genreNavRefDesktop.current?.offsetWidth ?? 0;
      const isMobile = mobileW > 0;
      const w = isMobile ? mobileW : desktopW;
      if (w <= 0) return;

      if (isMobile) {
        // Mobile: estimate each label width to avoid cut-off text
        const navWidth = Math.max(0, w - MOBILE_RIGHT_WIDTH);
        let usedWidth = 0;
        let count = 0;

        for (let i = 0; i < genreLinks.length; i += 1) {
          const itemWidth = estimateMobileGenreWidth(genreLinks[i].label);
          const gapWidth = i > 0 ? 4 : 0; // gap-1
          if (usedWidth + gapWidth + itemWidth > navWidth) break;
          usedWidth += gapWidth + itemWidth;
          count += 1;
        }

        const clamped = Math.max(
          MIN_VISIBLE_GENRES,
          Math.min(genreLinks.length, count),
        );
        setVisibleGenreCount(clamped);
      } else {
        // Desktop: estimate with fixed width per tab
        const count = Math.floor(w / ESTIMATED_GENRE_WIDTH_DESKTOP);
        const clamped = Math.max(
          MIN_VISIBLE_GENRES,
          Math.min(genreLinks.length, count),
        );
        setVisibleGenreCount(clamped);
      }
    };

    updateVisible();
    const ro = new ResizeObserver(updateVisible);
    const elM = genreNavRefMobile.current;
    const elD = genreNavRefDesktop.current;
    if (elM) ro.observe(elM);
    if (elD) ro.observe(elD);
    return () => ro.disconnect();
  }, []);

  const visibleGenres = genreLinks.slice(0, visibleGenreCount);
  const moreGenres = genreLinks.slice(visibleGenreCount);

  const isGenreActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const isProfileActive =
    pathname === "/profile" || pathname.startsWith("/profile/");

  // ----- Reusable dropdown "more genres" (mobile + desktop) -----
  const dropdownContent = moreGenres.length > 0 && (
    <>
      <button
        type="button"
        onClick={() => setGenreMenuOpen(!genreMenuOpen)}
        className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label={genreMenuOpen ? "Đóng menu thể loại" : "Xem thêm thể loại"}
        aria-expanded={genreMenuOpen}
      >
        <ChevronDown
          className={cn(
            "size-5 transition-transform",
            genreMenuOpen && "rotate-180",
          )}
        />
      </button>
      {genreMenuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setGenreMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] min-w-40 overflow-y-auto rounded-lg border border-border bg-popover py-1 shadow-lg">
            {moreGenres.map((link: (typeof genreLinks)[number]) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setGenreMenuOpen(false)}
                className={cn(
                  "block px-4 py-2.5 text-sm font-medium transition-colors",
                  isGenreActive(link.href)
                    ? "bg-accent text-popover-foreground"
                    : "text-popover-foreground hover:bg-accent",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full min-w-0 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto min-w-0 max-w-full px-4 sm:px-6 lg:px-8">
        {/* ---------- MOBILE: Hàng 1 = Logo + Search, Hàng 2 = Thể loại + Dropdown + Profile ---------- */}
        <div className="flex min-w-0 flex-col sm:hidden">
          {/* Mobile row 1: brand + search */}
          <div className="flex h-12 min-h-12 min-w-0 items-center gap-2 py-2">
            <Link
              href="/"
              className="flex shrink-0 items-center"
              aria-label="Drama Phim - Trang chủ"
            >
              <Image
                src="/dramahd-logo.svg"
                alt="Drama Phim"
                width={120}
                height={20}
                className="h-5 w-auto"
                priority
              />
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="search"
                placeholder="Tìm phim, diễn viên..."
                className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                className="shrink-0 rounded-lg bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90"
                aria-label="Tìm kiếm"
              >
                <Search className="size-4" />
              </button>
            </div>
          </div>
          <div
            ref={genreNavRefMobile}
            className="relative flex h-11 min-w-0 items-center justify-between gap-2 border-t border-border/40"
          >
            {/* Mobile row 2-left: visible genre tabs */}
            <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-hide">
              {visibleGenres.map((link: (typeof genreLinks)[number]) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-medium transition-colors",
                    isGenreActive(link.href)
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {/* Mobile row 2-right: overflow dropdown + profile */}
            <div className="relative flex shrink-0 items-center gap-0.5">
              {dropdownContent}
              <Link
                href="/profile"
                className={cn(
                  "flex size-9 items-center justify-center rounded-full transition-colors hover:bg-accent hover:text-foreground",
                  isProfileActive ? "text-foreground" : "text-muted-foreground",
                )}
                aria-label={user ? "Tài khoản" : "Đăng nhập / Đăng ký"}
              >
                <User className="size-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* ---------- WEB: Hàng 1 = Logo + Search + Profile, Hàng 2 = Thể loại căn giữa + Dropdown ---------- */}
        <div className="hidden sm:block">
          {/* Desktop row 1: brand + search + profile */}
          <div className="flex h-14 min-h-14 items-center gap-4 py-2">
            <Link
              href="/"
              className="flex shrink-0 items-center"
              aria-label="Drama Phim - Trang chủ"
            >
              <Image
                src="/dramahd-logo.svg"
                alt="Drama Phim"
                width={140}
                height={24}
                className="h-6 w-auto"
                priority
              />
            </Link>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <input
                type="search"
                placeholder="Tìm phim, diễn viên..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                className="shrink-0 rounded-lg bg-primary px-3 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
                aria-label="Tìm kiếm"
              >
                <Search className="size-5" />
              </button>
            </div>
            <Link
              href="/profile"
              className={cn(
                "flex shrink-0 items-center justify-center rounded-full p-2 transition-colors hover:bg-accent hover:text-foreground",
                isProfileActive ? "text-foreground" : "text-muted-foreground",
              )}
              aria-label={user ? "Tài khoản" : "Đăng nhập / Đăng ký"}
            >
              <User className="size-6" />
            </Link>
          </div>
          <div
            ref={genreNavRefDesktop}
            className="flex h-11 shrink-0 items-center border-t border-border/40"
          >
            <div className="w-9 shrink-0" aria-hidden="true" />
            {/* Desktop row 2-center: visible genre tabs */}
            <nav className="flex min-w-0 flex-1 justify-evenly items-center gap-4 overflow-x-auto scrollbar-hide px-2">
              {visibleGenres.map((link: (typeof genreLinks)[number]) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "shrink-0 whitespace-nowrap px-2.5 py-2 text-sm font-medium transition-colors",
                    isGenreActive(link.href)
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            {/* Desktop row 2-right: overflow dropdown */}
            {moreGenres.length > 0 ? (
              <div className="relative w-9 shrink-0 flex items-center justify-center">
                {dropdownContent}
              </div>
            ) : (
              <div className="w-9 shrink-0" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
