import { Routes, Route, useParams } from "react-router-dom";
import { PacienteHome } from "@/features/paciente/paciente-home";
import { WaitingRoom } from "@/features/paciente/waiting-room";

function WaitingRoomRoute() {
  const { token } = useParams<{ token: string }>();
  if (!token) return null;
  return <WaitingRoom accessToken={token} />;
}

export function PacientePortalPage() {
  return (
    <Routes>
      <Route index element={<PacienteHome />} />
      <Route path="sala/:token" element={<WaitingRoomRoute />} />
    </Routes>
  );
}
