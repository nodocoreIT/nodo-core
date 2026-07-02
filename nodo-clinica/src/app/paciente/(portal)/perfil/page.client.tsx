"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clinicApi } from "@/lib/clinic/client-api";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

function readImageFile(file: File, maxKb = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > maxKb * 1024) {
      reject(new Error(`Imagen muy grande (máx ${maxKb}KB)`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Used in local mode — fetches its own data
export function PacientePerfilClient() {
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<{
    fullName: string;
    email: string;
    profilePhotoData?: string;
  } | null>(null);

  useEffect(() => {
    clinicApi.getSession().then(({ user }) => {
      if (user) {
        setPatient({
          fullName: user.fullName,
          email: user.email,
          profilePhotoData: user.profilePhotoData,
        });
      }
      setLoading(false);
    });
  }, []);

  if (loading || !patient) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return <ProfileCard initialData={patient} />;
}

// Used in supabase mode — receives server-fetched data as props
export function ProfileCard({
  initialData,
}: {
  initialData: { fullName: string; email: string; profilePhotoData?: string };
}) {
  const [photoData, setPhotoData] = useState(initialData.profilePhotoData);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (file: File) => {
    try {
      const profilePhotoData = await readImageFile(file);
      await clinicApi.updatePatientProfile({ profilePhotoData });
      setPhotoData(profilePhotoData);
      toast.success("Foto actualizada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir foto");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mi perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="relative group"
            >
              <UserAvatar
                name={initialData.fullName}
                photoUrl={photoData}
                size="lg"
              />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100">
                <Camera className="h-4 w-4 text-white" />
              </span>
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePhoto(f);
              }}
            />
            <div>
              <p className="font-semibold text-slate-800">{initialData.fullName}</p>
              <p className="text-sm text-slate-500">{initialData.email}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Tu ficha clínica (altura, peso, alergias) está en{" "}
            <strong>Mi salud</strong> del menú lateral.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
