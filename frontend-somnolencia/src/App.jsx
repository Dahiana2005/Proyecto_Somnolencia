import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Activity, History, BarChart3, AlertTriangle, Play, Square, Clock, ShieldAlert } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

function App() {
  const [vistaActiva, setVistaActiva] = useState('monitoreo');
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Estados para simular el Trayecto Activo
  const [enTrayecto, setEnTrayecto] = useState(false);
  const [segundosTrayecto, setSegundosTrayecto] = useState(0);
  const timerRef = useRef(null);

  const obtenerDatos = async () => {
    try {
      const respuesta = await fetch('http://127.0.0.1:8000/api/eventos');
      const datos = await respuesta.json();
      setEventos(datos);
      setCargando(false);
    } catch (error) {
      console.error("Error API:", error);
      setCargando(false);
    }
  };

  useEffect(() => {
    obtenerDatos();
    const intervalo = setInterval(obtenerDatos, 3000);
    return () => clearInterval(intervalo);
  }, []);

  // Lógica del cronómetro de trayecto
  const iniciarTrayecto = () => {
    if (!enTrayecto) {
      setEnTrayecto(true);
      setSegundosTrayecto(0);
      timerRef.current = setInterval(() => {
        setSegundosTrayecto((prev) => prev + 1);
      }, 1000);
    }
  };

  const finalizarTrayecto = () => {
    setEnTrayecto(false);
    clearInterval(timerRef.current);
  };

  const formatearTiempo = (totalSegundos) => {
    const horas = Math.floor(totalSegundos / 3600);
    const minutos = Math.floor((totalSegundos % 3600) / 60);
    const segundos = totalSegundos % 60;
    return `${horas.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}:${segundos.toString().padStart(2, '0')}`;
  };

  // --- COMPONENTES DE PANTALLAS ---

  const PantallaMonitoreo = () => {
    const ultimoEvento = eventos.length > 0 ? eventos[0] : null;
    const esAlerta = ultimoEvento?.estado === 'Alerta de Somnolencia';

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800">Monitoreo en Vivo</h2>
            {enTrayecto && (
              <span className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-semibold border border-indigo-200 animate-pulse">
                <Clock size={16} /> {formatearTiempo(segundosTrayecto)}
              </span>
            )}
          </div>
          <div className="flex gap-4">
            {!enTrayecto ? (
              <button onClick={iniciarTrayecto} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition shadow-sm">
                <Play size={18} /> Iniciar Trayecto
              </button>
            ) : (
              <button onClick={finalizarTrayecto} className="flex items-center gap-2 bg-rose-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-rose-700 transition shadow-sm">
                <Square size={18} /> Finalizar Trayecto
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-slate-900 rounded-xl aspect-video flex items-center justify-center overflow-hidden border-4 border-slate-800 relative shadow-lg">
            <img 
              src="http://127.0.0.1:8000/api/video_feed" 
              alt="Señal de Video IoT" 
              className="w-full h-full object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            <div className="absolute top-4 left-4 bg-black/60 text-white px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 border border-slate-700">
              <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
              LIVE STREAM
            </div>
            {!enTrayecto && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center text-white z-10">
                <Play className="text-white/50 mb-4" size={48} />
                <p className="text-lg font-semibold">Sistema en espera</p>
                <p className="text-sm text-slate-300">Inicia el trayecto para registrar telemetría</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className={`p-6 rounded-xl border shadow-sm text-center transition-colors duration-300 ${esAlerta && enTrayecto ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200'}`}>
              <h3 className="text-sm font-semibold text-slate-500 uppercase mb-4">Estado del Conductor</h3>
              <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full border-8 font-bold text-xl transition-all duration-300 shadow-inner ${
                !enTrayecto ? 'border-slate-300 bg-slate-100 text-slate-400' :
                esAlerta 
                  ? 'border-rose-500 bg-rose-100 text-rose-700 animate-pulse' 
                  : 'border-emerald-500 bg-emerald-100 text-emerald-700'
              }`}>
                {!enTrayecto ? 'PAUSA' : (esAlerta ? 'SOMNOLENCIA' : 'ATENTO')}
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Probabilidad de cierre</span>
                <span className="font-mono font-bold text-indigo-600">
                  {enTrayecto && ultimoEvento?.score ? (ultimoEvento.score * 100).toFixed(1) + '%' : '0.0%'}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-500">Última lectura</span>
                <span className="font-mono font-bold text-slate-700 text-xs mt-1">
                  {enTrayecto && ultimoEvento?.timestamp ? ultimoEvento.timestamp.split(' ')[1] : '--:--:--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PantallaHistorial = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Historial de Eventos</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs tracking-wider">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Fecha y Hora</th>
                <th className="px-6 py-4">Estado Detectado</th>
                <th className="px-6 py-4">Detalle Técnico</th>
                <th className="px-6 py-4 text-right">Gravedad (Score)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {eventos.map((evento) => (
                <tr key={evento.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-400">#{evento.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-700">{evento.timestamp}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      evento.estado === 'Alerta de Somnolencia' ? 'bg-rose-100 text-rose-800' : 
                      evento.estado === 'Normal' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {evento.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{evento.detalle}</td>
                  <td className="px-6 py-4 text-right font-medium text-slate-900">
                    {evento.score > 0 ? (evento.score * 100).toFixed(1) + '%' : '-'}
                  </td>
                </tr>
              ))}
              {eventos.length === 0 && (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-400">No hay registros en la base de datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const PantallaEstadisticas = () => {
    const alertas = eventos.filter(e => e.estado === 'Alerta de Somnolencia');
    const normales = eventos.filter(e => e.estado === 'Normal');
    const sinRostro = eventos.filter(e => e.estado === 'Sin Rostro');

    const datosDistribucion = [
      { name: 'Normal', value: normales.length, color: '#10b981' },
      { name: 'Alerta Somnolencia', value: alertas.length, color: '#f43f5e' },
      { name: 'Sin Rostro', value: sinRostro.length, color: '#f59e0b' }
    ].filter(d => d.value > 0);

    const datosTendencia = eventos.slice(0, 20).reverse().map(e => ({
      hora: e.timestamp.split(' ')[1],
      probabilidad: Math.round(e.score * 100)
    }));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Estadísticas y Tendencias</h2>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Distribución de Estados</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie cx="50%" cy="50%" data={datosDistribucion} dataKey="value" innerRadius={60} outerRadius={80} paddingAngle={5}>
                    {datosDistribucion.map((entry, index) => (
                      <Cell fill={entry.color} key={`cell-${index}`} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} eventos`, 'Cantidad']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4 text-sm">
              {datosDistribucion.map(d => (
                <div key={d.name} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div><span className="text-slate-600">{d.name}</span></div>
              ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Evolución de Probabilidad (Últimos Eventos)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={datosTendencia}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hora" hide />
                  <YAxis domain={[0, 100]} axisLine={false} fontSize={12} stroke="#64748b" tickFormatter={(v) => `${v}%`} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', border: 'none' }} />
                  <Line type="monotone" dataKey="probabilidad" stroke="#4f46e5" strokeWidth={3} activeDot={{ r: 6, fill: '#4f46e5' }} dot={{ r: 3, fill: '#4f46e5' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const PantallaPanelGeneral = () => {
    const alertas = eventos.filter(e => e.estado === 'Alerta de Somnolencia');
    
    // Agrupar TODOS los eventos (Normal, Alerta, Sin Rostro) por hora
    const datosGrafico = eventos.reduce((acc, evento) => {
      if (!evento.timestamp) return acc;
      const horaExacta = evento.timestamp.split(' ')[1].split(':')[0] + ':00';
      const existente = acc.find(item => item.hora === horaExacta);
      
      if (existente) {
        if (evento.estado === 'Alerta de Somnolencia') existente.alertas += 1;
        else if (evento.estado === 'Normal') existente.normales += 1;
        else existente.sinRostro += 1;
      } else {
        acc.push({ 
          hora: horaExacta, 
          alertas: evento.estado === 'Alerta de Somnolencia' ? 1 : 0,
          normales: evento.estado === 'Normal' ? 1 : 0,
          sinRostro: (evento.estado !== 'Alerta de Somnolencia' && evento.estado !== 'Normal') ? 1 : 0
        });
      }
      return acc;
    }, []).sort((a, b) => a.hora.localeCompare(b.hora));

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Panel General</h2>
        <div className="grid grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Eventos Totales</h3>
            <p className="text-3xl font-black text-slate-700 mt-2">{eventos.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alertas Históricas</h3>
            <p className="text-3xl font-black text-rose-600 mt-2">{alertas.length}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Última Alerta</h3>
            <p className="text-xl font-bold text-slate-700 mt-4 font-mono">{alertas.length > 0 ? alertas[0].timestamp.split(' ')[1] : '--:--'}</p>
          </div>
          <div className="bg-white p-6 rounded-xl border border-indigo-200 bg-indigo-50 shadow-sm">
            <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider flex items-center gap-2"><ShieldAlert size={14} /> Estado General</h3>
            <p className="text-xl font-black text-indigo-700 mt-3">{alertas.length > 10 ? 'Riesgo Alto' : 'Óptimo'}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Actividad y Alertas por Franja Horaria</h3>
          <div className="h-72 w-full">
            {datosGrafico.length > 0 ? (
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={datosGrafico}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hora" axisLine={false} fontSize={12} stroke="#64748b" tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} fontSize={12} stroke="#64748b" tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }} cursor={{ fill: '#f1f5f9' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                  
                  {/* Barras apiladas (stackId="a" agrupa las columnas) */}
                  <Bar dataKey="normales" name="Atento (Normal)" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={40} />
                  <Bar dataKey="sinRostro" name="Sin Rostro" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={40} />
                  <Bar dataKey="alertas" name="Somnolencia" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">Sin actividad registrada</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // --- RENDERIZADO DEL LAYOUT ---
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <AlertTriangle className="text-indigo-500" />
          <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Entorno<br/>Convergente</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button onClick={() => setVistaActiva('monitoreo')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${vistaActiva === 'monitoreo' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Activity size={20} /> Monitoreo en vivo
          </button>
          <button onClick={() => setVistaActiva('panel')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${vistaActiva === 'panel' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20} /> Panel general
          </button>
          <button onClick={() => setVistaActiva('historial')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${vistaActiva === 'historial' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <History size={20} /> Historial eventos
          </button>
          <button onClick={() => setVistaActiva('estadisticas')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${vistaActiva === 'estadisticas' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <BarChart3 size={20} /> Estadísticas
          </button>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shadow-sm z-10">
           <div className="text-sm font-semibold text-slate-500">Módulo IoT - Visión Artificial</div>
           <span className="text-sm text-slate-500 font-medium">Estado Backend: <span className="text-emerald-600">Conectado (PostgreSQL)</span></span>
        </header>
        <div className="flex-1 overflow-auto p-8">
          {vistaActiva === 'monitoreo' && <PantallaMonitoreo />}
          {vistaActiva === 'panel' && <PantallaPanelGeneral />}
          {vistaActiva === 'historial' && <PantallaHistorial />}
          {vistaActiva === 'estadisticas' && <PantallaEstadisticas />}
        </div>
      </main>
    </div>
  );
}

export default App;