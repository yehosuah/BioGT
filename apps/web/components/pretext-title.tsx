"use client";

import { layoutWithLines, prepareWithSegments } from "@chenglou/pretext";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";

type PretextLine = {
  text: string;
  width: number;
};

const preparedTitleCache = new Map<string, ReturnType<typeof prepareWithSegments>>();

const getPreparedTitle = (text: string, font: string) => {
  const cacheKey = `${font}::${text}`;
  const cached = preparedTitleCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const prepared = prepareWithSegments(text, font, { whiteSpace: "normal" });
  preparedTitleCache.set(cacheKey, prepared);
  return prepared;
};

export function PretextTitle({
  as = "h1",
  className,
  lineHeight,
  maxWidth = 760,
  minWidth = 280,
  text,
  font
}: {
  as?: "h1" | "h2" | "h3";
  className?: string;
  lineHeight: number;
  maxWidth?: number;
  minWidth?: number;
  text: string;
  font: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<PretextLine[]>([]);
  const headingLevel = Number(as.slice(1));
  const HeadingTag = as;

  const recompute = useEffectEvent((width: number) => {
    if (typeof window === "undefined") {
      return;
    }

    const prepared = getPreparedTitle(text, font);
    const clampedWidth = Math.max(minWidth, Math.min(width, maxWidth));
    const next = layoutWithLines(prepared, clampedWidth, lineHeight).lines.map((line) => ({
      text: line.text,
      width: line.width
    }));

    startTransition(() => {
      setLines(next);
    });
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    let frame = 0;
    const update = () => {
      recompute(node.clientWidth);
    };

    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    });

    observer.observe(node);
    document.fonts.ready.then(update);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [font, recompute, text]);

  return (
    <div
      aria-label={text}
      className={className}
      ref={containerRef}
      role="heading"
      aria-level={headingLevel}
    >
      {lines.length === 0 ? (
        <HeadingTag>{text}</HeadingTag>
      ) : (
        lines.map((line, index) => (
          <span key={`${line.text}-${index}`} style={{ width: `${line.width + 20}px` }}>
            {line.text}
          </span>
        ))
      )}
    </div>
  );
}
