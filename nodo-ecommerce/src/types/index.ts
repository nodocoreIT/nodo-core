export interface Producto {
  id: string;
  nombre: string;
  marca: string;
  slug: string;
  descripcion: string;
  descripcion_corta?: string;
  precio_costo?: number;
  precio_venta: number;
  stock: number;
  imagen_url?: string;
  imagenes_adicionales?: string[];
  categoria_id?: string;
  categoria?: string;
  categorias?: { nombre: string };
  subcategoria_id?: string;
  subcategorias?: { nombre: string };
  moneda?: 'ARS' | 'USD';
  proveedor_id?: string;
  proveedores?: { nombre: string };
  activo: boolean;
  destacado: boolean;
  nuevo: boolean;
  pedido?: boolean;
  meta_titulo?: string;
  meta_descripcion?: string;
  created_at: string;
  updated_at: string;
}

export interface FiltroProductos {
  precioMin?: number;
  precioMax?: number;
  busqueda?: string;
  ordenar?: "precio_asc" | "precio_desc" | "nombre" | "nuevo";
}
