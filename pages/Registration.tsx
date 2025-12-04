import React, { useState, useMemo, useEffect, useRef } from 'react';
import { INITIAL_REGISTRATION_STATE } from '../constants';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { RegistrationFormState, RegistryStudent } from '../types';
import { Check, ChevronRight, ChevronLeft, Upload, School as SchoolIcon, Bus, FileText, ListChecks, MapPin, Navigation, AlertCircle, Loader2, Search, RefreshCw, Crosshair } from 'lucide-react';
import { useNavigate } from '../router';

// Declare Leaflet globally
declare const L: any;

// Utility to validate CPF
const isValidCPF = (cpf: string): boolean => {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf === '') return false;
  // Elimina CPFs invalidos conhecidos
  if (cpf.length !== 11 ||
    cpf === "00000000000" ||
    cpf === "11111111111" ||
    cpf === "22222222222" ||
    cpf === "33333333333" ||
    cpf === "44444444444" ||
    cpf === "55555555555" ||
    cpf === "66666666666" ||
    cpf === "77777777777" ||
    cpf === "88888888888" ||
    cpf === "99999999999")
    return false;

  // Valida 1o digito
  let add = 0;
  for (let i = 0; i < 9; i++)
    add += parseInt(cpf.charAt(i)) * (10 - i);
  let rev = 11 - (add % 11);
  if (rev === 10 || rev === 11)
    rev = 0;
  if (rev !== parseInt(cpf.charAt(9)))
    return false;

  // Valida 2o digito
  add = 0;
  for (let i = 0; i < 10; i++)
    add += parseInt(cpf.charAt(i)) * (11 - i);
  rev = 11 - (add % 11);
  if (rev === 10 || rev === 11)
    rev = 0;
  if (rev !== parseInt(cpf.charAt(10)))
    return false;

  return true;
};

// Utility to format CPF
const formatCPF = (value: string) => {
  return value
    .replace(/\D/g, '') // substitui qualquer caracter que nao seja numero por nada
    .replace(/(\d{3})(\d)/, '$1.$2') // captura 2 grupos de numero o primeiro de 3 e o segundo de 1, apos a captura, o $1.$2 adiciona um ponto entre eles
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1'); // captura 2 numeros seguidos de um traço e não deixa ser digitado mais nada
};

// Utility to format CEP
const formatCEP = (value: string) => {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{5})(\d)/, '$1-$2')
    .substring(0, 9);
};

export const Registration: React.FC = () => {
  const { schools, addStudent } = useData();
  const { addToast } = useToast();
  const [formState, setFormState] = useState<RegistrationFormState>(INITIAL_REGISTRATION_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const navigate = useNavigate();

  // Map Ref for Picker
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (section: 'student' | 'guardian' | 'address', field: string, value: any) => {
    let finalValue = value;

    // Apply mask for CPF fields
    if (field === 'cpf') {
      finalValue = formatCPF(value);
      // Clear error when typing
      if (errors[`${section}Cpf`]) {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`${section}Cpf`];
            return newErrors;
        });
      }
    }

    // Apply mask and fetch for CEP
    if (field === 'zipCode') {
        finalValue = formatCEP(value);
        if (finalValue.length === 9) {
            fetchAddressByCep(finalValue);
        }
    }

    setFormState(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: finalValue
      }
    }));
  };

  const fetchAddressByCep = async (cep: string) => {
      const cleanCep = cep.replace(/\D/g, '');
      if (cleanCep.length !== 8) return;

      setIsLoadingCep(true);
      try {
          const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          const data = await response.json();
          
          if (!data.erro) {
              setFormState(prev => ({
                  ...prev,
                  address: {
                      ...prev.address,
                      street: data.logradouro,
                      neighborhood: data.bairro,
                      city: data.localidade,
                      // Keep existing number/complement
                  }
              }));
              addToast('Endereço encontrado!', 'success');
              // Clear any previous address errors
          } else {
             addToast('CEP não encontrado.', 'warning');
          }
      } catch (error) {
          console.error("Erro ao buscar CEP:", error);
          addToast('Erro ao buscar o CEP.', 'error');
      } finally {
          setIsLoadingCep(false);
      }
  };

  // Function to Geocode address using OSM Nominatim (Forward: Text -> Lat/Lng)
  const geocodeAddress = async () => {
    const { street, number, city } = formState.address;
    
    if (!street || !city) {
      addToast('Preencha pelo menos a Rua e a Cidade para localizar.', 'warning');
      return;
    }

    setIsGeocoding(true);
    try {
      // Prioritize Street + Number + City
      let query = `${street} ${number}, ${city}`;
      if (!number) {
         query = `${street}, ${city}`;
      }

      // Nominatim API endpoint
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        setFormState(prev => ({
          ...prev,
          address: { ...prev.address, lat, lng: lon }
        }));

        // Update map view if active
        if (mapRef.current) {
          mapRef.current.setView([lat, lon], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lon]);
          } else {
            // Marker creation handled by useEffect
          }
        }
        addToast(number ? 'Endereço exato localizado!' : 'Rua localizada. Arraste o pino se necessário.', 'success');
      } else {
        // Fallback: Try just street and city if number failed
        if (number) {
           const fallbackQuery = `${street}, ${city}`;
           const fbResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}&limit=1`);
           const fbData = await fbResponse.json();
           
           if (fbData && fbData.length > 0) {
             const lat = parseFloat(fbData[0].lat);
             const lon = parseFloat(fbData[0].lon);
             setFormState(prev => ({ ...prev, address: { ...prev.address, lat, lng: lon } }));
             
             if (mapRef.current) {
                 mapRef.current.setView([lat, lon], 15);
                 if (markerRef.current) markerRef.current.setLatLng([lat, lon]);
             }
             addToast('Número não encontrado, mas a rua foi localizada. Ajuste o pino.', 'info');
             return;
           }
        }
        addToast('Endereço não localizado no mapa. Tente ajustar o pino manualmente.', 'warning');
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      addToast('Erro ao conectar serviço de mapa.', 'error');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Function to Reverse Geocode (Lat/Lng -> Text)
  const reverseGeocode = async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        setFormState(prev => ({
          ...prev,
          address: {
            ...prev.address,
            street: addr.road || addr.pedestrian || addr.street || prev.address.street,
            neighborhood: addr.suburb || addr.quarter || addr.neighbourhood || prev.address.neighborhood,
            city: addr.city || addr.town || addr.village || addr.municipality || prev.address.city,
            zipCode: addr.postcode || prev.address.zipCode,
            lat,
            lng
          }
        }));
        addToast('Endereço atualizado conforme a localização do pino.', 'info');
      }
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      // Even if fetch fails, we still update the coordinates
      setFormState(prev => ({
        ...prev,
        address: { ...prev.address, lat, lng }
      }));
    } finally {
      setIsGeocoding(false);
    }
  };

  // Use GPS Location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      addToast('Seu navegador não suporta geolocalização.', 'error');
      return;
    }

    setIsGeocoding(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setFormState(prev => ({
          ...prev,
          address: { ...prev.address, lat: latitude, lng: longitude }
        }));
        
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 16);
          if (markerRef.current) {
            markerRef.current.setLatLng([latitude, longitude]);
          }
        }
        
        // Fill address fields from coordinates
        reverseGeocode(latitude, longitude);
        addToast('Localização obtida com sucesso!', 'success');
      },
      (error) => {
        console.error("Geolocation error:", error);
        addToast('Não foi possível obter sua localização. Verifique as permissões.', 'error');
        setIsGeocoding(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleBlur = (section: 'student' | 'guardian') => {
    const cpf = section === 'student' ? formState.student.cpf : formState.guardian.cpf;
    
    // Student CPF is optional, but if provided, must be valid
    if (section === 'student' && (!cpf || cpf.trim() === '')) {
        return;
    }

    if (section === 'guardian' && (!cpf || cpf.trim() === '')) {
        setErrors(prev => ({ ...prev, [`${section}Cpf`]: 'Campo obrigatório' }));
        return;
    }

    if (cpf && !isValidCPF(cpf)) {
      setErrors(prev => ({
        ...prev,
        [`${section}Cpf`]: 'CPF inválido.'
      }));
    }
  };

  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
    const d = R * c; // Distance in km
    return d;
  };

  // Initialize Map Picker when Step 3 is active
  useEffect(() => {
    if (formState.step === 3 && mapContainerRef.current && !mapRef.current) {
        // Default Center (Itaberaba)
        const defaultLat = -12.5253;
        const defaultLng = -40.2917;
        const initialLat = formState.address.lat || defaultLat;
        const initialLng = formState.address.lng || defaultLng;

        const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 15);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        mapRef.current = map;

        // Custom Icon
        const markerIcon = L.icon({
             iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
             shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
             iconSize: [25, 41],
             iconAnchor: [12, 41],
             popupAnchor: [1, -34],
        });

        const updatePosition = (lat: number, lng: number) => {
            reverseGeocode(lat, lng);
        };

        // Add Marker if coordinates exist, or center
        const markerLat = formState.address.lat || initialLat;
        const markerLng = formState.address.lng || initialLng;

        const marker = L.marker([markerLat, markerLng], { 
             draggable: true,
             icon: markerIcon 
        }).addTo(map);
        markerRef.current = marker;

        marker.on('dragend', (e: any) => {
             const newPos = e.target.getLatLng();
             updatePosition(newPos.lat, newPos.lng);
        });

        // Click handler to move/add marker
        map.on('click', (e: any) => {
            marker.setLatLng(e.latlng);
            updatePosition(e.latlng.lat, e.latlng.lng);
        });
    }

    // Update marker if coordinates change externally (e.g., from typing search)
    if (formState.step === 3 && mapRef.current && markerRef.current && formState.address.lat && formState.address.lng) {
        const currentLatLng = markerRef.current.getLatLng();
        // Only update map if the distance is significant to avoid loops or jitter during drags
        if (Math.abs(currentLatLng.lat - formState.address.lat) > 0.0001 || Math.abs(currentLatLng.lng - formState.address.lng) > 0.0001) {
             markerRef.current.setLatLng([formState.address.lat, formState.address.lng]);
             mapRef.current.setView([formState.address.lat, formState.address.lng], 16);
        }
    }

    // If map already exists, ensure size is correct (in case of tab switch/animation)
    if (formState.step === 3 && mapRef.current) {
        setTimeout(() => mapRef.current.invalidateSize(), 100);
    }
  }, [formState.step]); // Removed formState.address dependency from useEffect to prevent loops, handled logic inside


  const nextStep = () => {
    // Validate Step 1 (Student)
    if (formState.step === 1) {
         if (!formState.student.fullName.trim() || !formState.student.birthDate) {
             addToast('Por favor, preencha o nome completo e a data de nascimento do aluno.', 'warning');
             return;
         }
         // Optional CPF check
         if (formState.student.cpf && !isValidCPF(formState.student.cpf)) {
             setErrors(prev => ({...prev, studentCpf: 'CPF do aluno inválido'}));
             addToast('O CPF do aluno informado é inválido.', 'error');
             return;
         }
    }

    // Validate Step 2 (Guardian)
    if (formState.step === 2) {
        const cpfClean = formState.guardian.cpf.replace(/\D/g, '');
        
        if (!cpfClean) {
             setErrors(prev => ({
                ...prev,
                guardianCpf: 'O CPF do responsável é obrigatório.'
              }));
              addToast('Informe o CPF do responsável.', 'warning');
              return;
        }

        if (!isValidCPF(formState.guardian.cpf)) {
             setErrors(prev => ({
                ...prev,
                guardianCpf: 'CPF do responsável inválido.'
              }));
              addToast('CPF do responsável inválido. Verifique os números.', 'error');
              return;
        }
        
        if (!formState.guardian.fullName.trim()) {
            addToast('O nome do responsável é obrigatório.', 'warning');
            return;
        }
    }

    if (formState.step === 3) {
      if (!formState.address.lat || !formState.address.lng) {
          // If no coordinate selected, use default city center but warn
          const defaultLat = -12.5260;
          const defaultLng = -40.2930;
           setFormState(prev => ({
            ...prev,
            address: { ...prev.address, lat: defaultLat, lng: defaultLng },
            step: prev.step + 1
          }));
          addToast('Usando localização padrão aproximada.', 'info');
      } else {
          setFormState(prev => ({ ...prev, step: prev.step + 1 }));
      }
    } else {
      setFormState(prev => ({ ...prev, step: prev.step + 1 }));
    }
  };

  const prevStep = () => setFormState(prev => ({ ...prev, step: prev.step - 1 }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Final validation check
    if (errors.studentCpf || errors.guardianCpf) {
        addToast("Por favor, corrija os erros no formulário antes de prosseguir.", 'error');
        return;
    }
    if (!isValidCPF(formState.guardian.cpf)) {
        setErrors(prev => ({...prev, guardianCpf: 'CPF Inválido'}));
        addToast("CPF do responsável inválido.", 'error');
        return;
    }
    if (formState.student.cpf && !isValidCPF(formState.student.cpf)) {
         setErrors(prev => ({...prev, studentCpf: 'CPF Inválido'}));
         addToast("CPF do aluno inválido.", 'error');
         return;
    }

    setIsSubmitting(true);

    // Create a new student object
    const selectedSchool = schools.find(s => s.id === formState.selectedSchoolId);
    
    const newStudent: RegistryStudent = {
        id: Date.now().toString(), // Generate a temporary ID
        name: formState.student.fullName.toUpperCase(),
        birthDate: formState.student.birthDate.split('-').reverse().join('/'), // Format to DD/MM/YYYY
        cpf: formState.student.cpf || '',
        status: 'Em Análise',
        school: selectedSchool ? selectedSchool.name : 'Não alocada',
        grade: 'Definição Pendente', // Será definido pela secretaria
        shift: 'Definição Pendente',
        transportRequest: formState.student.needsTransport,
        specialNeeds: formState.student.needsSpecialEducation,
        enrollmentId: `PROT-${Math.floor(Math.random() * 100000)}`, // Generate protocol
        lat: formState.address.lat, // Save coordinates
        lng: formState.address.lng
    };

    // Simulate API delay
    setTimeout(() => {
      addStudent(newStudent); // Save to Global Context
      setIsSubmitting(false);
      addToast('Solicitação de matrícula enviada com sucesso!', 'success');
      navigate('/status?success=true');
    }, 1500);
  };

  // Calculate and sort schools by distance when on Step 4
  const sortedSchools = useMemo(() => {
    if (formState.step !== 4 || !formState.address.lat || !formState.address.lng) return schools;

    const schoolsWithDistance = schools.map(school => ({
      ...school,
      distance: calculateDistance(
        formState.address.lat!, 
        formState.address.lng!, 
        school.lat, 
        school.lng
      )
    }));

    return schoolsWithDistance.sort((a, b) => a.distance - b.distance);
  }, [formState.step, formState.address.lat, formState.address.lng, schools]);

  const StepIndicator = () => (
    <div className="flex justify-between mb-8 relative">
      <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -z-10 rounded-full"></div>
      {[1, 2, 3, 4].map((s) => (
        <div key={s} className={`flex flex-col items-center bg-slate-50 px-2`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
            formState.step >= s ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
          }`}>
            {s < formState.step ? <Check className="h-5 w-5" /> : s}
          </div>
          <span className="text-xs font-medium text-slate-500 mt-2 hidden sm:block">
            {s === 1 && 'Aluno'}
            {s === 2 && 'Responsável'}
            {s === 3 && 'Endereço'}
            {s === 4 && 'Escola'}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">Ficha de Matrícula</h2>
          
          {/* Section: Documentação Necessária */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg text-blue-600 hidden sm:block">
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <ListChecks className="h-5 w-5 sm:hidden" />
                  Documentação Necessária
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  Para efetivar a matrícula, tenha em mãos (originais e cópias) os seguintes documentos para apresentar na escola selecionada:
                </p>
                <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2 text-sm text-blue-800 font-medium">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> Certidão de Nascimento ou RG do Aluno
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> CPF do Aluno (se houver)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> RG e CPF do Responsável
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> Comprovante de Residência Atualizado
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> Cartão de Vacinação Atualizado
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> Cartão do SUS
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> Número do NIS (se beneficiário)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-blue-500" /> Laudo Médico (para alunos com deficiência)
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <StepIndicator />

          <form onSubmit={handleSubmit}>
            {/* Step 1: Student Data */}
            {formState.step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Dados do Aluno</h3>
                <div className="grid gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={formState.student.fullName}
                      onChange={(e) => handleInputChange('student', 'fullName', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                      <input
                        type="date"
                        required
                        max={new Date().toISOString().split("T")[0]}
                        value={formState.student.birthDate}
                        onChange={(e) => handleInputChange('student', 'birthDate', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">CPF (Opcional)</label>
                      <input
                        type="text"
                        placeholder="000.000.000-00"
                        value={formState.student.cpf}
                        onChange={(e) => handleInputChange('student', 'cpf', e.target.value)}
                        onBlur={() => handleBlur('student')}
                        maxLength={14}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${errors.studentCpf ? 'border-red-500' : 'border-slate-300'}`}
                      />
                      {errors.studentCpf && <p className="text-red-500 text-xs mt-1">{errors.studentCpf}</p>}
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="specialNeeds"
                        checked={formState.student.needsSpecialEducation}
                        onChange={(e) => handleInputChange('student', 'needsSpecialEducation', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="specialNeeds" className="text-sm font-medium text-slate-700">Aluno possui necessidade educacional especial?</label>
                    </div>
                    {formState.student.needsSpecialEducation && (
                      <div className="mt-3">
                         <label className="block text-sm font-medium text-slate-700 mb-1">Detalhes / CID</label>
                         <input
                          type="text"
                          value={formState.student.specialEducationDetails}
                          onChange={(e) => handleInputChange('student', 'specialEducationDetails', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Descreva a necessidade..."
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Guardian Data */}
            {formState.step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Dados do Responsável</h3>
                <div className="grid gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={formState.guardian.fullName}
                      onChange={(e) => handleInputChange('guardian', 'fullName', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">CPF *</label>
                      <input
                        type="text"
                        required
                        placeholder="000.000.000-00"
                        value={formState.guardian.cpf}
                        onChange={(e) => handleInputChange('guardian', 'cpf', e.target.value)}
                        onBlur={() => handleBlur('guardian')}
                        maxLength={14}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${errors.guardianCpf ? 'border-red-500' : 'border-slate-300'}`}
                      />
                      {errors.guardianCpf && <p className="text-red-500 text-xs mt-1">{errors.guardianCpf}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Parentesco</label>
                      <select
                        value={formState.guardian.relationship}
                        onChange={(e) => handleInputChange('guardian', 'relationship', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option>Mãe</option>
                        <option>Pai</option>
                        <option>Avô/Avó</option>
                        <option>Tio/Tia</option>
                        <option>Outro Responsável Legal</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        placeholder="exemplo@email.com"
                        value={formState.guardian.email}
                        onChange={(e) => handleInputChange('guardian', 'email', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Celular / WhatsApp</label>
                      <input
                        type="tel"
                        required
                        placeholder="(00) 90000-0000"
                        value={formState.guardian.phone}
                        onChange={(e) => handleInputChange('guardian', 'phone', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Address (Enhanced with Map) */}
            {formState.step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Endereço Residencial</h3>
                
                <div className="grid gap-6">
                  {/* Map Picker */}
                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 p-3 border-b border-slate-200 flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-blue-600" />
                              Confirme a Localização
                          </span>
                          <span className="text-xs text-slate-500 hidden sm:inline">Use o formulário ou clique no mapa</span>
                      </div>
                      <div ref={mapContainerRef} className="w-full h-[300px] bg-slate-200 relative">
                           {/* Leaflet map mounts here */}
                           {!mapRef.current && (
                               <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                                   <Loader2 className="h-8 w-8 animate-spin" />
                               </div>
                           )}
                           {isGeocoding && (
                             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] bg-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2 text-xs font-medium text-blue-600">
                               <RefreshCw className="h-3 w-3 animate-spin" />
                               Atualizando endereço...
                             </div>
                           )}
                           
                           {/* Use Current Location Button inside Map */}
                           <button
                             type="button"
                             onClick={handleUseCurrentLocation}
                             className="absolute bottom-4 right-4 z-[400] bg-white p-2 rounded-full shadow-lg border border-slate-200 text-blue-600 hover:bg-blue-50 transition"
                             title="Usar minha localização atual"
                           >
                             <Crosshair className="h-5 w-5" />
                           </button>
                      </div>
                      <div className="bg-white p-2 text-xs text-center text-slate-500 border-t border-slate-200">
                         {formState.address.lat ? (
                             <span>Coordenadas selecionadas: {formState.address.lat.toFixed(5)}, {formState.address.lng?.toFixed(5)}</span>
                         ) : (
                             <span>Selecione sua localização no mapa acima</span>
                         )}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="relative">
                      <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                      <input
                        type="text"
                        required
                        placeholder="00000-000"
                        value={formState.address.zipCode}
                        onChange={(e) => handleInputChange('address', 'zipCode', e.target.value)}
                        maxLength={9}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      {isLoadingCep && (
                          <div className="absolute right-3 top-[34px] animate-spin">
                              <Loader2 className="h-4 w-4 text-blue-500" />
                          </div>
                      )}
                    </div>
                     <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                      <input
                        type="text"
                        disabled
                        value={formState.address.city}
                        className="w-full px-4 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rua / Logradouro</label>
                    <input
                      type="text"
                      required
                      value={formState.address.street}
                      onChange={(e) => handleInputChange('address', 'street', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                      <input
                        type="text"
                        required
                        value={formState.address.number}
                        onChange={(e) => handleInputChange('address', 'number', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div className="md:col-span-1">
                       <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                      <input
                        type="text"
                        required
                        value={formState.address.neighborhood}
                        onChange={(e) => handleInputChange('address', 'neighborhood', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                     <div className="md:col-span-1">
                        <button
                          type="button"
                          onClick={geocodeAddress}
                          disabled={isGeocoding || !formState.address.street}
                          className="w-full py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                           {isGeocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                           Buscar Endereço
                        </button>
                    </div>
                  </div>
                  
                  {/* Transport Request */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="transport"
                        checked={formState.student.needsTransport}
                        onChange={(e) => handleInputChange('student', 'needsTransport', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex items-center gap-2">
                        <Bus className="h-4 w-4 text-blue-700" />
                         <label htmlFor="transport" className="text-sm font-medium text-slate-700">Solicitar Transporte Escolar (Zona Rural/Difícil Acesso)</label>
                      </div>
                    </div>
                  </div>

                  {/* Document Upload Simulation */}
                   <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition">
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Anexar Comprovante de Residência</p>
                      <p className="text-xs text-slate-500">PNG, JPG ou PDF (Máx. 5MB)</p>
                   </div>
                </div>
              </div>
            )}

            {/* Step 4: School Selection */}
            {formState.step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Seleção de Preferência</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Com base no seu endereço, calculamos a distância para as unidades escolares.
                  Selecione a escola de sua preferência.
                </p>
                
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {sortedSchools.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center gap-3 text-yellow-800">
                       <AlertCircle className="h-5 w-5" />
                       <p className="text-sm">Não foram encontradas escolas cadastradas no sistema. Você pode prosseguir com a matrícula para ficar em lista de espera na zona de zoneamento.</p>
                    </div>
                  ) : (
                    sortedSchools.map((school, index) => {
                      const isNearest = index < 3 && school.distance !== undefined;
                      
                      return (
                        <div 
                          key={school.id}
                          onClick={() => setFormState(prev => ({ ...prev, selectedSchoolId: school.id }))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition relative ${
                            formState.selectedSchoolId === school.id 
                              ? 'border-blue-600 bg-blue-50' 
                              : isNearest 
                                ? 'border-green-200 bg-green-50/30 hover:border-green-300 hover:bg-green-50'
                                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                          }`}
                        >
                          {isNearest && (
                            <div className="absolute -top-2.5 right-4 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                               <Navigation className="h-3 w-3" /> Recomendada
                            </div>
                          )}

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`p-2 rounded-lg border ${isNearest ? 'bg-white border-green-100' : 'bg-white border-slate-100'}`}>
                                <SchoolIcon className={`h-6 w-6 ${isNearest ? 'text-green-600' : 'text-blue-600'}`} />
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-900">{school.name}</h4>
                                <p className="text-sm text-slate-500 flex items-center gap-1">
                                  {school.distance !== undefined && (
                                    <span className="font-medium text-slate-700 bg-slate-100 px-1.5 rounded flex items-center gap-0.5">
                                      <MapPin className="h-3 w-3" />
                                      {school.distance.toFixed(2)} km
                                    </span>
                                  )}
                                  <span className="truncate max-w-[180px]">{school.address}</span>
                                </p>
                                <div className="flex gap-1 mt-1">
                                  {school.types.map(t => <span key={t} className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600">{t}</span>)}
                                </div>
                              </div>
                            </div>
                            {formState.selectedSchoolId === school.id && <Check className="h-6 w-6 text-blue-600" />}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={prevStep}
                disabled={formState.step === 1 || isSubmitting}
                className={`flex items-center px-6 py-2 rounded-lg text-slate-700 font-medium hover:bg-slate-100 transition ${formState.step === 1 ? 'opacity-0 cursor-default' : ''}`}
              >
                <ChevronLeft className="h-5 w-5 mr-1" />
                Voltar
              </button>
              
              {formState.step < 4 ? (
                 <button
                  type="button"
                  onClick={nextStep}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md shadow-blue-200 transition"
                >
                  Próximo
                  <ChevronRight className="h-5 w-5 ml-1" />
                </button>
              ) : (
                <button
                  type="submit"
                  // Allow submit even if no school is selected if there are no schools (fallback logic)
                  disabled={(!formState.selectedSchoolId && sortedSchools.length > 0) || isSubmitting}
                  className="flex items-center px-8 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 shadow-md shadow-green-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Enviando...' : 'Confirmar Matrícula'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};