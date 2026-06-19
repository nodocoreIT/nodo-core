import { supabase, db } from '@/shared/lib/supabase';
import { requireUserId } from '@/shared/lib/auth-user';
import { DolarService } from '@/services/dolar-service';
import type {
  Cuenta,
  GastoFijo,
  GastoDiario,
  Tarjeta,
  ConsumoTarjeta,
  Prestamo,
  CuotaProgramada,
  CuentaBancaria,
  ConfiguracionCategoria,
  AppState,
  CotizacionDolar,
  Rubro,
  Sueldo,
  MovimientoCuenta,
  PlanAhorro,
  CuotaPlanAhorro,
  TipoDolar,
} from '@/types';

export class FinanzasService {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async withTenant<T extends Record<string, any>>(
    row: T,
  ): Promise<T & { user_id: string }> {
    return { ...row, user_id: await requireUserId() };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async withTenantMany<T extends Record<string, any>>(
    rows: T[],
  ): Promise<Array<T & { user_id: string }>> {
    const user_id = await requireUserId();
    return rows.map((row) => ({ ...row, user_id }));
  }

  // === CUENTAS ===
  static async obtenerCuentas(): Promise<Cuenta[]> {
    const { data, error } = await db
      .from('cuentas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo cuentas:', error);
      return [];
    }

    return data.map(this.mapearCuenta);
  }

  static async crearCuenta(cuenta: Omit<Cuenta, 'id'>): Promise<Cuenta | null> {
    const { data, error } = await db
      .from('cuentas')
      .insert([await this.withTenant(this.mapearCuentaParaDB(cuenta))])
      .select()
      .single();

    if (error) {
      console.error('Error creando cuenta:', error);
      return null;
    }

    return this.mapearCuenta(data);
  }

  static async actualizarCuenta(id: string, cambios: Partial<Cuenta>): Promise<boolean> {
    const { error } = await db
      .from('cuentas')
      .update(this.mapearCuentaParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando cuenta:', error);
      return false;
    }

    return true;
  }

  static async eliminarCuenta(id: string): Promise<boolean> {
    const { error } = await db
      .from('cuentas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando cuenta:', error);
      return false;
    }

    return true;
  }

  // === MOVIMIENTOS DE CUENTA ===
  static async obtenerMovimientosCuenta(cuentaId: string): Promise<MovimientoCuenta[]> {
    const { data, error } = await db
      .from('movimientos_cuenta')
      .select('*')
      .eq('cuenta_id', cuentaId)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error obteniendo movimientos de cuenta:', error);
      return [];
    }

    return data.map(this.mapearMovimiento);
  }

  static async registrarMovimiento(
    movimiento: Omit<MovimientoCuenta, 'id' | 'createdAt'>
  ): Promise<MovimientoCuenta | null> {
    const { data, error } = await db
      .from('movimientos_cuenta')
      .insert([await this.withTenant({
        cuenta_id:    movimiento.cuentaId,
        fecha:        movimiento.fecha,
        descripcion:  movimiento.descripcion,
        monto:        movimiento.monto,
        tipo:         movimiento.tipo,
        origen:       movimiento.origen,
        referencia_id: movimiento.referenciaId ?? null,
        detalle:      movimiento.detalle ?? null,
      })])
      .select()
      .single();

    if (error) {
      console.error('Error registrando movimiento:', error);
      return null;
    }

    return this.mapearMovimiento(data);
  }

  static async eliminarMovimientosPorReferencia(referenciaId: string): Promise<boolean> {
    const { error } = await db
      .from('movimientos_cuenta')
      .delete()
      .eq('referencia_id', referenciaId);

    if (error) {
      console.error('Error eliminando movimientos por referencia:', error);
      return false;
    }
    return true;
  }

  static async actualizarMovimiento(id: string, cambios: Partial<MovimientoCuenta>): Promise<boolean> {
    const { error } = await db
      .from('movimientos_cuenta')
      .update({
        fecha:        cambios.fecha,
        descripcion:  cambios.descripcion,
        monto:        cambios.monto,
        tipo:         cambios.tipo,
        origen:       cambios.origen,
        detalle:      cambios.detalle,
        updated_at:   new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando movimiento:', error);
      return false;
    }
    return true;
  }

  static async eliminarMovimiento(id: string): Promise<boolean> {
    const { error } = await db
      .from('movimientos_cuenta')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando movimiento:', error);
      return false;
    }
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearMovimiento(data: any): MovimientoCuenta {
    return {
      id:           data.id,
      cuentaId:     data.cuenta_id,
      fecha:        data.fecha,
      descripcion:  data.descripcion,
      monto:        Number(data.monto),
      tipo:         data.tipo,
      origen:       data.origen,
      referenciaId: data.referencia_id ?? undefined,
      detalle:      data.detalle ?? undefined,
      createdAt:    data.created_at,
    };
  }

  static async obtenerGastosFijos(): Promise<GastoFijo[]> {
    const { data, error } = await db
      .from('gastos_fijos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo gastos fijos:', error);
      return [];
    }

    return data.map(this.mapearGastoFijo);
  }

  static async crearGastoFijo(gasto: Omit<GastoFijo, 'id'>): Promise<GastoFijo | null> {
    console.log('FinanzasService.crearGastoFijo - Datos originales:', gasto);
    const datosParaDB = this.mapearGastoFijoParaDB(gasto);
    console.log('FinanzasService.crearGastoFijo - Datos mapeados para DB:', datosParaDB);

    const { data, error } = await db
      .from('gastos_fijos')
      .insert([await this.withTenant(datosParaDB)])
      .select()
      .single();

    if (error) {
      console.error('Error creando gasto fijo:', error);
      if (error.code === '23514' && error.message.includes('gastos_fijos_rubro_id_check')) {
        console.error('ERROR: El rubro no está permitido en la base de datos.');
      }
      return null;
    }

    console.log('FinanzasService.crearGastoFijo - Gasto creado exitosamente:', data);
    return this.mapearGastoFijo(data);
  }

  static async actualizarGastoFijo(id: string, cambios: Partial<GastoFijo>): Promise<boolean> {
    console.log('FinanzasService.actualizarGastoFijo - ID:', id, 'Cambios:', cambios);
    const datosParaDB = this.mapearGastoFijoParaDB(cambios);
    console.log('FinanzasService.actualizarGastoFijo - Datos mapeados para DB:', datosParaDB);

    const { error } = await db
      .from('gastos_fijos')
      .update(datosParaDB)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando gasto fijo:', error);
      return false;
    }

    console.log('FinanzasService.actualizarGastoFijo - Actualizado exitosamente');
    return true;
  }

  static async eliminarGastoFijo(id: string): Promise<boolean> {
    const { error } = await db
      .from('gastos_fijos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando gasto fijo:', error);
      return false;
    }

    return true;
  }

  // === TARJETAS ===
  static async obtenerTarjetas(): Promise<Tarjeta[]> {
    const { data, error } = await db
      .from('tarjetas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo tarjetas:', error);
      return [];
    }

    return data.map(this.mapearTarjeta);
  }

  static async crearTarjeta(tarjeta: Omit<Tarjeta, 'id'>): Promise<Tarjeta | null> {
    const { data, error } = await db
      .from('tarjetas')
      .insert([await this.withTenant(this.mapearTarjetaParaDB(tarjeta))])
      .select()
      .single();

    if (error) {
      console.error('Error creando tarjeta:', error);
      return null;
    }

    return this.mapearTarjeta(data);
  }

  static async actualizarTarjeta(id: string, cambios: Partial<Tarjeta>): Promise<boolean> {
    const { error } = await db
      .from('tarjetas')
      .update(this.mapearTarjetaParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando tarjeta:', error);
      return false;
    }

    return true;
  }

  static async eliminarTarjeta(id: string): Promise<boolean> {
    const { error } = await db
      .from('tarjetas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando tarjeta:', error);
      return false;
    }

    return true;
  }

  // === CONSUMOS TARJETAS ===
  static async obtenerConsumosTarjetas(): Promise<ConsumoTarjeta[]> {
    const { data, error } = await db
      .from('tarjetas_consumos')
      .select(`
        *,
        rubros (
          id,
          codigo,
          nombre,
          emoji,
          color,
          descripcion,
          activo,
          es_sistema,
          orden
        )
      `)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error obteniendo consumos:', error);
      return [];
    }

    return data.map(this.mapearConsumoTarjeta);
  }

  static async crearConsumoTarjeta(consumo: Omit<ConsumoTarjeta, 'id'>): Promise<ConsumoTarjeta | null> {
    const payload = this.mapearConsumoTarjetaParaDB(consumo);
    console.log('[crearConsumoTarjeta] payload:', JSON.stringify(payload, null, 2));

    const { data, error } = await db
      .from('tarjetas_consumos')
      .insert([await this.withTenant(payload)])
      .select()
      .single();

    if (error) {
      console.error('[crearConsumoTarjeta] Error Supabase:', error);
      throw new Error(`Error al crear consumo de tarjeta: ${error.message} (code: ${error.code})`);
    }

    return this.mapearConsumoTarjeta(data);
  }

  static async actualizarConsumoTarjeta(id: string, cambios: Partial<ConsumoTarjeta>): Promise<boolean> {
    const { error } = await db
      .from('tarjetas_consumos')
      .update(this.mapearConsumoTarjetaParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando consumo:', error);
      return false;
    }

    return true;
  }

  static async eliminarConsumoTarjeta(id: string): Promise<boolean> {
    const { error } = await db
      .from('tarjetas_consumos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando consumo:', error);
      return false;
    }

    return true;
  }

  // ====================================
  // RUBROS
  // ====================================

  static async obtenerRubros(): Promise<Rubro[]> {
    const { data, error } = await db
      .from('rubros')
      .select(`
        id,
        nombre,
        emoji,
        color,
        descripcion,
        activo,
        es_sistema,
        orden,
        created_at,
        updated_at
      `)
      .order('orden', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error obteniendo rubros:', error);
      return [];
    }

    return data?.map(FinanzasService.mapRubroFromDB) || [];
  }

  static async crearRubro(rubro: Omit<Rubro, 'id'>): Promise<Rubro | null> {
    const { data, error } = await db
      .from('rubros')
      .insert([await this.withTenant({
        codigo: rubro.codigo,
        nombre: rubro.nombre,
        emoji: rubro.emoji,
        color: rubro.color,
        descripcion: rubro.descripcion,
        activo: rubro.activo,
        es_sistema: rubro.esSistema || false,
        orden: rubro.orden || 999
      })])
      .select(`
        id,
        nombre,
        emoji,
        color,
        descripcion,
        activo,
        es_sistema,
        orden,
        created_at,
        updated_at
      `)
      .single();

    if (error) {
      console.error('Error creando rubro:', error);
      return null;
    }

    return data ? FinanzasService.mapRubroFromDB(data) : null;
  }

  static async actualizarRubro(id: string, rubro: Partial<Omit<Rubro, 'id'>>): Promise<boolean> {
    const { error } = await db
      .from('rubros')
      .update({
        ...(rubro.nombre && { nombre: rubro.nombre }),
        ...(rubro.emoji && { emoji: rubro.emoji }),
        ...(rubro.color && { color: rubro.color }),
        ...(rubro.descripcion !== undefined && { descripcion: rubro.descripcion }),
        ...(rubro.activo !== undefined && { activo: rubro.activo }),
        ...(rubro.esSistema !== undefined && { es_sistema: rubro.esSistema }),
        ...(rubro.orden !== undefined && { orden: rubro.orden })
      })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando rubro:', error);
      return false;
    }

    return true;
  }

  static async eliminarRubro(id: string): Promise<boolean> {
    const rubro = await FinanzasService.obtenerRubroPorId(id);
    if (!rubro || rubro.esSistema) return false;

    const tablas = ['gastos_diarios', 'gastos_fijos', 'tarjetas_consumos'] as const;
    for (const tabla of tablas) {
      const { error: refError } = await db
        .from(tabla)
        .update({ rubro_id: null })
        .eq('rubro_id', id);
      if (refError) {
        console.error(`Error desvinculando rubro de ${tabla}:`, refError);
        return false;
      }
    }

    const { error } = await db.from('rubros').delete().eq('id', id);

    if (error) {
      console.error('Error eliminando rubro:', error);
      return false;
    }

    return true;
  }

  static async eliminarRubrosInactivos(): Promise<number> {
    const inactivos = (await FinanzasService.obtenerRubros()).filter(
      r => !r.activo && !r.esSistema
    );
    let eliminados = 0;
    for (const rubro of inactivos) {
      if (await FinanzasService.eliminarRubro(rubro.id)) eliminados++;
    }
    return eliminados;
  }

  static async obtenerRubroPorId(id: string): Promise<Rubro | null> {
    const { data, error } = await db
      .from('rubros')
      .select(`
        id,
        nombre,
        emoji,
        color,
        descripcion,
        activo,
        es_sistema,
        orden,
        created_at,
        updated_at
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error obteniendo rubro:', error);
      return null;
    }

    return data ? FinanzasService.mapRubroFromDB(data) : null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapRubroFromDB(data: any): Rubro {
    return {
      id: data.id,
      codigo: data.codigo,
      nombre: data.nombre,
      emoji: data.emoji,
      color: data.color,
      descripcion: data.descripcion,
      activo: data.activo,
      esSistema: data.es_sistema || false,
      orden: data.orden || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  // === CONSUMOS FIJOS ===
  static async obtenerConsumosFijos(): Promise<ConsumoTarjeta[]> {
    const { data, error } = await db
      .from('tarjetas_consumos')
      .select('*')
      .eq('gasto_fijo', true)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error obteniendo consumos fijos:', error);
      return [];
    }

    return data.map(this.mapearConsumoTarjeta);
  }

  static async verificarConsumoFijoExiste(consumoFijo: ConsumoTarjeta, añoMes: string): Promise<boolean> {
    const [año, mes] = añoMes.split('-').map(Number);
    const primerDia = `${añoMes}-01`;

    const proximoMesDate = new Date(año, mes, 1);
    const proximoMesStr = `${proximoMesDate.getFullYear()}-${(proximoMesDate.getMonth() + 1).toString().padStart(2, '0')}-01`;

    const { data, error } = await db
      .from('tarjetas_consumos')
      .select('id')
      .eq('tarjeta_id', consumoFijo.tarjetaId)
      .eq('lugar', consumoFijo.lugar)
      .eq('importe_ars', consumoFijo.importeARS)
      .eq('importe_usd', consumoFijo.importeUSD || 0)
      .gte('fecha', primerDia)
      .lt('fecha', proximoMesStr)
      .limit(1);

    if (error) {
      console.error('Error verificando consumo fijo existente:', error);
      return true; // Por seguridad ante error real, no duplicar
    }

    return data && data.length > 0;
  }

  static async generarConsumosFijosPorMes(añoMes: string): Promise<ConsumoTarjeta[]> {
    try {
      const consumosFijos = await this.obtenerConsumosFijos();
      const consumosGenerados: ConsumoTarjeta[] = [];

      for (const consumoFijo of consumosFijos) {
        const existe = await this.verificarConsumoFijoExiste(consumoFijo, añoMes);

        if (!existe) {
          const fechaNueva = `${añoMes}-${new Date(consumoFijo.fecha).getDate().toString().padStart(2, '0')}`;

          const nuevoConsumo: Omit<ConsumoTarjeta, 'id'> = {
            tarjetaId: consumoFijo.tarjetaId,
            fecha: fechaNueva,
            lugar: consumoFijo.lugar,
            rubro: consumoFijo.rubro,
            detalle: consumoFijo.detalle,
            importeARS: consumoFijo.importeARS,
            importeUSD: consumoFijo.importeUSD,
            cuotas: consumoFijo.cuotas,
            cuotaActual: consumoFijo.cuotaActual,
            totalCuotas: consumoFijo.totalCuotas,
            gastoFijo: false, // CRÍTICO: Los gastos generados no deben ser fijos para evitar bucles infinitos
            codigoOperacion: crypto.randomUUID(),
          };

          const consumoCreado = await this.crearConsumoTarjeta(nuevoConsumo);
          if (consumoCreado) {
            consumosGenerados.push(consumoCreado);
          }
        }
      }

      return consumosGenerados;
    } catch (error) {
      console.error('Error generando consumos fijos:', error);
      return [];
    }
  }

  // === GASTOS DIARIOS ===
  static async obtenerGastosDiarios(): Promise<GastoDiario[]> {
    const { data, error } = await db
      .from('gastos_diarios')
      .select(`
        *,
        rubros (
          id,
          codigo,
          nombre,
          emoji,
          color,
          descripcion,
          activo,
          es_sistema,
          orden
        )
      `)
      .order('fecha', { ascending: false });

    if (error) {
      console.error('Error obteniendo gastos diarios:', error);
      return [];
    }

    return data.map(this.mapearGastoDiario);
  }

  static async crearGastoDiario(gasto: Omit<GastoDiario, 'id'>): Promise<GastoDiario | null> {
    const datosParaDB = this.mapearGastoDiarioParaDB(gasto);

    try {
      console.log('ENVIANDO A DB (gastos_diarios):', JSON.stringify(datosParaDB, null, 2));
      const { data, error } = await db
        .from('gastos_diarios')
        .insert([await this.withTenant(datosParaDB)])
        .select()
        .single();

      if (error) {
        console.error('Error de Supabase al crear gasto diario:', error);

        if (error.code === '23503' && error.details?.includes('cuenta_id')) {
          console.warn('Error de relación en cuenta_id. Reintentando sin vincular cuenta...');
          const datosSinCuenta = { ...datosParaDB, cuenta_id: null };

          const { data: retryData, error: retryError } = await db
            .from('gastos_diarios')
            .insert([await this.withTenant(datosSinCuenta)])
            .select()
            .single();

          if (retryError) throw retryError;
          return this.mapearGastoDiario(retryData);
        }

        throw error;
      }

      return this.mapearGastoDiario(data);
    } catch (err: any) {
      console.error('Error fatal al crear gasto diario:', err);
      throw new Error(`Error DB: ${err.message || err.code} (${err.code})`);
    }
  }

  static async actualizarGastoDiario(id: string, cambios: Partial<GastoDiario>): Promise<boolean> {
    const { error } = await db
      .from('gastos_diarios')
      .update(this.mapearGastoDiarioParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando gasto diario:', error);
      return false;
    }

    return true;
  }

  static async eliminarGastoDiario(id: string): Promise<boolean> {
    const { error } = await db
      .from('gastos_diarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando gasto diario:', error);
      return false;
    }

    return true;
  }

  // === PRÉSTAMOS ===
  static async obtenerPrestamos(): Promise<Prestamo[]> {
    const { data, error } = await db
      .from('prestamos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo préstamos:', error);
      return [];
    }

    return data.map(this.mapearPrestamo);
  }

  static async crearPrestamo(prestamo: Omit<Prestamo, 'id'>): Promise<Prestamo | null> {
    const { data, error } = await db
      .from('prestamos')
      .insert([await this.withTenant(this.mapearPrestamoParaDB(prestamo))])
      .select()
      .single();

    if (error) {
      console.error('Error creando préstamo:', error);
      return null;
    }

    return this.mapearPrestamo(data);
  }

  static async actualizarPrestamo(id: string, cambios: Partial<Prestamo>): Promise<boolean> {
    const { error } = await db
      .from('prestamos')
      .update(this.mapearPrestamoParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando préstamo:', error);
      return false;
    }

    return true;
  }

  static async eliminarPrestamo(id: string): Promise<boolean> {
    const { error } = await db
      .from('prestamos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando préstamo:', error);
      return false;
    }

    return true;
  }

  static async subirComprobante(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `prestamos/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('comprobantes')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error subiendo comprobante:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('comprobantes')
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  // === CUENTAS BANCARIAS ===
  static async obtenerCuentasBancarias(): Promise<CuentaBancaria[]> {
    const { data, error } = await db
      .from('cuentas_bancarias')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error obteniendo cuentas bancarias:', error);
      return [];
    }

    return data.map(this.mapearCuentaBancaria);
  }

  static async crearCuentaBancaria(cuenta: Omit<CuentaBancaria, 'id'>): Promise<CuentaBancaria | null> {
    const { data, error } = await db
      .from('cuentas_bancarias')
      .insert([await this.withTenant(this.mapearCuentaBancariaParaDB(cuenta))])
      .select()
      .single();

    if (error) {
      console.error('Error creando cuenta bancaria:', error);
      return null;
    }

    return this.mapearCuentaBancaria(data);
  }

  static async actualizarCuentaBancaria(id: string, cambios: Partial<CuentaBancaria>): Promise<boolean> {
    const { error } = await db
      .from('cuentas_bancarias')
      .update(this.mapearCuentaBancariaParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando cuenta bancaria:', error);
      return false;
    }

    return true;
  }

  static async eliminarCuentaBancaria(id: string): Promise<boolean> {
    const { error } = await db
      .from('cuentas_bancarias')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando cuenta bancaria:', error);
      return false;
    }

    return true;
  }

  // === CATEGORÍAS ===
  static async obtenerCategorias(): Promise<ConfiguracionCategoria[]> {
    const { data, error } = await db
      .from('categorias')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error obteniendo categorías:', error);
      return [];
    }

    return data.map(this.mapearCategoria);
  }

  static async crearCategoria(categoria: Omit<ConfiguracionCategoria, 'id'>): Promise<ConfiguracionCategoria | null> {
    console.log('Intentando crear categoría:', categoria);

    const datosParaDB = this.mapearCategoriaParaDB(categoria);
    console.log('Datos mapeados para DB:', datosParaDB);

    const { data, error } = await db
      .from('categorias')
      .insert([await this.withTenant(datosParaDB)])
      .select()
      .single();

    if (error) {
      console.error('Error creando categoría:', error);
      return null;
    }

    console.log('Categoría creada exitosamente en DB:', data);
    return this.mapearCategoria(data);
  }

  static async actualizarCategoria(id: string, cambios: Partial<ConfiguracionCategoria>): Promise<boolean> {
    const { error } = await db
      .from('categorias')
      .update(this.mapearCategoriaParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando categoría:', error);
      return false;
    }

    return true;
  }

  static async eliminarCategoria(id: string): Promise<boolean> {
    const { error } = await db
      .from('categorias')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando categoría:', error);
      return false;
    }

    return true;
  }

  // === SUELDOS ===
  static async obtenerSueldos(): Promise<Sueldo[]> {
    const { data, error } = await db
      .from('sueldos')
      .select('*')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error obteniendo sueldos:', error);
      return [];
    }

    return data.map(this.mapearSueldo);
  }

  static async crearSueldo(sueldo: Omit<Sueldo, 'id'>): Promise<Sueldo | null> {
    const { data, error } = await db
      .from('sueldos')
      .insert([await this.withTenant(this.mapearSueldoParaDB(sueldo))])
      .select()
      .single();

    if (error) {
      console.error('Error creando sueldo:', error);
      return null;
    }

    return this.mapearSueldo(data);
  }

  static async actualizarSueldo(id: string, cambios: Partial<Sueldo>): Promise<boolean> {
    const { error } = await db
      .from('sueldos')
      .update(this.mapearSueldoParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando sueldo:', error);
      return false;
    }

    return true;
  }

  static async eliminarSueldo(id: string): Promise<boolean> {
    const { error } = await db
      .from('sueldos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error eliminando sueldo:', error);
      return false;
    }

    return true;
  }

  // === ESTADO COMPLETO ===
  static async cargarEstadoCompleto(): Promise<AppState> {
    const [
      cuentas,
      gastosFijos,
      gastosDiarios,
      tarjetas,
      consumosTarjetas,
      prestamos,
      cuentasBancarias,
      categorias,
      sueldos,
      planesAhorro
    ] = await Promise.all([
      this.obtenerCuentas(),
      this.obtenerGastosFijos(),
      this.obtenerGastosDiarios(),
      this.obtenerTarjetas(),
      this.obtenerConsumosTarjetas(),
      this.obtenerPrestamos(),
      this.obtenerCuentasBancarias(),
      this.obtenerCategorias(),
      this.obtenerSueldos(),
      this.obtenerPlanesAhorro()
    ]);

    const formasDePago = [
      { id: '1', nombre: 'Efectivo', codigo: 'EFECTIVO' as const, activa: true },
      { id: '2', nombre: 'Débito Automático', codigo: 'DEBITO' as const, activa: true },
      { id: '3', nombre: 'Tarjeta de Crédito', codigo: 'TARJETA' as const, activa: true },
      { id: '4', nombre: 'Transferencia Bancaria', codigo: 'TRANSFERENCIA BANCO' as const, activa: true },
      { id: '5', nombre: 'Mercado Pago', codigo: 'MERCADO_PAGO' as const, activa: true },
    ];

    const tipoDolarConfig = await this.obtenerConfiguracion('tipo_dolar_seleccionado');
    const tipoDolarSeleccionado: TipoDolar = (tipoDolarConfig as TipoDolar) || 'blue';
    const cotizacionDolar = await this.obtenerCotizacionDolar(tipoDolarSeleccionado);

    return {
      cuentas,
      gastosFijos,
      gastosDiarios,
      tarjetas,
      consumosTarjetas,
      prestamos,
      cotizacionDolar,
      configuracion: {
        tipoDolarSeleccionado,
        cuentasBancarias,
        categorias,
        formasDePago,
        sueldos
      },
      planesAhorro
    };
  }

  // === HELPERS DE MAPEO ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuenta(data: any): Cuenta {
    return {
      id: data.id,
      nombre: data.nombre,
      tipo: data.tipo,
      saldoActual: Number(data.saldo_actual),
      moneda: data.moneda,
      activa: data.activa,
      fechaActualizacion: data.fecha_actualizacion || data.created_at,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuentaParaDB(cuenta: Partial<Cuenta>): any {
    return {
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      saldo_actual: cuenta.saldoActual,
      moneda: cuenta.moneda,
      activa: cuenta.activa,
      fecha_actualizacion: cuenta.fechaActualizacion,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearGastoFijo(data: any): GastoFijo {
    return {
      id: data.id,
      rubroId: data.rubro_id,
      etiqueta: data.etiqueta,
      descripcion: data.descripcion,
      monto: Number(data.monto),
      moneda: data.moneda,
      formaDePago: data.forma_de_pago,
      tarjetaId: data.tarjeta_id,
      cuentaBancariaId: data.cuenta_bancaria_id,
      activo: data.activo,
      fechaCreacion: data.fecha_creacion || data.created_at,
      planId: data.plan_id,
      prestamoId: data.prestamo_id,
      pagoTarjetaId: data.pago_tarjeta_id,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearGastoFijoParaDB(gasto: Partial<GastoFijo>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datos: any = {};

    if (gasto.rubroId !== undefined) datos.rubro_id = gasto.rubroId && gasto.rubroId !== '' ? gasto.rubroId : null;
    if (gasto.etiqueta !== undefined) datos.etiqueta = gasto.etiqueta || null;
    if (gasto.descripcion !== undefined) datos.descripcion = gasto.descripcion;
    if (gasto.monto !== undefined) datos.monto = gasto.monto;
    if (gasto.moneda !== undefined) datos.moneda = gasto.moneda;
    if (gasto.formaDePago !== undefined) datos.forma_de_pago = gasto.formaDePago;
    if (gasto.tarjetaId !== undefined) datos.tarjeta_id = (gasto.tarjetaId && gasto.tarjetaId !== '') ? gasto.tarjetaId : null;
    if (gasto.cuentaBancariaId !== undefined) datos.cuenta_bancaria_id = (gasto.cuentaBancariaId && gasto.cuentaBancariaId !== '') ? gasto.cuentaBancariaId : null;
    if (gasto.activo !== undefined) datos.activo = gasto.activo;
    if (gasto.fechaCreacion !== undefined) datos.fecha_creacion = gasto.fechaCreacion;
    if (gasto.planId !== undefined) datos.plan_id = (gasto.planId && gasto.planId !== '') ? gasto.planId : null;
    if (gasto.prestamoId !== undefined) datos.prestamo_id = (gasto.prestamoId && gasto.prestamoId !== '') ? gasto.prestamoId : null;
    if (gasto.pagoTarjetaId !== undefined) datos.pago_tarjeta_id = (gasto.pagoTarjetaId && gasto.pagoTarjetaId !== '') ? gasto.pagoTarjetaId : null;

    return datos;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearTarjeta(data: any): Tarjeta {
    return {
      id: data.id,
      nombre: data.nombre,
      banco: data.banco,
      tipo: data.tipo,
      titular: data.titular,
      activa: data.activa,
      fechaVencimiento: data.fecha_vencimiento,
      limiteCredito: data.limite_credito ? Number(data.limite_credito) : undefined,
      limiteRecomendado: data.limite_recomendado ? Number(data.limite_recomendado) : undefined,
      diaCierre: data.dia_cierre,
      diaVencimiento: data.dia_vencimiento,
      pagada: data.pagada || false,
      ultimoPagoMes: data.ultimo_pago_mes,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearTarjetaParaDB(tarjeta: Partial<Tarjeta>): any {
    return {
      nombre: tarjeta.nombre,
      banco: tarjeta.banco,
      tipo: tarjeta.tipo,
      titular: tarjeta.titular,
      activa: tarjeta.activa,
      fecha_vencimiento: tarjeta.fechaVencimiento,
      limite_credito: tarjeta.limiteCredito,
      limite_recomendado: tarjeta.limiteRecomendado,
      dia_cierre: tarjeta.diaCierre,
      dia_vencimiento: tarjeta.diaVencimiento,
      pagada: tarjeta.pagada,
      ultimo_pago_mes: tarjeta.ultimoPagoMes,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearConsumoTarjeta(data: any): ConsumoTarjeta {
    return {
      id: data.id,
      tarjetaId: data.tarjeta_id,
      fecha: data.fecha,
      lugar: data.lugar,
      rubro: data.rubro || '',
      rubroId: data.rubro_id,
      rubroInfo: data.rubros ? FinanzasService.mapRubroFromDB(data.rubros) : undefined,
      detalle: data.detalle,
      importeARS: Number(data.importe_ars),
      importeUSD: data.importe_usd ? Number(data.importe_usd) : undefined,
      cuotas: data.cuotas,
      cuotaActual: data.cuota_actual,
      totalCuotas: data.total_cuotas,
      gastoFijo: data.gasto_fijo || false,
      codigoOperacion: data.codigo_operacion,
      fechaCompra: data.fecha_compra,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearConsumoTarjetaParaDB(consumo: Partial<ConsumoTarjeta>): any {
    return {
      tarjeta_id: consumo.tarjetaId && consumo.tarjetaId !== '' ? consumo.tarjetaId : null,
      fecha: consumo.fecha,
      lugar: consumo.lugar,
      rubro_id: consumo.rubroId && consumo.rubroId !== '' ? consumo.rubroId : null,
      detalle: consumo.detalle,
      importe_ars: consumo.importeARS,
      importe_usd: consumo.importeUSD,
      cuotas: consumo.cuotas,
      cuota_actual: consumo.cuotaActual,
      total_cuotas: consumo.totalCuotas,
      gasto_fijo: consumo.gastoFijo || false,
      codigo_operacion: consumo.codigoOperacion,
      fecha_compra: consumo.fechaCompra,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearGastoDiario(data: any): GastoDiario {
    return {
      id: data.id,
      descripcion: data.descripcion,
      detalle: data.detalle,
      monto: Number(data.monto),
      montoUSD: data.monto_usd ? Number(data.monto_usd) : undefined,
      fecha: data.fecha,
      rubro: data.rubro || '',
      rubroId: data.rubro_id,
      rubroInfo: data.rubros ? FinanzasService.mapRubroFromDB(data.rubros) : undefined,
      formaPago: data.forma_de_pago,
      tarjetaId: data.tarjeta_id,
      cuentaId: data.cuenta_id,
      cuotas: data.cuotas,
      codigoOperacion: data.codigo_operacion,
      gastoFijoId:     data.gasto_fijo_id,
      planId:          data.plan_id,
      prestamoId:      data.prestamo_id,
      pagoTarjetaId:   data.pago_tarjeta_id,
      pagoParcial:     data.pago_parcial,
      pagoTarjetaMes:  data.pago_tarjeta_mes,
      esSilencioso:    data.es_silencioso,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearGastoDiarioParaDB(gasto: Partial<GastoDiario>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbData: any = {
      descripcion: gasto.descripcion,
      detalle: gasto.detalle || null,
      monto: gasto.monto,
      monto_usd: gasto.montoUSD || null,
      fecha: gasto.fecha,
      rubro: gasto.rubro || 'OTROS',
      rubro_id: gasto.rubroId || null,
      forma_de_pago: gasto.formaPago,
      tarjeta_id: gasto.tarjetaId || null,
      cuenta_id: gasto.cuentaId || null,
      cuotas: gasto.cuotas,
      codigo_operacion: gasto.codigoOperacion,
      gasto_fijo_id: gasto.gastoFijoId || null,
      plan_id: gasto.planId || null,
      prestamo_id: gasto.prestamoId || null,
      pago_tarjeta_id: gasto.pagoTarjetaId || null,
      pago_parcial:    gasto.pagoParcial,
      pago_tarjeta_mes: gasto.pagoTarjetaMes || null,
      es_silencioso: gasto.esSilencioso,
    };

    // Eliminar undefined para evitar errores de Supabase
    Object.keys(dbData).forEach(key => {
      if (dbData[key] === undefined) delete dbData[key];
    });

    return dbData;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearPrestamo(data: any): Prestamo {
    return {
      id: data.id,
      concepto: data.concepto,
      montoOriginal: Number(data.monto_original),
      moneda: data.moneda,
      saldoPendiente: Number(data.saldo_pendiente),
      tasaInteres: data.tasa_interes ? Number(data.tasa_interes) : undefined,
      fechaInicio: data.fecha_inicio,
      fechaVencimiento: data.fecha_vencimiento,
      cuotasTotales: data.cuotas_totales ? Number(data.cuotas_totales) : undefined,
      cuotasPagas: data.cuotas_pagas !== undefined && data.cuotas_pagas !== null ? Number(data.cuotas_pagas) : undefined,
      importeCuota: data.importe_cuota ? Number(data.importe_cuota) : undefined,
      saldoCancelacion: data.saldo_cancelacion ? Number(data.saldo_cancelacion) : undefined,
      cuotaAbonada: data.cuota_abonada || false,
      pagado: data.pagado || false,
      activo: data.activo,
      prestamista: data.prestamista,
      color: data.color,
      noCobrarCuota: data.no_cobrar_cuota || false,
      notas: data.notas,
      comprobanteUrl: data.comprobante_url,
      ultimoPagoMes: data.ultimo_pago_mes,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearPrestamoParaDB(prestamo: Partial<Prestamo>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbData: any = {};

    if (prestamo.concepto !== undefined) dbData.concepto = prestamo.concepto;
    if (prestamo.montoOriginal !== undefined) dbData.monto_original = prestamo.montoOriginal;
    if (prestamo.moneda !== undefined) dbData.moneda = prestamo.moneda;
    if (prestamo.saldoPendiente !== undefined) dbData.saldo_pendiente = prestamo.saldoPendiente;
    if (prestamo.tasaInteres !== undefined) dbData.tasa_interes = prestamo.tasaInteres;
    if (prestamo.fechaInicio !== undefined) dbData.fecha_inicio = prestamo.fechaInicio;
    if (prestamo.fechaVencimiento !== undefined) dbData.fecha_vencimiento = prestamo.fechaVencimiento;
    if (prestamo.cuotasTotales !== undefined) dbData.cuotas_totales = prestamo.cuotasTotales;
    if (prestamo.cuotasPagas !== undefined) dbData.cuotas_pagas = prestamo.cuotasPagas;
    if (prestamo.importeCuota !== undefined) dbData.importe_cuota = prestamo.importeCuota;
    if (prestamo.saldoCancelacion !== undefined) dbData.saldo_cancelacion = prestamo.saldoCancelacion;
    if (prestamo.cuotaAbonada !== undefined) dbData.cuota_abonada = prestamo.cuotaAbonada;
    if (prestamo.pagado !== undefined) dbData.pagado = prestamo.pagado;
    if (prestamo.activo !== undefined) dbData.activo = prestamo.activo;
    if (prestamo.prestamista !== undefined) dbData.prestamista = prestamo.prestamista;
    if (prestamo.color !== undefined) dbData.color = prestamo.color;
    if (prestamo.noCobrarCuota !== undefined) dbData.no_cobrar_cuota = prestamo.noCobrarCuota;
    if (prestamo.notas !== undefined) dbData.notas = prestamo.notas;
    if (prestamo.comprobanteUrl !== undefined) dbData.comprobante_url = prestamo.comprobanteUrl;
    if (prestamo.ultimoPagoMes !== undefined) dbData.ultimo_pago_mes = prestamo.ultimoPagoMes;

    return dbData;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuentaBancaria(data: any): CuentaBancaria {
    return {
      id: data.id,
      nombre: data.nombre,
      banco: data.banco,
      titular: data.titular,
      tipo: data.tipo,
      activa: data.activa,
      cuentaSaldoId: data.cuenta_saldo_id,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuentaBancariaParaDB(cuenta: Partial<CuentaBancaria>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbData: any = {
      nombre: cuenta.nombre,
      banco: cuenta.banco,
      titular: cuenta.titular,
      tipo: cuenta.tipo,
      activa: cuenta.activa,
      cuenta_saldo_id: (cuenta.cuentaSaldoId && cuenta.cuentaSaldoId !== '') ? cuenta.cuentaSaldoId : null,
    };

    Object.keys(dbData).forEach(key => {
      if (dbData[key] === undefined) delete dbData[key];
    });

    return dbData;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCategoria(data: any): ConfiguracionCategoria {
    return {
      id: data.id,
      nombre: data.nombre,
      codigo: data.codigo,
      activa: data.activa,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCategoriaParaDB(categoria: Partial<ConfiguracionCategoria>): any {
    return {
      nombre: categoria.nombre,
      codigo: categoria.codigo,
      activa: categoria.activa,
    };
  }

  // === COTIZACIONES DÓLAR ===
  /** Cache TTL: cotización en DB más vieja que esto se refresca desde la API. */
  static readonly COTIZACION_CACHE_TTL_MS = 15 * 60 * 1000;

  private static cotizacionCacheVigente(cotizacion: CotizacionDolar): boolean {
    const edadMs = Date.now() - new Date(cotizacion.fechaActualizacion).getTime();
    return edadMs >= 0 && edadMs < FinanzasService.COTIZACION_CACHE_TTL_MS;
  }

  static async obtenerCotizacionDolar(
    tipo: TipoDolar,
    forzarAPI = false,
  ): Promise<CotizacionDolar | null> {
    let cotizacion: CotizacionDolar | null = null;

    if (!forzarAPI) {
      cotizacion = await this.obtenerUltimaCotizacion(tipo);
      if (cotizacion && !this.cotizacionCacheVigente(cotizacion)) {
        cotizacion = null;
      }
    }

    if (!cotizacion) {
      cotizacion = await DolarService.obtenerCotizacion(tipo);
      if (cotizacion) {
        try {
          await this.guardarCotizacion(cotizacion);
        } catch (error) {
          console.error('Error guardando cotización:', error);
        }
      }
    }

    return cotizacion;
  }

  static async guardarCotizacion(cotizacion: CotizacionDolar): Promise<void> {
    const fechaHoy = new Date().toISOString().split('T')[0];
    const { data: existente } = await db
      .from('cotizaciones_dolar')
      .select('id')
      .eq('tipo', cotizacion.tipo)
      .gte('fecha_actualizacion', fechaHoy + 'T00:00:00.000Z')
      .lt('fecha_actualizacion', fechaHoy + 'T23:59:59.999Z')
      .limit(1)
      .maybeSingle();

    if (existente) {
      const { error } = await db
        .from('cotizaciones_dolar')
        .update({
          compra: cotizacion.compra,
          venta: cotizacion.venta,
          fecha_actualizacion: cotizacion.fechaActualizacion,
        })
        .eq('id', existente.id);

      if (error) {
        throw new Error(`Error actualizando cotización: ${error.message}`);
      }
    } else {
      const { error } = await db
        .from('cotizaciones_dolar')
        .insert({
          tipo: cotizacion.tipo,
          compra: cotizacion.compra,
          venta: cotizacion.venta,
          fecha_actualizacion: cotizacion.fechaActualizacion,
        });

      if (error) {
        throw new Error(`Error guardando cotización: ${error.message}`);
      }
    }
  }

  static async guardarCotizaciones(cotizaciones: CotizacionDolar[]): Promise<void> {
    await Promise.all(cotizaciones.map((c) => this.guardarCotizacion(c)));
  }

  static async obtenerUltimaCotizacion(tipo: string): Promise<CotizacionDolar | null> {
    const { data, error } = await db
      .from('cotizaciones_dolar')
      .select('*')
      .eq('tipo', tipo)
      .order('fecha_actualizacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(`Error obteniendo cotización: ${error.message}`);
    }

    if (!data) return null;

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tipo: data.tipo as any,
      compra: data.compra,
      venta: data.venta,
      fechaActualizacion: data.fecha_actualizacion,
    };
  }

  // === CONFIGURACIÓN USUARIO ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async guardarConfiguracion(clave: string, valor: any): Promise<void> {
    const user_id = await requireUserId();
    const { error } = await db
      .from('configuracion_usuario')
      .upsert({
        clave,
        valor: valor,
        user_id,
      }, {
        onConflict: 'user_id,clave'
      });

    if (error) {
      throw new Error(`Error guardando configuración: ${error.message}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async obtenerConfiguracion(clave: string): Promise<any> {
    const { data, error } = await db
      .from('configuracion_usuario')
      .select('valor')
      .eq('clave', clave)
      .maybeSingle();

    if (error) {
      throw new Error(`Error obteniendo configuración: ${error.message}`);
    }

    return data ? data.valor : null;
  }

  // === CUOTAS PROGRAMADAS ===
  static async obtenerCuotasPorPrestamo(prestamoId: string): Promise<CuotaProgramada[]> {
    const { data, error } = await db
      .from('cuotas_programadas')
      .select('*')
      .eq('prestamo_id', prestamoId)
      .order('numero_cuota', { ascending: true });

    if (error) {
      console.error('Error obteniendo cuotas programadas:', error);
      return [];
    }

    return data.map(this.mapearCuotaProgramada);
  }

  static async crearCuotas(cuotas: Omit<CuotaProgramada, 'id'>[]): Promise<CuotaProgramada[]> {
    const { data, error } = await db
      .from('cuotas_programadas')
      .insert(await this.withTenantMany(cuotas.map(this.mapearCuotaProgramadaParaDB)))
      .select();

    if (error) {
      console.error('Error creando cuotas programadas:', error);
      return [];
    }

    return data.map(this.mapearCuotaProgramada);
  }

  static async actualizarCuota(id: string, cambios: Partial<CuotaProgramada>): Promise<boolean> {
    const { error } = await db
      .from('cuotas_programadas')
      .update(this.mapearCuotaProgramadaParaDB(cambios))
      .eq('id', id);

    return !error;
  }

  static async marcarCuotaComoPagada(id: string, fechaPago: string): Promise<boolean> {
    const { error } = await db
      .from('cuotas_programadas')
      .update({
        pagada: true,
        fecha_pago: fechaPago,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    return !error;
  }

  static async obtenerCuotaActual(prestamoId: string): Promise<CuotaProgramada | null> {
    const hoy = new Date().toISOString().split('T')[0];

    const { data, error } = await db
      .from('cuotas_programadas')
      .select('*')
      .eq('prestamo_id', prestamoId)
      .eq('pagada', false)
      .lte('fecha_vencimiento', hoy)
      .order('numero_cuota', { ascending: true })
      .limit(1)
      .single();

    if (error || !data) {
      const { data: proximaCuota, error: errorProxima } = await db
        .from('cuotas_programadas')
        .select('*')
        .eq('prestamo_id', prestamoId)
        .eq('pagada', false)
        .order('numero_cuota', { ascending: true })
        .limit(1)
        .single();

      if (errorProxima || !proximaCuota) return null;
      return this.mapearCuotaProgramada(proximaCuota);
    }

    return this.mapearCuotaProgramada(data);
  }

  static async eliminarCuotasPorPrestamo(prestamoId: string): Promise<boolean> {
    const { error } = await db
      .from('cuotas_programadas')
      .delete()
      .eq('prestamo_id', prestamoId);

    return !error;
  }

  // === PLANES DE AHORRO ===
  static async obtenerPlanesAhorro(): Promise<PlanAhorro[]> {
    const { data, error } = await db
      .from('planes_ahorro')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error obteniendo planes de ahorro:', error);
      return [];
    }
    return data.map(this.mapearPlanAhorro);
  }

  static async crearPlanAhorro(plan: Omit<PlanAhorro, 'id'>): Promise<PlanAhorro | null> {
    const { data, error } = await db
      .from('planes_ahorro')
      .insert([await this.withTenant(this.mapearPlanAhorroParaDB(plan))])
      .select()
      .single();
    if (error) {
      console.error('Error creando plan de ahorro:', error);
      return null;
    }
    return this.mapearPlanAhorro(data);
  }

  static async actualizarPlanAhorro(id: string, cambios: Partial<PlanAhorro>): Promise<boolean> {
    const { error } = await db
      .from('planes_ahorro')
      .update(this.mapearPlanAhorroParaDB(cambios))
      .eq('id', id);
    if (error) {
      console.error('Error actualizando plan de ahorro:', error);
      return false;
    }
    return true;
  }

  static async eliminarPlanAhorro(id: string): Promise<boolean> {
    const { error } = await db
      .from('planes_ahorro')
      .delete()
      .eq('id', id);
    if (error) {
      console.error('Error eliminando plan de ahorro:', error);
      return false;
    }
    return true;
  }

  // === CUOTAS PLANES DE AHORRO ===
  static async obtenerCuotasPorPlan(planId: string): Promise<CuotaPlanAhorro[]> {
    const { data, error } = await db
      .from('cuotas_planes_ahorro')
      .select('*')
      .eq('plan_id', planId)
      .order('numero_cuota', { ascending: true });
    if (error) {
      console.error('Error obteniendo cuotas de plan de ahorro:', error);
      return [];
    }
    return data.map(this.mapearCuotaPlanAhorro);
  }

  static async obtenerProximaCuotaPlanAhorro(planId: string): Promise<CuotaPlanAhorro | null> {
    const { data, error } = await db
      .from('cuotas_planes_ahorro')
      .select('*')
      .eq('plan_id', planId)
      .eq('pagada', false)
      .order('numero_cuota', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('Error obteniendo proxima cuota plan:', error);
      return null;
    }
    return data ? this.mapearCuotaPlanAhorro(data) : null;
  }

  static async marcarCuotaPlanComoPagada(id: string, fechaPago: string, gastoDiarioId?: string): Promise<boolean> {
    const { error } = await db
      .from('cuotas_planes_ahorro')
      .update({
        pagada: true,
        fecha_pago: fechaPago,
        gasto_diario_id: gastoDiarioId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    return !error;
  }

  static async crearCuotasPlan(cuotas: Omit<CuotaPlanAhorro, 'id'>[]): Promise<CuotaPlanAhorro[]> {
    const dbCuotas = await this.withTenantMany(cuotas.map(c => this.mapearCuotaPlanAhorroParaDB(c)));
    const { data, error } = await db
      .from('cuotas_planes_ahorro')
      .insert(dbCuotas)
      .select();

    if (error) {
      console.error('Error creando cuotas de plan:', error);
      return [];
    }
    return data.map(this.mapearCuotaPlanAhorro);
  }

  static async actualizarCuotaPlan(id: string, cambios: Partial<CuotaPlanAhorro>): Promise<boolean> {
    const { error } = await db
      .from('cuotas_planes_ahorro')
      .update(this.mapearCuotaPlanAhorroParaDB(cambios))
      .eq('id', id);

    if (error) {
      console.error('Error actualizando cuota de plan:', error);
      return false;
    }
    return true;
  }

  static async eliminarCuotasPorPlan(planId: string): Promise<boolean> {
    const { error } = await db
      .from('cuotas_planes_ahorro')
      .delete()
      .eq('plan_id', planId);

    if (error) {
      console.error('Error eliminando cuotas del plan:', error);
      return false;
    }
    return true;
  }

  // === MAPPERS CUOTAS PROGRAMADAS ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuotaProgramada(data: any): CuotaProgramada {
    return {
      id: data.id,
      prestamoId: data.prestamo_id,
      numeroCuota: data.numero_cuota,
      fechaVencimiento: data.fecha_vencimiento,
      importeTotal: parseFloat(data.importe_total),
      pagada: data.pagada,
      fechaPago: data.fecha_pago
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuotaProgramadaParaDB(cuota: Partial<CuotaProgramada>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {};

    if (cuota.prestamoId !== undefined) result.prestamo_id = cuota.prestamoId;
    if (cuota.numeroCuota !== undefined) result.numero_cuota = cuota.numeroCuota;
    if (cuota.fechaVencimiento !== undefined) result.fecha_vencimiento = cuota.fechaVencimiento;
    if (cuota.importeTotal !== undefined) result.importe_total = cuota.importeTotal;
    if (cuota.pagada !== undefined) result.pagada = cuota.pagada;
    if (cuota.fechaPago !== undefined) result.fecha_pago = cuota.fechaPago;

    return result;
  }

  // === MAPPERS PLANES DE AHORRO ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearPlanAhorro(data: any): PlanAhorro {
    return {
      id: data.id,
      detalle: data.detalle,
      grupo: data.grupo,
      orden: data.orden,
      valorMovil: data.valor_movil ? Number(data.valor_movil) : undefined,
      saldoCancelacion: data.saldo_cancelacion ? Number(data.saldo_cancelacion) : undefined,
      fechaInicio: data.fecha_inicio,
      cuotasTotales: data.cuotas_totales,
      cuotasPagas: data.cuotas_pagas,
      cuotasAdelantadas: data.cuotas_adelantadas ? Number(data.cuotas_adelantadas) : undefined,
      importeCuota: Number(data.importe_cuota),
      moneda: data.moneda,
      fechaVencimiento: data.fecha_vencimiento,
      activa: data.activa,
      linkPago: data.link_pago,
      modeloReferencia: data.modelo_referencia,
      createdAt: data.created_at,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearPlanAhorroParaDB(plan: Partial<PlanAhorro>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbData: any = {};
    if (plan.detalle !== undefined) dbData.detalle = plan.detalle;
    if (plan.grupo !== undefined) dbData.grupo = plan.grupo;
    if (plan.orden !== undefined) dbData.orden = plan.orden;
    if (plan.valorMovil !== undefined) dbData.valor_movil = plan.valorMovil;
    if (plan.saldoCancelacion !== undefined) dbData.saldo_cancelacion = plan.saldoCancelacion;
    if (plan.fechaInicio !== undefined) dbData.fecha_inicio = plan.fechaInicio;
    if (plan.cuotasTotales !== undefined) dbData.cuotas_totales = plan.cuotasTotales;
    if (plan.cuotasPagas !== undefined) dbData.cuotas_pagas = plan.cuotasPagas;
    if (plan.cuotasAdelantadas !== undefined) dbData.cuotas_adelantadas = plan.cuotasAdelantadas;
    if (plan.importeCuota !== undefined) dbData.importe_cuota = plan.importeCuota;
    if (plan.moneda !== undefined) dbData.moneda = plan.moneda;
    if (plan.fechaVencimiento !== undefined) dbData.fecha_vencimiento = plan.fechaVencimiento;
    if (plan.activa !== undefined) dbData.activa = plan.activa;
    if (plan.linkPago !== undefined) dbData.link_pago = plan.linkPago;
    if (plan.modeloReferencia !== undefined) dbData.modelo_referencia = plan.modeloReferencia;
    return dbData;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuotaPlanAhorro(data: any): CuotaPlanAhorro {
    return {
      id: data.id,
      planId: data.plan_id,
      numeroCuota: data.numero_cuota,
      fechaVencimiento: data.fecha_vencimiento,
      importe: Number(data.importe),
      pagada: data.pagada,
      fechaPago: data.fecha_pago,
      gastoDiarioId: data.gasto_diario_id,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearCuotaPlanAhorroParaDB(cuota: Partial<CuotaPlanAhorro>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbData: any = {};
    if (cuota.planId !== undefined) dbData.plan_id = cuota.planId;
    if (cuota.numeroCuota !== undefined) dbData.numero_cuota = cuota.numeroCuota;
    if (cuota.fechaVencimiento !== undefined) dbData.fecha_vencimiento = cuota.fechaVencimiento;
    if (cuota.importe !== undefined) dbData.importe = cuota.importe;
    if (cuota.pagada !== undefined) dbData.pagada = cuota.pagada;
    if (cuota.fechaPago !== undefined) dbData.fecha_pago = cuota.fechaPago;
    if (cuota.gastoDiarioId !== undefined) dbData.gasto_diario_id = cuota.gastoDiarioId;
    return dbData;
  }

  // === SUELDOS MAPPERS ===
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearSueldo(data: any): Sueldo {
    return {
      id: data.id,
      nombre: data.nombre,
      monto: Number(data.monto),
      moneda: data.moneda,
      activo: data.activo,
      updatedAt: data.updated_at,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static mapearSueldoParaDB(sueldo: Partial<Sueldo>): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbData: any = {};
    if (sueldo.nombre !== undefined) dbData.nombre = sueldo.nombre;
    if (sueldo.monto !== undefined) dbData.monto = sueldo.monto;
    if (sueldo.moneda !== undefined) dbData.moneda = sueldo.moneda;
    if (sueldo.activo !== undefined) dbData.activo = sueldo.activo;
    return dbData;
  }

  // === UTILIDADES ===
  static async limpiarTodosLosDatos(): Promise<void> {
    await db.from('tarjetas_consumos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('gastos_fijos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('prestamos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('tarjetas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('categorias').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('cuentas_bancarias').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await db.from('cuentas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }

}

export default FinanzasService;
