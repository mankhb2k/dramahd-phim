"use client";

import { useEffect, useRef } from "react";

const AD_SCRIPT_SRC =
  "https://www.highperformanceformat.com/0c469230ca7ea887de8d159b5a7f79a9/invoke.js";

declare global {
  interface Window {
    atOptions?: {
      key: string;
      format: string;
      height: number;
      width: number;
      params?: Record<string, unknown>;
    };
  }
}

export function BannerHomeAds() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;

    window.atOptions = {
      key: "0c469230ca7ea887de8d159b5a7f79a9",
      format: "iframe",
      height: 250,
      width: 300,
      params: {},
    };

    const script = document.createElement("script");
    script.src = AD_SCRIPT_SRC;
    script.async = true;
    containerRef.current.appendChild(script);

    return () => {
      script.remove();
      delete window.atOptions;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="banner-home-ads"
      className="flex min-h-[250px] min-w-[300px] max-w-[300px] items-center justify-center overflow-hidden rounded-lg bg-muted/30"
      aria-label="Quảng cáo"
    />
  );
}
