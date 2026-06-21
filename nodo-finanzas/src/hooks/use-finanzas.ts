import { useState, useEffect, useCallback } from 'react';
import { FinanzasService } from '@/services/finanzas-service';
import { useAuth } from '@nodocore/shared-components';
import { calcularMesFacturacion } from '@/utils/tarjeta-fechas';
import { getFechaHoy } from '@/utils/formatters';
import type {
  AppState,
  Cuenta,
  GastoFijo,
  GastoDiario,
  Tarjeta,
  ConsumoTarjeta,
  Prestamo,
  CuentaBancaria,
  ConfiguracionCategoria,
  ConfiguracionFormaPago,
  RubroConsumo,
  Sueldo,
  PlanAhorro,
  MovimientoCuenta,
} from '@/types';
import { TASA_INTERES_TARJETA } from '@/types';

export const useFinanzas = () => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [estado, setEstado] = useState<AppState>({
    cuentas: [],
    gastosFijos: [],
    gastosDiarios: [],
    tarjetas: [],
    consumosTarjetas: [],
    prestamos: [],
    planesAhorro: [],
    cotizacionDolar: null,
    configuracion: {
      tipoDolarSeleccionado: 'blue',
      cuentasBancarias: [],
      categorias: [],
      formasDePago: [],
      sueldos: [],
    },
  });
  const [loading, setLoading] = useState(true);

  // Cargar datos cuando hay sesión (multi-tenant por user_id)
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const cargarDatos = async () => {
      try {
        setLoading(true);
        const estadoCompleto = await FinanzasService.cargarEstadoCompleto();
        setEstado(estadoCompleto);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    void cargarDatos();
  }, [userId]);

  // Función para recargar solo los consumos de tarjetas
  const recargarConsumosTarjetas = useCallback(async () => {
    try {
      const consumos = await FinanzasService.obtenerConsumosTarjetas();
      setEstado(prev => ({
        ...prev,
        consumosTarjetas: consumos,
      }));
    } catch (error) {
      console.error('Error recargando consumos de tarjetas:', error);
    }
  }, []);

  // Función para recargar todos los datos
  const recargarDatos = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const estadoCompleto = await FinanzasService.cargarEstadoCompleto();
      setEstado(estadoCompleto);
    } catch (error) {
      console.error('Error recargando datos:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Escuchar evento de sincronización offline exitosa
  useEffect(() => {
    const handleSync = () => {
      console.log('Sincronización offline completada. Recargando datos en UI...');
      recargarDatos();
    };

    window.addEventListener('offlineQueueSynced', handleSync);
    return () => window.removeEventListener('offlineQueueSynced', handleSync);
  }, [recargarDatos]);

  // Función para recargar solo los gastos fijos
  const recargarGastosFijos = useCallback(async () => {
    try {
      const gastosFijos = await FinanzasService.obtenerGastosFijos();
      setEstado(prev => ({
        ...prev,
        gastosFijos
      }));
      console.log('Gastos fijos recargados exitosamente');
    } catch (error) {
      console.error('Error recargando gastos fijos:', error);
    }
  }, []);

  // === HELPERS DE NEGOCIO ===
  const resolverCuentaDeSaldo = useCallback((idOCodigo?: string, formaPago?: string): Cuenta | undefined => {
    if (!idOCodigo && !formaPago) return undefined;

    // 1. Buscar por ID directo en cuentas de saldo
    if (idOCodigo) {
      const cuentaDirecta = estado.cuentas.find(c => c.id === idOCodigo);
      if (cuentaDirecta) return cuentaDirecta;
    }

    // 2. Buscar en configuración de cuentas bancarias
    if (idOCodigo) {
      const cuentaConfig = estado.configuracion.cuentasBancarias.find(cb => cb.id === idOCodigo);
      if (cuentaConfig) {
        if (cuentaConfig.cuentaSaldoId) {
          const cuentaVinc = estado.cuentas.find(c => c.id === cuentaConfig.cuentaSaldoId);
          if (cuentaVinc) return cuentaVinc;
        }

        const nombreConfig = cuentaConfig.nombre.toLowerCase().trim();
        const exacta = estado.cuentas.find(c => c.nombre.toLowerCase().trim() === nombreConfig);
        if (exacta) return exacta;

        const coincidenciaGral = estado.cuentas.find(c => {
          const nombreSaldo = c.nombre.toLowerCase().trim();
          return nombreSaldo.includes(nombreConfig) || nombreConfig.includes(nombreSaldo);
        });

        if (coincidenciaGral) {
          if (coincidenciaGral.nombre.toLowerCase().includes('reserva') && !nombreConfig.includes('reserva')) {
            const sinReserva = estado.cuentas.find(c => {
              const n = c.nombre.toLowerCase();
              return (n.includes(nombreConfig) || nombreConfig.includes(n)) && !n.includes('reserva');
            });
            if (sinReserva) return sinReserva;
          }
          return coincidenciaGral;
        }
      }
    }

    // 3. Fallback por forma de pago
    if (formaPago) {
      const configFormaPago = estado.configuracion.formasDePago.find(f => f.codigo === formaPago);
      if (configFormaPago && configFormaPago.cuentaSaldoId) {
        const cuentaVinc = estado.cuentas.find(c => c.id === configFormaPago.cuentaSaldoId);
        if (cuentaVinc) return cuentaVinc;
      }

      const nombreBusqueda =
        formaPago === 'MERCADO_PAGO' ? 'mercado pago' :
        formaPago === 'EFECTIVO' ? 'efectivo' :
        (formaPago === 'TRANSFERENCIA BANCO' || formaPago === 'DEBITO') ? 'santander' : null;

      if (nombreBusqueda) {
        const todas = estado.cuentas.filter(c => {
          const n = c.nombre.toLowerCase();
          return (n.includes(nombreBusqueda) || n.replace(/\s/g, '').includes(nombreBusqueda.replace(/\s/g, ''))) && !n.includes('reserva');
        });

        if (todas.length > 0) {
          if (nombreBusqueda === 'santander') {
            const cajaAhorro = todas.find(c => c.nombre.toLowerCase().includes('caja') || c.nombre.toLowerCase().includes('ahorro'));
            if (cajaAhorro) return cajaAhorro;
          }
          return todas[0];
        }

        const exacta = estado.cuentas.find(c => c.nombre.toLowerCase().trim() === nombreBusqueda);
        if (exacta) return exacta;
      }
    }

    return undefined;
  }, [estado.cuentas, estado.configuracion.cuentasBancarias, estado.configuracion.formasDePago]);

  // === CUENTAS ===
  const agregarCuenta = useCallback(async (cuenta: Omit<Cuenta, 'id'>) => {
    try {
      const nuevaCuenta = await FinanzasService.crearCuenta(cuenta);
      if (nuevaCuenta) {
        setEstado(prev => ({
          ...prev,
          cuentas: [...prev.cuentas, nuevaCuenta],
        }));
      }
    } catch (error) {
      console.error('Error agregando cuenta:', error);
    }
  }, []);

  const actualizarCuenta = useCallback(async (id: string, cambios: Partial<Cuenta>) => {
    try {
      const success = await FinanzasService.actualizarCuenta(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          cuentas: prev.cuentas.map(cuenta =>
            cuenta.id === id ? { ...cuenta, ...cambios } : cuenta
          ),
        }));
      }
    } catch (error) {
      console.error('Error actualizando cuenta:', error);
    }
  }, []);

  const eliminarCuenta = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarCuenta(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          cuentas: prev.cuentas.filter(cuenta => cuenta.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
    }
  }, []);

  // === MOVIMIENTOS DE CUENTA ===
  const registrarMovimientoManual = useCallback(async (movimiento: Omit<MovimientoCuenta, 'id' | 'createdAt'>) => {
    try {
      const nuevoMovimiento = await FinanzasService.registrarMovimiento(movimiento);
      if (nuevoMovimiento) {
        const cuenta = estado.cuentas.find(c => c.id === movimiento.cuentaId);
        if (cuenta) {
          const diferencia = movimiento.tipo === 'entrada' ? movimiento.monto : -movimiento.monto;
          const nuevoSaldo = cuenta.saldoActual + diferencia;
          await actualizarCuenta(cuenta.id, { saldoActual: nuevoSaldo });
        }
        return nuevoMovimiento;
      }
    } catch (error) {
      console.error('Error registrando movimiento manual:', error);
    }
    return null;
  }, [estado.cuentas, actualizarCuenta]);

  const actualizarMovimientoManual = useCallback(async (id: string, cambios: Partial<MovimientoCuenta>, movimientoAnterior: MovimientoCuenta) => {
    try {
      const success = await FinanzasService.actualizarMovimiento(id, cambios);
      if (success) {
        const cuenta = estado.cuentas.find(c => c.id === movimientoAnterior.cuentaId);
        if (cuenta) {
          const revertir = movimientoAnterior.tipo === 'entrada' ? -movimientoAnterior.monto : movimientoAnterior.monto;
          const montoNuevo = cambios.monto ?? movimientoAnterior.monto;
          const tipoNuevo = cambios.tipo ?? movimientoAnterior.tipo;
          const aplicar = tipoNuevo === 'entrada' ? montoNuevo : -montoNuevo;

          const nuevoSaldo = cuenta.saldoActual + revertir + aplicar;
          await actualizarCuenta(cuenta.id, { saldoActual: nuevoSaldo });
        }
        return true;
      }
    } catch (error) {
      console.error('Error actualizando movimiento manual:', error);
    }
    return false;
  }, [estado.cuentas, actualizarCuenta]);

  const eliminarMovimientoManual = useCallback(async (movimiento: MovimientoCuenta) => {
    try {
      const success = await FinanzasService.eliminarMovimiento(movimiento.id);
      if (success) {
        const cuenta = estado.cuentas.find(c => c.id === movimiento.cuentaId);
        if (cuenta) {
          const revertir = movimiento.tipo === 'entrada' ? -movimiento.monto : movimiento.monto;
          const nuevoSaldo = cuenta.saldoActual + revertir;
          await actualizarCuenta(cuenta.id, { saldoActual: nuevoSaldo });
        }
        return true;
      }
    } catch (error) {
      console.error('Error eliminando movimiento manual:', error);
    }
    return false;
  }, [estado.cuentas, actualizarCuenta]);

  const transferirDinero = useCallback(async (datos: {
    cuentaOrigenId: string;
    cuentaDestinoId: string;
    monto: number;
    fecha: string;
    descripcion: string;
    detalle?: string;
  }) => {
    try {
      const cuentaOrigen = estado.cuentas.find(c => c.id === datos.cuentaOrigenId);
      const cuentaDestino = estado.cuentas.find(c => c.id === datos.cuentaDestinoId);

      if (!cuentaOrigen || !cuentaDestino) return false;

      await FinanzasService.registrarMovimiento({
        cuentaId: datos.cuentaOrigenId,
        fecha: datos.fecha,
        descripcion: `Transferencia a ${cuentaDestino.nombre}: ${datos.descripcion}`,
        monto: datos.monto,
        tipo: 'salida',
        origen: 'ajuste_manual',
        detalle: datos.detalle
      });

      await FinanzasService.registrarMovimiento({
        cuentaId: datos.cuentaDestinoId,
        fecha: datos.fecha,
        descripcion: `Transferencia desde ${cuentaOrigen.nombre}: ${datos.descripcion}`,
        monto: datos.monto,
        tipo: 'entrada',
        origen: 'ajuste_manual',
        detalle: datos.detalle
      });

      await FinanzasService.actualizarCuenta(cuentaOrigen.id, {
        saldoActual: cuentaOrigen.saldoActual - datos.monto
      });
      await FinanzasService.actualizarCuenta(cuentaDestino.id, {
        saldoActual: cuentaDestino.saldoActual + datos.monto
      });

      setEstado(prev => ({
        ...prev,
        cuentas: prev.cuentas.map(c => {
          if (c.id === datos.cuentaOrigenId) return { ...c, saldoActual: c.saldoActual - datos.monto };
          if (c.id === datos.cuentaDestinoId) return { ...c, saldoActual: c.saldoActual + datos.monto };
          return c;
        })
      }));

      return true;
    } catch (error) {
      console.error('Error en transferencia entre cuentas:', error);
      return false;
    }
  }, [estado.cuentas]);

  // === GASTOS FIJOS ===
  const agregarGastoFijo = useCallback(async (gasto: Omit<GastoFijo, 'id'>) => {
    try {
      console.log('useFinanzas.agregarGastoFijo - Iniciando:', gasto);
      const nuevoGasto = await FinanzasService.crearGastoFijo(gasto);
      console.log('useFinanzas.agregarGastoFijo - Respuesta del servicio:', nuevoGasto);

      if (nuevoGasto) {
        setEstado(prev => ({
          ...prev,
          gastosFijos: [...prev.gastosFijos, nuevoGasto],
        }));
        console.log('useFinanzas.agregarGastoFijo - Estado actualizado correctamente');
      } else {
        console.error('useFinanzas.agregarGastoFijo - No se pudo crear el gasto');
      }
    } catch (error) {
      console.error('Error agregando gasto fijo:', error);
    }
  }, []);

  const actualizarGastoFijo = useCallback(async (id: string, cambios: Partial<GastoFijo>) => {
    try {
      const success = await FinanzasService.actualizarGastoFijo(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          gastosFijos: prev.gastosFijos.map(gasto =>
            gasto.id === id ? { ...gasto, ...cambios } : gasto
          ),
        }));
      }
    } catch (error) {
      console.error('Error actualizando gasto fijo:', error);
    }
  }, []);

  const eliminarGastoFijo = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarGastoFijo(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          gastosFijos: prev.gastosFijos.filter(gasto => gasto.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error eliminando gasto fijo:', error);
    }
  }, []);

  // === TARJETAS ===
  const agregarTarjeta = useCallback(async (tarjeta: Omit<Tarjeta, 'id'>) => {
    try {
      const nuevaTarjeta = await FinanzasService.crearTarjeta(tarjeta);
      if (nuevaTarjeta) {
        setEstado(prev => ({
          ...prev,
          tarjetas: [...prev.tarjetas, nuevaTarjeta],
        }));
      }
    } catch (error) {
      console.error('Error agregando tarjeta:', error);
    }
  }, []);

  const actualizarTarjeta = useCallback(async (id: string, cambios: Partial<Tarjeta>) => {
    try {
      const success = await FinanzasService.actualizarTarjeta(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          tarjetas: prev.tarjetas.map(tarjeta =>
            tarjeta.id === id ? { ...tarjeta, ...cambios } : tarjeta
          ),
        }));
      }
    } catch (error) {
      console.error('Error actualizando tarjeta:', error);
    }
  }, []);

  const eliminarTarjeta = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarTarjeta(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          tarjetas: prev.tarjetas.filter(tarjeta => tarjeta.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error eliminando tarjeta:', error);
    }
  }, []);

  // === CONSUMOS TARJETAS ===
  const agregarConsumo = useCallback(async (consumo: Omit<ConsumoTarjeta, 'id'>) => {
    try {
      const consumoCreado = await FinanzasService.crearConsumoTarjeta(consumo);

      if (consumoCreado) {
        setEstado(prev => ({
          ...prev,
          consumosTarjetas: [consumoCreado, ...prev.consumosTarjetas],
        }));
        return consumoCreado;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error agregando consumo:', error);
      throw error;
    }
  }, []);

  const actualizarConsumo = useCallback(async (id: string, cambios: Partial<ConsumoTarjeta>) => {
    try {
      const success = await FinanzasService.actualizarConsumoTarjeta(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          consumosTarjetas: prev.consumosTarjetas.map(consumo =>
            consumo.id === id ? { ...consumo, ...cambios } : consumo
          ),
        }));
      }
    } catch (error) {
      console.error('Error actualizando consumo:', error);
    }
  }, []);

  const eliminarConsumo = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarConsumoTarjeta(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          consumosTarjetas: prev.consumosTarjetas.filter(consumo => consumo.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error eliminando consumo:', error);
    }
  }, []);

  // === GASTOS DIARIOS ===
  const agregarGastoDiario = useCallback(async (gasto: Omit<GastoDiario, 'id'>) => {
    try {
      // === PRE-CALCULAR MES DE FACTURACIÓN PARA TARJETAS ===
      if (gasto.formaPago === 'TARJETA' && gasto.tarjetaId) {
        const tarjeta = estado.tarjetas.find(t => t.id === gasto.tarjetaId);
        if (tarjeta && tarjeta.diaCierre) {
          try {
            const fechaFacturacion = calcularMesFacturacion(gasto.fecha, {
              diaCierre: tarjeta.diaCierre,
              diaVencimiento: tarjeta.diaVencimiento
            });
            gasto.pagoTarjetaMes = fechaFacturacion.slice(0, 7); // Guardamos YYYY-MM
            console.log(`[agregarGastoDiario] Gasto Tarjeta asignado al periodo: ${gasto.pagoTarjetaMes}`);
          } catch (e) {
            console.error('Error calculando pagoTarjetaMes:', e);
          }
        }
      }

      const nuevoGasto = await FinanzasService.crearGastoDiario(gasto);

      if (nuevoGasto) {
        setEstado(prev => ({
          ...prev,
          gastosDiarios: [...prev.gastosDiarios, nuevoGasto],
        }));

        // === VINCULAR CON GASTO FIJO SI NO TIENE ID ===
        if (!gasto.gastoFijoId) {
          const gastoFijoCoincidente = estado.gastosFijos.find(gf =>
            gf.activo && (
              (gasto.planId && gf.planId === gasto.planId) ||
              (gasto.prestamoId && gf.prestamoId === gasto.prestamoId) ||
              (gasto.pagoTarjetaId && gf.pagoTarjetaId === gasto.pagoTarjetaId) ||
              (gf.descripcion.toLowerCase() === gasto.descripcion.toLowerCase())
            )
          );

          if (gastoFijoCoincidente) {
            console.log(`[useFinanzas] Vinculando automáticamente Gasto Diario ${nuevoGasto.id} con Gasto Fijo ${gastoFijoCoincidente.id}`);
            await FinanzasService.actualizarGastoDiario(nuevoGasto.id, { gastoFijoId: gastoFijoCoincidente.id });
            nuevoGasto.gastoFijoId = gastoFijoCoincidente.id;
            setEstado(prev => ({
              ...prev,
              gastosDiarios: prev.gastosDiarios.map(gd => gd.id === nuevoGasto.id ? { ...gd, gastoFijoId: gastoFijoCoincidente.id } : gd)
            }));
          }
        }

        // === ACTUALIZAR SALDO DE CUENTA Y REGISTRAR MOVIMIENTOS ===
        if (!gasto.esSilencioso) {
          if (gasto.formaPago !== 'TARJETA') {
            const cuentaActual = resolverCuentaDeSaldo(gasto.cuentaId, gasto.formaPago);

            if (cuentaActual) {
              const cotizacion = estado.cotizacionDolar?.venta || 1350;
              let montoADescontar = Number(gasto.monto);

              if (gasto.montoUSD && gasto.montoUSD > 0) {
                if (cuentaActual.moneda === 'ARS') {
                  montoADescontar += (gasto.montoUSD * cotizacion);
                } else {
                  montoADescontar = (montoADescontar / cotizacion) + gasto.montoUSD;
                }
              }

              const nuevoSaldo = Number(cuentaActual.saldoActual) - montoADescontar;

              console.log(`[agregarGastoDiario] PROCESANDO DESCUENTO:
                - Cuenta: ${cuentaActual.nombre} (${cuentaActual.moneda})
                - Saldo anterior: ${cuentaActual.saldoActual}
                - Total Final a Descontar: ${montoADescontar}
                - Nuevo Saldo: ${nuevoSaldo}`);

              await actualizarCuenta(cuentaActual.id, { saldoActual: nuevoSaldo });

              await FinanzasService.registrarMovimiento({
                cuentaId:    cuentaActual.id,
                fecha:       gasto.fecha || getFechaHoy(),
                descripcion: gasto.descripcion,
                monto:       montoADescontar,
                tipo:        'salida',
                origen:      'gasto_diario',
                referenciaId: nuevoGasto.id,
                detalle:     gasto.detalle ?? undefined,
              });
            } else {
              console.warn(`[agregarGastoDiario] No se pudo encontrar una cuenta de saldo para el Gasto.`);
            }
          }

          // === CREAR CONSUMO SI ES TARJETA ===
          if (gasto.formaPago === 'TARJETA' && gasto.tarjetaId) {
            const tarjeta = estado.tarjetas.find(t => t.id === gasto.tarjetaId);
            let fechaFacturacion = gasto.fecha;

            if (tarjeta && tarjeta.diaCierre) {
              try {
                fechaFacturacion = calcularMesFacturacion(gasto.fecha, {
                  diaCierre: tarjeta.diaCierre,
                  diaVencimiento: tarjeta.diaVencimiento
                });
                console.log(`[Tarjeta] Consumo: ${gasto.fecha}, Cierre: ${tarjeta.diaCierre}, Vencimiento: ${tarjeta.diaVencimiento} → Facturación: ${fechaFacturacion}`);
              } catch (e) {
                console.error('Error calculando fecha de facturación:', e);
              }
            }

            const rubroConsumo: RubroConsumo = (gasto.rubro as RubroConsumo) || 'OTROS';
            const totalCuotas = gasto.cuotas || 1;
            const montoPorCuota = totalCuotas > 1 ? gasto.monto / totalCuotas : gasto.monto;

            const codigoOperacion = gasto.codigoOperacion || crypto.randomUUID();
            const promesasCuotas = [];

            for (let cuota = 1; cuota <= totalCuotas; cuota++) {
              const fechaCuotaFinal = new Date(fechaFacturacion);
              if (cuota > 1) {
                fechaCuotaFinal.setMonth(fechaCuotaFinal.getMonth() + (cuota - 1));
              }

              const consumoTarjeta: Omit<ConsumoTarjeta, 'id'> = {
                tarjetaId: gasto.tarjetaId,
                fecha: fechaCuotaFinal.toISOString(),
                fechaCompra: gasto.fecha,
                lugar: gasto.descripcion,
                rubro: rubroConsumo,
                rubroId: gasto.rubroId || (gasto.rubro && gasto.rubro.length > 20 ? gasto.rubro : undefined),
                detalle: gasto.detalle || gasto.descripcion,
                importeARS: montoPorCuota,
                cuotas: totalCuotas > 1 ? `${cuota} de ${totalCuotas}` : '1',
                cuotaActual: cuota,
                totalCuotas: totalCuotas,
                codigoOperacion: codigoOperacion,
              };

              promesasCuotas.push(FinanzasService.crearConsumoTarjeta(consumoTarjeta));
            }

            await Promise.all(promesasCuotas);
          }
        }

        // === ACTUALIZAR PLAN DE AHORRO SI TIENE planId ===
        if (gasto.planId) {
          console.log('[useFinanzas] Registrando pago de Plan de Ahorro:', gasto.planId);
          try {
            const proximaCuota = await FinanzasService.obtenerProximaCuotaPlanAhorro(gasto.planId);

            if (proximaCuota) {
              console.log('[useFinanzas] Marcando cuota como pagada:', proximaCuota.numeroCuota);
              const fechaPago = gasto.fecha || new Date().toISOString().split('T')[0];
              await FinanzasService.marcarCuotaPlanComoPagada(proximaCuota.id, fechaPago, nuevoGasto.id);

              const planActual = estado.planesAhorro.find(p => p.id === gasto.planId);
              if (planActual) {
                const todasLasCuotas = await FinanzasService.obtenerCuotasPorPlan(gasto.planId);
                const siguienteNoPagada = todasLasCuotas.find(c => !c.pagada && c.id !== proximaCuota.id);

                const nuevosDatosPlan = {
                  cuotasPagas: planActual.cuotasPagas + 1,
                  fechaVencimiento: siguienteNoPagada ? siguienteNoPagada.fechaVencimiento : planActual.fechaVencimiento
                };

                await actualizarPlanAhorro(planActual.id, nuevosDatosPlan);
                console.log('[useFinanzas] Plan de ahorro actualizado exitosamente');
              }
            } else {
              const planActual = estado.planesAhorro.find(p => p.id === gasto.planId);
              if (planActual) {
                await actualizarPlanAhorro(planActual.id, {
                  cuotasPagas: planActual.cuotasPagas + 1
                });
              }
            }
          } catch (e) {
            console.error('[useFinanzas] Error al actualizar estado del plan de ahorro:', e);
          }
        }

        // === ACTUALIZAR ESTADO DE PAGO DE TARJETA SI TIENE pagoTarjetaId ===
        if (gasto.pagoTarjetaId) {
          const isParcial = gasto.pagoParcial;
          const mesDePago = (gasto.fecha || getFechaHoy()).slice(0, 7);
          const tarjeta = estado.tarjetas.find(t => t.id === gasto.pagoTarjetaId);

          console.log(`[useFinanzas] Procesando pago de tarjeta ${tarjeta?.nombre}: ${isParcial ? 'PARCIAL' : 'TOTAL'}`);

          await actualizarTarjeta(gasto.pagoTarjetaId, {
            pagada: !isParcial,
            ultimoPagoMes: mesDePago
          });

          if (tarjeta) {
            const consumosMes = estado.consumosTarjetas.filter(c =>
              c.tarjetaId === tarjeta.id && c.fecha.startsWith(mesDePago)
            );

            const totalARS = consumosMes.reduce((acc, c) => acc + (c.importeARS || 0), 0);
            const totalUSD = consumosMes.reduce((acc, c) => acc + (c.importeUSD || 0), 0);
            const cotizacion = estado.cotizacionDolar?.venta || 1350;

            const paidARS = Number(gasto.monto);
            const paidUSD = Number(gasto.montoUSD || 0);

            let pendienteARS = 0;
            let pendienteUSD = 0;

            if (isParcial) {
              pendienteARS = Math.max(0, totalARS - paidARS);
              pendienteUSD = Math.max(0, totalUSD - paidUSD);
            } else {
              pendienteARS = 0;
              pendienteUSD = 0;
            }

            if (pendienteARS > 0 || pendienteUSD > 0) {
              console.log(`[useFinanzas] Saldo pendiente detectado: ARS ${pendienteARS}, USD ${pendienteUSD}. Generando cargos...`);

              const partesFecha = mesDePago.split('-');
              let anio = parseInt(partesFecha[0]);
              let mes = parseInt(partesFecha[1]);

              if (mes === 12) {
                anio += 1;
                mes = 1;
              } else {
                mes += 1;
              }

              const proxMesStr = `${anio}-${String(mes).padStart(2, '0')}`;
              const fechaProximosCargos = `${proxMesStr}-01`;

              const opId = crypto.randomUUID();

              if (pendienteARS > 0) {
                await FinanzasService.crearConsumoTarjeta({
                  tarjetaId: tarjeta.id,
                  fecha: fechaProximosCargos,
                  lugar: `Saldo Pendiente (Pesos)`,
                  rubroId: gasto.rubroId || 'OTROS',
                  detalle: `Saldo remanente ARS del mes ${mesDePago}`,
                  importeARS: pendienteARS,
                  codigoOperacion: opId
                });
              }

              if (pendienteUSD > 0) {
                await FinanzasService.crearConsumoTarjeta({
                  tarjetaId: tarjeta.id,
                  fecha: fechaProximosCargos,
                  lugar: `Saldo Pendiente (Dólares)`,
                  rubroId: gasto.rubroId || 'OTROS',
                  detalle: `Saldo remanente USD del mes ${mesDePago}`,
                  importeARS: 0,
                  importeUSD: pendienteUSD,
                  codigoOperacion: opId
                });
              }

              const pendienteEquivalenteARS = pendienteARS + (pendienteUSD * cotizacion);
              const intereses = pendienteEquivalenteARS * TASA_INTERES_TARJETA;

              if (intereses > 0) {
                await FinanzasService.crearConsumoTarjeta({
                  tarjetaId: tarjeta.id,
                  fecha: fechaProximosCargos,
                  lugar: `Intereses de Financiación`,
                  rubroId: gasto.rubroId || 'OTROS',
                  detalle: `Interés mensual aplicado (${(TASA_INTERES_TARJETA * 100).toFixed(2)}%) sobre saldo pendiente`,
                  importeARS: intereses,
                  codigoOperacion: opId
                });
              }

              console.log(`[useFinanzas] Cargos por financiación creados para ${proxMesStr}`);
              await recargarConsumosTarjetas();
            }
          }
        }

        // === ACTUALIZAR PRÉSTAMO SI TIENE prestamoId ===
        if (gasto.prestamoId) {
          const prestamo = estado.prestamos.find(p => p.id === gasto.prestamoId);
          if (prestamo) {
            const mesDePago = (gasto.fecha || getFechaHoy()).slice(0, 7);
            const nuevoSaldo = Math.max(0, prestamo.saldoPendiente - gasto.monto);

            console.log(`[useFinanzas] Registrando pago de préstamo: ${prestamo.concepto}. Nuevo saldo: ${nuevoSaldo}. Mes: ${mesDePago}`);

            await actualizarPrestamo(prestamo.id, {
              saldoPendiente: nuevoSaldo,
              ultimoPagoMes: mesDePago,
              pagado: nuevoSaldo <= 0,
              activo: nuevoSaldo > 0
            });
          }
        }

        return nuevoGasto;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error agregando gasto diario:', error);
      throw error;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.cuentas, estado.tarjetas, estado.configuracion, actualizarCuenta, agregarConsumo]);

  const crearGastoDiarioSinConsumo = useCallback(async (gasto: Omit<GastoDiario, 'id'>) => {
    try {
      const nuevoGasto = await FinanzasService.crearGastoDiario(gasto);

      if (nuevoGasto) {
        setEstado(prev => ({
          ...prev,
          gastosDiarios: [...prev.gastosDiarios, nuevoGasto],
        }));

        return nuevoGasto;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error creando gasto diario directo:', error);
      throw error;
    }
  }, []);

  const actualizarGastoDiario = useCallback(async (id: string, cambios: Partial<GastoDiario>) => {
    try {
      console.log(`[actualizarGastoDiario] Iniciando update para ID: ${id}`, cambios);

      const gastoOriginal = estado.gastosDiarios.find(g => g.id === id);
      if (!gastoOriginal) {
        console.error(`[actualizarGastoDiario] Gasto no encontrado: ${id}`);
        return false;
      }

      const montoNuevo = cambios.monto !== undefined ? cambios.monto : gastoOriginal.monto;
      const formaPagoNueva = cambios.formaPago || gastoOriginal.formaPago;
      const idCuentaForm = cambios.cuentaId || gastoOriginal.cuentaId;

      const cuentaOrig = resolverCuentaDeSaldo(gastoOriginal.cuentaId, gastoOriginal.formaPago);
      const cuentaNueva = resolverCuentaDeSaldo(idCuentaForm, formaPagoNueva);

      if (cambios.cuentaId) {
        const esConfig = estado.configuracion.cuentasBancarias.some(cb => cb.id === cambios.cuentaId);
        if (!esConfig) {
          const config = estado.configuracion.cuentasBancarias.find(cb => cb.cuentaSaldoId === cambios.cuentaId);
          if (config) {
            console.log(`[actualizarGastoDiario] Mapeando Saldo ID -> Config ID para DB: ${cambios.cuentaId} -> ${config.id}`);
            cambios.cuentaId = config.id;
          } else {
            console.warn(`[actualizarGastoDiario] El ID ${cambios.cuentaId} no tiene configuración vinculada. Enviando NULL al DB.`);
            (cambios as any).cuentaId = null;
          }
        }
      }

      const success = await FinanzasService.actualizarGastoDiario(id, cambios);
      if (!success) return false;

      setEstado(prev => ({
        ...prev,
        gastosDiarios: prev.gastosDiarios.map(g => (g.id === id ? { ...g, ...cambios } : g)),
      }));

      console.log(`[actualizarGastoDiario] Logica de saldos:
        - Original: ${gastoOriginal.monto} (${gastoOriginal.formaPago}) -> Cuenta: ${cuentaOrig?.nombre || 'N/A'}
        - Nuevo: ${montoNuevo} (${formaPagoNueva}) -> Cuenta: ${cuentaNueva?.nombre || 'N/A'}`);

      const fueEfectivo = gastoOriginal.formaPago !== 'TARJETA';
      const esEfectivoAhora = formaPagoNueva !== 'TARJETA';

      if (fueEfectivo && cuentaOrig) {
        if (esEfectivoAhora && cuentaNueva && cuentaOrig.id === cuentaNueva.id) {
          const diff = gastoOriginal.monto - montoNuevo;
          if (diff !== 0) {
            console.log(`[actualizarGastoDiario] Ajuste NETO en ${cuentaOrig.nombre}: ${diff}`);
            await actualizarCuenta(cuentaOrig.id, { saldoActual: cuentaOrig.saldoActual + diff });

            await FinanzasService.eliminarMovimientosPorReferencia(id);
            await FinanzasService.registrarMovimiento({
              cuentaId: cuentaOrig.id,
              fecha: cambios.fecha || gastoOriginal.fecha || getFechaHoy(),
              descripcion: cambios.descripcion || gastoOriginal.descripcion,
              monto: montoNuevo,
              tipo: 'salida',
              origen: 'gasto_diario',
              referenciaId: id,
              detalle: cambios.detalle || gastoOriginal.detalle || undefined,
            });
          }
        } else {
          console.log(`[actualizarGastoDiario] Revirtiendo ${gastoOriginal.monto} en ${cuentaOrig.nombre}`);
          await actualizarCuenta(cuentaOrig.id, { saldoActual: cuentaOrig.saldoActual + gastoOriginal.monto });
          await FinanzasService.eliminarMovimientosPorReferencia(id);

          if (esEfectivoAhora && cuentaNueva) {
            console.log(`[actualizarGastoDiario] Aplicando nuevo monto ${montoNuevo} en ${cuentaNueva.nombre}`);
            await actualizarCuenta(cuentaNueva.id, { saldoActual: cuentaNueva.saldoActual - montoNuevo });
            await FinanzasService.registrarMovimiento({
              cuentaId: cuentaNueva.id,
              fecha: cambios.fecha || gastoOriginal.fecha || getFechaHoy(),
              descripcion: cambios.descripcion || gastoOriginal.descripcion,
              monto: montoNuevo,
              tipo: 'salida',
              origen: 'gasto_diario',
              referenciaId: id,
              detalle: cambios.detalle || gastoOriginal.detalle || undefined,
            });
          }
        }
      }
      else if (!fueEfectivo && esEfectivoAhora && cuentaNueva) {
        console.log(`[actualizarGastoDiario] Cambio Tarjeta -> Efectivo. Descontando ${montoNuevo} de ${cuentaNueva.nombre}`);
        await actualizarCuenta(cuentaNueva.id, { saldoActual: cuentaNueva.saldoActual - montoNuevo });
        await FinanzasService.registrarMovimiento({
          cuentaId: cuentaNueva.id,
          fecha: cambios.fecha || gastoOriginal.fecha || getFechaHoy(),
          descripcion: cambios.descripcion || gastoOriginal.descripcion,
          monto: montoNuevo,
          tipo: 'salida',
          origen: 'gasto_diario',
          referenciaId: id,
          detalle: cambios.detalle || gastoOriginal.detalle || undefined,
        });
      }

      return true;
    } catch (error) {
      console.error('Error actualizando gasto diario:', error);
      throw error;
    }
  }, [estado.gastosDiarios, estado.cuentas, resolverCuentaDeSaldo, actualizarCuenta]);

  const eliminarGastoDiario = useCallback(async (id: string) => {
    try {
      const gastoAEliminar = estado.gastosDiarios.find(g => g.id === id);

      const success = await FinanzasService.eliminarGastoDiario(id);

      if (success && gastoAEliminar) {
        if (gastoAEliminar.pagoTarjetaId) {
          console.log('[useFinanzas] Revirtiendo estado de tarjeta PAGADA:', gastoAEliminar.pagoTarjetaId);
          await actualizarTarjeta(gastoAEliminar.pagoTarjetaId, {
            pagada: false
          });
        }

        if (gastoAEliminar.formaPago !== 'TARJETA') {
          const cuentaActual = resolverCuentaDeSaldo(gastoAEliminar.cuentaId, gastoAEliminar.formaPago);

          if (cuentaActual) {
            const cotizacion = estado.cotizacionDolar?.venta || 1350;
            let montoAReembolsar = Number(gastoAEliminar.monto);

            if (gastoAEliminar.montoUSD && gastoAEliminar.montoUSD > 0) {
              if (cuentaActual.moneda === 'ARS') {
                montoAReembolsar += (gastoAEliminar.montoUSD * cotizacion);
              } else {
                montoAReembolsar = (montoAReembolsar / cotizacion) + gastoAEliminar.montoUSD;
              }
            }

            const nuevoSaldo = Number(cuentaActual.saldoActual) + montoAReembolsar;

            console.log(`[eliminarGastoDiario] REEMBOLSANDO:
              - Cuenta: ${cuentaActual.nombre}
              - Monto: ${montoAReembolsar}
              - Nuevo Saldo: ${nuevoSaldo}`);

            await actualizarCuenta(cuentaActual.id, { saldoActual: nuevoSaldo });

            await FinanzasService.eliminarMovimientosPorReferencia(id);
          }
        }

        if (gastoAEliminar.codigoOperacion) {
          const consumosRelacionados = estado.consumosTarjetas.filter(c => c.codigoOperacion === gastoAEliminar.codigoOperacion);
          for (const consumo of consumosRelacionados) {
            await FinanzasService.eliminarConsumoTarjeta(consumo.id);
          }
          if (consumosRelacionados.length > 0) {
            setEstado(prev => ({
              ...prev,
              consumosTarjetas: prev.consumosTarjetas.filter(c => c.codigoOperacion !== gastoAEliminar.codigoOperacion)
            }));
          }
        }

        setEstado(prev => ({
          ...prev,
          gastosDiarios: prev.gastosDiarios.filter(g => g.id !== id),
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error eliminando gasto diario:', error);
      throw error;
    }
  }, [estado.gastosDiarios, estado.cuentas, estado.consumosTarjetas, actualizarCuenta, actualizarTarjeta, resolverCuentaDeSaldo]);

  // === PRÉSTAMOS ===
  const agregarPrestamo = useCallback(async (prestamo: Omit<Prestamo, 'id'>) => {
    try {
      const nuevoPrestamo = await FinanzasService.crearPrestamo(prestamo);
      if (nuevoPrestamo) {
        setEstado(prev => ({
          ...prev,
          prestamos: [...prev.prestamos, nuevoPrestamo],
        }));
      }
    } catch (error) {
      console.error('Error agregando préstamo:', error);
    }
  }, []);

  const actualizarPrestamo = useCallback(async (id: string, cambios: Partial<Prestamo>) => {
    try {
      const success = await FinanzasService.actualizarPrestamo(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          prestamos: prev.prestamos.map(prestamo =>
            prestamo.id === id ? { ...prestamo, ...cambios } : prestamo
          ),
        }));
      }
    } catch (error) {
      console.error('Error actualizando préstamo:', error);
    }
  }, []);

  const eliminarPrestamo = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarPrestamo(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          prestamos: prev.prestamos.filter(prestamo => prestamo.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error eliminando préstamo:', error);
    }
  }, []);

  // === PLANES DE AHORRO ===
  const agregarPlanAhorro = useCallback(async (plan: Omit<PlanAhorro, 'id'>) => {
    try {
      const nuevoPlan = await FinanzasService.crearPlanAhorro(plan);
      if (nuevoPlan) {
        setEstado(prev => ({
          ...prev,
          planesAhorro: [...prev.planesAhorro, nuevoPlan],
        }));
      }
    } catch (error) {
      console.error('Error agregando plan de ahorro:', error);
    }
  }, []);

  const actualizarPlanAhorro = useCallback(async (id: string, cambios: Partial<PlanAhorro>) => {
    try {
      const success = await FinanzasService.actualizarPlanAhorro(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          planesAhorro: prev.planesAhorro.map(plan =>
            plan.id === id ? { ...plan, ...cambios } : plan
          ),
        }));
      }
    } catch (error) {
      console.error('Error actualizando plan de ahorro:', error);
    }
  }, []);

  const eliminarPlanAhorro = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarPlanAhorro(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          planesAhorro: prev.planesAhorro.filter(plan => plan.id !== id),
        }));
      }
    } catch (error) {
      console.error('Error eliminando plan de ahorro:', error);
    }
  }, []);

  // === CONFIGURACIONES ===
  const agregarCuentaBancaria = useCallback(async (cuenta: Omit<CuentaBancaria, 'id'>) => {
    try {
      const nuevaCuenta = await FinanzasService.crearCuentaBancaria(cuenta);
      if (nuevaCuenta) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            cuentasBancarias: [...prev.configuracion.cuentasBancarias, nuevaCuenta],
          },
        }));
      }
    } catch (error) {
      console.error('Error agregando cuenta bancaria:', error);
    }
  }, []);

  const actualizarCuentaBancaria = useCallback(async (id: string, cambios: Partial<CuentaBancaria>) => {
    try {
      const success = await FinanzasService.actualizarCuentaBancaria(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            cuentasBancarias: prev.configuracion.cuentasBancarias.map(cuenta =>
              cuenta.id === id ? { ...cuenta, ...cambios } : cuenta
            ),
          },
        }));
      }
    } catch (error) {
      console.error('Error actualizando cuenta bancaria:', error);
    }
  }, []);

  const eliminarCuentaBancaria = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarCuentaBancaria(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            cuentasBancarias: prev.configuracion.cuentasBancarias.filter(cuenta => cuenta.id !== id),
          },
        }));
      }
    } catch (error) {
      console.error('Error eliminando cuenta bancaria:', error);
    }
  }, []);

  // Categorías
  const agregarCategoria = useCallback(async (categoria: Omit<ConfiguracionCategoria, 'id'>) => {
    try {
      const nuevaCategoria = await FinanzasService.crearCategoria(categoria);
      if (nuevaCategoria) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            categorias: [...prev.configuracion.categorias, nuevaCategoria],
          },
        }));
      }
    } catch (error) {
      console.error('Error agregando categoría:', error);
    }
  }, []);

  const actualizarCategoria = useCallback(async (id: string, cambios: Partial<ConfiguracionCategoria>) => {
    try {
      const success = await FinanzasService.actualizarCategoria(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            categorias: prev.configuracion.categorias.map(categoria =>
              categoria.id === id ? { ...categoria, ...cambios } : categoria
            ),
          },
        }));
      }
    } catch (error) {
      console.error('Error actualizando categoría:', error);
    }
  }, []);

  const eliminarCategoria = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarCategoria(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            categorias: prev.configuracion.categorias.filter(categoria => categoria.id !== id),
          },
        }));
      }
    } catch (error) {
      console.error('Error eliminando categoría:', error);
    }
  }, []);

  // Sueldos
  const agregarSueldo = useCallback(async (sueldo: Omit<Sueldo, 'id'>) => {
    try {
      const nuevoSueldo = await FinanzasService.crearSueldo(sueldo);
      if (nuevoSueldo) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            sueldos: [...prev.configuracion.sueldos, nuevoSueldo],
          },
        }));
      }
    } catch (error) {
      console.error('Error agregando sueldo:', error);
    }
  }, []);

  const actualizarSueldo = useCallback(async (id: string, cambios: Partial<Sueldo>) => {
    try {
      const success = await FinanzasService.actualizarSueldo(id, cambios);
      if (success) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            sueldos: prev.configuracion.sueldos.map(sueldo =>
              sueldo.id === id ? { ...sueldo, ...cambios } : sueldo
            ),
          },
        }));
      }
    } catch (error) {
      console.error('Error actualizando sueldo:', error);
    }
  }, []);

  const eliminarSueldo = useCallback(async (id: string) => {
    try {
      const success = await FinanzasService.eliminarSueldo(id);
      if (success) {
        setEstado(prev => ({
          ...prev,
          configuracion: {
            ...prev.configuracion,
            sueldos: prev.configuracion.sueldos.filter(sueldo => sueldo.id !== id),
          },
        }));
      }
    } catch (error) {
      console.error('Error eliminando sueldo:', error);
    }
  }, []);

  // Formas de Pago
  const actualizarFormaPago = useCallback(async (codigo: string, cambios: Partial<ConfiguracionFormaPago>) => {
    try {
      const nuevasFormas = estado.configuracion.formasDePago.map(f =>
        f.codigo === codigo ? { ...f, ...cambios } : f
      );

      setEstado(prev => ({
        ...prev,
        configuracion: {
          ...prev.configuracion,
          formasDePago: nuevasFormas,
        },
      }));

      await FinanzasService.guardarConfiguracion('formas_de_pago', nuevasFormas);
      return true;
    } catch (error) {
      console.error('Error actualizando forma de pago:', error);
      return false;
    }
  }, [estado.configuracion.formasDePago]);

  // === UTILIDADES ===
  const limpiarTodosLosDatos = useCallback(() => {
    localStorage.clear();
    setEstado({
      cuentas: [],
      gastosFijos: [],
      gastosDiarios: [],
      tarjetas: [],
      consumosTarjetas: [],
      prestamos: [],
      planesAhorro: [],
      cotizacionDolar: null,
      configuracion: {
        tipoDolarSeleccionado: 'blue',
        cuentasBancarias: [],
        categorias: [],
        formasDePago: [],
        sueldos: [],
      },
    });
  }, []);

  const exportarDatos = useCallback(() => {
    return JSON.stringify(estado, null, 2);
  }, [estado]);

  const importarDatos = useCallback((datosJson: string) => {
    try {
      const datos: AppState = JSON.parse(datosJson);
      setEstado(datos);
      return true;
    } catch (error) {
      console.error('Error importando datos:', error);
      return false;
    }
  }, []);

  const generarConsumosFijosMesActual = useCallback(async () => {
    try {
      const ahora = new Date();
      const añoMes = `${ahora.getFullYear()}-${(ahora.getMonth() + 1).toString().padStart(2, '0')}`;

      const consumosGenerados = await FinanzasService.generarConsumosFijosPorMes(añoMes);

      if (consumosGenerados.length > 0) {
        setEstado(prev => ({
          ...prev,
          consumosTarjetas: [...prev.consumosTarjetas, ...consumosGenerados],
        }));

        console.log(`Se generaron ${consumosGenerados.length} consumos fijos para el mes ${añoMes}`);
        return consumosGenerados.length;
      }

      return 0;
    } catch (error) {
      console.error('Error generando consumos fijos:', error);
      return 0;
    }
  }, []);

  const verificarYGenerarGastosFijos = useCallback(async () => {
    try {
      const consumosFijos = await FinanzasService.obtenerConsumosFijos();

      if (consumosFijos.length > 0) {
        const ahora = new Date();
        const añoMesActual = `${ahora.getFullYear()}-${(ahora.getMonth() + 1).toString().padStart(2, '0')}`;

        const generadosActual = await FinanzasService.generarConsumosFijosPorMes(añoMesActual);

        const proximoMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1);
        const añoMesProximo = `${proximoMes.getFullYear()}-${(proximoMes.getMonth() + 1).toString().padStart(2, '0')}`;
        const generadosProximo = await FinanzasService.generarConsumosFijosPorMes(añoMesProximo);

        const totalGenerados = [...generadosActual, ...generadosProximo];

        if (totalGenerados.length > 0) {
          setEstado(prev => ({
            ...prev,
            consumosTarjetas: [...prev.consumosTarjetas, ...totalGenerados],
          }));

          console.log(`Se generaron automáticamente ${totalGenerados.length} gastos fijos`);
        }
      }

      return 0;
    } catch (error) {
      console.error('Error verificando gastos fijos:', error);
      return 0;
    }
  }, []);

  return {
    // Estado
    ...estado,
    loading,

    // Cuentas
    agregarCuenta,
    actualizarCuenta,
    eliminarCuenta,

    // Gastos Fijos
    agregarGastoFijo,
    actualizarGastoFijo,
    eliminarGastoFijo,

    // Tarjetas
    agregarTarjeta,
    actualizarTarjeta,
    eliminarTarjeta,

    // Consumos
    agregarConsumo,
    actualizarConsumo,
    eliminarConsumo,

    // Gastos Diarios
    agregarGastoDiario,
    crearGastoDiarioSinConsumo,
    actualizarGastoDiario,
    eliminarGastoDiario,

    // Préstamos
    agregarPrestamo,
    actualizarPrestamo,
    eliminarPrestamo,

    // Configuraciones
    agregarCuentaBancaria,
    actualizarCuentaBancaria,
    eliminarCuentaBancaria,
    agregarCategoria,
    actualizarCategoria,
    eliminarCategoria,
    agregarSueldo,
    actualizarSueldo,
    eliminarSueldo,

    // Utilidades
    recargarDatos,
    recargarGastosFijos,
    recargarConsumosTarjetas,
    limpiarTodosLosDatos,
    exportarDatos,
    importarDatos,
    generarConsumosFijosMesActual,
    verificarYGenerarGastosFijos,

    // Planes de Ahorro
    agregarPlanAhorro,
    actualizarPlanAhorro,
    eliminarPlanAhorro,

    // Movimientos de cuenta
    registrarMovimiento: FinanzasService.registrarMovimiento.bind(FinanzasService),
    registrarMovimientoManual,
    actualizarMovimientoManual,
    eliminarMovimientoManual,
    transferirDinero,
    resolverCuentaDeSaldo,
    actualizarFormaPago,
  };
};
