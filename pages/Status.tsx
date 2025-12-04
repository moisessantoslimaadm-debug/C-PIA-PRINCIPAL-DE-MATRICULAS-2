import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from '../router';
import { CheckCircle, FileText, Search, UserCheck, AlertCircle, Bus, GraduationCap, School, Clock, Hash, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { RegistryStudent } from '../types';

type SortField = 'name' | 'cpf';
type SortDirection = 'asc' | 'desc';

// Helper for normalizing text (removes accents, converts to lowercase, removes special chars)
const normalizeString = (str: string) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ""); // Remove special chars (keep letters, numbers, spaces)
};

// Helper to format CPF input dynamically
const formatSearchInput = (value: string) => {
  // If the first character is a number, apply CPF mask
  // Also allows pasting a CPF with standard formatting
  const numbers = value.replace(/\D/g, '');
  
  // If it starts with a number or looks like it's trying to be a CPF
  if (/^\d/.test(value) || (numbers.length > 0 && numbers.length <= 11 && !/[a-z]/i.test(value))) {
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  }
  return value; // Return as is for names
};

export const Status: React.FC = () => {
  const { students } = useData();
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get('success') === 'true';
  const [activeTab, setActiveTab] = useState<'protocol' | 'student'>('protocol');
  
  // Protocol Search State
  const [protocolInput, setProtocolInput] = useState('');
  
  // Student Registry Search State
  const [studentInput, setStudentInput] = useState('');
  const [searchResults, setSearchResults] = useState<RegistryStudent[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // Filter & Sort States
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSearchInput(e.target.value);
    setStudentInput(formatted);
  };

  const handleStudentSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInput.trim()) return;

    const term = studentInput.trim();
    const normalizedTerm = normalizeString(term);
    const cleanCpfTerm = term.replace(/\D/g, '');

    const found = students.filter(s => {
      // Name Search (Normalized & Robust)
      // Removes special chars to ensure "D'Ávila" matches "davila"
      const studentNameNorm = normalizeString(s.name);
      const matchesName = studentNameNorm.includes(normalizedTerm);

      // CPF Search (Clean numbers)
      const studentCpfClean = s.cpf ? s.cpf.replace(/\D/g, '') : '';
      // Only match CPF if the term looks like a CPF (has digits) and matches
      // Allowing partial match for CPF if at least 3 digits to avoid noise
      const matchesCpf = cleanCpfTerm.length >= 3 && studentCpfClean.includes(cleanCpfTerm);

      // Protocol/ID Search
      const matchesProtocol = s.enrollmentId && s.enrollmentId.toLowerCase().includes(term.toLowerCase());
      const matchesId = s.id === term;

      return matchesName || matchesCpf || matchesProtocol || matchesId;
    });

    setSearchResults(found);
    setHasSearched(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const processedResults = useMemo(() => {
    let results = [...searchResults];

    // Filter
    if (statusFilter !== 'Todos') {
      results = results.filter(s => s.status === statusFilter);
    }

    // Sort
    results.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      
      if (sortField === 'cpf') {
         // Remove non-digits for cleaner sorting
         valA = valA.replace(/\D/g, '');
         valB = valB.replace(/\D/g, '');
      } else {
        // Case insensitive sort for names
        valA = valA.toString().toLowerCase();
        valB = valB.toString().toLowerCase();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return results;
  }, [searchResults, statusFilter, sortField, sortDirection]);

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 print-container">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in zoom-in-95 duration-300 border border-slate-100 print:shadow-none print:border-none print:w-full print:max-w-none">
          
          {/* Print Header */}
          <div className="hidden print:block mb-8 border-b border-black pb-4">
            <h1 className="text-xl font-bold uppercase">Secretaria Municipal de Educação</h1>
            <p className="text-sm">Comprovante de Solicitação de Matrícula</p>
          </div>

          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner no-print">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Solicitação Enviada!</h2>
          <p className="text-slate-600 mb-6">
            Os dados foram recebidos com sucesso. O número do seu protocolo é:
          </p>
          <div className="bg-blue-50 py-4 px-6 rounded-xl mb-8 border border-blue-100 print:bg-transparent print:border-black print:border-2">
            <span className="text-2xl font-mono font-bold text-blue-700 tracking-wider print:text-black">MAT-{Math.floor(Math.random() * 100000)}</span>
          </div>
          <p className="text-sm text-slate-500 mb-8 no-print">
            Você receberá atualizações sobre o status da matrícula no email cadastrado e via WhatsApp.
          </p>
          <div className="space-y-3 no-print">
             <button onClick={() => window.print()} className="w-full py-3 border border-slate-200 rounded-xl text-slate-700 font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2">
              <FileText className="h-4 w-4" />
              Imprimir Comprovante
            </button>
            <Link to="/" className="block w-full py-3 bg-blue-600 rounded-xl text-white font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200/50">
              Voltar ao Início
            </Link>
          </div>

          <div className="hidden print:block text-xs text-left mt-12 pt-4 border-t border-black">
             <p>Data de emissão: {new Date().toLocaleDateString()} às {new Date().toLocaleTimeString()}</p>
             <p className="mt-2">Este comprovante garante apenas o registro da solicitação, não a vaga. Aguarde a confirmação oficial.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 no-print">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Consultas</h1>
          <p className="text-slate-600 mt-2">Verifique o andamento da matrícula ou a situação cadastral.</p>
        </div>
        
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 min-h-[500px]">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('protocol')}
              className={`flex-1 py-4 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 relative ${
                activeTab === 'protocol' 
                  ? 'text-blue-600' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FileText className="h-4 w-4" />
              Protocolo
              {activeTab === 'protocol' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
            </button>
            <button
              onClick={() => setActiveTab('student')}
              className={`flex-1 py-4 text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 relative ${
                activeTab === 'student' 
                  ? 'text-blue-600' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              <UserCheck className="h-4 w-4" />
              Buscar Aluno
              {activeTab === 'student' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-full"></div>}
            </button>
          </div>

          <div className="p-6 md:p-8">
            {activeTab === 'protocol' ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300 max-w-md mx-auto mt-8">
                <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">CPF do Responsável</label>
                   <input type="text" placeholder="000.000.000-00" className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" />
                </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-700 mb-1">Número do Protocolo</label>
                   <input 
                    type="text" 
                    placeholder="MAT-00000" 
                    value={protocolInput}
                    onChange={(e) => setProtocolInput(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                   />
                </div>
                <button className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 mt-2 transition shadow-lg shadow-blue-200">
                  Consultar
                </button>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <form onSubmit={handleStudentSearch} className="space-y-4 max-w-2xl mx-auto">
                   <div className="relative">
                     <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo ou CPF do Aluno</label>
                     <input 
                      type="text" 
                      placeholder="Digite o nome ou CPF (apenas números)..." 
                      value={studentInput}
                      onChange={handleSearchInputChange}
                      className="w-full px-4 py-3 pl-11 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-shadow" 
                     />
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                   </div>
                   <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                    Pesquisar na Rede
                  </button>
                </form>

                {/* Filters and Sort Controls - Only show if search triggered */}
                {searchResults.length > 0 && (
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 mt-6">
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Filter className="h-4 w-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">Filtrar:</span>
                            <select 
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="text-sm border-slate-300 rounded-lg border px-3 py-1.5 focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="Todos">Todos</option>
                                <option value="Matriculado">Matriculado</option>
                                <option value="Pendente">Pendente</option>
                                <option value="Em Análise">Em Análise</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                            <span className="text-sm font-medium text-slate-700">Ordenar:</span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => handleSort('name')}
                                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition ${sortField === 'name' ? 'bg-white border border-slate-300 shadow-sm text-blue-700' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}
                                >
                                    Nome
                                    {sortField === 'name' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                </button>
                                <button 
                                    onClick={() => handleSort('cpf')}
                                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 transition ${sortField === 'cpf' ? 'bg-white border border-slate-300 shadow-sm text-blue-700' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}
                                >
                                    CPF
                                    {sortField === 'cpf' && (sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {hasSearched && processedResults.length === 0 ? (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-6 flex flex-col items-center text-center gap-3 text-red-800 mt-6">
                    <div className="bg-white p-2 rounded-full shadow-sm">
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">Nenhum resultado encontrado</p>
                      <p className="text-sm mt-1 text-red-600/80">Verifique os filtros, o termo de busca ou tente digitar o nome sem acentos.</p>
                    </div>
                  </div>
                ) : (
                    <div className="grid gap-4 mt-6">
                        {processedResults.map((student) => (
                           <div key={student.id} className="bg-white border border-slate-200 rounded-2xl p-0 overflow-hidden shadow-sm hover:shadow-md transition animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900 leading-tight">{student.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">ID: {student.id}</span>
                                            {student.enrollmentId && (
                                                <span className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                                                    <Hash className="h-3 w-3" /> {student.enrollmentId}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`pl-2 pr-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border whitespace-nowrap flex items-center gap-1.5 ${
                                        student.status === 'Matriculado' ? 'bg-green-50 text-green-700 border-green-200' :
                                        student.status === 'Pendente' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                        'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                        {student.status === 'Matriculado' && <CheckCircle className="h-3.5 w-3.5" />}
                                        {student.status === 'Pendente' && <AlertCircle className="h-3.5 w-3.5" />}
                                        {(student.status !== 'Matriculado' && student.status !== 'Pendente') && <Clock className="h-3.5 w-3.5" />}
                                        {student.status}
                                    </span>
                                </div>

                                <div className="p-6">
                                    <div className="grid grid-cols-2 gap-6 mb-5">
                                        <div>
                                            <span className="block text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">CPF</span>
                                            <span className="font-medium text-slate-800 font-mono">{student.cpf || "Não informado"}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Nascimento</span>
                                            <span className="font-medium text-slate-800">{student.birthDate}</span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-100 w-full mb-5"></div>

                                    <div className="space-y-3">
                                        {student.grade && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                                                    <GraduationCap className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-slate-500">Etapa / Turma</span>
                                                    <span className="text-sm font-medium text-slate-900 block">{student.grade}</span>
                                                    {student.className && <span className="text-xs text-blue-600 font-medium mt-0.5 block">{student.className}</span>}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg shrink-0 ${student.transportRequest ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                                                <Bus className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <span className="block text-xs text-slate-500">Transporte Escolar</span>
                                                <span className={`text-sm font-medium ${student.transportRequest ? 'text-green-700' : 'text-slate-500'}`}>
                                                    {student.transportRequest ? 'Utiliza Transporte Oficial' : 'Não Solicitado'}
                                                </span>
                                                {student.transportType && (
                                                    <span className="text-xs text-slate-500 block mt-0.5 capitalize">{student.transportType}</span>
                                                )}
                                            </div>
                                        </div>

                                        {student.school && (
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg shrink-0">
                                                    <School className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <span className="block text-xs text-slate-500">Unidade Escolar</span>
                                                    <span className="text-sm font-medium text-slate-900 block">{student.school}</span>
                                                    {student.shift && (
                                                        <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                                            <Clock className="h-3 w-3" />
                                                            {student.shift}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                           </div>
                        ))}
                    </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};