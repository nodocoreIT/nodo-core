"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { WaitingRoom } from "@/components/patient/waiting-room";
import type { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

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
  // Only block dismissal while a video call is actually connected — every
  // other screen (waiting queue, load error, cancelled, post-call) has no
  // in-content close button in embedded mode, so blocking those too would
  // trap the patient with no way out. WaitingRoom reports call state via
  // onCallActiveChange.
  const [callActive, setCallActive] = useState(false);

  // Closing during an active call by clicking outside, pressing Escape, or
  // the corner X would silently hang it up with no confirmation. Cancel
  // those dismiss attempts while callActive; the only way out during a call
  // is the app's own explicit "Cerrar" flow inside WaitingRoom (onClose
  // below), which changes `accessToken` in the parent directly and bypasses
  // this handler entirely.
  const handleDialogOpenChange = (
    open: boolean,
    eventDetails: DialogPrimitive.Root.ChangeEventDetails,
  ) => {
    if (!open && callActive) {
      eventDetails.cancel();
      return;
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={!!accessToken} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        showCloseButton={!callActive}
        className="max-w-[85%] sm:max-w-xl max-h-[90vh] overflow-y-auto px-6 pt-8"
      >
        <DialogTitle className="sr-only">Turno</DialogTitle>
        {accessToken && (
          <WaitingRoom
            accessToken={accessToken}
            dataSource="local"
            onClose={() => onOpenChange(false)}
            onReady={onReady}
            onCallActiveChange={setCallActive}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
