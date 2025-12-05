import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { 
  FileSpreadsheet, Upload, RefreshCw, Check, AlertTriangle, Database, 
  Download, Users, Search, ChevronLeft, ChevronRight, Eye, Save, UserPlus, X, Eraser,
  School as SchoolIcon, Layout, Bus, HeartPulse,
  ArrowUpDown, ArrowUp, ArrowDown, Layers, Trash2, Lock, Edit3, CheckSquare, Square, MinusSquare, LogOut,
  Pencil, MapPin, History, Clock, ChevronDown, ChevronUp, PlusCircle
} from 'lucide-react';
import { RegistryStudent, School, SchoolType, StudentHistory } from '../types';
import { Link } from '../router';

// Helper functions defined outside component
const normalizeKey = (key: string) => {
  return key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
};

// Normalization that preserves spaces for fuzzy word matching
const normalizeForFuzzy = (str: string) => {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
};

// Levenshtein distance algorithm for fuzzy matching
const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) return dateStr;
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

const parseCoordinate = (val: any): number => {
    if (!val) return 0;
    const strVal = String(val).replace(',', '.');
    const num = parseFloat(strVal);
    return isNaN(num) ? 0 : num;
};

const parseCSV = (text: string): any[] => {
  const lines = text.split(/\r\n|\n/);
  if (lines.length === 0) return [];
  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(separator).map(h => normalizeKey(h.trim()));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const obj: any = {};
    const currentline = lines[i].split(separator);
    for (let j = 0; j < headers.length; j++) {
      const val = currentline[j] ? currentline[j].trim().replace(/^"|"$/g, '') : '';
      obj[headers[j]] = val;
    }
    if (Object.keys(obj).some(k => obj[k])) {
      result.push(obj);
    }
  }
  return result;
};

const mapSchoolsFromData = (data: any[]): School[] => {
  return data.map((item: any, index: number) => {
    let types: SchoolType[] = [];
    const rawType = (item.tipo || item.types || item.modalidade || '').toLowerCase();
    
    if (rawType.includes('infantil') || rawType.includes('creche') || rawType.includes('pre')) types.push(SchoolType.INFANTIL);
    if (rawType.includes('fundamental')) {
       if (rawType.includes('1') || rawType.includes('i') || rawType.includes('inicial')) types.push(SchoolType.FUNDAMENTAL_1);
       if (rawType.includes('2') || rawType.includes('ii') || rawType.includes('final')) types.push(SchoolType.FUNDAMENTAL_2);
       if (!types.includes(SchoolType.FUNDAMENTAL_1) && !types.includes(SchoolType.FUNDAMENTAL_2)) types.push(SchoolType.FUNDAMENTAL_1);
    }
    if (rawType.includes('medio')) types.push(SchoolType.MEDIO);
    if (rawType.includes('eja')) types.push(SchoolType.EJA);
    if (types.length === 0) types.push(SchoolType.INFANTIL); // Default

    return {
      id: item.id || item.codigo || `school_${Date.now()}_${index}`,
      inep: item.inep || item.codigo || item.codinep || '',
      name: item.nome || item.name || item.escola || item.unidade || 'Escola Importada',
      address: item.endereco || item.address || item.localizacao || 'Endereço não informado',
      types: types,
      image: item.image || item.imagem || 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80',
      rating: parseFloat(item.rating || item.nota || item.avaliacao) || 4.5,
      availableSlots: parseInt(item.capacidade || item.vagas || item.availableslots) || 0,
      lat: parseCoordinate(item.lat || item.latitude),
      lng: parseCoordinate(item.lng || item.longitude)
    };
  });
};

const mapStudentsFromData = (data: any[]): RegistryStudent[] => {
  return data.map((item: any, index: number) => {
    const name = (item.name || item.nome || item.nomedoaluno || item.aluno || 'Aluno Sem Nome').toUpperCase();
    const cpfRaw = item.cpf || item.doc || item.documento || '';
    const cpf = cpfRaw.replace(/\D/g, '');
    const birthDateRaw = item.birthdate || item.nascimento || item.datadenascimento || item.dtnasc || '';
    
    const statusRaw = item.status || item.situacao || 'Matriculado';
    let status: RegistryStudent['status'] = 'Matriculado';
    if (statusRaw.toLowerCase().includes('pendente')) status = 'Pendente';
    if (statusRaw.toLowerCase().includes('analise')) status = 'Em Análise';

    return {
      id: item.id || item.matricula || item.codigo || item.ra || `student_${Date.now()}_${index}`,
      enrollmentId: item.enrollmentid || item.protocolo || item.matricula || item.codigomatricula || '',
      name: name,
      birthDate: formatDate(birthDateRaw),
      cpf: cpf,
      status: status,
      school: item.school || item.escola || item.unidadeescolar || item.creche || '',
      grade: item.grade || item.etapa || item.serie || item.ano || '',
      shift: item.shift || item.turno || item.periodo || '',
      className: item.classname || item.turma || item.nometurma || '',
      classId: item.classid || item.codturma || item.codigoturma || '',
      transportRequest: (item.transport || item.transporte || item.utilizatransporte || '').toString().toLowerCase().includes('sim'), 
      transportType: item.transporttype || item.tipotransporte || item.veiculo || '',
      specialNeeds: (item.specialneeds || item.deficiencia || item.nee || item.aee || '').toString().toLowerCase().includes('sim')
    };
  });
};

// Internal Confirmation Modal
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = "Confirmar", confirmColor = "bg-red-600" }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full relative p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4 text-slate-800">
          <div className="bg-slate-100 p-2 rounded-full">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold">{title}</h3>
        </div>
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 text-white font-bold rounded-lg hover:opacity-90 transition shadow-lg ${confirmColor}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Import Confirmation Modal
const ImportModal = ({ isOpen, onClose, onConfirm, dataLength, type, schoolName }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative p-6 animate-in zoom-in-95 duration-200">
                <div className="flex items-center gap-3 mb-4 text-slate-800">
                    <div className="bg-green-100 p-3 rounded-full text-green-600">
                        <FileSpreadsheet className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold">Arquivo Processado!</h3>
                        <p className="text-xs text-slate-500">Os dados estão prontos para importação.</p>
                    </div>
                </div>
                
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-sm text-slate-600">Tipo de Dados:</span>
                        <span className="font-bold text-slate-800">
                            {type === 'schools' ? 'Escolas' : type === 'educacenso' ? 'Censo Escolar Completo' : 'Alunos'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                        <span className="text-sm text-slate-600">Registros Encontrados:</span>
                        <span className="font-bold text-blue-600 text-lg">{dataLength}</span>
                    </div>
                    {schoolName && (
                        <div className="flex flex-col gap-1">
                            <span className="text-sm text-slate-600">Escola Vinculada:</span>
                            <span className="font-bold text-slate-800 text-sm bg-white p-2 rounded border border-slate-200 truncate">
                                <SchoolIcon className="h-3 w-3 inline mr-1 text-indigo-500" />
                                {schoolName}
                            </span>
                        </div>
                    )}
                </div>

                <p className="text-slate-600 text-sm mb-6 text-center">
                    Deseja salvar estes registros no banco de dados do sistema agora?
                </p>

                <div className="flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition"
                    >
                        Descartar
                    </button>
                    <button 
                        onClick={() => { onConfirm(); onClose(); }}
                        className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition shadow-lg flex items-center gap-2"
                    >
                        <Save className="h-4 w-4" />
                        Salvar Dados
                    </button>
                </div>
            </div>
        </div>
    );
};

// Bulk Action Modal
const BulkActionModal = ({ 
    isOpen, 
    onClose, 
    type, 
    schools,
    onConfirm 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    type: 'status' | 'class' | 'school', 
    schools?: School[],
    onConfirm: (data: any) => void 
}) => {
    const [status, setStatus] = useState('Matriculado');
    const [className, setClassName] = useState('');
    const [grade, setGrade] = useState('');
    const [shift, setShift] = useState('Matutino');
    const [targetSchool, setTargetSchool] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (type === 'status') {
            onConfirm({ status });
        } else if (type === 'school') {
            if (!targetSchool) return; 
            onConfirm({ school: targetSchool, status });
        } else {
            onConfirm({ className, grade, shift });
        }
        onClose();
    };

    const getTitle = () => {
        switch(type) {
            case 'status': return 'Alterar Status em Massa';
            case 'school': return 'Alocar Escola em Massa';
            case 'class': return 'Atribuir Turma em Massa';
            default: return 'Ação em Massa';
        }
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">
                        {getTitle()}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X className="h-5 w-5" /></button>
                </div>
                
                <div className="space-y-4 mb-6">
                    {type === 'status' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Novo Status</label>
                            <select 
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="Matriculado">Matriculado</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Em Análise">Em Análise</option>
                            </select>
                            <p className="text-xs text-slate-500 mt-2">Isso atualizará o status de todos os alunos selecionados.</p>
                        </div>
                    )}
                    
                    {type === 'school' && (
                         <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Escola de Destino</label>
                                <select 
                                    value={targetSchool}
                                    onChange={(e) => setTargetSchool(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Selecione uma escola...</option>
                                    {schools?.map(s => (
                                        <option key={s.id} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Definir Status como</label>
                                <select 
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="Matriculado">Matriculado</option>
                                    <option value="Pendente">Pendente</option>
                                    <option value="Em Análise">Em Análise</option>
                                </select>
                            </div>
                            <p className="text-xs text-slate-500">Os alunos selecionados serão movidos para esta escola com o status escolhido.</p>
                        </>
                    )}

                    {type === 'class' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Turma</label>
                                <input 
                                    type="text"
                                    placeholder="Ex: 1º ANO A"
                                    value={className}
                                    onChange={(e) => setClassName(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Etapa / Série</label>
                                    <input 
                                        type="text"
                                        placeholder="Ex: Fundamental I"
                                        value={grade}
                                        onChange={(e) => setGrade(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Turno</label>
                                    <select 
                                        value={shift}
                                        onChange={(e) => setShift(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="Matutino">Matutino</option>
                                        <option value="Vespertino">Vespertino</option>
                                        <option value="Noturno">Noturno</option>
                                        <option value="Integral">Integral</option>
                                    </select>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={type === 'school' && !targetSchool}
                        className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

// School Editor Modal
const SchoolEditModal = ({
    isOpen,
    onClose,
    onSave
}: {
    isOpen: boolean,
    onClose: () => void,
    onSave: (school: School) => void
}) => {
    const [schoolData, setSchoolData] = useState<Partial<School>>({
        name: '',
        address: '',
        inep: '',
        availableSlots: 0,
        types: [SchoolType.INFANTIL],
        lat: -12.5253,
        lng: -40.2917,
        rating: 5.0,
        image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80'
    });

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!schoolData.name || !schoolData.address) return;
        const newSchool: School = {
            id: `manual_school_${Date.now()}`,
            ...schoolData as School
        };
        onSave(newSchool);
        onClose();
    };

    const toggleType = (type: SchoolType) => {
        setSchoolData(prev => {
            const currentTypes = prev.types || [];
            if (currentTypes.includes(type)) {
                return { ...prev, types: currentTypes.filter(t => t !== type) };
            } else {
                return { ...prev, types: [...currentTypes, type] };
            }
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative animate-in zoom-in-95 duration-200 p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <SchoolIcon className="h-6 w-6 text-blue-600" />
                    Cadastrar Nova Escola
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Escola</label>
                        <input 
                            type="text"
                            value={schoolData.name}
                            onChange={e => setSchoolData({...schoolData, name: e.target.value.toUpperCase()})}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                            placeholder="ESCOLA MUNICIPAL..."
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Código INEP (Opcional)</label>
                            <input 
                                type="text"
                                value={schoolData.inep}
                                onChange={e => setSchoolData({...schoolData, inep: e.target.value})}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Vagas Totais</label>
                            <input 
                                type="number"
                                value={schoolData.availableSlots}
                                onChange={e => setSchoolData({...schoolData, availableSlots: parseInt(e.target.value) || 0})}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Endereço</label>
                        <input 
                            type="text"
                            value={schoolData.address}
                            onChange={e => setSchoolData({...schoolData, address: e.target.value})}
                            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Rua, Número, Bairro"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Modalidades de Ensino</label>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.values(SchoolType).map(type => (
                                <label key={type} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer p-2 border rounded-lg hover:bg-slate-50">
                                    <input 
                                        type="checkbox"
                                        checked={schoolData.types?.includes(type)}
                                        onChange={() => toggleType(type)}
                                        className="rounded text-blue-600 focus:ring-blue-500"
                                    />
                                    {type}
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200">Cancelar</button>
                    <button 
                        onClick={handleSubmit} 
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md"
                    >
                        Salvar Escola
                    </button>
                </div>
            </div>
        </div>
    );
};

// Student Details/Edit Modal
const StudentDetailModal = ({ 
    student, 
    onClose, 
    onSave, 
    schools, 
    isCreating = false 
}: { 
    student: RegistryStudent | null, 
    onClose: () => void, 
    onSave: (s: RegistryStudent) => void, 
    schools: School[], 
    isCreating?: boolean 
}) => {
    const [isEditing, setIsEditing] = useState(isCreating);
    const [formData, setFormData] = useState<RegistryStudent | null>(null);

    useEffect(() => {
        setFormData(student);
        setIsEditing(isCreating);
    }, [student, isCreating]);

    if (!student || !formData) return null;

    const handleChange = (field: keyof RegistryStudent, value: any) => {
        setFormData(prev => prev ? ({ ...prev, [field]: value }) : null);
    };

    const handleSave = () => {
        if (formData) {
            onSave(formData);
            if (!isCreating) setIsEditing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[90vh]">
                  
                  <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                      <div>
                          {isEditing ? (
                              <input 
                                type="text" 
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="NOME DO ALUNO"
                                className="text-lg font-bold text-slate-900 border-b border-blue-500 focus:outline-none bg-transparent w-full uppercase placeholder:text-slate-400"
                              />
                          ) : (
                              <h3 className="text-lg font-bold text-slate-900">{student.name}</h3>
                          )}
                          <div className="flex gap-2 mt-1">
                               {isEditing ? (
                                   <select 
                                    value={formData.status}
                                    onChange={(e) => handleChange('status', e.target.value)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-white focus:outline-none"
                                   >
                                       <option value="Matriculado">Matriculado</option>
                                       <option value="Pendente">Pendente</option>
                                       <option value="Em Análise">Em Análise</option>
                                   </select>
                               ) : (
                                   <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                        student.status === 'Matriculado' ? 'bg-green-100 text-green-700 border-green-200' : 
                                        'bg-yellow-100 text-yellow-700 border-yellow-200'
                                   }`}>
                                       {student.status}
                                   </span>
                               )}
                               
                               {isEditing ? (
                                   <label className="flex items-center gap-1 text-[10px] font-bold uppercase cursor-pointer select-none">
                                       <input 
                                        type="checkbox" 
                                        checked={formData.specialNeeds}
                                        onChange={(e) => handleChange('specialNeeds', e.target.checked)}
                                        className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                                       />
                                       AEE (Deficiência)
                                   </label>
                               ) : (
                                   student.specialNeeds && (
                                       <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-pink-100 text-pink-700 border border-pink-200 flex items-center gap-1">
                                           <HeartPulse className="h-3 w-3" /> AEE
                                       </span>
                                   )
                               )}
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          {!isEditing ? (
                              <button onClick={() => setIsEditing(true)} className="p-2 hover:bg-slate-200 rounded-full transition text-blue-600" title="Editar Aluno">
                                  <Edit3 className="h-5 w-5" />
                              </button>
                          ) : (
                              <button onClick={handleSave} className="p-2 bg-green-100 hover:bg-green-200 rounded-full transition text-green-700" title="Salvar Alterações">
                                  <Save className="h-5 w-5" />
                              </button>
                          )}
                          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition">
                              <X className="h-5 w-5 text-slate-500" />
                          </button>
                      </div>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                      
                      <section>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <Users className="h-3 w-3" /> Dados Pessoais
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                  <span className="text-xs text-slate-500 block mb-0.5">CPF</span>
                                  {isEditing ? (
                                      <input 
                                        type="text" 
                                        value={formData.cpf}
                                        onChange={(e) => handleChange('cpf', e.target.value)}
                                        className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1"
                                      />
                                  ) : (
                                      <span className="font-mono text-sm font-medium text-slate-800">{student.cpf || 'Não informado'}</span>
                                  )}
                              </div>
                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                  <span className="text-xs text-slate-500 block mb-0.5">Data de Nascimento</span>
                                   {isEditing ? (
                                      <input 
                                        type="text" 
                                        value={formData.birthDate}
                                        onChange={(e) => handleChange('birthDate', e.target.value)}
                                        placeholder="DD/MM/AAAA"
                                        className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1"
                                      />
                                  ) : (
                                      <span className="font-mono text-sm font-medium text-slate-800">{student.birthDate}</span>
                                  )}
                              </div>
                          </div>
                      </section>

                      <section>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <SchoolIcon className="h-3 w-3" /> Dados Acadêmicos
                          </h4>
                          <div className="space-y-3">
                              <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                                  <span className="text-sm text-slate-500">Escola</span>
                                   {isEditing ? (
                                      <select 
                                        value={formData.school || ''}
                                        onChange={(e) => handleChange('school', e.target.value)}
                                        className="text-sm bg-white border border-slate-300 rounded px-2 py-1 max-w-[300px]"
                                      >
                                          <option value="">Não alocada</option>
                                          {schools.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                      </select>
                                  ) : (
                                      <span className="text-sm font-bold text-slate-800">{student.school || 'Não alocada'}</span>
                                  )}
                              </div>
                               <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                                      <span className="text-xs text-slate-500 block">Turma</span>
                                      {isEditing ? (
                                          <input 
                                            type="text"
                                            value={formData.className}
                                            onChange={(e) => handleChange('className', e.target.value)}
                                            className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1 mt-1"
                                          />
                                      ) : (
                                          <span className="text-sm font-bold text-blue-600">{student.className || '-'}</span>
                                      )}
                                  </div>
                                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                                      <span className="text-xs text-slate-500 block">Turno</span>
                                      {isEditing ? (
                                           <select 
                                            value={formData.shift || ''}
                                            onChange={(e) => handleChange('shift', e.target.value)}
                                            className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1 mt-1"
                                          >
                                              <option value="Matutino">Matutino</option>
                                              <option value="Vespertino">Vespertino</option>
                                              <option value="Noturno">Noturno</option>
                                              <option value="Integral">Integral</option>
                                          </select>
                                      ) : (
                                          <span className="text-sm font-bold text-slate-800">{student.shift || '-'}</span>
                                      )}
                                  </div>
                               </div>
                               <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                                      <span className="text-xs text-slate-500 block">Etapa</span>
                                      {isEditing ? (
                                          <input 
                                            type="text"
                                            value={formData.grade}
                                            onChange={(e) => handleChange('grade', e.target.value)}
                                            className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1 mt-1"
                                          />
                                      ) : (
                                          <span className="text-sm font-medium text-slate-800">{student.grade || '-'}</span>
                                      )}
                                  </div>
                                  <div className="p-3 bg-white border border-slate-200 rounded-lg">
                                      <span className="text-xs text-slate-500 block">Matrícula/ID</span>
                                      {isEditing ? (
                                           <input 
                                            type="text"
                                            value={formData.enrollmentId}
                                            onChange={(e) => handleChange('enrollmentId', e.target.value)}
                                            className="w-full text-sm bg-white border border-slate-300 rounded px-2 py-1 mt-1"
                                          />
                                      ) : (
                                           <span className="text-sm font-mono text-slate-600">{student.enrollmentId || '-'}</span>
                                      )}
                                  </div>
                               </div>
                          </div>
                      </section>
                      
                      <section>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <Bus className="h-3 w-3" /> Serviços e Necessidades
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                               <div className={`p-3 rounded-lg border flex items-center gap-3 ${formData.transportRequest ? 'bg-green-50 border-green-200 text-green-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                   <Bus className="h-5 w-5" />
                                   <div>
                                       <span className="text-xs font-bold block">Transporte Escolar</span>
                                       {isEditing ? (
                                           <label className="text-xs cursor-pointer select-none flex items-center gap-1 mt-1">
                                               <input 
                                                type="checkbox" 
                                                checked={formData.transportRequest}
                                                onChange={(e) => handleChange('transportRequest', e.target.checked)}
                                               />
                                               Solicitar
                                           </label>
                                       ) : (
                                           <span className="text-xs">{student.transportRequest ? 'Solicitado' : 'Não utiliza'}</span>
                                       )}
                                   </div>
                               </div>
                               <div className={`p-3 rounded-lg border flex items-center gap-3 ${formData.specialNeeds ? 'bg-pink-50 border-pink-200 text-pink-800' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                   <HeartPulse className="h-5 w-5" />
                                   <div>
                                       <span className="text-xs font-bold block">Educação Especial</span>
                                       <span className="text-xs">{student.specialNeeds ? 'Sim' : 'Não'}</span>
                                   </div>
                               </div>
                          </div>
                      </section>

                      {/* History Section */}
                      {student.history && student.history.length > 0 && (
                          <section>
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                  <History className="h-3 w-3" /> Histórico de Alterações
                              </h4>
                              <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                  {student.history.slice().reverse().map((entry, idx) => (
                                      <div key={idx} className="p-3 border-b border-slate-100 last:border-0 flex justify-between items-start gap-3">
                                          <div className="flex-1">
                                              <p className="text-xs font-medium text-slate-800">{entry.action}</p>
                                              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                  <Users className="h-2 w-2" /> {entry.user}
                                              </p>
                                          </div>
                                          <span className="text-[10px] text-slate-400 whitespace-nowrap bg-white px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                                              <Clock className="h-2 w-2" />
                                              {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                          </span>
                                      </div>
                                  ))}
                              </div>
                          </section>
                      )}

                  </div>
                  
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
                      {isEditing && !isCreating && (
                          <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium rounded-lg transition">
                            Cancelar
                          </button>
                      )}
                      <button onClick={isEditing ? handleSave : onClose} className={`px-6 py-2 font-medium rounded-lg transition ${isEditing ? 'bg-green-600 hover:bg-green-700 text-white shadow-md' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}>
                          {isEditing ? (isCreating ? 'Cadastrar Aluno' : 'Salvar Alterações') : 'Fechar'}
                      </button>
                  </div>
              </div>
          </div>
    );
};

export const AdminData: React.FC = () => {
  const { schools, students, updateSchools, updateStudents, addStudent, removeStudent, resetData, lastBackupDate, registerBackup, addSchool } = useData();
  const { addToast } = useToast();
  
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  
  // Feedback States
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackDetails, setFeedbackDetails] = useState<string[]>([]);

  // Preview/Confirmation States
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [importType, setImportType] = useState<'schools' | 'students' | 'educacenso' | null>(null);
  const [educacensoSchool, setEducacensoSchool] = useState<School | null>(null); 
  const [showImportModal, setShowImportModal] = useState(false);

  // Reset Confirmation
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // View State
  const [activeTab, setActiveTab] = useState<'students' | 'classes'>('students');
  const [expandedClassKey, setExpandedClassKey] = useState<string | null>(null);

  // Student List Inspection States
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState('Todos'); 
  const [classFilter, setClassFilter] = useState('Todas');   
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<RegistryStudent | null>(null);
  const itemsPerPage = 10;
  
  // Manual Creation State
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof RegistryStudent; direction: 'asc' | 'desc' } | null>(null);

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionModal, setBulkActionModal] = useState<{ isOpen: boolean, type: 'status' | 'class' | 'school' | 'delete' }>({ isOpen: false, type: 'status' });

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      // Simple mock auth
      if (passwordInput === 'admin123') {
          setIsAuthenticated(true);
          addToast('Acesso administrativo concedido.', 'success');
      } else {
          addToast('Senha incorreta.', 'error');
      }
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    setPasswordInput('');
    addToast('Sessão encerrada com sucesso.', 'info');
  };

  // Derived Data for Filters
  const schoolStats = useMemo(() => {
      const stats: Record<string, number> = {};
      students.forEach(s => {
          const name = s.school || 'Não alocada';
          stats[name] = (stats[name] || 0) + 1;
      });
      return stats;
  }, [students]);

  const schoolNames = useMemo(() => {
      return Object.keys(schoolStats).sort();
  }, [schoolStats]);

  // Extract unique class names from students for filter
  const classNames = useMemo(() => {
      const classes = new Set(students.map(s => s.className).filter(Boolean));
      return Array.from(classes).sort();
  }, [students]);

  // Count unallocated students
  const unallocatedCount = useMemo(() => {
    return students.filter(s => !s.school || s.school === 'Não alocada').length;
  }, [students]);

  // ... (Educacenso Processing - same as before) ...
  const processEducacensoRaw = (text: string) => {
    const lines = text.split(/\r\n|\n/);
    let schoolName = "Escola Municipal";
    let schoolCode = "";
    let city = "Município";
    
    const newStudents: RegistryStudent[] = [];
    let isTableBody = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('Nome da escola:')) schoolName = line.split(';').find(p => p && p.trim() !== '' && !p.includes('Nome da escola'))?.trim() || schoolName;
      if (line.includes('Código da escola:')) schoolCode = line.split(';').find(p => p && p.trim() !== '' && !p.includes('Código da escola'))?.trim() || schoolCode;
      if (line.includes('Município:')) city = line.split(';').find(p => p && p.trim() !== '' && !p.includes('Município'))?.trim() || city;

      if (line.includes('Identificação única') && line.includes('Nome')) {
        isTableBody = true;
        continue; 
      }

      if (isTableBody && line.trim() !== '') {
        const cols = line.split(';');
        const id = cols[2]?.trim();
        const name = cols[4]?.trim();
        
        if (id && name) {
            const birthDate = cols[7]?.trim();
            const cpf = cols[9]?.trim();
            const transport = cols[22]?.trim().toLowerCase() === 'sim';
            const enrollmentId = cols[26]?.trim();
            const classId = cols[27]?.trim();
            const className = cols[28]?.trim();
            const grade = cols[31]?.trim() || cols[30]?.trim(); 
            let shift = 'Integral';
            const schedule = cols[34] || '';
            if (schedule.toLowerCase().includes('13:00') || className?.includes('VESPERTINO')) shift = 'Vespertino';
            else if (schedule.toLowerCase().includes('08:00') && !schedule.toLowerCase().includes('17:00') || className?.includes('MATUTINO')) shift = 'Matutino';
            const specialNeedsRaw = cols[15]?.trim();
            const specialNeeds = specialNeedsRaw && specialNeedsRaw !== '--' && specialNeedsRaw !== '';

            newStudents.push({
              id: id,
              enrollmentId: enrollmentId,
              name: name.toUpperCase(),
              birthDate: birthDate,
              cpf: cpf,
              status: 'Matriculado',
              school: schoolName,
              grade: grade,
              className: className,
              classId: classId,
              shift: shift,
              transportRequest: transport,
              specialNeeds: !!specialNeeds,
              transportType: transport ? 'Vans/Kombis' : undefined
            });
        }
      }
    }

    if (newStudents.length > 0) {
        const schoolExists = schools.some(s => s.name === schoolName || s.inep === schoolCode);
        let newSchool: School | null = null;
        
        if (!schoolExists) {
             newSchool = {
                id: schoolCode || Date.now().toString(),
                inep: schoolCode,
                name: schoolName,
                address: `${city} - BA`,
                types: [SchoolType.INFANTIL, SchoolType.FUNDAMENTAL_1],
                image: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80',
                rating: 5.0,
                availableSlots: 0,
                lat: -12.5253,
                lng: -40.2917
             };
        }
        return { students: newStudents, school: newSchool };
    }
    return null;
  };

  // ... (Process File Logic - same as before) ...
  const processFile = (file: File) => {
    setIsUploading(true);
    setUploadStatus('idle');
    setFeedbackMessage('');
    setFeedbackDetails([]);
    setUploadProgress(0);
    setPreviewData(null);
    setImportType(null);
    setEducacensoSchool(null);
    setProcessingStage('Iniciando...');
    setShowImportModal(false);

    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    reader.onload = (event) => {
      setTimeout(() => {
        try {
          const content = event.target?.result as string;
          
          if (file.name.endsWith('.json')) {
              const parsed = JSON.parse(content);
              
              if (!Array.isArray(parsed) && (parsed.schools || parsed.students)) {
                 if (parsed.schools) updateSchools(parsed.schools);
                 if (parsed.students) updateStudents(parsed.students);
                 setFeedbackMessage('Backup restaurado com sucesso!');
                 addToast('Backup restaurado com sucesso!', 'success');
                 setUploadStatus('success');
              } else if (Array.isArray(parsed) && parsed.length > 0) {
                 const sample = parsed[0];
                 if (sample.nome || sample.name || sample.capacidade || sample.vagas || sample.lat) {
                     setPreviewData(mapSchoolsFromData(parsed));
                     setImportType('schools');
                 } else {
                     setPreviewData(mapStudentsFromData(parsed));
                     setImportType('students');
                 }
                 setShowImportModal(true); // Open modal on success
              } else {
                 throw new Error("Formato JSON inválido ou vazio.");
              }

          } else if (file.name.endsWith('.csv') || content.includes('Ministério da Educação')) {
              if (content.includes('Ministério da Educação') || content.includes('Educacenso')) {
                  const result = processEducacensoRaw(content);
                  if (result) {
                      setPreviewData(result.students);
                      setImportType('educacenso');
                      setEducacensoSchool(result.school);
                      setShowImportModal(true); // Open modal on success
                  } else {
                      throw new Error("Nenhum aluno encontrado no arquivo do Educacenso.");
                  }
              } else {
                  const parsedData = parseCSV(content);
                  if (parsedData.length > 0) {
                      const keys = Object.keys(parsedData[0]);
                      const isSchool = keys.some(k => 
                          ['lat', 'latitude', 'capacidade', 'vagas', 'endereco', 'address', 'tipo'].includes(k)
                      );
                      
                      if (isSchool) {
                          setPreviewData(mapSchoolsFromData(parsedData));
                          setImportType('schools');
                      } else {
                          setPreviewData(mapStudentsFromData(parsedData));
                          setImportType('students');
                      }
                      setShowImportModal(true); // Open modal on success
                  } else {
                      throw new Error("Arquivo CSV vazio ou inválido.");
                  }
              }
          } else {
              throw new Error("Formato não suportado.");
          }
          setProcessingStage('Pronto para importar!');
        } catch (error: any) {
          console.error("Import error:", error);
          setUploadStatus('error');
          setFeedbackMessage(error.message || 'Erro ao ler o arquivo.');
          addToast(error.message || 'Erro ao ler o arquivo.', 'error');
        } finally {
          setIsUploading(false);
        }
      }, 600);
    };

    reader.onerror = () => {
      setUploadStatus('error');
      setFeedbackMessage('Erro de leitura.');
      addToast('Erro de leitura do arquivo.', 'error');
      setIsUploading(false);
    };

    reader.readAsText(file, 'ISO-8859-1');
  };

  const confirmImport = () => {
      if (!previewData) return;

      if (importType === 'schools') {
          updateSchools(previewData as School[]);
          setFeedbackMessage(`${previewData.length} escolas importadas com sucesso.`);
          addToast(`${previewData.length} escolas importadas.`, 'success');
      } else if (importType === 'students') {
          updateStudents(previewData as RegistryStudent[]);
          setFeedbackMessage(`${previewData.length} alunos importados com sucesso.`);
          addToast(`${previewData.length} alunos importados.`, 'success');
      } else if (importType === 'educacenso') {
          if (educacensoSchool) {
              updateSchools([educacensoSchool]);
          }
          updateStudents(previewData as RegistryStudent[]);
          setFeedbackMessage(`${previewData.length} alunos do Educacenso importados.`);
          addToast(`Importação do Educacenso concluída.`, 'success');
      }

      setUploadStatus('success');
      setPreviewData(null);
      setImportType(null);
      setShowImportModal(false);
  };

  const cancelImport = () => {
      setPreviewData(null);
      setImportType(null);
      setUploadStatus('idle');
      setFeedbackMessage('');
      setShowImportModal(false);
      addToast('Importação cancelada.', 'info');
  };

  const executeReset = () => {
    resetData();
    addToast('Todos os dados foram resetados para o padrão.', 'warning');
  };

  const handleCreateStudent = () => {
    const newStudent: RegistryStudent = {
        id: `manual_${Date.now()}`,
        name: '',
        birthDate: '',
        cpf: '',
        status: 'Pendente',
        school: '',
        grade: '',
        shift: '',
        transportRequest: false,
        specialNeeds: false,
        enrollmentId: ''
    };
    setSelectedStudent(newStudent);
    setIsCreating(true);
  };

  const handleSaveSchool = (school: School) => {
      addSchool(school);
      addToast('Escola cadastrada com sucesso!', 'success');
  };

  // --- Handlers ---
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleBackup = () => {
      const backupData = { students, schools };
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `backup_educa_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      // Update backup metadata
      registerBackup();
      
      addToast('Backup baixado com sucesso. Salve em local seguro!', 'success');
  };

  const resetUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadStatus('idle');
    setUploadProgress(0);
  };

  const clearFilters = () => {
      setSearchTerm('');
      setSchoolFilter('Todas');
      setStatusFilter('Todos');
      setClassFilter('Todas');
      setCurrentPage(1);
      setSortConfig(null);
      setSelectedIds(new Set());
  };

  const handleSort = (key: keyof RegistryStudent) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  // --- Selection Logic ---
  
  const toggleSelection = (id: string) => {
      const newSelection = new Set(selectedIds);
      if (newSelection.has(id)) {
          newSelection.delete(id);
      } else {
          newSelection.add(id);
      }
      setSelectedIds(newSelection);
  };

  // --- Filter Logic ---
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const searchLower = normalizeForFuzzy(searchTerm);
      const studentName = normalizeForFuzzy(student.name);
      const studentCpf = student.cpf ? student.cpf.replace(/\D/g, '') : '';
      const studentSchool = (student.school || '').toLowerCase();
      const simpleSearchTerm = searchTerm.toLowerCase().trim();

      // Standard matching first (Includes)
      let matchesSearch = studentName.includes(searchLower) || 
                            studentCpf.includes(simpleSearchTerm) ||
                            studentSchool.includes(simpleSearchTerm);

      // Fuzzy matching if no direct match and search term is long enough to be a name
      if (!matchesSearch && searchLower.length > 2 && !/\d/.test(searchLower)) {
          // Check full string distance
          const dist = getLevenshteinDistance(searchLower, studentName);
          // Allow 1 error per 4 characters approx, max 3 errors
          const threshold = Math.min(3, Math.floor(searchLower.length / 4) + 1);
          
          if (dist <= threshold) {
              matchesSearch = true;
          } else {
              // Check partial word matching (e.g. search "Matheus" matches "Mateus Silva")
              const searchParts = searchLower.split(' ');
              const nameParts = studentName.split(' ');

              // If searching for single word name, check if any name part matches closely
              if (searchParts.length === 1) {
                  matchesSearch = nameParts.some(part => {
                      return getLevenshteinDistance(searchLower, part) <= 1; // Strict for single word
                  });
              }
          }
      }
                            
      const matchesSchool = schoolFilter === 'Todas' || student.school === schoolFilter;
      const matchesStatus = statusFilter === 'Todos' || student.status === statusFilter;
      const matchesClass = classFilter === 'Todas' || student.className === classFilter;

      return matchesSearch && matchesSchool && matchesStatus && matchesClass;
    });
  }, [students, searchTerm, schoolFilter, statusFilter, classFilter]);

  // --- Sorting Logic ---
  const sortedStudents = useMemo(() => {
      if (!sortConfig) return filteredStudents;

      return [...filteredStudents].sort((a, b) => {
          let aVal = a[sortConfig.key] || '';
          let bVal = b[sortConfig.key] || '';

          // Normalize for case-insensitive comparison
          aVal = String(aVal).toLowerCase();
          bVal = String(bVal).toLowerCase();

          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  }, [filteredStudents, sortConfig]);

  // Clear selection when filters change to avoid confusion
  useEffect(() => {
      setSelectedIds(new Set());
  }, [searchTerm, schoolFilter, statusFilter, classFilter]);

  const handleSelectAll = () => {
      if (selectedIds.size === sortedStudents.length && sortedStudents.length > 0) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(sortedStudents.map(s => s.id)));
      }
  };

  // --- Bulk Action Handlers ---

  const executeBulkAction = (data: any) => {
      if (bulkActionModal.type === 'status') {
          const updatedStudents = students.map(s => {
              if (selectedIds.has(s.id)) {
                  // Add History Log
                  const historyItem: StudentHistory = {
                      date: new Date().toISOString(),
                      action: `Status alterado em massa para ${data.status}`,
                      user: 'Gestor'
                  };
                  return { ...s, status: data.status, history: [...(s.history || []), historyItem] };
              }
              return s;
          });
          updateStudents(updatedStudents);
          addToast(`${selectedIds.size} alunos atualizados para "${data.status}".`, 'success');
      } else if (bulkActionModal.type === 'school') {
          const updatedStudents = students.map(s => {
              if (selectedIds.has(s.id)) {
                  // Add History Log
                  const historyItem: StudentHistory = {
                      date: new Date().toISOString(),
                      action: `Alocado em massa para ${data.school} (${data.status})`,
                      user: 'Gestor'
                  };
                  return { 
                      ...s, 
                      school: data.school, 
                      status: data.status || 'Matriculado',
                      history: [...(s.history || []), historyItem]
                  };
              }
              return s;
          });
          updateStudents(updatedStudents);
          addToast(`Escola "${data.school}" atribuída para ${selectedIds.size} alunos.`, 'success');
      } else if (bulkActionModal.type === 'class') {
          const updatedStudents = students.map(s => {
              if (selectedIds.has(s.id)) {
                  const changes = [];
                  if (data.className) changes.push(`Turma: ${data.className}`);
                  if (data.grade) changes.push(`Etapa: ${data.grade}`);
                  if (data.shift) changes.push(`Turno: ${data.shift}`);
                  
                  const historyItem: StudentHistory = {
                      date: new Date().toISOString(),
                      action: `Enturmação em massa: ${changes.join(', ')}`,
                      user: 'Gestor'
                  };

                  return { 
                      ...s, 
                      className: data.className || s.className,
                      grade: data.grade || s.grade,
                      shift: data.shift || s.shift,
                      history: [...(s.history || []), historyItem]
                  };
              }
              return s;
          });
          updateStudents(updatedStudents);
          addToast(`Turma atribuída para ${selectedIds.size} alunos.`, 'success');
      }
      setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
      // Iterate through selected IDs and remove them
      let count = 0;
      selectedIds.forEach(id => {
          removeStudent(id);
          count++;
      });
      
      addToast(`${count} alunos excluídos com sucesso.`, 'success');
      setSelectedIds(new Set());
  };

  const handleSaveStudent = (updatedStudent: RegistryStudent) => {
      const originalStudent = students.find(s => s.id === updatedStudent.id);
      
      if (isCreating) {
          const historyItem: StudentHistory = {
              date: new Date().toISOString(),
              action: 'Aluno cadastrado manualmente',
              user: 'Gestor'
          };
          updatedStudent.history = [historyItem];
          addStudent(updatedStudent);
          addToast('Novo aluno cadastrado com sucesso!', 'success');
      } else {
          // Detect changes for history
          const changes = [];
          if (originalStudent) {
              if (originalStudent.status !== updatedStudent.status) changes.push(`Status: ${originalStudent.status} -> ${updatedStudent.status}`);
              if (originalStudent.school !== updatedStudent.school) changes.push(`Escola: ${originalStudent.school || 'N/A'} -> ${updatedStudent.school || 'N/A'}`);
              if (originalStudent.className !== updatedStudent.className) changes.push(`Turma: ${originalStudent.className || 'N/A'} -> ${updatedStudent.className || 'N/A'}`);
              if (originalStudent.shift !== updatedStudent.shift) changes.push(`Turno: ${originalStudent.shift || 'N/A'} -> ${updatedStudent.shift || 'N/A'}`);
          } else {
              changes.push("Edição de dados");
          }

          if (changes.length > 0) {
              const historyItem: StudentHistory = {
                  date: new Date().toISOString(),
                  action: changes.join('; '),
                  user: 'Gestor'
              };
              updatedStudent.history = [...(originalStudent?.history || []), historyItem];
          }

          updateStudents([updatedStudent]);
          addToast('Dados do aluno atualizados com sucesso.', 'success');
      }
      setSelectedStudent(updatedStudent);
      setIsCreating(false);
  };

  // --- Grouped Classes Logic (for Classes Tab) ---
  const groupedClasses = useMemo(() => {
    const groups: Record<string, { 
      id: string, 
      school: string, 
      className: string, 
      grade: string, 
      shift: string, 
      count: number 
    }> = {};

    filteredStudents.forEach(s => {
      // Use filteredStudents so the class list respects the global filters
      const className = s.className || 'Sem Turma';
      const school = s.school || 'Sem Escola';
      const key = `${school}-${className}`;

      if (!groups[key]) {
        groups[key] = {
          id: key,
          school,
          className,
          grade: s.grade || '-',
          shift: s.shift || '-',
          count: 0
        };
      }
      groups[key].count++;
    });

    return Object.values(groups).sort((a, b) => a.school.localeCompare(b.school) || a.className.localeCompare(b.className));
  }, [filteredStudents]);

  const maxClassCount = Math.max(...groupedClasses.map(c => c.count), 1);

  // --- CSV Export Logic ---
  const handleExportFilteredCSV = () => {
      // Logic for exporting data while respecting filters and encoding
      
      let csvContent = "";
      
      if (activeTab === 'classes') {
          // Headers for Classes
          csvContent += "Escola;Turma;Etapa;Turno;Qtd Alunos\n";
          // Rows
          groupedClasses.forEach(c => {
              const row = [
                  `"${c.school}"`,
                  `"${c.className}"`,
                  `"${c.grade}"`,
                  `"${c.shift}"`,
                  c.count
              ];
              csvContent += row.join(";") + "\n";
          });
      } else {
          // Headers for Students - Add History
          csvContent += "ID;Nome;CPF;Data Nascimento;Status;Escola;Turma;Etapa;Turno;Protocolo;Transporte;Deficiencia;Historico\n";
          // Rows
          sortedStudents.forEach(s => {
              // Format history: [Date] Action (User)
              const historyStr = s.history 
                  ? s.history.map(h => `[${new Date(h.date).toLocaleDateString()} ${new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}] ${h.action} (${h.user})`).join(' | ') 
                  : '';

              const row = [
                  `"${s.id}"`,
                  `"${s.name}"`,
                  `"${s.cpf || ''}"`,
                  `"${s.birthDate}"`,
                  `"${s.status}"`,
                  `"${s.school || ''}"`,
                  `"${s.className || ''}"`,
                  `"${s.grade || ''}"`,
                  `"${s.shift || ''}"`,
                  `"${s.enrollmentId || ''}"`,
                  s.transportRequest ? "Sim" : "Não",
                  s.specialNeeds ? "Sim" : "Não",
                  `"${historyStr}"`
              ];
              csvContent += row.join(";") + "\n";
          });
      }

      // Add BOM for Excel UTF-8 compatibility
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      
      // Dynamic Filename
      const timestamp = new Date().toISOString().slice(0,10);
      let filename = `exportacao_${activeTab}_${timestamp}`;
      if (statusFilter !== 'Todos') filename += `_${statusFilter.toLowerCase()}`;
      filename += ".csv";
      
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleExportClassList = (className: string) => {
      const studentsInClass = sortedStudents.filter(s => s.className === className);
      let csvContent = "Nome;CPF;Data Nascimento;Status\n";
      studentsInClass.forEach(s => {
          const row = [
              `"${s.name}"`,
              `"${s.cpf || ''}"`,
              `"${s.birthDate}"`,
              `"${s.status}"`
          ];
          csvContent += row.join(";") + "\n";
      });

      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `lista_presenca_${className.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }

  // Pagination Logic
  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedStudents = sortedStudents.slice(indexOfFirstItem, indexOfLastItem);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const toggleClassExpansion = (classId: string) => {
      setExpandedClassKey(prev => prev === classId ? null : classId);
  };

  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-slate-200">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Lock className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Área Restrita</h2>
                  <p className="text-slate-500 mb-6">Acesso exclusivo para gestores da Secretaria de Educação.</p>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input 
                          type="password" 
                          placeholder="Senha de Acesso" 
                          value={passwordInput}
                          onChange={(e) => setPasswordInput(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                      />
                      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-lg shadow-blue-200">
                          Entrar no Sistema
                      </button>
                  </form>
                  <p className="text-xs text-slate-400 mt-6">
                      Ambiente seguro e monitorado.
                  </p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Gestão de Dados</h1>
            <p className="text-slate-600">
              Administre a base de alunos e escolas. <span className="font-semibold text-blue-600">{students.length}</span> alunos cadastrados.
            </p>
          </div>
          <div className="flex gap-3">
             <Link to="/dashboard" className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition flex items-center gap-2 font-medium">
                <Layers className="h-4 w-4" />
                Ir para Dashboard
             </Link>
             <button onClick={handleLogout} className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 transition flex items-center gap-2 font-medium">
                <LogOut className="h-4 w-4" />
                Sair
             </button>
          </div>
        </div>

        {/* Toolbar Section: Search, Filters, Actions */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col xl:flex-row gap-4 justify-between items-center sticky top-20 z-30">
            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome, CPF..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 scrollbar-hide">
                    <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="Todos">Status: Todos</option>
                        <option value="Matriculado">Matriculado</option>
                        <option value="Pendente">Pendente</option>
                        <option value="Em Análise">Em Análise</option>
                    </select>
                    
                    <select 
                        value={schoolFilter}
                        onChange={(e) => setSchoolFilter(e.target.value)}
                        className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none max-w-[150px]"
                    >
                        <option value="Todas">Escolas: Todas</option>
                        {schoolNames.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>

                    {activeTab === 'students' && (
                        <select 
                            value={classFilter}
                            onChange={(e) => setClassFilter(e.target.value)}
                            className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 outline-none max-w-[150px]"
                        >
                            <option value="Todas">Turmas: Todas</option>
                            {classNames.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
                    
                    {(searchTerm || schoolFilter !== 'Todas' || statusFilter !== 'Todos' || classFilter !== 'Todas') && (
                        <button onClick={clearFilters} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="Limpar Filtros">
                            <Eraser className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-3 w-full xl:w-auto justify-end">
                 <button 
                    onClick={() => setIsCreatingSchool(true)}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 shadow-sm"
                 >
                    <PlusCircle className="h-4 w-4" />
                    Nova Escola
                 </button>
                 <button 
                    onClick={handleCreateStudent}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition flex items-center gap-2 shadow-sm"
                 >
                    <UserPlus className="h-4 w-4" />
                    Novo Aluno
                 </button>
                 <button 
                    onClick={handleExportFilteredCSV}
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition flex items-center gap-2"
                 >
                    <Download className="h-4 w-4" />
                    {activeTab === 'classes' ? 'Exportar Resumo' : 'Exportar Lista'}
                 </button>
            </div>
        </div>

        {/* Tabs Control */}
        <div className="flex gap-1 mb-0 border-b border-slate-200">
            <button
                onClick={() => setActiveTab('students')}
                className={`px-6 py-3 text-sm font-medium rounded-t-lg transition flex items-center gap-2 border-t border-l border-r ${
                    activeTab === 'students' 
                    ? 'bg-white border-slate-200 border-b-transparent text-blue-600' 
                    : 'bg-slate-50 border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
                <Users className="h-4 w-4" />
                Alunos ({filteredStudents.length})
            </button>
            <button
                onClick={() => setActiveTab('classes')}
                className={`px-6 py-3 text-sm font-medium rounded-t-lg transition flex items-center gap-2 border-t border-l border-r ${
                    activeTab === 'classes' 
                    ? 'bg-white border-slate-200 border-b-transparent text-blue-600' 
                    : 'bg-slate-50 border-transparent text-slate-500 hover:text-slate-700'
                }`}
            >
                <Layout className="h-4 w-4" />
                Turmas ({groupedClasses.length})
            </button>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-slate-200 border-t-0 overflow-hidden min-h-[500px] flex flex-col">
            
            {/* STUDENTS TAB */}
            {activeTab === 'students' && (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 w-10">
                                        <input 
                                            type="checkbox" 
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            checked={selectedIds.size > 0 && selectedIds.size === sortedStudents.length}
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('name')}>
                                        <div className="flex items-center gap-1">Nome {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</div>
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('cpf')}>
                                        <div className="flex items-center gap-1">CPF {sortConfig?.key === 'cpf' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</div>
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('school')}>
                                        <div className="flex items-center gap-1">Escola {sortConfig?.key === 'school' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</div>
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('className')}>
                                        <div className="flex items-center gap-1">Turma {sortConfig?.key === 'className' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</div>
                                    </th>
                                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('status')}>
                                        <div className="flex items-center gap-1">Status {sortConfig?.key === 'status' && (sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</div>
                                    </th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedStudents.length > 0 ? (
                                    paginatedStudents.map((student) => (
                                        <tr key={student.id} className={`hover:bg-slate-50 transition group ${selectedIds.has(student.id) ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-6 py-4">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedIds.has(student.id)}
                                                    onChange={() => toggleSelection(student.id)}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="font-medium text-slate-900 hover:text-blue-600 hover:underline text-left block"
                                                >
                                                    {student.name}
                                                </button>
                                                {student.enrollmentId && <span className="text-xs text-slate-400 font-mono block mt-0.5">{student.enrollmentId}</span>}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 font-mono text-xs">{student.cpf || '-'}</td>
                                            <td className="px-6 py-4 text-slate-600 text-xs truncate max-w-[200px]">{student.school || '-'}</td>
                                            <td className="px-6 py-4 text-slate-600 text-xs">
                                                {student.className ? (
                                                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{student.className}</span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                                    student.status === 'Matriculado' ? 'bg-green-100 text-green-700' : 
                                                    student.status === 'Em Análise' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {student.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button 
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Ver Detalhes / Editar"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                            Nenhum aluno encontrado com os filtros atuais.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="border-t border-slate-200 p-4 flex items-center justify-between mt-auto bg-slate-50">
                        <span className="text-sm text-slate-500">
                            Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, sortedStudents.length)} de {sortedStudents.length} alunos
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    pageNum = currentPage - 3 + i;
                                    if (pageNum > totalPages) pageNum = i + 1; // Fallback logic simplified
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => handlePageChange(pageNum)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium ${
                                            currentPage === pageNum
                                                ? 'bg-blue-600 text-white'
                                                : 'border border-slate-300 hover:bg-white text-slate-600'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className="p-2 border border-slate-300 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* CLASSES TAB */}
            {activeTab === 'classes' && (
                <div className="overflow-x-auto p-4">
                    {groupedClasses.length > 0 ? (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 w-10"></th>
                                    <th className="px-6 py-4">Escola</th>
                                    <th className="px-6 py-4">Turma</th>
                                    <th className="px-6 py-4">Etapa</th>
                                    <th className="px-6 py-4">Turno</th>
                                    <th className="px-6 py-4">Total Alunos</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {groupedClasses.map((cls) => {
                                    const occupancy = (cls.count / maxClassCount) * 100;
                                    const isExpanded = expandedClassKey === cls.id;
                                    const classStudents = isExpanded 
                                        ? filteredStudents.filter(s => 
                                            (s.school || 'Sem Escola') === cls.school && 
                                            (s.className || 'Sem Turma') === cls.className
                                          )
                                        : [];

                                    return (
                                        <React.Fragment key={cls.id}>
                                            <tr 
                                                className={`hover:bg-slate-50 transition cursor-pointer ${isExpanded ? 'bg-slate-50' : ''}`}
                                                onClick={() => toggleClassExpansion(cls.id)}
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="text-slate-400">
                                                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-800">{cls.school}</td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
                                                        {cls.className}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">{cls.grade}</td>
                                                <td className="px-6 py-4 text-slate-600">{cls.shift}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-slate-800 w-6">{cls.count}</span>
                                                        <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${cls.count > 25 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                                style={{ width: `${Math.min(occupancy, 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleExportClassList(cls.className);
                                                        }}
                                                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition"
                                                        title="Baixar Lista de Chamada"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr className="bg-slate-50/50">
                                                    <td colSpan={7} className="px-6 py-4 border-t border-slate-100">
                                                        <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm animate-in slide-in-from-top-2">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Lista de Alunos</h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                                                {classStudents.map(student => (
                                                                    <div key={student.id} className="flex items-center justify-between p-2 rounded border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-200 transition text-xs">
                                                                        <div>
                                                                            <p className="font-medium text-slate-800">{student.name}</p>
                                                                            <p className="text-slate-500 font-mono text-[10px]">{student.cpf || 'Sem CPF'}</p>
                                                                        </div>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                                            student.status === 'Matriculado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                                                                        }`}>
                                                                            {student.status}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                            <Layout className="h-12 w-12 mb-3 opacity-20" />
                            <p>Nenhuma turma encontrada.</p>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.size > 0 && activeTab === 'students' && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl z-40 flex items-center gap-6 animate-in slide-in-from-bottom-4">
                <span className="font-bold text-sm bg-slate-700 px-2 py-0.5 rounded flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    {selectedIds.size} selecionados
                </span>
                
                <div className="h-4 w-px bg-slate-700"></div>

                <div className="flex gap-2">
                    <button 
                        onClick={() => setBulkActionModal({ isOpen: true, type: 'status' })}
                        className="hover:text-blue-300 transition text-sm font-medium flex items-center gap-1.5"
                    >
                        <RefreshCw className="h-4 w-4" /> Alterar Status
                    </button>
                    <button 
                        onClick={() => setBulkActionModal({ isOpen: true, type: 'class' })}
                        className="hover:text-blue-300 transition text-sm font-medium flex items-center gap-1.5"
                    >
                        <Layout className="h-4 w-4" /> Atribuir Turma
                    </button>
                    <button 
                        onClick={() => setBulkActionModal({ isOpen: true, type: 'school' })}
                        className="hover:text-blue-300 transition text-sm font-medium flex items-center gap-1.5"
                    >
                        <SchoolIcon className="h-4 w-4" /> Alocar Escola
                    </button>
                    <button 
                        onClick={() => setBulkActionModal({ isOpen: true, type: 'delete' })}
                        className="hover:text-red-400 transition text-sm font-medium flex items-center gap-1.5 text-red-300 ml-2"
                    >
                        <Trash2 className="h-4 w-4" /> Excluir
                    </button>
                </div>

                <button onClick={() => setSelectedIds(new Set())} className="ml-2 hover:bg-white/10 p-1 rounded-full transition">
                    <X className="h-4 w-4" />
                </button>
            </div>
        )}

        {/* Import/Reset Zone (Collapsible or Bottom) */}
        <div className="mt-8 border-t border-slate-200 pt-8">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Database className="h-5 w-5 text-slate-400" />
                Manutenção do Sistema
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
                {/* Import Box */}
                <div 
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors relative ${
                        isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {isUploading ? (
                        <div className="flex flex-col items-center">
                            <RefreshCw className="h-10 w-10 text-blue-600 animate-spin mb-4" />
                            <p className="text-slate-600 font-medium">{processingStage}</p>
                            <div className="w-64 h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                            </div>
                        </div>
                    ) : uploadStatus === 'success' ? (
                        <div className="flex flex-col items-center animate-in zoom-in">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <Check className="h-8 w-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">Processado com Sucesso!</h3>
                            <p className="text-slate-600 text-sm mb-4">{feedbackMessage}</p>
                            <button onClick={resetUpload} className="text-blue-600 hover:underline text-sm font-medium">
                                Importar outro arquivo
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center pointer-events-none">
                            <Upload className="h-10 w-10 text-slate-400 mb-3" />
                            <p className="text-slate-600 font-medium mb-1">Arraste e solte arquivos aqui</p>
                            <p className="text-xs text-slate-400 mb-4">Suporta CSV do Educacenso ou Backup JSON</p>
                            <label className="pointer-events-auto px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-700 text-sm font-bold hover:bg-slate-50 cursor-pointer transition">
                                Selecionar Arquivo
                                <input type="file" className="hidden" accept=".csv,.json,.txt" onChange={handleInputChange} />
                            </label>
                        </div>
                    )}
                </div>

                {/* Reset & Backup Actions */}
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
                        <div>
                            <h4 className="font-bold text-slate-800 mb-2">Cópia de Segurança</h4>
                            <p className="text-sm text-slate-500 mb-4">
                                Baixe todos os dados cadastrados localmente para prevenir perdas.
                                {lastBackupDate && <span className="block mt-2 text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Último backup: {new Date(lastBackupDate).toLocaleDateString()}</span>}
                            </p>
                        </div>
                        <button 
                            onClick={handleBackup}
                            className="w-full py-3 bg-blue-50 text-blue-700 font-bold rounded-lg hover:bg-blue-100 transition flex items-center justify-center gap-2 border border-blue-100"
                        >
                            <Download className="h-5 w-5" />
                            Baixar Backup Completo
                        </button>
                    </div>

                    <div className="bg-red-50 p-6 rounded-xl border border-red-100 flex flex-col justify-between">
                        <div>
                            <h4 className="font-bold text-red-800 mb-2">Zona de Perigo</h4>
                            <p className="text-sm text-red-600 mb-4">
                                Restaurar os dados originais de fábrica apagará todas as importações e edições.
                            </p>
                        </div>
                        <button 
                            onClick={() => setIsResetModalOpen(true)}
                            className="w-full py-3 bg-white border border-red-200 text-red-600 font-bold rounded-lg hover:bg-red-600 hover:text-white transition flex items-center justify-center gap-2"
                        >
                            <Trash2 className="h-5 w-5" />
                            Zerar Sistema
                        </button>
                    </div>
                </div>
            </div>
        </div>

      </div>

      {/* Modals */}
      <ConfirmationModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={executeReset}
        title="Tem certeza absoluta?"
        message="Esta ação é irreversível. Todos os alunos e escolas importados serão apagados e o sistema voltará ao estado inicial de demonstração."
        confirmText="Sim, Apagar Tudo"
      />

      <ConfirmationModal 
        isOpen={bulkActionModal.isOpen && bulkActionModal.type === 'delete'}
        onClose={() => setBulkActionModal({ ...bulkActionModal, isOpen: false })}
        onConfirm={handleBulkDelete}
        title={`Excluir ${selectedIds.size} alunos?`}
        message="Os registros selecionados serão removidos permanentemente do sistema. Confirme para continuar."
        confirmText="Excluir Registros"
      />

      <ImportModal 
        isOpen={showImportModal}
        onClose={cancelImport}
        onConfirm={confirmImport}
        dataLength={previewData?.length || 0}
        type={importType}
        schoolName={educacensoSchool?.name}
      />

      <BulkActionModal 
        isOpen={bulkActionModal.isOpen && bulkActionModal.type !== 'delete'}
        onClose={() => setBulkActionModal({ ...bulkActionModal, isOpen: false })}
        type={bulkActionModal.type as any}
        schools={schools}
        onConfirm={executeBulkAction}
      />

      <StudentDetailModal 
        student={selectedStudent}
        isCreating={isCreating}
        schools={schools}
        onClose={() => { setSelectedStudent(null); setIsCreating(false); }}
        onSave={handleSaveStudent}
      />

      <SchoolEditModal 
        isOpen={isCreatingSchool}
        onClose={() => setIsCreatingSchool(false)}
        onSave={handleSaveSchool}
      />

    </div>
  );
};