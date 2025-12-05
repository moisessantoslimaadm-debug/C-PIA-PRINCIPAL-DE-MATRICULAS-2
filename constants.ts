import { School, SchoolType, RegistryStudent, RegistrationFormState } from './types';

export const MUNICIPALITY_NAME = "Itaberaba";

// Dados fictícios de escola para demonstração
export const MOCK_SCHOOLS: School[] = [
  {
    id: '29383935',
    inep: '29383935',
    name: 'CRECHE PARAISO DA CRIANCA',
    address: 'Urbana - Centro - BA',
    types: [SchoolType.INFANTIL],
    image: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&q=80',
    rating: 5.0,
    availableSlots: 150,
    lat: -12.5253,
    lng: -40.2917
  },
  {
    id: '29383936',
    inep: '29383936',
    name: 'ESCOLA MUNICIPAL FUTURO DO SABER',
    address: 'Bairro Jardim - BA',
    types: [SchoolType.FUNDAMENTAL_1],
    image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80',
    rating: 4.8,
    availableSlots: 200,
    lat: -12.5280,
    lng: -40.2950
  }
];

export const INITIAL_REGISTRATION_STATE: RegistrationFormState = {
  step: 1,
  student: {
    fullName: '',
    birthDate: '',
    cpf: '',
    needsSpecialEducation: false,
    specialEducationDetails: '',
    needsTransport: false
  },
  guardian: {
    fullName: '',
    cpf: '',
    email: '',
    phone: '',
    relationship: 'Mãe'
  },
  address: {
    street: '',
    number: '',
    neighborhood: '',
    city: MUNICIPALITY_NAME,
    zipCode: ''
  },
  selectedSchoolId: null
};

// DADOS ANONIMIZADOS PARA DEMONSTRAÇÃO
// Todos os nomes e CPFs abaixo são fictícios gerados aleatoriamente.
export const MOCK_STUDENT_REGISTRY: RegistryStudent[] = [
  { id: '1001', name: 'JOÃO SILVA SANTOS', birthDate: '03/01/2022', cpf: '000.000.000-01', status: 'Matriculado', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 3 C', classId: 'C1', enrollmentId: 'MAT-001', shift: 'Integral', transportRequest: false },
  { id: '1002', name: 'MARIA OLIVEIRA', birthDate: '02/09/2021', cpf: '000.000.000-02', status: 'Matriculado', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 3 C', classId: 'C1', enrollmentId: 'MAT-002', shift: 'Integral', transportRequest: false },
  { id: '1003', name: 'PEDRO ALMEIDA', birthDate: '19/04/2022', cpf: '000.000.000-03', status: 'Pendente', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 2 A', classId: 'C2', enrollmentId: 'MAT-003', shift: 'Integral', transportRequest: true, transportType: 'Vans/Kombis' },
  { id: '1004', name: 'ANA SOUZA', birthDate: '03/07/2021', cpf: '000.000.000-04', status: 'Em Análise', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 3 C', classId: 'C1', enrollmentId: 'MAT-004', shift: 'Integral', transportRequest: false },
  { id: '1005', name: 'LUCAS PEREIRA', birthDate: '10/03/2023', cpf: '000.000.000-05', status: 'Matriculado', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 2 A', classId: 'C2', enrollmentId: 'MAT-005', shift: 'Integral', transportRequest: false },
  { id: '1006', name: 'JULIA LIMA', birthDate: '21/02/2022', cpf: '000.000.000-06', status: 'Matriculado', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 3 B', classId: 'C3', enrollmentId: 'MAT-006', shift: 'Integral', transportRequest: false, specialNeeds: true },
  { id: '1007', name: 'GABRIEL COSTA', birthDate: '29/05/2022', cpf: '000.000.000-07', status: 'Pendente', school: 'ESCOLA MUNICIPAL FUTURO DO SABER', className: '1º ANO A', classId: 'E1', enrollmentId: 'MAT-007', shift: 'Matutino', transportRequest: true },
  { id: '1008', name: 'BEATRIZ ROCHA', birthDate: '15/10/2021', cpf: '000.000.000-08', status: 'Matriculado', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 3 B', classId: 'C3', enrollmentId: 'MAT-008', shift: 'Integral', transportRequest: false },
  { id: '1009', name: 'ENZO FERREIRA', birthDate: '18/02/2022', cpf: '000.000.000-09', status: 'Matriculado', school: 'CRECHE PARAISO DA CRIANCA', className: 'GRUPO 3 B', classId: 'C3', enrollmentId: 'MAT-009', shift: 'Integral', transportRequest: false },
  { id: '1010', name: 'LAURA GOMES', birthDate: '08/08/2021', cpf: '000.000.000-10', status: 'Em Análise', school: 'Não alocada', className: '', classId: '', enrollmentId: 'MAT-010', shift: 'Definição Pendente', transportRequest: false }
];