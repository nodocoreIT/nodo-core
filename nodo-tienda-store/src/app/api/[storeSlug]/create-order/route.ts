import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

interface OrderPayload {
  orgId: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
  };
  shippingMethod: string;
  notes: string;
  items: {
    productId: string;
    variantId: string | null;
    productName: string;
    variantLabel: string | null;
    quantity: number;
    unitPrice: number;
  }[];
  subtotal: number;
  shippingCost: number;
  total: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ storeSlug: string }> },
) {
  // params destructured for potential future use (e.g. per-store rate limiting)
  await params;

  let body: OrderPayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.orgId || !body.items?.length) {
    return NextResponse.json(
      { error: "orgId and items required" },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdmin();

  // 1. Upsert customer by email
  let customerId: string | null = null;
  if (body.customer.email) {
    const { data: existing } = await admin
      .schema("nodo_tienda")
      .from("customers")
      .select("id")
      .eq("org_id", body.orgId)
      .eq("email", body.customer.email)
      .is("deleted_at", null)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: newCustomer } = await admin
        .schema("nodo_tienda")
        .from("customers")
        .insert({
          org_id: body.orgId,
          first_name: body.customer.firstName,
          last_name: body.customer.lastName,
          email: body.customer.email,
          phone: body.customer.phone || null,
          address: body.customer.address || null,
          city: body.customer.city || null,
        })
        .select("id")
        .single();
      customerId = newCustomer?.id ?? null;
    }
  }

  // 2. Create order (order_number set by DB trigger)
  const { data: order, error: orderErr } = await admin
    .schema("nodo_tienda")
    .from("orders")
    .insert({
      org_id: body.orgId,
      order_number: "",
      customer_id: customerId,
      status: "pending",
      subtotal: body.subtotal,
      discount: 0,
      shipping_cost: body.shippingCost,
      tax: 0,
      total: body.total,
      shipping_address: {
        address: body.customer.address,
        city: body.customer.city,
        name: `${body.customer.firstName} ${body.customer.lastName}`,
        phone: body.customer.phone,
      },
      notes: body.notes || null,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    console.error("Order creation failed:", orderErr);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }

  // 3. Insert order items
  const { error: itemsErr } = await admin
    .schema("nodo_tienda")
    .from("order_items")
    .insert(
      body.items.map((item) => ({
        org_id: body.orgId,
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId,
        product_name: item.productName,
        variant_label: item.variantLabel,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
      })),
    );

  if (itemsErr) {
    console.error("Order items creation failed:", itemsErr);
    // Order created but items failed — log and continue so order is still returned
  }

  // 4. Log initial status history
  await admin
    .schema("nodo_tienda")
    .from("order_status_history")
    .insert({ order_id: order.id, status: "pending", notes: "Pedido recibido" });

  // 5. Update customer total_spent
  if (customerId) {
    const { data: currentCustomer } = await admin
      .schema("nodo_tienda")
      .from("customers")
      .select("total_spent")
      .eq("id", customerId)
      .single();

    await admin
      .schema("nodo_tienda")
      .from("customers")
      .update({
        total_spent: (currentCustomer?.total_spent ?? 0) + body.total,
        last_purchase_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  }

  return NextResponse.json({
    ok: true,
    orderId: order.id,
    orderNumber: order.order_number,
  });
}
