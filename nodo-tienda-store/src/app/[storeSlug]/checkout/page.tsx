"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart-store";

type CheckoutStep = "form" | "submitting" | "success";

interface CustomerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  notes: string;
}

export default function CheckoutPage() {
  const params = useParams<{ storeSlug: string }>();
  const storeSlug = params.storeSlug;
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>("form");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  const [form, setForm] = useState<CustomerForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    notes: "",
  });

  useEffect(() => {
    if (!storeSlug) return;
    fetch(`/api/${storeSlug}/store-info`)
      .then((r) => r.json())
      .then((d) => {
        if (d.orgId) setOrgId(d.orgId);
      });
  }, [storeSlug]);

  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(n);

  if (items.length === 0 && step === "form") {
    router.push(`/${storeSlug}/cart`);
    return null;
  }

  function setField(key: keyof CustomerForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) {
      setError("Error de configuración. Recargá la página.");
      return;
    }
    if (!form.firstName || !form.lastName) {
      setError("Nombre y apellido son requeridos.");
      return;
    }

    setStep("submitting");
    setError(null);

    const subtotal = total();
    const shippingCost = 0;
    const orderTotal = subtotal + shippingCost;

    try {
      const res = await fetch(`/api/${storeSlug}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          customer: {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            address: form.address,
            city: form.city,
          },
          shippingMethod: "standard",
          notes: form.notes,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            productName: item.name,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
          subtotal,
          shippingCost,
          total: orderTotal,
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Error al procesar el pedido");

      clearCart();
      setOrderNumber(data.orderNumber);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setStep("form");
    }
  }

  if (step === "success") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <CheckCircle2
          className="w-16 h-16 mx-auto mb-6"
          style={{ color: "var(--store-primary)" }}
        />
        <h1 className="text-3xl font-bold text-slate-800 mb-3">
          ¡Pedido recibido!
        </h1>
        <p className="text-slate-500 mb-2">
          Tu pedido fue registrado exitosamente.
        </p>
        {orderNumber && (
          <p
            className="text-lg font-mono font-bold mb-8"
            style={{ color: "var(--store-primary)" }}
          >
            #{orderNumber}
          </p>
        )}
        <p className="text-sm text-slate-400 mb-8">
          Nos pondremos en contacto a la brevedad para coordinar la entrega.
        </p>
        <a
          href={`/${storeSlug}`}
          className="inline-block font-semibold px-8 py-3 rounded-xl text-white transition hover:opacity-90"
          style={{ backgroundColor: "var(--store-primary)" }}
        >
          Volver a la tienda
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-8">
        Finalizar compra
      </h1>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="md:col-span-2 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Datos de contacto</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Nombre *"
                value={form.firstName}
                onChange={(v) => setField("firstName", v)}
                placeholder="Juan"
                required
              />
              <Field
                label="Apellido *"
                value={form.lastName}
                onChange={(v) => setField("lastName", v)}
                placeholder="García"
                required
              />
            </div>
            <Field
              label="Email"
              value={form.email}
              onChange={(v) => setField("email", v)}
              placeholder="juan@email.com"
              type="email"
            />
            <Field
              label="Teléfono"
              value={form.phone}
              onChange={(v) => setField("phone", v)}
              placeholder="+54 11 1234-5678"
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">
              Dirección de entrega
            </h2>
            <Field
              label="Dirección"
              value={form.address}
              onChange={(v) => setField("address", v)}
              placeholder="Av. Corrientes 1234"
            />
            <Field
              label="Ciudad"
              value={form.city}
              onChange={(v) => setField("city", v)}
              placeholder="Buenos Aires"
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <h2 className="font-semibold text-slate-800">Comentarios</h2>
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              placeholder="Aclaraciones o instrucciones especiales..."
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 resize-none"
              style={
                { "--tw-ring-color": "var(--store-primary)" } as React.CSSProperties
              }
            />
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={step === "submitting"}
            className="w-full flex items-center justify-center gap-2 font-semibold py-4 rounded-xl text-white transition hover:opacity-90 disabled:opacity-70"
            style={{ backgroundColor: "var(--store-primary)" }}
          >
            {step === "submitting" && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {step === "submitting" ? "Procesando..." : "Confirmar pedido"}
          </button>
        </form>

        {/* Order summary */}
        <div className="md:col-span-1">
          <div className="sticky top-24 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Tu pedido</h2>
            <div className="space-y-2 text-sm">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId}`}
                  className="flex justify-between text-slate-600"
                >
                  <span className="truncate mr-2">
                    {item.name} ×{item.quantity}
                  </span>
                  <span className="shrink-0">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatPrice(total())}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Envío</span>
                <span>A coordinar</span>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-800">
              <span>Total</span>
              <span>{formatPrice(total())}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
        style={
          { "--tw-ring-color": "var(--store-primary)" } as React.CSSProperties
        }
      />
    </div>
  );
}
