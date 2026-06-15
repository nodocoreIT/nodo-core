import { WaitingRoom } from "@/components/patient/waiting-room";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function WaitingRoomPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <WaitingRoom accessToken={token} dataSource="local" />
  );
}
