"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export default function RevealOnScroll({
  children,
  className = "",
  delay = 0,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.08 }
    );

    observer.observe(el);

    // Safety net: reveal after delay + 1s regardless
    const timer = setTimeout(() => setRevealed(true), 1000 + delay);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [delay]);

  // SSR and first paint: fully visible (no flash of invisible content)
  // Only apply the hidden state after client mount, before reveal
  const shouldAnimate = mounted && !revealed;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shouldAnimate ? 0 : 1,
        transform: shouldAnimate ? "translateY(22px)" : "none",
        transition: mounted
          ? `opacity .7s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .7s cubic-bezier(.2,.7,.2,1) ${delay}ms`
          : "none",
      }}
    >
      {children}
    </div>
  );
}
