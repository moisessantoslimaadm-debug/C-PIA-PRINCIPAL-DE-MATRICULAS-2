
export enum SchoolType {
  INFANTIL = 'Educação Infantil',
  FUNDAMENTAL_1 = 'Fundamental I',
  FUNDAMENTAL_2 = 'Fundamental II',
  MEDIO = 'Ensino Médio',
  EJA = 'EJA'
}

export interface School {
  id: string;
  inep?: string; // Added INEP/Admin code
  name: string;
  address: string;
  types: SchoolType[];
  image: string;
  rating: number;
  availableSlots: number;
  lat: number;
  lng: number;
  distance?: number; // Property for calculated distance
}

export interface StudentData {
  fullName: string;
  birthDate: string;
  cpf: string; // Optional for children, mandatory if exists
  needsSpecialEducation: boolean;
  specialEducationDetails?: string;
  needsTransport: boolean; // Added field
}

export interface GuardianData {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  relationship: string;
}

export interface AddressData {
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string; // Defaults to the municipality
  zipCode: string;
  lat?: number;
  lng?: number;
}

export interface RegistrationFormState {
  step: number;
  student: StudentData;
  guardian: GuardianData;
  address: AddressData;
  selectedSchoolId: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isLoading?: boolean;
}

// Updated interface for data extracted from PDF
export interface RegistryStudent {
  id: string; // ID único do aluno
  enrollmentId?: string; // Código da Matrícula (PDF)
  name: string;
  birthDate: string;
  cpf: string;
  status: 'Matriculado' | 'Pendente' | 'Em Análise';
  school?: string;
  shift?: string; // Turno (Matutino/Vespertino)
  transportRequest?: boolean; // Matches 'Transporte escolar' from PDF
  transportType?: string; // Detalhe do transporte (Vans/Kombis/Ônibus)
  grade?: string; // Etapa de ensino
  className?: string; // Nome da Turma (ex: GRUPO 4 F)
  classId?: string; // Código da Turma
  specialNeeds?: boolean; // Atendimento AEE
  lat?: number; // Latitude exata da residência
  lng?: number; // Longitude exata da residência
}
