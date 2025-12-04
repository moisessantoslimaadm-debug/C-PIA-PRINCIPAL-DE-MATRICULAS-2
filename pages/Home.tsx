
import React from 'react';
import { Link } from '../router';
import { Calendar, CheckCircle2, MapPin, ArrowRight } from 'lucide-react';
import { MUNICIPALITY_NAME } from '../constants';

export const Home: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-blue-900 text-white py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-blue-900/90 to-blue-800/80"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Matrícula Escolar {new Date().getFullYear() + 1} <br/>
              <span className="text-blue-300">{MUNICIPALITY_NAME}</span>
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 leading-relaxed">
              Garanta o futuro do seu filho de forma rápida e segura. Realize a pré-matrícula na rede municipal de ensino sem sair de casa.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/registration"
                className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-lg text-blue-900 bg-white hover:bg-blue-50 shadow-lg transition duration-150"
              >
                Fazer Matrícula
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/schools"
                className="inline-flex items-center justify-center px-8 py-3 border border-white/30 text-base font-medium rounded-lg text-white hover:bg-white/10 backdrop-blur-sm transition duration-150"
              >
                Ver Escolas
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Info Cards */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 -mt-24 relative z-10">
            {[
              {
                icon: <Calendar className="h-8 w-8 text-blue-600" />,
                title: "Período de Inscrição",
                desc: "As inscrições estão abertas até 30 de Novembro. Não deixe para a última hora."
              },
              {
                icon: <MapPin className="h-8 w-8 text-blue-600" />,
                title: "Geolocalização",
                desc: "O sistema indica automaticamente as escolas mais próximas da sua residência."
              },
              {
                icon: <CheckCircle2 className="h-8 w-8 text-blue-600" />,
                title: "Resultado Online",
                desc: "Acompanhe o status da sua solicitação e saiba onde seu filho irá estudar."
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 hover:border-blue-100 transition duration-300">
                <div className="bg-blue-50 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                  {item.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-3">{item.title}</h3>
                <p className="text-slate-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Como funciona?</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              O processo é simples e totalmente digital. Siga os passos abaixo para garantir a vaga.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Cadastro", desc: "Preencha os dados do aluno e do responsável." },
              { step: "02", title: "Endereço", desc: "Informe onde você mora para o georreferenciamento." },
              { step: "03", title: "Seleção", desc: "Escolha até 3 escolas de sua preferência." },
              { step: "04", title: "Confirmação", desc: "Envie a solicitação e aguarde o resultado." }
            ].map((item, idx) => (
              <div key={idx} className="relative">
                <div className="text-6xl font-bold text-slate-200 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2 relative z-10">{item.title}</h3>
                <p className="text-slate-600 relative z-10">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
