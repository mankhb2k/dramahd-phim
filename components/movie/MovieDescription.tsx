"use client";

import { useMemo, useState } from "react";

type MovieDescriptionProps = {
  text: string;
  maxLength?: number;
  className?: string;
};

export function MovieDescription({
  text,
  maxLength = 1000,
  className,
}: MovieDescriptionProps) {
  const [expanded, setExpanded] = useState(false);

  const shouldTruncate = text.length > maxLength;
  const truncated = useMemo(() => {
    if (!shouldTruncate) return text;
    return `${text.slice(0, maxLength).trimEnd()}...`;
  }, [maxLength, shouldTruncate, text]);

  return (
    <p className={className}>
      {expanded || !shouldTruncate ? text : truncated}
      {shouldTruncate && (
        <>
          {" "}
          <button
            type="button"
            onClick={() => setExpanded((prev: boolean) => !prev)}
            className="font-medium text-foreground underline underline-offset-2 transition-opacity hover:opacity-80"
          >
            {expanded ? "Thu gọn" : "Xem thêm"}
          </button>
        </>
      )}
    </p>
  );
}
