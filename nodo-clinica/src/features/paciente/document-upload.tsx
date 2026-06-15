import { useRef, useState } from "react";
import { Button } from "@nodocore/shared-components";
import { Upload, FileText, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabase";

interface UploadedFile {
  name: string;
  uploadedAt: string;
}

interface DocumentUploadProps {
  patientId: string;
  appointmentId: string;
  onUploaded?: (file: UploadedFile) => void;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_SIZE_MB = 10;

export function DocumentUpload({
  patientId,
  appointmentId,
  onUploaded,
}: DocumentUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: formato no permitido`);
        continue;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name}: excede ${MAX_SIZE_MB} MB`);
        continue;
      }

      const path = `${patientId}/${appointmentId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(path, file);

      if (uploadError) {
        toast.error(`Error al subir ${file.name}`);
        continue;
      }

      const { error: insertError } = await supabase
        .from("patient_documents")
        .insert({
          patient_id: patientId,
          appointment_id: appointmentId,
          file_name: file.name,
          file_path: path,
          mime_type: file.type,
        });

      if (insertError) {
        toast.error(`Error al registrar ${file.name}`);
        continue;
      }

      const uploaded: UploadedFile = {
        name: file.name,
        uploadedAt: new Date().toISOString(),
      };
      setUploadedFiles((prev) => [...prev, uploaded]);
      onUploaded?.(uploaded);
      toast.success(`${file.name} subido correctamente`);
    }

    setIsUploading(false);
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      <Button
        variant="outline"
        className="w-full border-dashed border-slate-300 h-20 flex flex-col gap-1"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-brand" />
        ) : (
          <>
            <Upload className="h-5 w-5 text-slate-400" />
            <span className="text-xs text-slate-500">
              PDF, JPG o PNG — máx. {MAX_SIZE_MB} MB
            </span>
          </>
        )}
      </Button>

      {uploadedFiles.length > 0 && (
        <div className="space-y-1.5">
          {uploadedFiles.map((file) => (
            <div
              key={file.name + file.uploadedAt}
              className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-md px-3 py-2"
            >
              <FileText className="h-3.5 w-3.5 text-brand shrink-0" />
              <span className="truncate flex-1">{file.name}</span>
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
