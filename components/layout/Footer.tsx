import Link from "next/link";
import Image from "next/image";
import { Facebook, Youtube, Instagram } from "lucide-react";

const footerLinks = {
  phim: [
    { href: "/phim-bo", label: "Phim bộ" },
    { href: "/phim-le", label: "Phim lẻ" },
    { href: "/hoat-hinh", label: "Hoạt hình" },
    { href: "/tv-shows", label: "TV Shows" },
  ],
  hoTro: [
    { href: "/huong-dan", label: "Hướng dẫn" },
    { href: "/lien-he", label: "Liên hệ" },
    { href: "/faq", label: "FAQ" },
  ],
  phapLy: [
    { href: "/dieu-khoan", label: "Điều khoản" },
    { href: "/chinh-sach", label: "Chính sách bảo mật" },
  ],
};

const socialLinks = [
  { href: "#", icon: Facebook, label: "Facebook" },
  { href: "#", icon: Youtube, label: "YouTube" },
  { href: "#", icon: Instagram, label: "Instagram" },
];

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border/40 bg-muted/30">
      <div className="container mx-auto px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        {/* Main Footer Content */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="Drama Phim - Trang chủ"
            >
              <Image
                src="/dramahd-logo.svg"
                alt="Drama Phim"
                width={140}
                height={24}
                className="h-6 w-auto"
              />
            </Link>
            <p className="text-sm text-muted-foreground">
              Xem phim online miễn phí, chất lượng cao. Cập nhật nhanh nhất.
            </p>
            {/* Social - mobile: full width, desktop: in brand column */}
            <div className="flex gap-3">
              {socialLinks.map(({ href, icon: Icon, label }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                  aria-label={label}
                >
                  <Icon className="size-5" />
                </Link>
              ))}
            </div>
          </div>

          {/* Phim */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Thể loại phim
            </h3>
            <ul className="space-y-3">
              {footerLinks.phim.map(
                (link: (typeof footerLinks.phim)[number]) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Hỗ trợ */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Hỗ trợ
            </h3>
            <ul className="space-y-3">
              {footerLinks.hoTro.map(
                (link: (typeof footerLinks.hoTro)[number]) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Pháp lý */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-foreground">
              Pháp lý
            </h3>
            <ul className="space-y-3">
              {footerLinks.phapLy.map(
                (link: (typeof footerLinks.phapLy)[number]) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-8 sm:flex-row">
          <p
            className="text-center text-sm text-muted-foreground sm:text-left"
            suppressHydrationWarning
          >
            © {currentYear} Drama Phim. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            {footerLinks.phapLy.map(
              (link: (typeof footerLinks.phapLy)[number]) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              ),
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
