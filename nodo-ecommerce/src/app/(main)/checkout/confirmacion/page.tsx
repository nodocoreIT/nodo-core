import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Clock, Banknote, Building2, CreditCard, ArrowRight } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ id?: string; mp?: string }>;
}

async function getData(id: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { pedido: null, config: {} };

  const supabase = createClient(url, key);
  const [{ data: pedido }, { data: configRows }] = await Promise.all([
    supabase.from("pedidos").select("*").eq("id", id).single(),
    supabase.from("configuracion").select("clave, valor").in("clave", ["cbu", "alias_cbu", "titular", "banco"]),
  ]);

  const config: Record<string, string> = {};
  (configRows || []).forEach((r: { clave: string; valor: string }) => { config[r.clave] = r.valor; });
  return { pedido, config };
}

export default async function ConfirmacionPage({ searchParams }: Props) {
  const { id, mp } = await searchParams;
  if (!id) notFound();

  const { pedido, config } = await getData(id);
  if (!pedido) notFound();

  const isPending = mp === "pending" || pedido.estado === "pendiente";

  const TRANSFER_CBU = config.cbu || "—";
  const TRANSFER_ALIAS = config.alias_cbu || "—";
  const TRANSFER_TITULAR = config.titular || "Mi Tienda";
  void isPending;

  const whatsappMsg = encodeURIComponent(
    `Hola! Realicé un pedido (${pedido.numero_pedido}) por $${pedido.total.toLocaleString("es-AR")}. Método de pago: ${pedido.metodo_pago}. Por favor confirmame la disponibilidad.`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
      {/* Status header */}
      <div className="text-center mb-10">
        {mp === "pending" ? (
          <Clock size={56} className="mx-auto mb-4 text-yellow-400" />
        ) : (
          <CheckCircle size={56} className="mx-auto mb-4 text-green-400" />
        )}
        <h1 className="font-serif text-3xl text-white mb-2">
          {mp === "pending" ? "Pago en proceso" : "¡Pedido recibido!"}
        </h1>
        <p className="text-luxury-gray-light text-sm">
          {mp === "pending"
            ? "Tu pago está siendo procesado. Te avisaremos cuando se confirme."
            : "Recibimos tu pedido correctamente. Te contactaremos pronto."}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 bg-luxury-black border border-luxury-gray-mid px-4 py-2 text-gold text-sm font-mono">
          {pedido.numero_pedido}
        </div>
      </div>

      {/* Payment instructions */}
      {pedido.metodo_pago === "efectivo" && (
        <div className="bg-luxury-black border border-luxury-gray p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Banknote size={20} className="text-gold" />
            <h2 className="text-white font-semibold">Pago en efectivo</h2>
          </div>
          <p className="text-luxury-gray-light text-sm leading-relaxed">
            El pago se realiza al momento de la entrega o al retirar en tienda.
            Coordinamos el día y horario por WhatsApp.
          </p>
        </div>
      )}

      {pedido.metodo_pago === "transferencia" && (
        <div className="bg-luxury-black border border-luxury-gray p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 size={20} className="text-gold" />
            <h2 className="text-white font-semibold">Datos para transferencia</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-luxury-gray">
              <span className="text-luxury-gray-light">Titular</span>
              <span className="text-white font-medium">{TRANSFER_TITULAR}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-luxury-gray">
              <span className="text-luxury-gray-light">CBU</span>
              <span className="text-white font-mono tracking-wide">{TRANSFER_CBU}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-luxury-gray">
              <span className="text-luxury-gray-light">Alias</span>
              <span className="text-white font-mono">{TRANSFER_ALIAS}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-luxury-gray-light">Importe</span>
              <span className="text-gold font-bold text-base">
                ${pedido.total.toLocaleString("es-AR")}
              </span>
            </div>
          </div>
          <p className="text-[#555555] text-xs mt-4">
            Una vez realizada la transferencia, envianos el comprobante por WhatsApp
            para confirmar tu pedido.
          </p>
        </div>
      )}

      {pedido.metodo_pago === "mercadopago" && (
        <div className="bg-luxury-black border border-luxury-gray p-6 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <CreditCard size={20} className="text-gold" />
            <h2 className="text-white font-semibold">MercadoPago</h2>
          </div>
          <p className="text-luxury-gray-light text-sm">
            {mp === "success"
              ? "Tu pago fue aprobado correctamente."
              : "Tu pago está siendo procesado por MercadoPago. Te enviaremos la confirmación."}
          </p>
        </div>
      )}

      {/* Order summary */}
      <div className="bg-luxury-black border border-luxury-gray p-6 mb-6">
        <h2 className="text-white text-xs font-bold tracking-[0.2em] uppercase mb-4">
          Resumen del pedido
        </h2>
        <ul className="space-y-2 mb-4">
          {(pedido.items as Array<{ nombre: string; marca: string; cantidad: number; precio_venta: number }>).map(
            (item, i: number) => (
              <li key={i} className="flex justify-between text-sm">
                <span className="text-luxury-gray-light">
                  {item.cantidad}x {item.nombre}
                  <span className="text-[#555555] text-xs"> — {item.marca}</span>
                </span>
                <span className="text-white">
                  ${(item.precio_venta * item.cantidad).toLocaleString("es-AR")}
                </span>
              </li>
            )
          )}
        </ul>
        <div className="flex justify-between font-bold border-t border-luxury-gray pt-3">
          <span className="text-white">Total</span>
          <span className="text-gold">
            ${pedido.total.toLocaleString("es-AR")}
          </span>
        </div>
        {pedido.cliente_direccion && (
          <p className="text-[#555555] text-xs mt-3">
            Entrega: {pedido.cliente_direccion}
          </p>
        )}
      </div>

      {/* WhatsApp CTA */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full bg-gold text-black font-bold py-4 text-sm tracking-wider uppercase hover:bg-gold-light transition-colors mb-4"
      >
        <img src="/what.png" alt="WhatsApp" className="w-5 h-5 rounded-full object-cover" />
        Confirmar por WhatsApp
      </a>

      <Link
        href="/productos"
        className="flex items-center justify-center gap-2 w-full border border-luxury-gray-mid text-luxury-gray-light hover:text-white hover:border-[#555555] py-3.5 text-sm transition-colors"
      >
        Seguir comprando
        <ArrowRight size={14} />
      </Link>
    </div>
  );
}
