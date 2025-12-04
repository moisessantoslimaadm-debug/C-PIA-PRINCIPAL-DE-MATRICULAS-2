
import React from 'react';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Registration } from './pages/Registration';
import { SchoolList } from './pages/SchoolList';
import { Status } from './pages/Status';
import { AdminData } from './pages/AdminData';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import { ChatAssistant } from './components/ChatAssistant';
import { HashRouter, Routes, Route, useLocation } from './router';
import { DataProvider } from './contexts/DataContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

const Footer: React.FC = () => {
  const { addToast } = useToast();

  const handleDeadLink = (e: React.MouseEvent, featureName: string) => {
    e.preventDefault();
    addToast(`A funcionalidade "${featureName}" estará disponível em breve.`, 'info');
  };

  return (
    <footer className="bg-slate-900 text-slate-400 py-12 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-4 gap-8">
        <div>
          <h4 className="text-white font-bold text-lg mb-4">EducaMunicípio</h4>
          <p className="text-sm">
            Transformando a educação pública através da tecnologia e acessibilidade.
          </p>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Links Rápidos</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <button onClick={(e) => handleDeadLink(e, 'Portal da Transparência')} className="hover:text-white transition text-left">
                Portal da Transparência
              </button>
            </li>
            <li>
              <button onClick={(e) => handleDeadLink(e, 'Calendário Escolar')} className="hover:text-white transition text-left">
                Calendário Escolar
              </button>
            </li>
            <li>
               <button onClick={(e) => handleDeadLink(e, 'Cardápio da Merenda')} className="hover:text-white transition text-left">
                Cardápio da Merenda
              </button>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Contato</h4>
          <ul className="space-y-2 text-sm">
            <li>Central: 156</li>
            <li>Email: contato@educacao.gov.br</li>
            <li>Av. Educação, 1000 - Centro</li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-bold mb-4">Horário de Atendimento</h4>
          <p className="text-sm">
            Segunda a Sexta<br/>
            08:00 às 17:00
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-center text-xs">
        &copy; {new Date().getFullYear()} Secretaria Municipal de Educação. Todos os direitos reservados.
      </div>
    </footer>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const AppContent: React.FC = () => {
  const { pathname } = useLocation();
  
  // Basic 404 Logic: Check if path matches known routes
  const validPaths = ['/', '/dashboard', '/registration', '/schools', '/status', '/admin/data'];
  const isNotFound = !validPaths.includes(pathname);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow">
        {isNotFound ? (
           <NotFound />
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/registration" element={<Registration />} />
            <Route path="/schools" element={<SchoolList />} />
            <Route path="/status" element={<Status />} />
            <Route path="/admin/data" element={<AdminData />} />
          </Routes>
        )}
      </main>
      {!isNotFound && <Footer />}
      <ChatAssistant />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <DataProvider>
        <ToastProvider>
          <HashRouter>
            <ScrollToTop />
            <AppContent />
          </HashRouter>
        </ToastProvider>
      </DataProvider>
    </ErrorBoundary>
  );
};

export default App;
