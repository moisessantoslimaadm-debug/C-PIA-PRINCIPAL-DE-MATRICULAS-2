import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2, HelpCircle, FileText, Calendar, MapPin } from 'lucide-react';
import { ChatMessage } from '../types';
import { sendMessageToGemini } from '../services/geminiService';

export const ChatAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'welcome', role: 'model', text: 'Olá! Sou o Edu, assistente virtual da Secretaria de Educação. Como posso ajudar com a matrícula hoje?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (text: string = inputValue) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    const modelMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: modelMsgId, role: 'model', text: '', isLoading: true }]);

    try {
      const stream = await sendMessageToGemini(userMsg.text);
      let fullText = '';
      
      for await (const chunk of stream) {
        fullText += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === modelMsgId 
            ? { ...msg, text: fullText, isLoading: false } 
            : msg
        ));
      }
    } catch (error) {
      console.error("Error in chat:", error);
      setMessages(prev => prev.map(msg => 
        msg.id === modelMsgId 
          ? { ...msg, text: "Desculpe, ocorreu um erro.", isLoading: false } 
          : msg
      ));
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = [
    { icon: <FileText className="h-3 w-3" />, text: "Documentos necessários" },
    { icon: <Calendar className="h-3 w-3" />, text: "Prazos de matrícula" },
    { icon: <MapPin className="h-3 w-3" />, text: "Escolas próximas" },
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-2xl w-80 sm:w-96 h-[500px] mb-4 flex flex-col border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
          {/* Header */}
          <div className="bg-blue-600 p-4 flex justify-between items-center text-white">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-1.5 rounded-full">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Edu - Assistente Virtual</h3>
                <span className="text-xs text-blue-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                  Online
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white transition">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
            <div className="space-y-4">
               {/* Welcome Suggestions */}
               {messages.length === 1 && (
                 <div className="grid grid-cols-1 gap-2 mb-4 px-1">
                   <p className="text-xs text-slate-500 mb-1 ml-1 font-medium">Perguntas frequentes:</p>
                   <div className="flex flex-wrap gap-2">
                     {suggestions.map((s, i) => (
                       <button
                         key={i}
                         onClick={() => handleSend(s.text)}
                         className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-100 rounded-full text-xs text-blue-700 hover:bg-blue-50 hover:border-blue-200 transition shadow-sm"
                       >
                         {s.icon}
                         {s.text}
                       </button>
                     ))}
                   </div>
                 </div>
               )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none shadow-md'
                        : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-bl-none'
                    }`}
                  >
                    {msg.isLoading ? (
                       <div className="flex items-center gap-2 text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Digitando...</span>
                       </div>
                    ) : (
                      <div className="markdown-body whitespace-pre-wrap">{msg.text}</div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-100">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua dúvida..."
                className="flex-1 px-4 py-2 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder:text-slate-400"
                disabled={isTyping}
              />
              <button
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isTyping}
                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-center mt-2">
               <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  IA oficial da Secretaria de Educação
               </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`${
          isOpen ? 'scale-0' : 'scale-100'
        } transition-all duration-300 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl flex items-center justify-center hover:shadow-blue-500/30 ring-4 ring-white hover:scale-110`}
      >
        <MessageCircle className="h-7 w-7" />
      </button>
    </div>
  );
};