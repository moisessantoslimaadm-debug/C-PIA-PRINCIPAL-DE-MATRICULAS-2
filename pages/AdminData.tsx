
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useToast } from '../contexts/ToastContext';
import { 
  FileSpreadsheet, Upload, RefreshCw, Check, AlertTriangle, Database, 
  Download, Users, Search, ChevronLeft, ChevronRight, Eye, Save, UserPlus, X, Eraser,
  School as SchoolIcon, Layout, Bus, HeartPulse,
  ArrowUpDown, ArrowUp, ArrowDown, Layers, Trash2, Lock, Edit3, CheckSquare, Square, MinusSquare, LogOut,
  Pencil
} from 'lucide-react';
import { RegistryStudent, School, SchoolType } from '../types';

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

// Bulk Action Modal
const BulkActionModal = ({ isOpen, onClose, type, onConfirm }: { isOpen: boolean, onClose: () => void, type: 'status' | 'class', onConfirm: (data: any) => void }) => {
    const [status, setStatus] = useState('Matriculado');
    const [className, setClassName] = useState('');
    const [grade, setGrade] = useState('');
    const [shift, setShift] = useState('Matutino');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (type === 'status') {
            onConfirm({ status });
        } else {
            onConfirm({ className, grade, shift });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full relative p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-800">
                        {type === 'status' ? 'Alterar Status em Massa' : 'Atribuir Turma em Massa'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full"><X className="h-5 w-5" /></button>
                </div>
                
                <div className="space-y-4 mb-6">
                    {type === 'status' ? (
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
                    ) : (
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
                    <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">Salvar Alterações</button>
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
  const { schools, students, updateSchools, updateStudents, addStudent, removeStudent, resetData, lastBackupDate, registerBackup } = useData();
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

  // Reset Confirmation
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // View State
  const [activeTab, setActiveTab] = useState<'students' | 'classes'>('students');

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

  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof RegistryStudent; direction: 'asc' | 'desc' } | null>(null);

  // Mass Allocation State
  const [targetSchoolId, setTargetSchoolId] = useState('');
  const [allocationMessage, setAllocationMessage] = useState('');

  // Bulk Actions State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionModal, setBulkActionModal] = useState<{ isOpen: boolean, type: 'status' | 'class' | 'delete' }>({ isOpen: false, type: 'status' });

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
  };

  const cancelImport = () => {
      setPreviewData(null);
      setImportType(null);
      setUploadStatus('idle');
      setFeedbackMessage('');
      addToast('Importação cancelada.', 'info');
  };

  const handleMassAllocation = () => {
      if (!targetSchoolId) return;
      const school = schools.find(s => s.id === targetSchoolId);
      if (!school) return;

      const unallocated = students.filter(s => !s.school || s.school === 'Não alocada');
      
      const studentsToUpdate = unallocated.map(s => ({ ...s, school: school.name, status: 'Matriculado' as const }));
      updateStudents(studentsToUpdate);

      setAllocationMessage(`${unallocated.length} alunos foram alocados para ${school.name}.`);
      addToast(`${unallocated.length} alunos alocados com sucesso.`, 'success');
      setTimeout(() => setAllocationMessage(''), 5000);
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
                  return { ...s, status: data.status };
              }
              return s;
          });
          updateStudents(updatedStudents);
          addToast(`${selectedIds.size} alunos atualizados para "${data.status}".`, 'success');
      } else if (bulkActionModal.type === 'class') {
          const updatedStudents = students.map(s => {
              if (selectedIds.has(s.id)) {
                  return { 
                      ...s, 
                      className: data.className || s.className,
                      grade: data.grade || s.grade,
                      shift: data.shift || s.shift
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
      if (isCreating) {
          addStudent(updatedStudent);
          addToast('Novo aluno cadastrado com sucesso!', 'success');
      } else {
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
      // Use filteredStudents so the class counts reflect the current filters
      const key = `${s.school}_${s.className}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          school: s.school || 'Não alocada',
          className: s.className || 'Sem Turma',
          grade: s.grade || '-',
          shift: s.shift || '-',
          count: 0
        };
      }
      groups[key].count += 1;
    });

    return Object.values(groups).sort((a, b) => 
        a.school.localeCompare(b.school) || a.className.localeCompare(b.className)
    );
  }, [filteredStudents]);

  const maxClassCount = useMemo(() => {
    if (groupedClasses.length === 0) return 0;
    return Math.max(...groupedClasses.map(c => c.count));
  }, [groupedClasses]);

  const handleExportClassCSV = (cls: any) => {
      const classStudents = students.filter(s => {
          const sSchool = s.school || 'Não alocada';
          const sClass = s.className || 'Sem Turma';
          return sSchool === cls.school && sClass === cls.className;
      });

      if (classStudents.length === 0) {
          addToast("Turma vazia.", 'warning');
          return;
      }

      const headers = ["Nome do Aluno", "Matrícula", "Data de Nascimento", "CPF", "Status", "Transporte", "Deficiência"];
      const rows = classStudents.sort((a,b) => a.name.localeCompare(b.name)).map(s => [
          s.name, 
          s.enrollmentId || '', 
          s.birthDate || '', 
          s.cpf || '', 
          s.status, 
          s.transportRequest ? 'Sim' : 'Não',
          s.specialNeeds ? 'Sim' : 'Não'
      ]);

      const csvContent = [
          headers.join(";"),
          ...rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      ].join("\r\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Lista_${cls.className.replace(/[^a-z0-9]/gi, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`Lista da turma exportada com sucesso.`, 'success');
  };

  const handleExportFilteredCSV = () => {
    // Uses sortedStudents which contains all items matching current filters and sort order
    if (sortedStudents.length === 0) {
        addToast("Nenhum registro para exportar com os filtros atuais.", 'warning');
        return;
    }

    // Define headers corresponding to columns
    const headers = [
        "ID do Sistema", "Nome Completo", "CPF", "Data de Nascimento", "Status da Matrícula", 
        "Escola Alocada", "Turma", "Etapa / Série", "Turno", "Solicitou Transporte?", "Possui Deficiência?", "Protocolo / Matrícula"
    ];

    // Helper for safe CSV formatting
    const escapeCsv = (text: any) => {
        if (text === null || text === undefined) return '';
        const str = String(text);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    // Map data from SORTED students
    const rows = sortedStudents.map(s => [
        s.id,
        s.name,
        s.cpf, // Raw CPF is fine if escaped, or we can force string with quotes if needed for Excel to not truncate leading zeros. Usually Excel needs ="value" or just text.
        s.birthDate,
        s.status,
        s.school || 'Não Alocada',
        s.className,
        s.grade,
        s.shift,
        s.transportRequest ? 'Sim' : 'Não',
        s.specialNeeds ? 'Sim' : 'Não',
        s.enrollmentId
    ]);

    const csvContent = [
        headers.join(";"),
        ...rows.map(row => row.map(escapeCsv).join(";"))
    ].join("\r\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    // Generate filename with timestamp
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `exportacao_alunos_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exportação de ${sortedStudents.length} alunos realizada com sucesso.`, 'success');
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedStudents.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  // Sort Icon Component
  const SortIcon = ({ column }: { column: keyof RegistryStudent }) => {
      if (sortConfig?.key !== column) return <ArrowUpDown className="h-3 w-3 text-slate-300 ml-1" />;
      return sortConfig.direction === 'asc' 
          ? <ArrowUp className="h-3 w-3 text-blue-600 ml-1" />
          : <ArrowDown className="h-3 w-3 text-blue-600 ml-1" />;
  };

  const SortableHeader = ({ label, column, className = "" }: { label: string, column: keyof RegistryStudent, className?: string }) => (
      <th 
          className={`px-6 py-3 cursor-pointer hover:bg-slate-200 transition select-none group ${className}`}
          onClick={() => handleSort(column)}
      >
          <div className="flex items-center gap-1">
              {label}
              <SortIcon column={column} />
          </div>
      </th>
  );

  // --- Render Login Overlay if not authenticated ---
  if (!isAuthenticated) {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-md w-full animate-in zoom-in-95 duration-300">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Lock className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-center text-slate-900 mb-2">Área Restrita</h2>
                  <p className="text-center text-slate-500 mb-8">Esta área é destinada apenas para gestores autorizados. Por favor, identifique-se.</p>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Código de Acesso</label>
                          <input 
                              type="password" 
                              autoFocus
                              placeholder="••••••••"
                              value={passwordInput}
                              onChange={(e) => setPasswordInput(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                          />
                      </div>
                      <button 
                          type="submit"
                          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
                      >
                          Acessar Painel
                      </button>
                  </form>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Gestão de Dados</h1>
            <p className="text-slate-600 mt-1">Importe, gerencie e analise os dados da rede municipal.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if(window.confirm('Deseja fazer um backup antes de resetar?')) handleBackup();
                setIsResetModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition text-sm font-medium"
            >
              <Trash2 className="h-4 w-4" />
              Zerar Dados
            </button>
            <button 
              onClick={handleBackup}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-sm font-medium"
            >
              <Save className="h-4 w-4" />
              Backup Manual
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white border border-slate-800 rounded-lg hover:bg-slate-900 transition text-sm font-medium shadow-sm"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </div>

        {/* --- Import Section --- */}
        <div 
          className={`bg-white rounded-2xl shadow-sm border-2 border-dashed transition-all duration-300 mb-8 overflow-hidden ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400'}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isUploading ? (
              <div className="p-12 flex flex-col items-center justify-center text-center">
                  {uploadStatus === 'idle' && (
                      <div className="animate-pulse flex flex-col items-center">
                          <RefreshCw className="h-10 w-10 text-blue-500 animate-spin mb-4" />
                          <h3 className="text-lg font-bold text-slate-800">{processingStage}</h3>
                          <p className="text-slate-500 mt-2">Processando {uploadProgress}%</p>
                      </div>
                  )}
                  {uploadStatus === 'success' && (
                       <div className="flex flex-col items-center animate-in zoom-in-95">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                              <Check className="h-8 w-8 text-green-600" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">Sucesso!</h3>
                          <p className="text-slate-600">{feedbackMessage}</p>
                          <button onClick={resetUpload} className="mt-6 px-6 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition">
                              Importar outro arquivo
                          </button>
                       </div>
                  )}
                   {uploadStatus === 'error' && (
                       <div className="flex flex-col items-center animate-in zoom-in-95">
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                              <AlertTriangle className="h-8 w-8 text-red-600" />
                          </div>
                          <h3 className="text-xl font-bold text-slate-800 mb-2">Erro na Importação</h3>
                          <p className="text-red-600 font-medium">{feedbackMessage}</p>
                          <button onClick={resetUpload} className="mt-6 px-6 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition">
                              Tentar novamente
                          </button>
                       </div>
                  )}
              </div>
          ) : previewData ? (
             <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-slate-800">Confirmar Importação</h3>
                    <div className="flex gap-2">
                        <button onClick={cancelImport} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium">Cancelar</button>
                        <button onClick={confirmImport} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">
                            Confirmar Importação
                        </button>
                    </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                     <p className="font-medium text-slate-700">Resumo:</p>
                     <ul className="list-disc list-inside text-sm text-slate-600 mt-2 space-y-1">
                         <li>Tipo de Dados: <span className="font-bold uppercase text-blue-600">{importType}</span></li>
                         <li>Total de Registros: <span className="font-bold">{previewData.length}</span></li>
                         {educacensoSchool && <li>Escola Vinculada: <span className="font-bold">{educacensoSchool.name}</span></li>}
                     </ul>
                </div>
                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                            <tr>
                                <th className="p-3">Nome / Descrição</th>
                                <th className="p-3">ID / Código</th>
                            </tr>
                        </thead>
                        <tbody>
                            {previewData.slice(0, 10).map((item: any, idx: number) => (
                                <tr key={idx} className="border-b border-slate-100">
                                    <td className="p-3">{item.name}</td>
                                    <td className="p-3 font-mono text-xs">{item.id || item.inep}</td>
                                </tr>
                            ))}
                            {previewData.length > 10 && (
                                <tr><td colSpan={2} className="p-3 text-center text-slate-500">... e mais {previewData.length - 10} registros</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
             </div>
          ) : (
             <div className="p-10 flex flex-col items-center justify-center text-center cursor-pointer" onClick={() => document.getElementById('fileInput')?.click()}>
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                  <Upload className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Arraste arquivos aqui ou clique para selecionar</h3>
                <p className="text-slate-500 mt-2 max-w-sm">
                  Suporta arquivos .CSV do Excel, .JSON de backup ou exportações do Educacenso/Sige.
                </p>
                <input 
                  type="file" 
                  id="fileInput" 
                  className="hidden" 
                  accept=".csv,.json,.txt" 
                  onChange={handleInputChange} 
                />
             </div>
          )}
        </div>

        {/* --- Main Content Tabs --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
            
            {/* Tab Header */}
            <div className="border-b border-slate-200 flex items-center justify-between px-6 py-4 bg-slate-50/50">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setActiveTab('students')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${activeTab === 'students' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users className="h-4 w-4" />
                        Alunos Cadastrados
                    </button>
                    <button 
                         onClick={() => setActiveTab('classes')}
                         className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${activeTab === 'classes' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Layers className="h-4 w-4" />
                        Visão por Turmas
                    </button>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Database className="h-4 w-4" />
                    <span className="font-mono">{students.length}</span> registros
                </div>
            </div>
            
            {/* Filters Toolbar */}
            <div className="p-4 border-b border-slate-200 grid grid-cols-1 lg:grid-cols-5 gap-4 bg-white">
                <div className="lg:col-span-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome, CPF ou ID..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                </div>
                <select 
                    value={schoolFilter}
                    onChange={(e) => setSchoolFilter(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                    <option value="Todas">Todas as Escolas</option>
                    <option value="Não alocada">Não Alocadas</option>
                    {schoolNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                <select 
                     value={statusFilter}
                     onChange={(e) => setStatusFilter(e.target.value)}
                     className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                >
                    <option value="Todos">Todos os Status</option>
                    <option value="Matriculado">Matriculado</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Em Análise">Em Análise</option>
                </select>
                
                 {/* Action Buttons */}
                <div className="flex gap-2">
                     <button 
                        onClick={clearFilters}
                        className="px-3 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                        title="Limpar Filtros"
                    >
                        <Eraser className="h-4 w-4" />
                    </button>
                     <button 
                        onClick={handleCreateStudent}
                        className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-4 py-2 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
                    >
                        <UserPlus className="h-4 w-4" />
                        Novo
                    </button>
                    <button 
                        onClick={handleExportFilteredCSV}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-lg hover:bg-green-100 transition text-sm font-medium"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-slate-50 relative">
                
                {/* Floating Bulk Action Bar */}
                {selectedIds.size > 0 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-4">
                        <span className="font-bold text-sm whitespace-nowrap border-r border-slate-600 pr-4">
                            {selectedIds.size} selecionados
                        </span>
                        
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setBulkActionModal({ isOpen: true, type: 'status' })}
                                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded-lg transition text-xs font-medium"
                            >
                                <CheckSquare className="h-4 w-4" />
                                Alterar Status
                            </button>
                            <button 
                                onClick={() => setBulkActionModal({ isOpen: true, type: 'class' })}
                                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-700 rounded-lg transition text-xs font-medium"
                            >
                                <Layout className="h-4 w-4" />
                                Atribuir Turma
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-red-900/50 text-red-300 rounded-lg transition text-xs font-medium"
                            >
                                <Trash2 className="h-4 w-4" />
                                Excluir
                            </button>
                        </div>

                        <button onClick={() => setSelectedIds(new Set())} className="ml-2 hover:bg-slate-700 p-1 rounded-full">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}


                {/* Tab: Students Table */}
                {activeTab === 'students' && (
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <button onClick={handleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-blue-600">
                                        {selectedIds.size > 0 && selectedIds.size === sortedStudents.length ? <CheckSquare className="h-5 w-5" /> : selectedIds.size > 0 ? <MinusSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                    </button>
                                </th>
                                <SortableHeader label="Nome do Aluno" column="name" />
                                <SortableHeader label="CPF" column="cpf" className="hidden md:table-cell" />
                                <SortableHeader label="Escola" column="school" className="hidden sm:table-cell" />
                                <SortableHeader label="Turma" column="className" className="hidden lg:table-cell" />
                                <SortableHeader label="Status" column="status" />
                                <th className="px-6 py-3 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {currentItems.length > 0 ? (
                                currentItems.map((student) => (
                                    <tr key={student.id} className={`hover:bg-blue-50/50 transition ${selectedIds.has(student.id) ? 'bg-blue-50' : ''}`}>
                                        <td className="px-4 py-3">
                                            <button onClick={() => toggleSelection(student.id)} className={`flex items-center justify-center ${selectedIds.has(student.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}>
                                                {selectedIds.has(student.id) ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                                            </button>
                                        </td>
                                        <td className="px-6 py-3 font-medium text-slate-900">
                                            <button onClick={() => setSelectedStudent(student)} className="hover:text-blue-600 hover:underline text-left">
                                                {student.name}
                                            </button>
                                            <div className="md:hidden text-xs text-slate-500 mt-0.5">{student.cpf}</div>
                                        </td>
                                        <td className="px-6 py-3 font-mono text-slate-600 hidden md:table-cell">{student.cpf || '-'}</td>
                                        <td className="px-6 py-3 text-slate-600 hidden sm:table-cell">
                                            {student.school || <span className="text-slate-400 italic">Não alocada</span>}
                                        </td>
                                        <td className="px-6 py-3 hidden lg:table-cell">
                                            {student.className ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200">
                                                    {student.className}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                                                student.status === 'Matriculado' ? 'bg-green-100 text-green-700' : 
                                                student.status === 'Em Análise' ? 'bg-blue-100 text-blue-700' : 
                                                'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {student.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right">
                                            <button 
                                                onClick={() => setSelectedStudent(student)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="Ver Detalhes"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-500">
                                        Nenhum aluno encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
                
                {/* Tab: Classes Table */}
                {activeTab === 'classes' && (
                     <div className="p-0">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="px-6 py-3">Escola</th>
                                    <th className="px-6 py-3">Turma</th>
                                    <th className="px-6 py-3">Etapa / Série</th>
                                    <th className="px-6 py-3">Turno</th>
                                    <th className="px-6 py-3 text-center">Total Alunos</th>
                                    <th className="px-6 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {groupedClasses.length > 0 ? (
                                    groupedClasses.map((cls) => (
                                        <tr key={cls.id} className="hover:bg-slate-50 transition">
                                            <td className="px-6 py-4 font-medium text-slate-800">{cls.school}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                                    {cls.className}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{cls.grade}</td>
                                            <td className="px-6 py-4 text-slate-600">{cls.shift}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex flex-col items-center justify-center gap-1.5">
                                                    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 text-xs">
                                                        {cls.count}
                                                    </span>
                                                    {maxClassCount > 0 && (
                                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                                                                style={{ width: `${(cls.count / maxClassCount) * 100}%` }}
                                                            ></div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleExportClassCSV(cls)}
                                                        className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                                                        title="Baixar Lista da Turma"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setActiveTab('students');
                                                            setSchoolFilter(cls.school === 'Não alocada' ? 'Não alocada' : cls.school);
                                                            setClassFilter(cls.className);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 text-xs font-bold px-3 py-1.5 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                                                    >
                                                        Ver Lista
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-500">
                                            Nenhum turma encontrada.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                     </div>
                )}

            </div>
            
            {/* Pagination Footer */}
            {activeTab === 'students' && totalPages > 1 && (
                <div className="border-t border-slate-200 p-4 bg-white flex justify-between items-center">
                    <span className="text-sm text-slate-500">
                        Mostrando {indexOfFirstItem + 1} a {Math.min(indexOfLastItem, sortedStudents.length)} de {sortedStudents.length}
                    </span>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        {[...Array(totalPages)].map((_, i) => (
                             // Logic to show limited pages if too many
                             (i + 1 === 1 || i + 1 === totalPages || (i + 1 >= currentPage - 1 && i + 1 <= currentPage + 1)) ? (
                                <button
                                    key={i}
                                    onClick={() => paginate(i + 1)}
                                    className={`w-8 h-8 rounded-lg text-sm font-medium ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
                                >
                                    {i + 1}
                                </button>
                             ) : (
                                 (i + 1 === 2 || i + 1 === totalPages - 1) && <span key={i} className="px-1 text-slate-400">...</span>
                             )
                        ))}
                        <button 
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="p-2 border border-slate-200 rounded-lg disabled:opacity-50 hover:bg-slate-50"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
      
      {/* Modals */}
      <ConfirmationModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={executeReset}
        title="Tem certeza absoluta?"
        message="Esta ação apagará todos os alunos e escolas do sistema e restaurará os dados de demonstração. Esta ação não pode ser desfeita sem um backup prévio."
        confirmText="Sim, Zerar Tudo"
      />

      <BulkActionModal 
        isOpen={bulkActionModal.isOpen}
        onClose={() => setBulkActionModal({ ...bulkActionModal, isOpen: false })}
        type={bulkActionModal.type as any}
        onConfirm={executeBulkAction}
      />

      <StudentDetailModal 
        student={selectedStudent} 
        isCreating={isCreating}
        onClose={() => { setSelectedStudent(null); setIsCreating(false); }} 
        onSave={handleSaveStudent}
        schools={schools}
      />
    </div>
  );
};
