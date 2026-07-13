import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface CartItem {
  id: string;
  nombre: string;
  marca: string;
  slug: string;
  precio_venta: number;
  imagen_url?: string;
  cantidad: number;
}

interface CheckoutBody {
  items: CartItem[];
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string;
  direccion?: string;
  notas?: string;
  metodo_pago: "efectivo" | "transferencia" | "getnet";
  cuotas?: number;
  total?: number;
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars faltantes");
  return createClient(url, key, { auth: { persistSession: false } });
}

function generarNumeroPedido(): string {
  const d = new Date();
  const fecha = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `ORD-${fecha}-${rand}`;
}

export async function POST(req: NextRequest) {
  try {
    const body: CheckoutBody = await req.json();
    const { items, nombre, apellido, telefono, email, direccion, notas, metodo_pago, cuotas, total } = body;

    if (!items?.length || !nombre?.trim() || !apellido?.trim() || !telefono?.trim() || !metodo_pago) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    if (metodo_pago === "getnet" && !cuotas) {
      return NextResponse.json({ error: "Seleccioná la cantidad de cuotas" }, { status: 400 });
    }

    const subtotal = items.reduce((s, i) => s + i.precio_venta * i.cantidad, 0);
    const finalTotal = total ?? subtotal;
    const supabase = getSupabase();

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        numero_pedido: generarNumeroPedido(),
        cliente_nombre: nombre.trim(),
        cliente_apellido: apellido.trim(),
        cliente_telefono: telefono.trim(),
        cliente_email: email?.trim() || null,
        cliente_direccion: direccion?.trim() || null,
        cliente_notas: notas?.trim() || null,
        items: items.map((i) => ({
          id: i.id,
          nombre: i.nombre,
          marca: i.marca,
          slug: i.slug,
          precio_venta: i.precio_venta,
          imagen_url: i.imagen_url || null,
          cantidad: i.cantidad,
        })),
        subtotal,
        total: finalTotal,
        metodo_pago,
        cuotas: cuotas ?? null,
        estado: "pendiente",
      })
      .select()
      .single();

    if (error) {
      console.error("[checkout] Supabase error:", JSON.stringify(error));
      return NextResponse.json(
        { error: `Error al guardar el pedido: ${error.message}` },
        { status: 500 }
      );
    }
    if (!pedido) {
      return NextResponse.json({ error: "No se pudo crear el pedido" }, { status: 500 });
    }

    const orderId = pedido.id as string;
    const baseUrl =
      req.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    // --- Getnet ---
    if (metodo_pago === "getnet") {
      const getnetApiUrl = process.env.GETNET_API_URL;
      const getnetClientId = process.env.GETNET_CLIENT_ID;
      const getnetClientSecret = process.env.GETNET_CLIENT_SECRET;
      const getnetSellerId = process.env.GETNET_SELLER_ID;

      if (!getnetApiUrl || !getnetClientId || !getnetClientSecret || !getnetSellerId) {
        console.error("[checkout] Getnet env vars not configured");
        return NextResponse.json(
          { error: "El pago con tarjeta no está disponible en este momento." },
          { status: 500 }
        );
      }

      try {
        // Step 1: get OAuth token
        const tokenRes = await fetch(`${getnetApiUrl}/v1/oauth/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${getnetClientId}:${getnetClientSecret}`).toString("base64")}`,
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "oob",
          }),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error("[checkout] Getnet token error:", errText);
          return NextResponse.json(
            { error: "Error al conectar con Getnet. Intentá nuevamente." },
            { status: 502 }
          );
        }

        const { access_token } = await tokenRes.json();

        // Step 2: create payment link
        const amountCents = Math.round(finalTotal * 100);
        const paymentRes = await fetch(`${getnetApiUrl}/v1/seller/${getnetSellerId}/paymentlink`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${access_token}`,
          },
          body: JSON.stringify({
            amount: amountCents,
            currency: "BRL", // Getnet Argentina uses ARS — update if needed
            order_id: orderId,
            customer: {
              first_name: nombre.trim(),
              last_name: apellido.trim(),
              email: email?.trim() || "comprador@mitienda.com",
              phone_number: telefono.trim(),
            },
            items: items.map((i) => ({
              name: `${i.nombre} — ${i.marca}`,
              quantity: i.cantidad,
              amount: Math.round(i.precio_venta * 100),
            })),
            back_url: `${baseUrl}/checkout/confirmacion?id=${orderId}`,
            cancel_url: `${baseUrl}/checkout?error=pago_fallido`,
          }),
        });

        if (!paymentRes.ok) {
          const errText = await paymentRes.text();
          console.error("[checkout] Getnet payment link error:", errText);
          return NextResponse.json(
            { error: "Error al generar el link de pago. Intentá nuevamente." },
            { status: 502 }
          );
        }

        const paymentData = await paymentRes.json();
        const paymentUrl: string = paymentData.payment_url ?? paymentData.url ?? paymentData.link;

        if (!paymentUrl) {
          console.error("[checkout] Getnet: no payment URL in response", paymentData);
          return NextResponse.json(
            { error: "No se pudo obtener el link de pago." },
            { status: 502 }
          );
        }

        await supabase
          .from("pedidos")
          .update({ getnet_payment_id: paymentData.payment_id ?? paymentData.id ?? null })
          .eq("id", orderId);

        return NextResponse.json({ orderId, redirectUrl: paymentUrl });
      } catch (err) {
        console.error("[checkout] Getnet unexpected error:", err);
        return NextResponse.json(
          { error: "Error al procesar el pago con Getnet." },
          { status: 500 }
        );
      }
    }

    // Efectivo or transferencia → confirm page
    return NextResponse.json({
      orderId,
      redirectUrl: `${baseUrl}/checkout/confirmacion?id=${orderId}`,
    });
  } catch (err) {
    console.error("[checkout] Error inesperado:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
