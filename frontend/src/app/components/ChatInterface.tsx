"use client";

import { useState, useEffect } from 'react';
import axios from 'axios';
import { TechnicianModal } from './TechnicianModal';
// import { supabase } from '@/lib/supabaseClient';

// Types
type Message = {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  sources?: { source: string; content: string }[];
};

type Chat = {
  id: string;
  preview: string;
  timestamp: Date;
  messages: Message[];
  userName?: string;
};

type DeleteModalProps = {
  isOpen: boolean;
  chatToDelete: Chat | null;
  onConfirm: () => void;
  onCancel: () => void;
};


// Delete Modal Component
function DeleteModal({ isOpen, chatToDelete, onConfirm, onCancel }: DeleteModalProps) {
  if (!isOpen || !chatToDelete) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full">
        <h3 className="text-black text-lg font-semibold mb-4">Delete Chat</h3>
        <p className="text-gray-600 mb-6">
          Tem certeza que deseja deletar <strong>{chatToDelete.preview}</strong>? Você não pode reverter esta ação.
        </p>
        <div className="flex space-x-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Deletar
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper functions
const generateId = (() => {
  let counter = 0;
  return () => {
    const timestamp = Date.now().toString(36);
    const uniquePart = (counter++).toString(36);
    return `${timestamp}-${uniquePart}`;
  };
})();

const FormattedDate = ({ date }: { date: Date }) => {
  return <span>{date.toLocaleDateString('pt-BR')}</span>;
};

const FormattedTime = ({ date }: { date: Date }) => {
  return <span>{date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })}</span>;
};

const extractUserName = (message: string): string | null => {
  const patterns = [
    /(?:me\s+chamo|meu\s+nome\s+(?:é|e)|sou\s+(?:o|a))\s+([A-Z][a-zÀ-ú]+)/i,
    /(?:pode\s+me\s+chamar\s+de)\s+([A-Z][a-zÀ-ú]+)/i,
    /(?:meu\s+nome\s+(?:é|e))\s+([A-Z][a-zÀ-ú]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// Main Component
export default function ChatInterface() {
  const [currentChat, setCurrentChat] = useState<Chat>({
    id: generateId(),
    preview: 'Novo Chat',
    timestamp: new Date(),
    messages: []
  });
  const [pastChats, setPastChats] = useState<Chat[]>([]);
  const [inputText, setInputText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [showTechModal, setShowTechModal] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('userName');
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startNewChat = () => {
    if (currentChat.messages.length > 0) {
      setPastChats(prev => {
        if (!prev.some(chat => chat.id === currentChat.id)) {
          return [currentChat, ...prev];
        }
        return prev;
      });
    }

    const newChat = {
      id: generateId(),
      preview: 'Novo Chat',
      timestamp: new Date(),
      messages: [],
      userName: userName
    };

    setCurrentChat(newChat);
    setIsSidebarOpen(false);
  };

  const loadChat = (chat: Chat) => {
    if (currentChat.messages.length > 0 && !pastChats.some(c => c.id === currentChat.id)) {
      setPastChats(prev => [currentChat, ...prev.filter(c => c.id !== chat.id)]);
    }
    setCurrentChat(chat);
    setIsSidebarOpen(false);
  };

  const handleDelete = (chat: Chat, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatToDelete(chat);
  };

  const confirmDelete = () => {
    if (chatToDelete) {
      setPastChats(prev => prev.filter(chat => chat.id !== chatToDelete.id));
      setChatToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const detectedName = extractUserName(inputText);
    if (detectedName) {
      setUserName(detectedName);
      localStorage.setItem('userName', detectedName);
    }

    const userMessage: Message = {
      id: generateId(),
      text: inputText,
      sender: 'user',
      timestamp: new Date()
    };

    const updatedChat = {
      ...currentChat,
      preview: inputText,
      messages: [...currentChat.messages, userMessage],
      userName: detectedName || userName
    };

    setCurrentChat(updatedChat);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/ask', {
        question: inputText,
        username: detectedName || userName,
        chat_history: currentChat.messages
          .filter(msg => msg.sender === 'user')
          .map(msg => msg.text)
      });

      if (response.data.answer) {
        const aiMessage: Message = {
          id: generateId(),
          text: response.data.answer,
          sender: 'ai',
          timestamp: new Date(),
          sources: response.data.sources
        };

        setCurrentChat(prev => ({
          ...prev,
          messages: [...prev.messages, aiMessage]
        }));
      } else {
        const aiMessage: Message = {
          id: generateId(),
          text: "Recebi sua pergunta, mas não consegui encontrar informações relevantes. Você poderia reformular sua pergunta?",
          sender: 'ai',
          timestamp: new Date()
        };

        setCurrentChat(prev => ({
          ...prev,
          messages: [...prev.messages, aiMessage]
        }));
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      
      const errorMessage: Message = {
        id: generateId(),
        text: "Desculpe, houve um erro ao conectar com o servidor.",
        sender: 'ai',
        timestamp: new Date()
      };

      setCurrentChat(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessage]
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleScheduleVisit = async (techId: number, date: string) => {
    try {
      // 1. Validação básica
      if (!techId || !date) {
        throw {
          message: 'Dados incompletos para agendamento',
          details: { techId, date }
        };
      }
  
      const selectedDate = new Date(date);
      if (selectedDate < new Date()) {
        throw { message: 'Não é possível agendar para datas passadas' };
      }
  
      // 2. Verificar se já existe agendamento para o mesmo técnico no mesmo horário
      const existingAppointment = [...pastChats, currentChat].some(chat => {
        return chat.messages.some(message => {
          if (message.sender === 'ai' && message.text.includes('Visita confirmada')) {
            const techMatch = message.text.match(/Técnico (\d+)/);
            const dateMatch = message.text.match(/para (\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2})/);
            
            if (techMatch && dateMatch) {
              const existingTechId = parseInt(techMatch[1]);
              const existingDate = new Date(
                dateMatch[1].replace(
                  /(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2})/, 
                  '$3-$2-$1T$4:00'
                )
              );
              
              return existingTechId === techId && 
                     existingDate.getTime() === selectedDate.getTime();
            }
          }
          return false;
        });
      });
  
      if (existingAppointment) {
        throw { 
          message: `O Técnico ${techId} já possui um agendamento simulado para este horário` 
        };
      }
  
      // 3. Simulação de dados do técnico (sem consulta ao Supabase)
      const technicianData = {
        nome: `Técnico ${techId}` // Nome simulado baseado no ID
      };
  
      // 4. Simulação de agendamento (sem inserção no Supabase)
      const newAppointment = {
        id: Math.floor(Math.random() * 1000), // ID simulado
        tecnico_id: techId,
        tecnico_nome: technicianData.nome,
        data_visita: date,
        status: 'pendente',
        cliente: userName || 'Anônimo'
      };
  
      // 5. Mensagem de confirmação
      const formattedDate = selectedDate.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  
      const confirmationMessage: Message = {
        id: generateId(),
        text: `Visita confirmada com ${technicianData.nome} para ${formattedDate}\nCódigo da visita: AG-${newAppointment.id}`,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setCurrentChat(prev => ({
        ...prev,
        messages: [...prev.messages, confirmationMessage]
      }));
  
    } catch (error: unknown) {
      let errorMessage = "Erro ao simular agendamento. Tente novamente.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
  
      console.error('Erro na simulação de agendamento:', error);
      
      const errorMessageToShow: Message = {
        id: generateId(),
        text: errorMessage,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setCurrentChat(prev => ({
        ...prev,
        messages: [...prev.messages, errorMessageToShow]
      }));
    }
  };

  return (
    <main className="flex min-h-screen">
      <DeleteModal
        isOpen={chatToDelete !== null}
        chatToDelete={chatToDelete}
        onConfirm={confirmDelete}
        onCancel={() => setChatToDelete(null)}
      />

      <TechnicianModal
        isOpen={showTechModal}
        onClose={() => setShowTechModal(false)}
        onSchedule={handleScheduleVisit}
      />

      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={`fixed lg:relative inset-y-0 left-0 w-64 bg-gray-50 border-r border-gray-200 p-4 transform transition-transform duration-200 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } z-40`}
      >
        <button
          onClick={startNewChat}
          className="w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Novo Chat
        </button>

        {userName && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-gray-700">
            <span className="font-medium">Olá, {userName}!</span>
          </div>
        )}

        <div className="space-y-2">
          {[currentChat, ...pastChats].map((chat, index) => (
            <div
              key={index}
              className={`group relative rounded-lg text-black ${
                chat.id === currentChat.id
                  ? 'bg-blue-100'
                  : 'hover:bg-gray-100'
              }`}
            >
              <button
                onClick={() => chat.id !== currentChat.id && loadChat(chat)}
                className="w-full p-3 text-left"
              >
                <div className="text-sm font-medium truncate">{chat.preview}</div>
                <div className="text-xs text-gray-500">
                  <FormattedDate date={chat.timestamp} />
                </div>
              </button>
              {chat.id !== currentChat.id && (
                <button
                  onClick={(e) => handleDelete(chat, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200 flex items-center">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg mr-4"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16m-7 6h7"
              />
            </svg>
          </button>

          <h1 className="text-xl font-semibold text-gray-800">Assistente Técnico de Impressoras</h1>
          
          {userName && (
            <span className="ml-auto text-sm text-gray-600">
              Olá, {userName}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {currentChat.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
              <h2 className="text-xl font-medium mb-2">Bem-vindo ao Assistente Técnico de Impressoras</h2>
              <p className="max-w-md">
                {userName 
                  ? `Olá ${userName}! Como posso ajudar você hoje?` 
                  : "Por favor, se apresente (exemplo: 'Me chamo João')"}
              </p>
            </div>
          )}

          {currentChat.messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}
              >
                <div style={{ whiteSpace: 'pre-line' }}>{message.text}</div>
                <div className={`text-xs mt-1 ${
                  message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                }`}>
                  <FormattedTime date={message.timestamp} />
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-lg bg-gray-100 text-gray-800 rounded-bl-none">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={userName 
                ? "Digite sua pergunta sobre impressoras..." 
                : "Diga seu nome ou faça uma pergunta sobre impressoras..."}
              className="text-black flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowTechModal(true)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Agendar Visita
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Enviar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}