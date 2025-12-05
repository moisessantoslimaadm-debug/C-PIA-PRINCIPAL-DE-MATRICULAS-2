import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { MapPin, Star, Users, Search, Map as MapIcon, List, X, Calendar, Hash, School as SchoolIcon, Layout, ArrowUpDown, PieChart, Baby, BookOpen, GraduationCap, Library, AlertCircle, Loader2, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { SchoolType, School, RegistryStudent } from '../types';
import { loadLeaflet } from '../services/leafletLoader';

// Declare Leaflet globally
declare const L: any;

// --- Constants & Helpers (Extracted for Performance) ---

// Mock "User Location" (City Center) for distance calculation
const USER_LOCATION = { lat: -12.5253, lng: -40.2917 };

// Haversine formula to calculate distance in km
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; 
  return d;
};

// Helper to determine icon based on school type
const getSchoolTypeIcon = (types: SchoolType[]) => {
    // Prioritize highest level or most specific
    if (types.includes(SchoolType.MEDIO)) return { icon: <GraduationCap className="h-5 w-5" />, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Ensino Médio' };
    if (types.includes(SchoolType.FUNDAMENTAL_2)) return { icon: <BookOpen className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Fundamental II' };
    if (types.includes(SchoolType.FUNDAMENTAL_1)) return { icon: <BookOpen className="h-5 w-5" />, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Fundamental I' };
    if (types.includes(SchoolType.INFANTIL)) return { icon: <Baby className="h-5 w-5" />, color: 'text-pink-600', bg: 'bg-pink-50', label: 'Infantil/Creche' };
    if (types.includes(SchoolType.EJA)) return { icon: <Library className="h-5 w-5" />, color: 'text-orange-600', bg: 'bg-orange-50', label: 'EJA' };
    
    return { icon: <SchoolIcon className="h-5 w-5" />, color: 'text-slate-600', bg: 'bg-slate-50', label: 'Escola' };
};

// --- Subcomponent: SchoolMap ---
// Isolates Leaflet logic so it only initializes when mounted
interface SchoolMapProps {
    schools: School[];
    center: { lat: number; lng: number };
    onSelectSchool: (school: School) => void;
}

// Optimized with React.memo to prevent unnecessary re-renders
const SchoolMap: React.FC<SchoolMapProps> = React.memo(({ schools, center, onSelectSchool }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersLayerRef = useRef<any>(null); // Optimization: Use LayerGroup
    const [isMapReady, setIsMapReady] = useState(false);
    const [isLoadingLib, setIsLoadingLib] = useState(true);

    // 1. Initialize Map Structure (Run Once)
    useEffect(() => {
        if (!mapContainerRef.current) return;

        let isMounted = true;

        const initMap = async () => {
            try {
                await loadLeaflet();
                if (!isMounted) return;
                setIsLoadingLib(false);

                if (typeof L === 'undefined') return;

                // Ensure container has dimensions
                const { clientWidth, clientHeight } = mapContainerRef.current!;
                if (clientWidth === 0 || clientHeight === 0) return;

                // Create Map Instance if not exists
                if (!mapInstanceRef.current) {
                    const map = L.map(mapContainerRef.current!).setView([center.lat, center.lng], 13);
                    
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(map);

                    // Create a LayerGroup for markers (Efficient update)
                    const markersLayer = L.layerGroup().addTo(map);
                    
                    mapInstanceRef.current = map;
                    markersLayerRef.current = markersLayer;
                    
                    // Force sizing update
                    requestAnimationFrame(() => {
                        map.invalidateSize();
                        setIsMapReady(true);
                    });
                }
            } catch (error) {
                console.error("Failed to load map library", error);
            }
        };

        // ResizeObserver to handle layout changes
        const resizeObserver = new ResizeObserver(() => {
            if (mapInstanceRef.current) {
                requestAnimationFrame(() => {
                    mapInstanceRef.current?.invalidateSize();
                });
            }
        });
        resizeObserver.observe(mapContainerRef.current);

        initMap();

        // Cleanup on unmount
        return () => {
            isMounted = false;
            resizeObserver.disconnect();
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markersLayerRef.current = null;
            }
        };
    }, []); // Empty dependency array ensures this runs strictly on mount

    // 2. Update Markers (Runs when schools data or map ready state changes)
    useEffect(() => {
        if (!isMapReady || !markersLayerRef.current) return;
        if (typeof L === 'undefined') return;
        
        const layerGroup = markersLayerRef.current;
        const map = mapInstanceRef.current;
        
        // Efficiently clear old markers
        layerGroup.clearLayers();

        // Custom Icon Definition
        const schoolIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        // Add New Markers
        const markers: any[] = [];
        schools.forEach((school) => {
            const marker = L.marker([school.lat, school.lng], { icon: schoolIcon });
            
            // Create popup content
            const popupContent = document.createElement('div');
            popupContent.innerHTML = `
                <div class="p-1 min-w-[200px]">
                    <h3 class="font-bold text-sm mb-1">${school.name}</h3>
                    <p class="text-xs text-gray-600 mb-2">${school.address}</p>
                    <div class="flex flex-wrap gap-1 mb-2">
                        ${school.types.map(t => `<span class="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded">${t}</span>`).join('')}
                    </div>
                    <button class="btn-detail w-full bg-blue-600 text-white text-xs py-1.5 rounded hover:bg-blue-700 transition">Ver Detalhes</button>
                </div>
            `;
            
            // Add click listener to button inside popup
            popupContent.querySelector('.btn-detail')?.addEventListener('click', () => {
                onSelectSchool(school);
            });

            marker.bindPopup(popupContent);
            marker.addTo(layerGroup); // Add to layer group instead of map directly
            markers.push(marker);
        });

        // Fit bounds if there are markers
        if (markers.length > 0) {
            const group = L.featureGroup(markers);
            try {
                map.fitBounds(group.getBounds().pad(0.1));
            } catch (e) {
                // Ignore bounds error if map not fully sized yet
            }
        }

    }, [schools, isMapReady, onSelectSchool]);

    return (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden h-[600px] relative animate-in fade-in duration-500">
             {(isLoadingLib || !isMapReady) && (
                 <div className="absolute inset-0 flex items-center justify-center bg-slate-50 z-20">
                     <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                     <span className="ml-2 text-slate-500 font-medium">{isLoadingLib ? 'Baixando recursos do mapa...' : 'Renderizando mapa...'}</span>
                 </div>
             )}
             <div ref={mapContainerRef} className="w-full h-full z-10" />
             {/* Legend overlay */}
             <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md z-[400] text-xs">
                <h4 className="font-bold mb-2">Legenda</h4>
                <div className="flex items-center gap-2 mb-1">
                    <img src="https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png" className="w-3 h-5" alt="marker" />
                    <span>Unidade Escolar</span>
                </div>
             </div>
        </div>
    );
});


// --- Main Component ---

export const SchoolList: React.FC = () => {
  const { schools, students } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('Todos');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [sortOption, setSortOption] = useState<string>('name');
  
  // States for the selected school modal
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'students' | 'classes' | 'info'>('students');
  
  // Modal Filters
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [studentSearchCpf, setStudentSearchCpf] = useState(''); // Specific CPF filter
  const [modalStatusFilter, setModalStatusFilter] = useState<string>('Todos');
  const [modalClassFilter, setModalClassFilter] = useState<string>('Todas');
  
  // Expanded classes in Modal
  const [expandedModalClasses, setExpandedModalClasses] = useState<Set<string>>(new Set());

  // Process schools: Filter -> Calculate Distance -> Sort
  const processedSchools = useMemo(() => {
    // 1. Filter
    let result = schools.filter(school => {
      const matchesSearch = school.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            school.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'Todos' || school.types.includes(filterType as SchoolType);
      return matchesSearch && matchesType;
    });

    // 2. Add Distance
    result = result.map(school => ({
      ...school,
      distance: calculateDistance(USER_LOCATION.lat, USER_LOCATION.lng, school.lat, school.lng)
    }));

    // 3. Sort
    return result.sort((a, b) => {
      if (sortOption === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortOption === 'rating') {
        return b.rating - a.rating;
      } else if (sortOption === 'distance') {
        return (a.distance || 0) - (b.distance || 0);
      }
      return 0;
    });
  }, [schools, searchTerm, filterType, sortOption]);

  // Logic for the Modal Data
  const schoolStudents = useMemo(() => {
    if (!selectedSchool) return [];
    return students.filter(student => {
      const schoolNameMatch = student.school && student.school.trim().toUpperCase() === selectedSchool.name.trim().toUpperCase();
      return schoolNameMatch; 
    });
  }, [selectedSchool, students]);

  // Extract unique classes for the filter dropdown
  const availableClasses = useMemo(() => {
    const classes = new Set(schoolStudents.map(s => s.className).filter(Boolean));
    return Array.from(classes).sort();
  }, [schoolStudents]);

  const filteredSchoolStudents = useMemo(() => {
    return schoolStudents.filter(s => {
      const term = studentSearchTerm.toLowerCase();
      const termClean = term.replace(/\D/g, ''); // Extract just numbers for CPF search

      // 1. Text Search (Name & Enrollment ID)
      const matchesText = !term || 
        s.name.toLowerCase().includes(term) || 
        (s.enrollmentId && s.enrollmentId.toLowerCase().includes(term));

      // 2. CPF Search (Robust - ignores formatting if searching in main bar)
      const studentCpfClean = s.cpf ? s.cpf.replace(/\D/g, '') : '';
      const matchesCpf = termClean.length > 0 && studentCpfClean.includes(termClean);

      // Combine matches
      const matchesSearch = matchesText || matchesCpf;

      // 3. Specific CPF Filter (New)
      const specificCpfTerm = studentSearchCpf.replace(/\D/g, '');
      const matchesSpecificCpf = !specificCpfTerm || (s.cpf && s.cpf.replace(/\D/g, '').includes(specificCpfTerm));

      // Status Filter
      const matchesStatus = modalStatusFilter === 'Todos' || s.status === modalStatusFilter;

      // Class Filter
      const matchesClass = modalClassFilter === 'Todas' || s.className === modalClassFilter;

      return matchesSearch && matchesSpecificCpf && matchesStatus && matchesClass;
    });
  }, [schoolStudents, studentSearchTerm, studentSearchCpf, modalStatusFilter, modalClassFilter]);

  // Group students by Class (Turma) for Classes Tab
  const schoolClassesGrouped = useMemo(() => {
    const groups: Record<string, RegistryStudent[]> = {};
    schoolStudents.forEach(student => {
      const className = student.className || 'Sem Turma Definida';
      if (!groups[className]) groups[className] = [];
      groups[className].push(student);
    });
    return groups;
  }, [schoolStudents]);

  // Prepare sorted classes and max count for visualization
  const sortedClassEntries = useMemo(() => {
     const entries = Object.entries(schoolClassesGrouped);
     // Sort alphabetically
     entries.sort((a, b) => a[0].localeCompare(b[0]));
     return entries;
  }, [schoolClassesGrouped]);

  const maxClassSize = useMemo(() => {
     if (sortedClassEntries.length === 0) return 0;
     return Math.max(...sortedClassEntries.map(([, students]) => students.length));
  }, [sortedClassEntries]);

  // Stabilize the handler function to allow proper memoization of child components
  const handleSchoolSelect = useCallback((school: School) => {
    setSelectedSchool(school);
    setModalActiveTab('students');
    setStudentSearchTerm('');
    setStudentSearchCpf('');
    setExpandedModalClasses(new Set()); // Reset expansions
  }, []);

  const toggleModalClassExpansion = (className: string) => {
      setExpandedModalClasses(prev => {
          const newSet = new Set(prev);
          if (newSet.has(className)) {
              newSet.delete(className);
          } else {
              newSet.add(className);
          }
          return newSet;
      });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 md:py-12 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Escolas da Rede Municipal</h1>
            <p className="text-slate-600">Gerencie e visualize as {processedSchools.length} unidades de ensino.</p>
          </div>
          <div className="bg-white border border-slate-200 p-1 rounded-lg flex shadow-sm self-start md:self-auto">
            <button 
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition ${viewMode === 'list' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <List className="h-4 w-4" />
              Lista
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition ${viewMode === 'map' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <MapIcon className="h-4 w-4" />
              Mapa
            </button>
          </div>
        </div>

        {/* Filters & Sorting */}
        <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col lg:flex-row gap-4 items-center justify-between sticky top-20 z-30">
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto items-center">
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                type="text"
                placeholder="Buscar escola..."
                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="relative w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                </div>
                <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className="w-full sm:w-48 pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm text-slate-700 cursor-pointer appearance-none"
                >
                    <option value="name">Ordem Alfabética</option>
                    <option value="rating">Melhor Avaliação</option>
                    <option value="distance">Menor Distância</option>
                </select>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 w-full lg:w-auto scrollbar-hide">
            {['Todos', ...Object.values(SchoolType)].map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border ${
                  filterType === type
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {viewMode === 'map' ? (
            <SchoolMap 
                schools={processedSchools} 
                center={USER_LOCATION} 
                onSelectSchool={handleSchoolSelect} 
            />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {processedSchools.map((school) => {
              const enrolledCount = students.filter(s => s.school === school.name).length;
              const capacity = school.availableSlots || 0;
              const available = Math.max(0, capacity - enrolledCount);
              const occupancy = capacity > 0 ? (enrolledCount / capacity) * 100 : 0;
              
              // Visual State Logic for Color Coding
              let visualState = 'success'; // default green
              if (capacity === 0) visualState = 'neutral';
              else if (occupancy >= 100) visualState = 'danger';
              else if (occupancy >= 80) visualState = 'warning';

              // Map state to color styles
              const colors = {
                  success: { 
                      border: 'border-green-200 hover:border-green-400 ring-green-50', 
                      leftBorder: 'border-l-green-500',
                      badge: 'bg-green-500 text-white', 
                      text: 'text-green-700', 
                      bg: 'bg-green-50', 
                      bar: 'bg-green-500' 
                  },
                  warning: { 
                      border: 'border-yellow-200 hover:border-yellow-400 ring-yellow-50', 
                      leftBorder: 'border-l-yellow-500',
                      badge: 'bg-yellow-500 text-white', 
                      text: 'text-yellow-700', 
                      bg: 'bg-yellow-50', 
                      bar: 'bg-yellow-500' 
                  },
                  danger: { 
                      border: 'border-red-200 hover:border-red-400 ring-red-50', 
                      leftBorder: 'border-l-red-500',
                      badge: 'bg-red-500 text-white', 
                      text: 'text-red-700', 
                      bg: 'bg-red-50', 
                      bar: 'bg-red-500' 
                  },
                  neutral: { 
                      border: 'border-slate-200 hover:border-slate-300 ring-slate-50', 
                      leftBorder: 'border-l-slate-400',
                      badge: 'bg-slate-500 text-white', 
                      text: 'text-slate-600', 
                      bg: 'bg-slate-50', 
                      bar: 'bg-slate-400' 
                  }
              };

              const currentColors = colors[visualState as keyof typeof colors];

              let badgeText = 'Vagas Abertas';
              if (visualState === 'neutral') badgeText = 'Cadastro Reserva';
              else if (visualState === 'danger') badgeText = 'Lotado';
              else if (visualState === 'warning') badgeText = 'Últimas Vagas';

              // Get School Icon
              const typeIconInfo = getSchoolTypeIcon(school.types);

              return (
                <div key={school.id} className={`bg-white rounded-xl shadow-sm border-y border-r border-l-4 ${currentColors.leftBorder} ${currentColors.border} overflow-hidden hover:shadow-xl hover:-translate-y-1 transition duration-300 group flex flex-col h-full ring-1 ring-inset ring-transparent hover:ring-opacity-50`}>
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={school.image} 
                      alt={school.name} 
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                    
                    {/* Status Badge */}
                    <div className={`absolute top-3 left-3 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border border-white/20 shadow-sm backdrop-blur-md ${currentColors.badge} bg-opacity-90`}>
                        {badgeText}
                    </div>

                    {school.inep && (
                       <div className="absolute top-10 left-3 bg-black/40 backdrop-blur-md text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/20">
                         INEP: {school.inep}
                       </div>
                    )}
                    
                    {/* Visual Icon Badge */}
                    <div className={`absolute top-3 right-3 p-2 rounded-full shadow-sm backdrop-blur-md border border-white/20 z-10 ${typeIconInfo.bg} bg-opacity-90`} title={typeIconInfo.label}>
                        <div className={typeIconInfo.color}>
                            {typeIconInfo.icon}
                        </div>
                    </div>

                    <div className="absolute bottom-4 left-4 right-4">
                      <h3 className="text-lg font-bold text-white leading-tight shadow-black drop-shadow-md">{school.name}</h3>
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {school.types.map(t => (
                        <span key={t} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                          {t}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex items-start gap-2.5 text-slate-600 mb-6 flex-1">
                      <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400" />
                      <div className="flex flex-col">
                          <span className="text-sm leading-snug">{school.address}</span>
                          {school.distance !== undefined && (
                              <span className="text-xs text-blue-600 font-medium mt-1">
                                  Aprox. {school.distance.toFixed(2)} km do Centro
                              </span>
                          )}
                      </div>
                    </div>

                    {/* Enhanced Availability Section with Color Tint */}
                    <div className={`pt-4 border-t border-slate-100 mt-auto -mx-5 -mb-5 px-5 pb-5 ${currentColors.bg} bg-opacity-20`}>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Disponibilidade</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-lg font-bold text-slate-800">{enrolledCount}</span>
                                    <span className="text-xs text-slate-500 font-medium">/ {capacity > 0 ? capacity : '?'} preenchidas</span>
                                </div>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-opacity-20 ${currentColors.text.replace('text-', 'bg-')} ${currentColors.text}`}>
                                {capacity > 0 ? `${occupancy.toFixed(0)}%` : 'N/A'}
                            </span>
                        </div>
                        
                        <div className="w-full bg-white rounded-full h-2 mb-3 overflow-hidden shadow-sm">
                            <div className={`h-full rounded-full transition-all duration-500 ${currentColors.bar}`} style={{ width: `${Math.min(occupancy, 100)}%` }}></div>
                        </div>

                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5" title="Vagas Restantes">
                                  <div className={`w-2 h-2 rounded-full ${available > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <span className="text-xs text-slate-600 font-medium">
                                      {capacity > 0 ? (available > 0 ? `${available} vagas restantes` : 'Sem vagas') : 'Capacidade n/i'}
                                  </span>
                            </div>

                            <button 
                                onClick={() => handleSchoolSelect(school)}
                                className="text-blue-600 text-xs font-bold hover:text-blue-800 transition-colors flex items-center gap-1 bg-white hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm"
                            >
                              Ver Detalhes
                              <Layout className="h-3 w-3 ml-1" />
                            </button>
                        </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {processedSchools.length === 0 && viewMode === 'list' && (
          <div className="col-span-full text-center py-16">
            <div className="inline-flex bg-slate-100 p-4 rounded-full mb-4">
              <Search className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Nenhuma escola encontrada</h3>
            <p className="text-slate-500 mt-1">Tente ajustar seus filtros de busca ou importe dados na aba Gestão.</p>
          </div>
        )}
      </div>

      {/* Enhanced Details Modal */}
      {selectedSchool && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
                onClick={() => setSelectedSchool(null)}
            ></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative animate-in zoom-in-95 duration-200 overflow-hidden">
                
                {/* Modal Header */}
                <div className="bg-slate-900 text-white p-6 shrink-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-white/10 rounded-lg">
                                    <SchoolIcon className="h-6 w-6 text-blue-300" />
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold leading-none">{selectedSchool.name}</h2>
                                    {selectedSchool.inep && <span className="text-xs text-slate-400 font-mono">INEP: {selectedSchool.inep}</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300 text-sm">
                                <MapPin className="h-4 w-4" />
                                {selectedSchool.address}
                            </div>
                        </div>
                        <button 
                            onClick={() => setSelectedSchool(null)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                    
                    {/* Tabs */}
                    <div className="flex gap-1 mt-6 border-b border-white/10">
                        <button
                            onClick={() => setModalActiveTab('students')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg flex items-center gap-2 transition ${
                                modalActiveTab === 'students' 
                                ? 'bg-white text-slate-900' 
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <Users className="h-4 w-4" />
                            Alunos ({schoolStudents.length})
                        </button>
                        <button
                            onClick={() => setModalActiveTab('classes')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg flex items-center gap-2 transition ${
                                modalActiveTab === 'classes' 
                                ? 'bg-white text-slate-900' 
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <Layout className="h-4 w-4" />
                            Turmas ({Object.keys(schoolClassesGrouped).length})
                        </button>
                         <button
                            onClick={() => setModalActiveTab('info')}
                            className={`px-4 py-2 text-sm font-medium rounded-t-lg flex items-center gap-2 transition ${
                                modalActiveTab === 'info' 
                                ? 'bg-white text-slate-900' 
                                : 'text-slate-300 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            <SchoolIcon className="h-4 w-4" />
                            Informações
                        </button>
                    </div>
                </div>

                {/* Modal Body */}
                <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col">
                    
                    {/* Tab: Students */}
                    {modalActiveTab === 'students' && (
                        <div className="flex flex-col h-full">
                            {/* Search & Filters Bar */}
                            <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row gap-4 items-center">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Pesquisar aluno por nome, CPF ou matrícula..." 
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={studentSearchTerm}
                                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="relative w-full sm:w-48">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar por CPF" 
                                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={studentSearchCpf}
                                        onChange={(e) => setStudentSearchCpf(e.target.value)}
                                    />
                                </div>
                                
                                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                    <select 
                                        value={modalStatusFilter}
                                        onChange={(e) => setModalStatusFilter(e.target.value)}
                                        className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                                    >
                                        <option value="Todos">Status: Todos</option>
                                        <option value="Matriculado">Matriculado</option>
                                        <option value="Pendente">Pendente</option>
                                        <option value="Em Análise">Em Análise</option>
                                    </select>
                                    
                                    <select 
                                        value={modalClassFilter}
                                        onChange={(e) => setModalClassFilter(e.target.value)}
                                        className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none w-full sm:w-auto"
                                    >
                                        <option value="Todas">Turmas: Todas</option>
                                        {availableClasses.map(cls => (
                                            <option key={cls} value={cls}>{cls}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-4">
                                {filteredSchoolStudents.length > 0 ? (
                                    <div className="grid gap-3">
                                        {filteredSchoolStudents.map((student) => (
                                            <div key={student.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:border-blue-300 transition flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm uppercase ${
                                                        student.status === 'Matriculado' ? 'bg-green-100 text-green-700' : 
                                                        student.status === 'Em Análise' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-sm">{student.name}</h4>
                                                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                                            {student.enrollmentId && (
                                                                <span className="flex items-center gap-1 bg-slate-100 px-1.5 rounded"><Hash className="h-3 w-3" /> {student.enrollmentId}</span>
                                                            )}
                                                            {student.cpf && (
                                                                <span className="flex items-center gap-1 font-mono text-[10px] bg-slate-100 px-1.5 rounded border border-slate-200" title="CPF">
                                                                    <CreditCard className="h-2.5 w-2.5" /> 
                                                                    {student.cpf}
                                                                </span>
                                                            )}
                                                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {student.birthDate}</span>
                                                            {student.className && (
                                                                <span className="flex items-center gap-1 text-blue-600 font-medium"><Layout className="h-3 w-3" /> {student.className}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                     <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                                                        student.status === 'Matriculado' ? 'bg-green-50 text-green-700 border border-green-100' : 
                                                        student.status === 'Em Análise' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-yellow-50 text-yellow-700 border border-yellow-100'
                                                    }`}>
                                                        {student.status}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <Users className="h-12 w-12 mb-3 opacity-20" />
                                        <p>Nenhum aluno encontrado.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab: Classes */}
                    {modalActiveTab === 'classes' && (
                         <div className="p-6 overflow-y-auto">
                            {sortedClassEntries.length > 0 ? (
                                <div className="grid md:grid-cols-2 gap-4">
                                    {sortedClassEntries.map(([className, classStudents]: [string, RegistryStudent[]]) => {
                                        const count = classStudents.length;
                                        const percentage = maxClassSize > 0 ? (count / maxClassSize) * 100 : 0;
                                        const isExpanded = expandedModalClasses.has(className);
                                        const visibleStudents = isExpanded ? classStudents : classStudents.slice(0, 5);
                                        
                                        return (
                                            <div key={className} className={`bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition duration-300 flex flex-col ${isExpanded ? 'row-span-2' : ''}`}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Layout className="h-5 w-5 text-blue-600" />
                                                        <h3 className="font-bold text-slate-800">{className}</h3>
                                                    </div>
                                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                                                        {count} Alunos
                                                    </span>
                                                </div>

                                                {/* Bar Chart */}
                                                <div className="mb-4">
                                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                                        <div 
                                                            className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out" 
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <div className="border-t border-slate-50 pt-3 space-y-2 flex-1">
                                                    {visibleStudents.map(s => (
                                                        <div key={s.id} className="text-xs text-slate-600 py-1 border-b border-slate-50 last:border-0 flex justify-between">
                                                            <span>{s.name}</span>
                                                        </div>
                                                    ))}
                                                    
                                                    {classStudents.length > 5 && (
                                                        <button 
                                                            onClick={() => toggleModalClassExpansion(className)}
                                                            className="w-full mt-2 text-xs text-center text-blue-600 font-medium hover:bg-blue-50 py-1.5 rounded transition flex items-center justify-center gap-1"
                                                        >
                                                            {isExpanded ? (
                                                                <>Ver menos <ChevronUp className="h-3 w-3" /></>
                                                            ) : (
                                                                <>+ {classStudents.length - 5} outros alunos <ChevronDown className="h-3 w-3" /></>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-500">
                                    Nenhuma turma identificada.
                                </div>
                            )}
                         </div>
                    )}

                    {/* Tab: Info */}
                     {modalActiveTab === 'info' && (
                        <div className="p-8 overflow-y-auto">
                            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                                <h3 className="text-lg font-bold text-slate-900 mb-4">Detalhes da Unidade</h3>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Endereço Completo</p>
                                        <p className="font-medium text-slate-800 flex items-start gap-2">
                                            <MapPin className="h-5 w-5 text-blue-500 shrink-0" />
                                            {selectedSchool.address}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Coordenadas</p>
                                        <p className="font-mono text-sm text-slate-700 bg-slate-100 p-2 rounded inline-block">
                                            Lat: {selectedSchool.lat}, Lng: {selectedSchool.lng}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Modalidades de Ensino</p>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedSchool.types.map(t => (
                                                <span key={t} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm text-slate-500 mb-1">Avaliação Geral</p>
                                        <div className="flex items-center gap-1">
                                            {[...Array(5)].map((_, i) => (
                                                <Star key={i} className={`h-5 w-5 ${i < Math.round(selectedSchool.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-200'}`} />
                                            ))}
                                            <span className="ml-2 font-bold text-slate-700">{selectedSchool.rating}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                                        <PieChart className="h-5 w-5 text-blue-600" />
                                        Quadro de Vagas
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                                            <span className="text-3xl font-bold text-slate-700 block mb-1">{selectedSchool.availableSlots || '-'}</span>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capacidade Total</span>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
                                            <span className="text-3xl font-bold text-blue-700 block mb-1">{schoolStudents.length}</span>
                                            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Matriculados</span>
                                        </div>
                                        <div className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center ${Math.max(0, selectedSchool.availableSlots - schoolStudents.length) > 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                                            <span className={`text-3xl font-bold block mb-1 ${Math.max(0, selectedSchool.availableSlots - schoolStudents.length) > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                                {Math.max(0, selectedSchool.availableSlots - schoolStudents.length)}
                                            </span>
                                            <span className={`text-xs font-bold uppercase tracking-wider ${Math.max(0, selectedSchool.availableSlots - schoolStudents.length) > 0 ? 'text-green-600' : 'text-red-400'}`}>
                                                Disponíveis
                                            </span>
                                        </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-sm font-medium text-slate-600">Taxa de Ocupação</span>
                                        <span className="text-lg font-bold text-slate-800">
                                            {selectedSchool.availableSlots > 0 ? ((schoolStudents.length / selectedSchool.availableSlots) * 100).toFixed(1) : 0}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-4 overflow-hidden">
                                        <div 
                                                className={`h-full rounded-full transition-all duration-500 ${
                                                    (schoolStudents.length / (selectedSchool.availableSlots || 1)) >= 1 ? 'bg-red-500' : 
                                                    (schoolStudents.length / (selectedSchool.availableSlots || 1)) > 0.8 ? 'bg-yellow-500' : 'bg-green-500'
                                                }`}
                                                style={{ width: `${Math.min(100, (schoolStudents.length / (selectedSchool.availableSlots || 1)) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
                
                {/* Modal Footer */}
                <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
                    <button 
                        onClick={() => setSelectedSchool(null)}
                        className="px-6 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};