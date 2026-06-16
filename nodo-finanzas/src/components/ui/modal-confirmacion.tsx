import { Button } from './button';

interface ModalConfirmacionProps {
  open: boolean;
  onClose?: () => void;
  onConfirm: () => void;
  onCancel?: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export function ModalConfirmacion({
  open,
  onClose,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
}: ModalConfirmacionProps) {
  if (!open) return null;

  const handleCancel = () => {
    onCancel?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
        <h3 className="text-lg font-bold text-ink mb-2">{title}</h3>
        <p className="text-sm text-slate2 mb-6">{message}</p>
        <div className="flex gap-3">
          <Button
            variant="danger"
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmText}
          </Button>
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </div>
  );
}
