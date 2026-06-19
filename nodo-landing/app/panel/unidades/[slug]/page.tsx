"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { getNodeBySlug } from "@/lib/nodes";
import { UnitPlanEditor } from "@/components/panel/UnitPlanEditor";

export default function NodoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const node = getNodeBySlug(slug);

  if (!node) notFound();

  return <UnitPlanEditor node={node} />;
}
