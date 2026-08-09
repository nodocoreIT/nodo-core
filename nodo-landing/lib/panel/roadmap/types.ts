import type { LucideIcon } from "lucide-react";

export type RoadmapStatus = "disponible" | "parcial" | "proximamente";

export type RoadmapSide = "medico" | "paciente" | "compartido";

export type RoadmapItem = {
  id: string;
  side: RoadmapSide;
  category: string;
  title: string;
  description: string;
  status: RoadmapStatus;
  icon: LucideIcon;
};

export type NodoRoadmap = {
  nodoCode: string;
  nodoLabel: string;
  updatedAt: string;
  items: RoadmapItem[];
  /** Known gaps/inconsistencies worth a QA gut-check — not roadmap items per se. */
  qaNotes: string[];
};
