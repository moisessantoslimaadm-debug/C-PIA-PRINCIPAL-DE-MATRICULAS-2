
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Link } from '../router';
import { 
  Users, School, AlertTriangle, Bus, TrendingUp, PieChart, 
  Activity, CheckCircle, Clock, Baby, GraduationCap, Info, Map as MapIcon, Layers, Save, Download
} from 'lucide-react';
import { SchoolType } from '../types';
import { loadLeaflet } from '../services/leafletLoader';

// Declare Leaflet globally
declare const L: any;

// --- Interactive Donut Chart ---
const InteractiveDonutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  
  let cumulativePercent = 0;

  const getCoordinatesForPercent = (percent: number) => {
    const x = Math.cos(2 * Math.PI * percent);
    const y = Math.sin(2 * Math.PI * percent);
    return [x, y];
  };

  // Determine what text to show in the center
  const centerLabel = hoveredIndex !== null ? data[hoveredIndex].label : "Total";
  const centerValue = hoveredIndex !== null ? data[hoveredIndex].value : total;
  const centerPercent = hoveredIndex !== null ? ((data[hoveredIndex].value / total) * 100).toFixed(1) + "%" : "";

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">
      {/* Chart SVG */}
      <div 
        className="relative w-56 h-56 shrink-0 group" 
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <svg viewBox="-1.1 -1.1 2.2 2.2" className="transform -rotate-90 w-full h-full drop-shadow-sm">
          {data.map((slice, i) => {
            const startPercent = cumulativePercent;
            const slicePercent = slice.value / total;
            cumulativePercent += slicePercent;
            
            const [startX, startY] = getCoordinatesForPercent(startPercent);
            const [endX, endY] = getCoordinatesForPercent(cumulativePercent);
            const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

            // Handle 100% case
            if (slicePercent === 1) {
              return <circle key={i} cx="0" cy="0" r="1" fill={slice.color} onMouseEnter={() => setHoveredIndex(i)} />;
            }

            const pathData = `
              M 0 0
              L ${startX} ${startY}
              A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}
              Z
            `;

            const isHovered = hoveredIndex === i;
            const isDimmed = hoveredIndex !== null && hoveredIndex !== i;

            return (
              <path 
                key={i} 
                d={pathData} 
                fill={slice.color} 
                stroke="white" 
                strokeWidth="0.02"
                className={`transition-all duration-300 ease-out cursor-pointer ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
                style={{
                  transform: isHovered ? 'scale(1.08)' : 'scale(1)',
                  transformOrigin: 'center',
                  zIndex: isHovered ? 10 : 1
                }}
                onMouseEnter={() => setHoveredIndex(i)}
              />
            );
          })}
          {/* Inner Circle for Donut Effect */}
          <circle cx="0" cy="0" r="0.65" fill="white" className="pointer-events-none" />
        </svg>
        
        {/* Center Info */}
        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none transition-all duration-200 z-20">
          <span className={`text-xs uppercase font-bold tracking-wider mb-0.5 transition-colors ${hoveredIndex !== null ? 'text-blue-600' : 'text-slate-400'}`}>
            {centerLabel}
          </span>
          <span className="text-3xl font-extrabold text-slate-800 leading-none">
            {centerValue}
          </span>
          {hoveredIndex !== null && (
            <span className="text-sm font-medium text-slate-500 mt-1 animate-in fade-in slide-in-from-bottom-1">
              {centerPercent}
            </span>
          )}
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="space-y-3 w-full sm:w-auto">
        {data.map((item, i) => (
          <div 
            key={i} 
            className={`flex items-center justify-between gap-6 w-full p-2 rounded-lg cursor-pointer transition-all duration-200 ${hoveredIndex === i ? 'bg-slate-50 shadow-sm ring-1 ring-slate-100' : 'hover:bg-slate-50/50'}`}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="flex items-center gap-3">
              <div 
                className={`w-3 h-3 rounded-full transition-transform ${hoveredIndex === i ? 'scale-125' : ''}`} 
                style={{ backgroundColor: item.color }}
              ></div>
              <span className={`text-sm font-medium ${hoveredIndex === i ? 'text-slate-900' : 'text-slate-600'}`}>
                {item.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{item.value}</span>
                <span className="text-xs text-slate-400">({((item.value / total) * 100).toFixed(1)}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Interactive Bar Chart ---
const InteractiveBarChart: React.FC<{ data: { label: string; value: number }[]; colorClass: string; barColor: string }> = ({ data, colorClass, barColor }) => {
  const [mounted, setMounted] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  useEffect(() => {
    // Trigger animation after mount
    setTimeout(() => setMounted(true), 100);
  }, []);

  const maxValue = Math.max(...data.map(d => d.value));
  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);
  
  return (
    <div className="space-y-5">
      {data.map((item, index) => {
        const percent = (item.value / maxValue) * 100;
        const share = ((item.value / totalValue) * 100).toFixed(1);
        
        return (
          <div 
            key={index} 
            className="group relative"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Tooltip */}
            {hoveredIndex === index && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs py-1 px-2 rounded shadow-lg z-20 whitespace-nowrap animate-in zoom-in-95 duration-150 pointer-events-none">
                    {item.value} unidades ({share}%)
                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                </div>
            )}

            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
              <span className="group-hover:text-blue-600 transition-colors">{item.label}</span>
              <span className="group-hover:text-slate-900 transition-colors">{item.value}</span>
            </div>
            
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-out relative ${colorClass}`} 
                style={{ 
                  width: mounted ? `${percent}%` : '0%',
                  opacity: hoveredIndex !== null && hoveredIndex !== index ? 0.6 : 1,
                  backgroundColor: hoveredIndex === index ? undefined : barColor // Use explicit color or class
                }}
              >
                 {/* Shine effect on hover */}
                 <div className="absolute inset-0 bg-white/20 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
};

// --- Student Density Heatmap ---
const StudentDensityMap: React.FC = () => {
    const { students, schools } = useData();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const heatLayerRef = useRef<any>(null);
    const hasFitBoundsRef = useRef(false);
    const [viewType, setViewType] = useState<'all' | 'pending'>('all');
    const [isMapReady, setIsMapReady] = useState(false);

    // Initialize Map only after container is mounted and has dimensions
    useEffect(() => {
        if (!mapContainerRef.current) return;

        let isMounted = true;

        const initMap = async () => {
            try {
                await loadLeaflet();
                if (!isMounted) return;
                
                if (typeof L === 'undefined') return;

                // ResizeObserver to ensure map handles container resizes gracefully
                const resizeObserver = new ResizeObserver(() => {
                    if (mapRef.current) {
                        mapRef.current.invalidateSize();
                    }
                });
                resizeObserver.observe(mapContainerRef.current!);

                // Ensure container has dimensions before initializing
                const { clientWidth, clientHeight } = mapContainerRef.current!;
                if (clientWidth === 0 || clientHeight === 0) return;

                // Initialize Map
                if (!mapRef.current) {
                    const map = L.map(mapContainerRef.current!, {
                        zoomControl: true,
                        attributionControl: false
                    });
                    
                    // Initial view (fallback), will be overridden by fitBounds later
                    map.setView([-12.5253, -40.2917], 13);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap contributors'
                    }).addTo(map);
                    
                    mapRef.current = map;
                    
                    // Force update size after a tick to ensure correct rendering context
                    setTimeout(() => {
                        map.invalidateSize();
                        setIsMapReady(true);
                    }, 100);
                }
            } catch (e) {
                console.error("Map load failed", e);
            }
        };

        initMap();

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                setIsMapReady(false);
            }
        };
    }, []);

    // Handle Heatmap Layer updates
    useEffect(() => {
        if (!isMapReady || !mapRef.current) return;
        if (typeof L === 'undefined') return;

        // Safety check: Canvas drawing fails if container is 0x0
        if (mapContainerRef.current) {
             const { clientWidth, clientHeight } = mapContainerRef.current;
             if (clientWidth <= 0 || clientHeight <= 0) return;
        }

        // Extra safety check for Leaflet internal size to prevent "IndexSizeError"
        const size = mapRef.current.getSize();
        if (size.x <= 0 || size.y <= 0) return;

        // Generate Heat Points
        const points: any[] = [];
        const latLngs: any[] = [];
        
        const targetStudents = viewType === 'all' 
            ? students 
            : students.filter(s => s.status === 'Pendente' || s.status === 'Em Análise');

        targetStudents.forEach(s => {
            // Priority: Real Student Coordinates (from Geocoding)
            if (s.lat && s.lng) {
                 // Intensity: 0.5 default, higher if pending to highlight demand
                 const intensity = viewType === 'pending' ? 0.9 : 0.6;
                 points.push([s.lat, s.lng, intensity]);
                 latLngs.push([s.lat, s.lng]);
                 return;
            }

            // Fallback: School Location Jitter (for legacy data)
            if (!s.school || s.school === 'Não alocada') return;
            
            const school = schools.find(sc => sc.name === s.school);
            if (school) {
                // Apply Gaussian-ish jitter (approx 1-2km radius max) to simulate neighborhood
                const jitterLat = (Math.random() - 0.5) * 0.015;
                const jitterLng = (Math.random() - 0.5) * 0.015;
                
                const intensity = viewType === 'pending' ? 0.8 : 0.5;
                const lat = school.lat + jitterLat;
                const lng = school.lng + jitterLng;
                points.push([lat, lng, intensity]);
                latLngs.push([lat, lng]);
            }
        });

        // Remove existing heat layer
        if (heatLayerRef.current) {
            mapRef.current.removeLayer(heatLayerRef.current);
            heatLayerRef.current = null;
        }

        // Add new heat layer
        if (typeof L.heatLayer === 'function' && points.length > 0) {
            try {
                heatLayerRef.current = L.heatLayer(points, {
                    radius: 25,
                    blur: 15,
                    maxZoom: 17,
                    gradient: viewType === 'all' 
                        ? {0.4: 'blue', 0.65: 'lime', 1: 'red'}
                        : {0.4: 'yellow', 0.65: 'orange', 1: 'red'}
                }).addTo(mapRef.current);
                
                // Fit bounds ONLY on initial load to set the right zoom
                // We do NOT fit bounds on viewType change to avoid jarring jumps when comparing views
                if (!hasFitBoundsRef.current && latLngs.length > 0) {
                    const bounds = L.latLngBounds(latLngs);
                    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
                    hasFitBoundsRef.current = true;
                }
            } catch (error) {
                console.error("Error drawing heatmap:", error);
            }
        }

    }, [students, schools, viewType, isMapReady]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <MapIcon className="h-5 w-5 text-blue-600" />
                        Mapa de Calor: Densidade de Alunos
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Visualização geoespacial da demanda por vagas (usa endereço exato se disponível).
                    </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setViewType('all')}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-2 ${viewType === 'all' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users className="h-3 w-3" />
                        Todos os Alunos
                    </button>
                    <button 
                         onClick={() => setViewType('pending')}
                         className={`px-3 py-1.5 text-xs font-bold rounded-md transition flex items-center gap-2 ${viewType === 'pending' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <AlertTriangle className="h-3 w-3" />
                        Demanda Reprimida
                    </button>
                </div>
            </div>
            <div className="h-[400px] w-full relative">
                <div ref={mapContainerRef} className="h-full w-full z-10" />
                
                {/* Overlay Legend */}
                <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg z-[400] text-xs border border-slate-200">
                    <h4 className="font-bold mb-2 text-slate-700">Intensidade</h4>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-20 h-2 bg-gradient-to-r from-blue-500 via-lime-500 to-red-500 rounded-full"></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Baixa</span>
                        <span>Alta</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
  const { students, schools, lastBackupDate } = useData();

  // --- Calculations ---

  const totalStudents = students.length;
  const totalSchools = schools.length;
  
  // Backup Status Check
  const backupNeeded = useMemo(() => {
    if (!lastBackupDate) return true;
    const last = new Date(lastBackupDate).getTime();
    const now = new Date().getTime();
    const hoursSince = (now - last) / (1000 * 60 * 60);
    return hoursSince > 24;
  }, [lastBackupDate]);

  // Metric: Unallocated Students (Status Analysis)
  const statusStats = useMemo(() => {
    return {
      matriculado: students.filter(s => s.status === 'Matriculado').length,
      pendente: students.filter(s => s.status === 'Pendente').length,
      analise: students.filter(s => s.status === 'Em Análise').length,
    };
  }, [students]);

  // Metric: School Types
  const schoolTypeStats = useMemo(() => {
    const counts: Record<string, number> = {
      [SchoolType.INFANTIL]: 0,
      [SchoolType.FUNDAMENTAL_1]: 0,
      [SchoolType.FUNDAMENTAL_2]: 0,
      [SchoolType.EJA]: 0,
    };

    schools.forEach(s => {
      s.types.forEach(t => {
        if (counts[t] !== undefined) counts[t]++;
      });
    });

    return [
      { label: 'Infantil (Creche/Pré)', value: counts[SchoolType.INFANTIL] },
      { label: 'Fundamental I', value: counts[SchoolType.FUNDAMENTAL_1] },
      { label: 'Fundamental II', value: counts[SchoolType.FUNDAMENTAL_2] },
      { label: 'EJA', value: counts[SchoolType.EJA] },
    ].filter(i => i.value > 0);
  }, [schools]);

  // Metric: Special Needs
  const specialNeedsCount = useMemo(() => students.filter(s => s.specialNeeds).length, [students]);
  
  // Metric: Transport
  const transportCount = useMemo(() => students.filter(s => s.transportRequest).length, [students]);

  // Metric: Top Schools by Allocation
  const topSchools = useMemo(() => {
    const schoolCounts: Record<string, number> = {};
    students.forEach(s => {
      if (s.school && s.school !== 'Não alocada') {
        schoolCounts[s.school] = (schoolCounts[s.school] || 0) + 1;
      }
    });

    return Object.entries(schoolCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [students]);

  // Metric: Total Capacity Estimate (Sum of availableSlots from school list)
  const totalCapacity = useMemo(() => schools.reduce((acc, s) => acc + (s.availableSlots || 0), 0), [schools]);
  
  // Calculate Occupancy Rate (Global)
  // Note: Since real data might have students > slots if slots aren't updated, we handle > 100% logic purely visually.
  const occupancyRate = totalCapacity > 0 ? (totalStudents / totalCapacity) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8 md:py-12 animate-in fade-in duration-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard Gerencial</h1>
            <p className="text-slate-600 mt-1">Visão geral dos indicadores da rede municipal de ensino.</p>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 shadow-sm">
            <Clock className="h-4 w-4" />
            Atualizado em: {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Security Alert - Backup Needed */}
        {backupNeeded && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8 flex items-start sm:items-center gap-4 animate-in slide-in-from-top-4">
             <div className="p-2 bg-red-100 rounded-full text-red-600 shrink-0">
               <Save className="h-6 w-6" />
             </div>
             <div className="flex-1">
               <h3 className="font-bold text-red-800">Atenção: Backup Necessário</h3>
               <p className="text-sm text-red-700">
                 Seu último backup externo foi há mais de 24 horas (ou nunca foi feito). Para garantir a segurança dos dados em caso de falha no computador, baixe uma cópia agora.
               </p>
             </div>
             <Link 
               to="/admin/data" 
               className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition flex items-center gap-2 shadow-sm whitespace-nowrap"
             >
               <Download className="h-4 w-4" />
               Fazer Backup
             </Link>
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-xl">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${occupancyRate > 90 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {occupancyRate.toFixed(1)}% Ocupação
              </span>
            </div>
            <h3 className="text-3xl font-bold text-slate-800">{totalStudents}</h3>
            <p className="text-sm text-slate-500">Alunos Matriculados</p>
            <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
               <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out" style={{ width: `${Math.min(occupancyRate, 100)}%` }}></div>
            </div>
             <p className="text-xs text-slate-400 mt-1">Capacidade Total Estimada: {totalCapacity}</p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
             <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 rounded-xl">
                <School className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-slate-800">{totalSchools}</h3>
            <p className="text-sm text-slate-500">Unidades Escolares</p>
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
               <Activity className="h-3 w-3" />
               Ativas no sistema
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
             <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-yellow-50 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              {statusStats.pendente > 0 && (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 animate-pulse">
                    Ação Necessária
                </span>
              )}
            </div>
            <h3 className="text-3xl font-bold text-slate-800">{statusStats.pendente + statusStats.analise}</h3>
            <p className="text-sm text-slate-500">Pendências / Em Análise</p>
            <p className="text-xs text-slate-400 mt-4">
                Solicitações aguardando deferimento
            </p>
          </div>

           <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
             <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-green-50 rounded-xl">
                <Bus className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-slate-800">{transportCount}</h3>
            <p className="text-sm text-slate-500">Solicitações de Transporte</p>
             <p className="text-xs text-slate-400 mt-4">
                {((transportCount / totalStudents) * 100 || 0).toFixed(1)}% do total de alunos
            </p>
          </div>

        </div>

        {/* Heatmap Section */}
        <div className="mb-8">
            <StudentDensityMap />
        </div>

        {/* Main Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            
            {/* Status Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-blue-600" />
                        Situação das Matrículas
                    </h2>
                    <div className="p-1.5 bg-blue-50 rounded-full cursor-help group relative">
                        <Info className="h-4 w-4 text-blue-500" />
                        <div className="absolute right-0 top-8 w-48 bg-slate-800 text-white text-xs p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            Passe o mouse sobre o gráfico para ver detalhes por categoria.
                        </div>
                    </div>
                </div>
                
                <InteractiveDonutChart 
                    data={[
                        { label: 'Matriculados', value: statusStats.matriculado, color: '#16a34a' }, // green-600
                        { label: 'Em Análise', value: statusStats.analise, color: '#3b82f6' }, // blue-500
                        { label: 'Pendentes', value: statusStats.pendente, color: '#eab308' }, // yellow-500
                    ].filter(d => d.value > 0)}
                />
            </div>

            {/* School Types Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <GraduationCap className="h-5 w-5 text-indigo-600" />
                        Modalidades
                    </h2>
                </div>
                <InteractiveBarChart 
                    data={schoolTypeStats}
                    colorClass="bg-indigo-500"
                    barColor="#6366f1"
                />
            </div>
        </div>

        {/* Detailed Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Top Schools */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Escolas com Maior Demanda
                </h2>
                <div className="space-y-4">
                    {topSchools.map((school, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-100 group">
                            <div className="flex items-center gap-3">
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all group-hover:scale-110 ${idx < 3 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {idx + 1}
                                </span>
                                <span className="font-medium text-slate-700 text-sm group-hover:text-blue-700 transition-colors">{school.name}</span>
                            </div>
                            <span className="font-bold text-slate-900">{school.count} <span className="text-xs font-normal text-slate-500">alunos</span></span>
                        </div>
                    ))}
                    {topSchools.length === 0 && <p className="text-slate-500 text-sm">Nenhum dado de alocação disponível.</p>}
                </div>
            </div>

            {/* Inclusion Stats */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                    <Baby className="h-5 w-5 text-pink-500" />
                    Indicadores de Inclusão
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                    <div className="bg-pink-50 rounded-xl p-5 border border-pink-100 flex flex-col justify-center items-center text-center hover:bg-pink-100/50 transition duration-300">
                        <div className="p-3 bg-white rounded-full mb-3 shadow-sm">
                            <Activity className="h-6 w-6 text-pink-500" />
                        </div>
                        <span className="text-4xl font-bold text-pink-700 mb-1">{specialNeedsCount}</span>
                        <span className="text-sm font-medium text-pink-900">Alunos com Deficiência (AEE)</span>
                        <span className="text-xs text-pink-600 mt-2">
                             {((specialNeedsCount / totalStudents) * 100 || 0).toFixed(1)}% da rede
                        </span>
                    </div>

                     <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100 flex flex-col justify-center items-center text-center hover:bg-emerald-100/50 transition duration-300">
                        <div className="p-3 bg-white rounded-full mb-3 shadow-sm">
                            <CheckCircle className="h-6 w-6 text-emerald-500" />
                        </div>
                        <span className="text-4xl font-bold text-emerald-700 mb-1">{statusStats.matriculado}</span>
                        <span className="text-sm font-medium text-emerald-900">Matrículas Efetivadas</span>
                        <span className="text-xs text-emerald-600 mt-2">
                            Processo concluído com sucesso
                        </span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};