"use client";

import dynamic from "next/dynamic";

const FlipBook = dynamic(() => import("./FlipBook"), { ssr: false });

interface Page {
  src: string;
  alt: string;
}

interface Props {
  pages: Page[];
}

export default function FlipBookWrapper({ pages }: Props) {
  return <FlipBook pages={pages} />;
}
