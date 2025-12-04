import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { School, RegistryStudent } from '../types';
import { MOCK_SCHOOLS, MOCK_STUDENT_REGISTRY } from '../constants';

interface DataContextType {
  schools: School[];
  students: RegistryStudent[];
  lastBackupDate: string | null;
  addSchool: (school: School) => void;
  addStudent: (student: RegistryStudent) => void;
  updateSchools: (newSchools: School[]) => void;
  updateStudents: (newStudents: RegistryStudent[]) => void;
  removeStudent: (id: string) => void;
  removeSchool: (id: string) => void;
  resetData: () => void;
  registerBackup: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children?: ReactNode }) => {
  // Inicializa com os dados do LocalStorage se existirem, senão usa os Mocks
  const [schools, setSchools] = useState<School[]>(() => {
    try {
      const saved = localStorage.getItem('educa_schools');
      return saved ? JSON.parse(saved) : MOCK_SCHOOLS;
    } catch (e) {
      console.error("Error loading schools from local storage", e);
      return MOCK_SCHOOLS;
    }
  });

  const [students, setStudents] = useState<RegistryStudent[]>(() => {
    try {
      const saved = localStorage.getItem('educa_students');
      return saved ? JSON.parse(saved) : MOCK_STUDENT_REGISTRY;
    } catch (e) {
      console.error("Error loading students from local storage", e);
      return MOCK_STUDENT_REGISTRY;
    }
  });

  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    return localStorage.getItem('educa_last_backup');
  });

  // Salva no LocalStorage sempre que houver mudança
  useEffect(() => {
    localStorage.setItem('educa_schools', JSON.stringify(schools));
  }, [schools]);

  useEffect(() => {
    localStorage.setItem('educa_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    if (lastBackupDate) {
        localStorage.setItem('educa_last_backup', lastBackupDate);
    }
  }, [lastBackupDate]);

  const addSchool = (school: School) => {
    setSchools(prev => [...prev, school]);
  };

  const addStudent = (student: RegistryStudent) => {
    setStudents(prev => [...prev, student]);
  };

  const updateSchools = (newSchools: School[]) => {
    setSchools(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const uniqueNewSchools = newSchools.filter(s => !existingIds.has(s.id));
      return [...prev, ...uniqueNewSchools];
    });
  };

  const updateStudents = (newStudents: RegistryStudent[]) => {
    setStudents(prev => {
      // Create a map of existing students for updates
      const studentMap = new Map(prev.map(s => [s.id, s]));
      
      // Update or Add
      newStudents.forEach(s => {
        studentMap.set(s.id, s);
      });

      return Array.from(studentMap.values());
    });
  };

  const removeStudent = (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  };

  const removeSchool = (id: string) => {
    setSchools(prev => prev.filter(s => s.id !== id));
  };

  const resetData = () => {
    setSchools(MOCK_SCHOOLS);
    setStudents(MOCK_STUDENT_REGISTRY);
    setLastBackupDate(null);
    localStorage.removeItem('educa_schools');
    localStorage.removeItem('educa_students');
    localStorage.removeItem('educa_last_backup');
  };

  const registerBackup = () => {
      const now = new Date().toISOString();
      setLastBackupDate(now);
  };

  return (
    <DataContext.Provider value={{ 
      schools, 
      students, 
      lastBackupDate,
      addSchool, 
      addStudent, 
      updateSchools, 
      updateStudents, 
      removeStudent, 
      removeSchool, 
      resetData, 
      registerBackup
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};