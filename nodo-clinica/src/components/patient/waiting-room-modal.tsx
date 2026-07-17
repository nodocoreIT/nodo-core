"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WaitingRoom } from "@/components/patient/waiting-room";

interface WaitingRoomModalProps {
  accessToken: string | null;
  onOpenChange: (open: boolean) => void;
  /** Called once, right after the appointment finishes loading successfully. */
  onReady?: () => void;
}

export function WaitingRoomModal({
  accessToken,
  onOpenChange,
  onReady,
}: WaitingRoomModalProps) {
  return (
    <Dialog open={!!accessToken} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[85%] sm:max-w-xl max-h-[90vh] overflow-y-auto px-6 pt-8">
        <DialogTitle className="sr-only">Turno</DialogTitle>
        {accessToken && (
          <WaitingRoom
            accessToken={accessToken}
            dataSource="local"
            onClose={() => onOpenChange(false)}
            onReady={onReady}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
