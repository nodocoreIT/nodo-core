"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  ShoppingBag, 
  Search, 
  Calendar, 
  User, 
  Phone, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  PackageCheck, 
  Truck,
  XCircle,
  Eye,
  Trash2,
  AlertTriangle,
  Loader2
} from "lucide-react";
import CustomSelect from "@/components/ui/CustomSelect";
import toast from "react-hot-toast";

interface OrderItem {
  id: string;
  nombre: string;
  cantidad: number;
  precio: number;
}

interface Order {
  id: string;
  numero_pedido: string;
  cliente_nombre: string;
  cliente_apellido: string;
  cliente_telefono: string;
  cliente_email: string;
  cliente_direccion: string;
  cliente_notas: string;
  items: OrderItem[];
  total: number;
  metodo_pago: string;
  estado: string;
  created_at: string;
}

interface Props {
  initialOrders: any[];
}

const ESTADOS = [
  { value: "pendiente", label: "Pendiente", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  { value: "confirmado", label: "Confirmado", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { value: "preparado", label: "Preparado", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" },
  { value: "entregado", label: "Entregado", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { value: "cancelado", label: "Cancelado", color: "bg-red-500/10 text-red-500 border-red-500/20" },
];

export default function OrdersClient({ initialOrders }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders as Order[]);
  const [filter, setFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: "", numero: "" });
  const supabase = createClient();

  useEffect(() => {
    // Real-time updates for orders
    const channel = supabase
      .channel("orders_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            setOrders(prev => [payload.new as Order, ...prev]);
            toast.success("¡Nuevo pedido recibido!");
          } else if (payload.eventType === "UPDATE") {
            setOrders(prev => prev.map(o => o.id === payload.new.id ? payload.new as Order : o));
          } else if (payload.eventType === "DELETE") {
            setOrders(prev => prev.filter(o => o.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  const updateStatus = async (id: string, newStatus: string) => {
    setLoadingId(id);
    const { error } = await supabase
      .from("pedidos")
      .update({ estado: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Error al actualizar el estado");
    } else {
      toast.success("Estado actualizado");
      // Actualizamos el estado local inmediatamente
      setOrders(prev => prev.map(o => 
        o.id === id ? { ...o, estado: newStatus } : o
      ));
      // Notificar a la campana
      window.dispatchEvent(new CustomEvent('refresh-orders-count'));
    }
    setLoadingId(null);
  };
  
  const deleteOrder = (id: string, numero: string) => {
    setDeleteModal({ isOpen: true, id, numero });
  };

  const confirmDelete = async () => {
    const { id } = deleteModal;
    setLoadingId(id);
    const { error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error al eliminar:", error);
      toast.error("Error al eliminar el pedido");
    } else {
      toast.success("Pedido eliminado correctamente");
      setOrders(prev => prev.filter(o => o.id !== id));
      setDeleteModal({ isOpen: false, id: "", numero: "" });
      // Notificar a la campana
      window.dispatchEvent(new CustomEvent('refresh-orders-count'));
    }
    setLoadingId(null);
  };

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filter === "todos" || order.estado === filter;
    const matchesSearch = !search || 
      `${order.cliente_nombre} ${order.cliente_apellido}`.toLowerCase().includes(search.toLowerCase()) ||
      order.numero_pedido.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusConfig = (status: string) => {
    return ESTADOS.find(e => e.value === status) || ESTADOS[0];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-white flex items-center gap-2">
            <ShoppingBag className="text-gold" />
            Gestión de Pedidos
          </h1>
          <p className="text-[#555555] text-sm mt-1">
            Administrá y hacé seguimiento de las ventas web.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555555]" />
            <input
              type="text"
              placeholder="Buscar por cliente o #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-luxury-black border border-luxury-gray text-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-gold w-full sm:w-64 transition-colors"
            />
          </div>
          <div className="w-full sm:w-48">
            <CustomSelect
              value={filter}
              onChange={setFilter}
              options={[
                { value: "todos", label: "Todos los estados" },
                ...ESTADOS.map(e => ({ value: e.value, label: e.label }))
              ]}
              placeholder="Estado"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredOrders.map((order) => {
          const status = getStatusConfig(order.estado);
          return (
            <div 
              key={order.id} 
              className="bg-luxury-black border border-luxury-gray overflow-hidden group hover:border-gold/30 transition-all duration-300 relative"
            >
              {/* Overlay de carga para toda la tarjeta */}
              {loadingId === order.id && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={32} className="text-gold animate-spin" />
                    <span className="text-gold text-xs font-medium uppercase tracking-widest">Actualizando...</span>
                  </div>
                </div>
              )}
              <div className="p-4 sm:p-6">
                {/* Header del pedido */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${status.color.split(' ')[0]} border ${status.color.split(' ')[2]}`}>
                      {order.estado === 'pendiente' && <Clock size={20} />}
                      {order.estado === 'confirmado' && <CheckCircle2 size={20} />}
                      {order.estado === 'preparado' && <PackageCheck size={20} />}
                      {order.estado === 'entregado' && <Truck size={20} />}
                      {order.estado === 'cancelado' && <XCircle size={20} />}
                    </div>
                    <div>
                      <h3 className="text-white font-bold tracking-wider">#{order.numero_pedido}</h3>
                      <p className="text-[#555555] text-xs flex items-center gap-1 mt-1">
                        <Calendar size={12} />
                        {new Date(order.created_at).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right mr-2 hidden sm:block">
                      <p className="text-[#555555] text-[10px] uppercase tracking-widest">Total</p>
                      <p className="text-gold font-bold text-lg">${order.total.toLocaleString('es-AR')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-40">
                        <CustomSelect
                          value={order.estado}
                          onChange={(val) => updateStatus(order.id, val)}
                          options={ESTADOS.map(e => ({ value: e.value, label: e.label }))}
                          placeholder="Cambiar estado"
                          loading={loadingId === order.id}
                        />
                      </div>
                      <button
                        onClick={() => deleteOrder(order.id, order.numero_pedido)}
                        disabled={loadingId === order.id}
                        className="p-2.5 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all duration-200 rounded"
                        title="Eliminar pedido"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Info Cliente */}
                  <div className="space-y-3">
                    <h4 className="text-[#333333] text-[10px] uppercase tracking-[0.2em] font-bold border-b border-luxury-gray pb-2">Datos del Cliente</h4>
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 text-sm">
                        <User size={16} className="text-gold mt-0.5 shrink-0" />
                        <div>
                          <p className="text-white font-medium">{order.cliente_nombre} {order.cliente_apellido}</p>
                          <p className="text-luxury-gray-light text-xs">{order.cliente_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <Phone size={16} className="text-gold shrink-0" />
                        <p className="text-luxury-gray-light">{order.cliente_telefono}</p>
                      </div>
                      {order.cliente_direccion && (
                        <div className="flex items-start gap-3 text-sm">
                          <MapPin size={16} className="text-gold mt-0.5 shrink-0" />
                          <p className="text-luxury-gray-light">{order.cliente_direccion}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items del Pedido */}
                  <div className="lg:col-span-2 space-y-3">
                    <h4 className="text-[#333333] text-[10px] uppercase tracking-[0.2em] font-bold border-b border-luxury-gray pb-2">Productos</h4>
                    <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-[#111111] last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-gold font-mono text-xs bg-gold/10 px-1.5 rounded">{item.cantidad}x</span>
                            <span className="text-gray-200 truncate max-w-[150px]">{item.nombre}</span>
                          </div>
                          <span className="text-[#555555] font-mono text-xs">${(item.precio * item.cantidad).toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                    </div>
                    
                    {order.cliente_notas && (
                      <div className="mt-4 p-3 bg-[#111111] border-l-2 border-gold text-xs text-luxury-gray-light italic">
                        &quot;{order.cliente_notas}&quot;
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer del pedido (Método de Pago) */}
              <div className="bg-black/50 border-t border-luxury-gray px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[#333333] text-[10px] uppercase tracking-widest">Pago via:</span>
                  <span className="text-luxury-gray-light text-xs uppercase font-medium tracking-wider">{order.metodo_pago}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border rounded ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="text-center py-20 bg-luxury-black border border-luxury-gray">
            <ShoppingBag size={48} className="mx-auto mb-4 text-luxury-gray" />
            <p className="text-[#555555]">No se encontraron pedidos con estos criterios.</p>
          </div>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-luxury-gray-mid w-full max-w-md p-6 md:p-8">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={24} />
              <h2 className="font-serif text-xl text-white">Confirmar eliminación</h2>
            </div>
            <p className="text-luxury-gray-light text-sm mb-6 leading-relaxed">
              ¿Estás seguro que deseas eliminar el pedido <strong className="text-gold">#{deleteModal.numero}</strong>? Esta acción no se puede deshacer y se perderá todo el historial de este pedido.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal({ isOpen: false, id: "", numero: "" })}
                className="flex-1 px-4 py-2.5 text-sm text-luxury-gray-light hover:text-white border border-luxury-gray-mid hover:bg-luxury-gray transition-colors"
                disabled={loadingId === deleteModal.id}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={loadingId === deleteModal.id}
                className="flex-1 px-4 py-2.5 text-sm text-white bg-red-600/90 hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
              >
                {loadingId === deleteModal.id ? (
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
