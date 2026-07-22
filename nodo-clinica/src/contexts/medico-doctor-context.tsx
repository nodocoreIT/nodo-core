"use client";

import { createContext, useContext } from "react";

export interface MedicoDoctorProfile {
  id: string;
  fullName: string;
  email: string;
  subscriptionPlan?: string;
  profilePhotoUrl?: string;
}

const MedicoDoctorContext = createContext<MedicoDoctorProfile | null>(null);

export function MedicoDoctorProvider({
  doctor,
  children,
}: {
  doctor: MedicoDoctorProfile;
  children: React.ReactNode;
}) {
  return (
    <MedicoDoctorContext.Provider value={doctor}>
      {children}
    </MedicoDoctorContext.Provider>
  );
}

export function useMedicoDoctor(): MedicoDoctorProfile {
  const doctor = useContext(MedicoDoctorContext);
  if (!doctor) {
    throw new Error("useMedicoDoctor must be used within MedicoDoctorProvider");
  }
  return doctor;
}
