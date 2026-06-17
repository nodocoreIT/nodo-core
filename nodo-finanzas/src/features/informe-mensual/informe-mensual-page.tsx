import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  BarChart2,
  PieChart as PieChartIcon,
  TrendingUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useFinanzas } from '@/hooks/use-finanzas';
import { useRubros } from '@/hooks/use-rubros';
import { formatearMoneda } from '@/utils/formatters';

const COLORS = [
  '#3b82f6', '#059669', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#4ade80', '#fb7185', '#38bdf8', '#fb923c', '#a78bfa',
  '#2dd4bf', '#fbbf24', '#f472b6', '#475569', '#94a3b8',
];

function normalizarNombre(nombre: string): string {
  if (!nombre) return '';
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  label?: string;
  totalMensual: number;
}

function CustomTooltip({ active, payload, label, totalMensual }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const nombre = (data.name as string) || `Día ${(data.fecha as string) || label}`;
  const monto = data.value !== undefined ? (data.value as number) : (data.monto as number);

  return (
    <div className="bg-white p-4 border border-mist shadow-md rounded-xl">
      <p className="text-xs font-bold text-slate2 uppercase tracking-widest mb-2 border-b border-mist pb-2">
        {nombre}
      </p>
      <p className="text-lg font-bold text-brand">
        {formatearMoneda(monto, 'ARS')}
      </p>
      {totalMensual > 0 && data.value !== undefined && (
        <p className="text-[10px] font-medium text-slate2 mt-1">
          {((monto / totalMensual) * 100).toFixed(1)}% del total
        </p>
      )}
    </div>
  );
}

export function InformeMensualPage() {
  const { gastosDiarios } = useFinanzas();
  const { rubrosActivos } = useRubros();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const [filtroMes, setFiltroMes] = useState(() => {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
  });

  const opcionesMeses = useMemo(() => {
    const opciones: Array<{ value: string; label: string }> = [];
    const hoy = new Date();
    for (let i = 0; i < 12; i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const valor = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const etiqueta = fecha.toLocaleDateString('es-AR', { year: 'numeric', month: 'long' });
      opciones.push({ value: valor, label: etiqueta });
    }
    return opciones;
  }, []);

  const mesActualLabel = useMemo(() => {
    return opcionesMeses.find((m) => m.value === filtroMes)?.label || filtroMes;
  }, [filtroMes, opcionesMeses]);

  const gastosMes = useMemo(() => {
    return gastosDiarios.filter((g) => {
      if (g.esSilencioso) return false;
      const mesReferencia =
        g.formaPago === 'TARJETA' && g.pagoTarjetaMes
          ? g.pagoTarjetaMes
          : g.fecha.slice(0, 7);
      return mesReferencia === filtroMes;
    });
  }, [gastosDiarios, filtroMes]);

  const datosRubro = useMemo(() => {
    const agrupar = gastosMes.reduce<Record<string, { value: number; id?: string }>>(
      (acc, gasto) => {
        let nombreRubro = 'Otros';
        let rubroId: string | undefined = undefined;

        if (gasto.rubroInfo) {
          nombreRubro = normalizarNombre(gasto.rubroInfo.nombre);
          rubroId = gasto.rubroId;
        } else if (gasto.rubro) {
          const codigoBuscado = gasto.rubro.toUpperCase();
          const rubroObj = rubrosActivos.find((r) => r.codigo === codigoBuscado);
          nombreRubro = rubroObj ? normalizarNombre(rubroObj.nombre) : gasto.rubro;
          rubroId = rubroObj?.id;
        }

        if (!acc[nombreRubro]) {
          acc[nombreRubro] = { value: 0, id: rubroId };
        }
        acc[nombreRubro].value += gasto.monto;
        return acc;
      },
      {}
    );

    const rawData = Object.entries(agrupar)
      .map(([name, data]) => ({ name, value: data.value, id: data.id }))
      .sort((a, b) => b.value - a.value);

    const totalGasto = rawData.reduce((sum, item) => sum + item.value, 0);
    const finalData: Array<{ name: string; value: number; id?: string }> = [];
    let otrosValue = 0;

    rawData.forEach((item, index) => {
      const porcentaje = (item.value / totalGasto) * 100;
      if (porcentaje >= 3 || index < 8) {
        finalData.push(item);
      } else {
        otrosValue += item.value;
      }
    });

    if (otrosValue > 0) {
      finalData.push({ name: 'Otras categorías', value: otrosValue, id: undefined });
    }

    return finalData;
  }, [gastosMes, rubrosActivos]);

  const datosMetodoPago = useMemo(() => {
    const agrupar = gastosMes.reduce<Record<string, number>>((acc, gasto) => {
      let metodo = gasto.formaPago
        ? gasto.formaPago.replace(/_/g, ' ').toLowerCase()
        : 'otros';
      metodo = metodo.charAt(0).toUpperCase() + metodo.slice(1);
      acc[metodo] = (acc[metodo] || 0) + gasto.monto;
      return acc;
    }, {});

    return Object.entries(agrupar)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [gastosMes]);

  const datosEvolucionDiaria = useMemo(() => {
    const diasDelMes: Record<string, number> = {};
    const [anio, mes] = filtroMes.split('-').map(Number);
    const ultimoDia = new Date(anio, mes, 0).getDate();

    for (let i = 1; i <= ultimoDia; i++) {
      const dia = String(i).padStart(2, '0');
      diasDelMes[`${filtroMes}-${dia}`] = 0;
    }

    gastosMes.forEach((gasto) => {
      if (diasDelMes[gasto.fecha] !== undefined) {
        diasDelMes[gasto.fecha] += gasto.monto;
      }
    });

    return Object.entries(diasDelMes).map(([fecha, monto]) => ({
      fecha: fecha.split('-')[2],
      monto,
      fullFecha: fecha,
    }));
  }, [gastosMes, filtroMes]);

  const totalMensual = useMemo(() => {
    return gastosMes.reduce((sum, g) => sum + g.monto, 0);
  }, [gastosMes]);

  const promedioDiario = useMemo(() => {
    const [anio, mes] = filtroMes.split('-').map(Number);
    const dias = new Date(anio, mes, 0).getDate();
    return dias > 0 ? totalMensual / dias : 0;
  }, [totalMensual, filtroMes]);

  const onPieEnter = (_: unknown, index: number) => setActiveIndex(index);
  const onPieLeave = () => setActiveIndex(null);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-brand rounded-xl shadow-sm">
            <BarChart2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-navy">Informe Mensual</h1>
            <p className="text-slate2 font-medium">Análisis de {mesActualLabel}</p>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2 bg-white border border-mist rounded-xl p-1 shadow-sm">
          <button
            onClick={() => {
              const idx = opcionesMeses.findIndex((o) => o.value === filtroMes);
              if (idx < opcionesMeses.length - 1) setFiltroMes(opcionesMeses[idx + 1].value);
            }}
            className="p-2 hover:bg-mist rounded-lg transition-colors text-slate2 hover:text-navy"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <select
            value={filtroMes}
            onChange={(e) => setFiltroMes(e.target.value)}
            className="text-sm font-bold text-navy bg-transparent focus:outline-none px-2 cursor-pointer appearance-none text-center min-w-[140px]"
          >
            {opcionesMeses.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const idx = opcionesMeses.findIndex((o) => o.value === filtroMes);
              if (idx > 0) setFiltroMes(opcionesMeses[idx - 1].value);
            }}
            className="p-2 hover:bg-mist rounded-lg transition-colors text-slate2 hover:text-navy"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <TrendingUp className="w-16 h-16 text-brand" />
          </div>
          <p className="text-xs font-bold text-slate2 uppercase tracking-widest mb-1">
            Gasto Total del Mes
          </p>
          <p className="text-3xl font-bold text-brand">{formatearMoneda(totalMensual, 'ARS')}</p>
          <div className="mt-4 flex items-center text-xs font-medium text-brand bg-mist w-fit px-2 py-1 rounded-lg">
            <Calendar className="w-3 h-3 mr-1" />
            {gastosMes.length} operaciones
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <BarChart2 className="w-16 h-16 text-slate2" />
          </div>
          <p className="text-xs font-bold text-slate2 uppercase tracking-widest mb-1">
            Promedio Diario
          </p>
          <p className="text-3xl font-bold text-navy">{formatearMoneda(promedioDiario, 'ARS')}</p>
          <p className="text-xs text-slate2 mt-4 font-medium">Calculado sobre los días del mes</p>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <PieChartIcon className="w-16 h-16 text-brand" />
          </div>
          <p className="text-xs font-bold text-slate2 uppercase tracking-widest mb-1">
            Mayor Categoría
          </p>
          <p className="text-3xl font-bold text-navy truncate">
            {datosRubro.length > 0 ? datosRubro[0].name : 'N/A'}
          </p>
          <p className="text-xs text-slate2 mt-4 font-medium">
            {datosRubro.length > 0 && totalMensual > 0
              ? `${((datosRubro[0].value / totalMensual) * 100).toFixed(1)}% del total`
              : 'Sin datos'}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart — Gastos por Rubro */}
        <Card className="overflow-hidden p-5">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-brand" />
            Gastos por Rubro
          </h3>
          <div className="h-[420px] w-full">
            {datosRubro.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={datosRubro}
                    cx="50%"
                    cy="50%"
                    innerRadius={100}
                    outerRadius={140}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                    isAnimationActive={false}
                    labelLine={false}
                    label={({
                      cx,
                      cy,
                      midAngle,
                      outerRadius: or,
                      index,
                      name,
                    }: {
                      cx: number;
                      cy: number;
                      midAngle: number;
                      outerRadius: number;
                      index: number;
                      name: string;
                    }) => {
                      const RADIAN = Math.PI / 180;
                      const sin = Math.sin(-RADIAN * midAngle);
                      const cos = Math.cos(-RADIAN * midAngle);
                      const sx = cx + (or + 5) * cos;
                      const sy = cy + (or + 5) * sin;
                      const mx = cx + (or + 20) * cos;
                      const my = cy + (or + 20) * sin;
                      const ex = mx + (cos >= 0 ? 1 : -1) * 12;
                      const ey = my;
                      const textAnchor = cos >= 0 ? 'start' : 'end';
                      const displayName = name.length > 18 ? name.slice(0, 16) + '…' : name;

                      return (
                        <g style={{ pointerEvents: 'none' }}>
                          <path
                            d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
                            stroke={COLORS[index % COLORS.length]}
                            fill="none"
                            strokeWidth={1}
                          />
                          <circle cx={ex} cy={ey} r={2} fill={COLORS[index % COLORS.length]} />
                          <text
                            x={ex + (cos >= 0 ? 1 : -1) * 4}
                            y={ey}
                            textAnchor={textAnchor}
                            dominantBaseline="central"
                            style={{
                              fontSize: activeIndex === index ? '10px' : '8px',
                              fontWeight: activeIndex === index ? 700 : 500,
                              fill: activeIndex === index ? '#0a1a14' : '#5f7a6e',
                            }}
                          >
                            {displayName}
                          </text>
                        </g>
                      );
                    }}
                  >
                    {datosRubro.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                      />
                    ))}
                  </Pie>

                  {/* Inner percentage labels */}
                  <Pie
                    data={datosRubro}
                    cx="50%"
                    cy="50%"
                    innerRadius={100}
                    outerRadius={140}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    isAnimationActive={false}
                    labelLine={false}
                    onMouseEnter={onPieEnter}
                    onMouseLeave={onPieLeave}
                    label={({
                      cx,
                      cy,
                      midAngle,
                      innerRadius: ir,
                      outerRadius: or,
                      value,
                    }: {
                      cx: number;
                      cy: number;
                      midAngle: number;
                      innerRadius: number;
                      outerRadius: number;
                      value: number;
                    }) => {
                      const pct = totalMensual > 0 ? (value / totalMensual) * 100 : 0;
                      if (pct < 3) return null;
                      const RADIAN = Math.PI / 180;
                      const radius = ir + (or - ir) * 0.5;
                      const x = cx + radius * Math.cos(-RADIAN * midAngle);
                      const y = cy + radius * Math.sin(-RADIAN * midAngle);
                      return (
                        <text
                          x={x}
                          y={y}
                          fill="white"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ fontSize: '10px', fontWeight: 700, pointerEvents: 'none' }}
                        >
                          {pct.toFixed(0)}%
                        </text>
                      );
                    }}
                  >
                    {datosRubro.map((_, index) => (
                      <Cell key={`cell-inner-${index}`} fill="transparent" />
                    ))}
                  </Pie>

                  {/* Center text */}
                  <g pointerEvents="none">
                    <text
                      x="50%"
                      y="46%"
                      textAnchor="middle"
                      style={{ fontSize: '9px', fontWeight: 700, fill: '#5f7a6e', textTransform: 'uppercase' }}
                    >
                      {activeIndex !== null
                        ? datosRubro[activeIndex].name.slice(0, 20)
                        : 'Gasto Total'}
                    </text>
                    <text
                      x="50%"
                      y="51%"
                      textAnchor="middle"
                      style={{ fontSize: '16px', fontWeight: 700, fill: '#0a1a14' }}
                    >
                      {activeIndex !== null
                        ? formatearMoneda(datosRubro[activeIndex].value, 'ARS')
                        : formatearMoneda(totalMensual, 'ARS')}
                    </text>
                    <text
                      x="50%"
                      y="56%"
                      textAnchor="middle"
                      style={{ fontSize: '9px', fontWeight: 500, fill: '#059669' }}
                    >
                      {activeIndex !== null && totalMensual > 0
                        ? `${((datosRubro[activeIndex].value / totalMensual) * 100).toFixed(1)}% del total`
                        : 'Este período'}
                    </text>
                  </g>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate2">
                <PieChartIcon className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">No hay datos para mostrar</p>
              </div>
            )}
          </div>
        </Card>

        {/* Bar chart — Métodos de pago */}
        <Card className="p-5">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2 mb-6">
            <CreditCard className="w-5 h-5 text-brand" />
            Métodos de Pago
          </h3>
          <div className="h-[420px] w-full">
            {datosMetodoPago.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosMetodoPago} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                    stroke="#dcfce7"
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={110}
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#5f7a6e' }}
                  />
                  <Tooltip
                    content={(props) => (
                      <CustomTooltip {...(props as unknown as CustomTooltipProps)} totalMensual={totalMensual} />
                    )}
                    cursor={{ fill: '#ecfdf5' }}
                  />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                    {datosMetodoPago.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate2">
                <CreditCard className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">No hay datos para mostrar</p>
              </div>
            )}
          </div>
        </Card>

        {/* Area chart — Evolución diaria */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-lg font-bold text-navy flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-brand" />
            Evolución Diaria de Gastos
          </h3>
          <div className="h-[280px] w-full">
            {datosEvolucionDiaria.some((d) => d.monto > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={datosEvolucionDiaria}>
                  <defs>
                    <linearGradient id="colorMonto" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dcfce7" />
                  <XAxis
                    dataKey="fecha"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#9dbdb4' }}
                    interval={0}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#9dbdb4' }}
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    content={(props) => (
                      <CustomTooltip {...(props as unknown as CustomTooltipProps)} totalMensual={totalMensual} />
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="monto"
                    stroke="#059669"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorMonto)"
                    activeDot={{ r: 6, strokeWidth: 0 }}
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate2">
                <TrendingUp className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">No hay datos para mostrar</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Desglose por Rubro — table */}
      <Card className="overflow-hidden p-0">
        <div className="px-6 py-4 border-b border-mist bg-mist/30">
          <h3 className="text-lg font-bold text-navy">Desglose por Rubro</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-mist/20">
                <th className="px-6 py-3 text-xs font-bold text-slate2 uppercase tracking-widest">
                  Rubro
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate2 uppercase tracking-widest text-right">
                  Monto Total
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate2 uppercase tracking-widest text-right">
                  % del Total
                </th>
                <th className="px-6 py-3 text-xs font-bold text-slate2 uppercase tracking-widest text-center">
                  Progreso
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist text-sm">
              {datosRubro.map((item, index) => {
                const porcentaje = totalMensual > 0 ? (item.value / totalMensual) * 100 : 0;
                return (
                  <tr key={item.name} className="hover:bg-mist/20 transition-colors group">
                    <td className="px-6 py-4 font-medium text-navy">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        {item.name}
                        {item.id && (
                          <ArrowRight className="w-3 h-3 text-brand opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-brand">
                      {formatearMoneda(item.value, 'ARS')}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate2">
                      {porcentaje.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full bg-mist rounded-full h-2 max-w-[120px] mx-auto overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${porcentaje}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {datosRubro.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate2 font-medium italic">
                    No hay gastos registrados en este período
                  </td>
                </tr>
              )}
            </tbody>
            {datosRubro.length > 0 && (
              <tfoot>
                <tr className="bg-mist/20 font-bold border-t border-mist">
                  <td className="px-6 py-4 text-navy">TOTAL</td>
                  <td className="px-6 py-4 text-right text-brand">
                    {formatearMoneda(totalMensual, 'ARS')}
                  </td>
                  <td className="px-6 py-4 text-right text-navy">100%</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
