
import React from 'react';
import { Link } from '../router';
import { Home, AlertCircle } from 'lucide-react';

export const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="h-10 w-10 text-slate-400" />
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 mb-4">Página Não Encontrada</h2>
        <p className="text-slate-500 mb-8">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link 
          to="/" 
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200"
        >
          <Home className="h-5 w-5 mr-2" />
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
};
