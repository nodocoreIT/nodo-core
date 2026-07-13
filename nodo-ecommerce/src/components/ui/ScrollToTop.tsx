"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Component that ensures the page scrolls to the top whenever the route changes.
 * This is especially useful in SPAs where the scroll position might be preserved
 * between navigation actions.
 */
export default function ScrollToTop() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // We use a small timeout to ensure the DOM has updated and the browser
    // can correctly calculate the scroll position.
    const timer = setTimeout(() => {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant" // "instant" for immediate jump as requested
      });
    }, 0);

    return () => clearTimeout(timer);
  }, [pathname, searchParams]); // Trigger on path or search params change (filters)

  return null;
}
