'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, Save, Truck, Phone, MapPin, Clock, Mail, FileText, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface Proveedor {
  id: string
  nombre: string
  razon_social: string | null
  cuit: string | null
  direccion: string | null
  ciudad: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
  horarios: string | null
  notas: string | null
  activo: boolean
}

interface Props {
  proveedores: Proveedor[]
}

const EMPTY_FORM: Omit<Proveedor, 'id'> = {
  nombre: '',
  razon_social: '',
  cuit: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  telefono: '',
  email: '',
  horarios: '',
  notas: '',
  activo: true,
}

const inputClass =
  'w-full bg-[#111111] border border-luxury-gray-mid text-white px-3 py-2 text-sm focus:outline-none focus:border-gold transition-colors placeholder-[#444444]'
const labelClass = 'block text-luxury-gray-light text-xs uppercase tracking-wider mb-1.5'

export default function ProveedoresClient({ proveedores: initialProveedores }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [proveedores, setProveedores] = useState<Proveedor[]>(initialProveedores)
  const [form, setForm] = useState<Omit<Proveedor, 'id'>>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  function openNew() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(p: Proveedor) {
    setEditingId(p.id)
    setForm({
      nombre: p.nombre,
      razon_social: p.razon_social ?? '',
      cuit: p.cuit ?? '',
      direccion: p.direccion ?? '',
      ciudad: p.ciudad ?? '',
      provincia: p.provincia ?? '',
      telefono: p.telefono ?? '',
      email: p.email ?? '',
      horarios: p.horarios ?? '',
      notas: p.notas ?? '',
      activo: p.activo,
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function set(key: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.nombre.trim()) {
      toast.error('El nombre es obligatorio.')
      return
    }

    setSaving(true)
    const payload = {
      nombre: form.nombre.trim(),
      razon_social: form.razon_social?.trim() || null,
      cuit: form.cuit?.trim() || null,
      direccion: form.direccion?.trim() || null,
      ciudad: form.ciudad?.trim() || null,
      provincia: form.provincia?.trim() || null,
      telefono: form.telefono?.trim() || null,
      email: form.email?.trim() || null,
      horarios: form.horarios?.trim() || null,
      notas: form.notas?.trim() || null,
      activo: form.activo,
    }

    if (editingId) {
      const { error } = await supabase.from('proveedores').update(payload).eq('id', editingId)
      if (error) { toast.error(error.message); setSaving(false); return }
      setProveedores((prev) => prev.map((p) => p.id === editingId ? { ...p, ...payload } : p))
      toast.success('Proveedor actualizado.')
    } else {
      const { data, error } = await supabase.from('proveedores').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      setProveedores((prev) => [...prev, { id: data.id, ...payload } as Proveedor])
      toast.success('Proveedor creado.')
    }

    setSaving(false)
    closeForm()
    router.refresh()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este proveedor?')) return
    const { error } = await supabase.from('proveedores').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setProveedores((prev) => prev.filter((p) => p.id !== id))
    toast.success('Proveedor eliminado.')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gold text-xs tracking-[0.3em] uppercase mb-1">Dashboard</p>
          <h1 className="text-white text-2xl font-serif">Proveedores</h1>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 bg-gold text-black font-bold px-4 py-2.5 text-sm tracking-wider hover:bg-gold-light transition-colors"
        >
          <Plus size={15} />
          Nuevo proveedor
        </button>
      </div>

      {/* List */}
      <section className="bg-luxury-black border border-luxury-gray">
        {proveedores.length === 0 ? (
          <div className="px-5 py-12 text-center text-[#444444] text-sm">
            No hay proveedores cargados aún.
          </div>
        ) : (
          <ul className="divide-y divide-luxury-gray">
            {proveedores.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{p.nombre}</span>
                    {!p.activo && (
                      <span className="text-[10px] text-[#555555] border border-[#333333] px-1.5 py-0.5 uppercase tracking-wider">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {p.razon_social && (
                      <span className="text-[#555555] text-xs">{p.razon_social}</span>
                    )}
                    {p.telefono && (
                      <span className="text-[#555555] text-xs flex items-center gap-1">
                        <Phone size={10} />
                        {p.telefono}
                      </span>
                    )}
                    {p.ciudad && (
                      <span className="text-[#555555] text-xs flex items-center gap-1">
                        <MapPin size={10} />
                        {p.ciudad}{p.provincia ? `, ${p.provincia}` : ''}
                      </span>
                    )}
                    {p.horarios && (
                      <span className="text-[#555555] text-xs flex items-center gap-1">
                        <Clock size={10} />
                        {p.horarios}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className="p-2 text-[#555555] hover:text-gold transition-colors"
                    aria-label="Editar"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-[#555555] hover:text-red-500 transition-colors"
                    aria-label="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-luxury-black border border-luxury-gray mb-8">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-luxury-gray">
              <div className="flex items-center gap-2">
                <Truck size={15} className="text-gold" />
                <h2 className="text-gold text-xs tracking-[0.2em] uppercase">
                  {editingId ? 'Editar proveedor' : 'Nuevo proveedor'}
                </h2>
              </div>
              <button type="button" onClick={closeForm} className="text-[#555555] hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-5">
              {/* Nombre + Razón social */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Nombre *</label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    className={inputClass}
                    placeholder="Ej: Distribuidora Norte"
                    autoFocus
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    <Building2 size={11} className="inline mr-1" />
                    Razón social
                  </label>
                  <input
                    type="text"
                    value={form.razon_social ?? ''}
                    onChange={(e) => set('razon_social', e.target.value)}
                    className={inputClass}
                    placeholder="Ej: Norte S.A."
                  />
                </div>
              </div>

              {/* CUIT */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>CUIT</label>
                  <input
                    type="text"
                    value={form.cuit ?? ''}
                    onChange={(e) => set('cuit', e.target.value)}
                    className={inputClass}
                    placeholder="Ej: 30-12345678-9"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    <Phone size={11} className="inline mr-1" />
                    Teléfono
                  </label>
                  <input
                    type="text"
                    value={form.telefono ?? ''}
                    onChange={(e) => set('telefono', e.target.value)}
                    className={inputClass}
                    placeholder="Ej: 2954 123456"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className={labelClass}>
                  <Mail size={11} className="inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => set('email', e.target.value)}
                  className={inputClass}
                  placeholder="Ej: ventas@proveedor.com"
                />
              </div>

              {/* Dirección */}
              <div>
                <label className={labelClass}>
                  <MapPin size={11} className="inline mr-1" />
                  Dirección
                </label>
                <input
                  type="text"
                  value={form.direccion ?? ''}
                  onChange={(e) => set('direccion', e.target.value)}
                  className={inputClass}
                  placeholder="Ej: Av. Corrientes 1234"
                />
              </div>

              {/* Ciudad + Provincia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Ciudad</label>
                  <input
                    type="text"
                    value={form.ciudad ?? ''}
                    onChange={(e) => set('ciudad', e.target.value)}
                    className={inputClass}
                    placeholder="Ej: Buenos Aires"
                  />
                </div>
                <div>
                  <label className={labelClass}>Provincia</label>
                  <input
                    type="text"
                    value={form.provincia ?? ''}
                    onChange={(e) => set('provincia', e.target.value)}
                    className={inputClass}
                    placeholder="Ej: CABA"
                  />
                </div>
              </div>

              {/* Horarios */}
              <div>
                <label className={labelClass}>
                  <Clock size={11} className="inline mr-1" />
                  Horarios de atención
                </label>
                <input
                  type="text"
                  value={form.horarios ?? ''}
                  onChange={(e) => set('horarios', e.target.value)}
                  className={inputClass}
                  placeholder="Ej: Lun–Vie 9–18 hs"
                />
              </div>

              {/* Notas */}
              <div>
                <label className={labelClass}>
                  <FileText size={11} className="inline mr-1" />
                  Notas internas
                </label>
                <textarea
                  value={form.notas ?? ''}
                  onChange={(e) => set('notas', e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  placeholder="Condiciones de pago, tiempos de entrega, contacto, etc."
                />
              </div>

              {/* Activo */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <p className="text-white text-sm font-medium">Activo</p>
                  <p className="text-[#555555] text-xs mt-0.5">Los proveedores inactivos no aparecen en la selección de productos.</p>
                </div>
                <button
                  type="button"
                  onClick={() => set('activo', !form.activo)}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${form.activo ? 'bg-gold' : 'bg-luxury-gray-mid'}`}
                  role="switch"
                  aria-checked={form.activo}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${form.activo ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-luxury-gray">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-gold text-black font-bold px-5 py-2.5 text-sm tracking-wider hover:bg-gold-light disabled:opacity-50 transition-colors"
              >
                <Save size={15} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex items-center gap-2 border border-luxury-gray-mid text-luxury-gray-light hover:text-white hover:border-gold/50 px-5 py-2.5 text-sm transition-colors"
              >
                <X size={15} />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
