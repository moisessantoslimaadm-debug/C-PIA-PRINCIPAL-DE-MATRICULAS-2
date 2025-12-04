import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Fix: Use React.Component to ensure props type inference works correctly
export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    // Emergency data clear if data corruption is the cause
    if (window.confirm("Isso limpará os dados locais para tentar recuperar o sistema. Deseja continuar?")) {
        localStorage.clear();
        window.location.href = '/';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-red-100 p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h1>
            <p className="text-slate-500 mb-6">
              Ocorreu um erro inesperado na aplicação. Nossos engenheiros foram notificados (simulado).
            </p>
            
            <div className="bg-slate-50 p-4 rounded-lg text-left mb-6 overflow-hidden">
                <p className="text-xs font-mono text-slate-600 break-words">
                    {this.state.error?.message || "Erro desconhecido"}
                </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={this.handleReload}
                className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-200"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Recarregar Página
              </button>
              
              <button
                onClick={() => window.location.hash = '#/'}
                className="w-full flex items-center justify-center px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition"
              >
                <Home className="h-5 w-5 mr-2" />
                Voltar ao Início
              </button>
              
               <button
                onClick={this.handleReset}
                className="text-xs text-red-400 hover:text-red-600 underline mt-4"
              >
                Resetar dados de emergência
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}