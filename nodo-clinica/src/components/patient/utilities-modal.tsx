"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PharmacyOnCallCard } from "@/components/patient/pharmacy-on-call-card";
import { MedicalDirectoryCard } from "@/components/patient/medical-directory-card";
import { FlaskConical, Scan } from "lucide-react";

export function UtilitiesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Utilidades y servicios útiles</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="farmacias" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="farmacias">Farmacias</TabsTrigger>
            <TabsTrigger value="laboratorios">Laboratorios</TabsTrigger>
            <TabsTrigger value="diagnostico">Diagnóstico</TabsTrigger>
          </TabsList>

          <TabsContent value="farmacias" className="mt-4">
            <PharmacyOnCallCard />
          </TabsContent>

          <TabsContent value="laboratorios" className="mt-4">
            <MedicalDirectoryCard
              category="laboratorio"
              title="Laboratorios de análisis clínicos"
              icon={FlaskConical}
              tone="sky"
              emptyLabel="Todavía no se cargó el listado de laboratorios."
            />
          </TabsContent>

          <TabsContent value="diagnostico" className="mt-4">
            <MedicalDirectoryCard
              category="diagnostico_imagenes"
              title="Diagnóstico por imágenes"
              icon={Scan}
              tone="violet"
              emptyLabel="Todavía no se cargó el listado de centros de diagnóstico."
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
