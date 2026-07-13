import { Truck } from "lucide-react";

interface Props {
  text: string;
  freeFrom?: string;
}

export default function TopBanner({ text, freeFrom }: Props) {
  const display = freeFrom
    ? `${text} en compras superiores a $${Number(freeFrom).toLocaleString("es-AR")}`
    : text;

  return (
    <div className="bg-gold text-black text-center py-2 px-4 text-[12px] font-semibold tracking-wider flex items-center justify-center gap-3">
      <Truck size={14} strokeWidth={2.5} />
      <span>{display}</span>
    </div>
  );
}
