import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Technician = {
  id: number;
  nome: string;
  horario_inicio: string;
  horario_fim: string;
};

export function TechnicianModal({ 
  isOpen, 
  onClose,
  onSchedule
}: {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (techId: number, date: string) => void;
}) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTech, setSelectedTech] = useState<number | null>(null);
  const [visitDate, setVisitDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchTechnicians();
    }
  }, [isOpen]);

  const fetchTechnicians = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tecnicos')
        .select('*');
      
      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isAvailableAtSelectedTime = (tech: Technician, selectedDateTime: string) => {
    if (!selectedDateTime) return true;
    
    const selectedTime = new Date(selectedDateTime).toTimeString().slice(0, 8);
    return selectedTime >= tech.horario_inicio && selectedTime <= tech.horario_fim;
  };

  const handleSchedule = () => {
    if (selectedTech && visitDate) {
      onSchedule(selectedTech, visitDate);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-black text-lg font-semibold mb-4">Agendar Visita Técnica</h3>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="font-medium mb-2">Técnicos Disponíveis:</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {technicians.length > 0 ? (
                  technicians.map((tech) => {
                    const isAvailable = isAvailableAtSelectedTime(tech, visitDate);
                    return (
                      <div 
                        key={tech.id}
                        className={`p-3 border rounded-lg cursor-pointer ${
                          selectedTech === tech.id 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        } ${
                          !isAvailable ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        onClick={() => isAvailable && setSelectedTech(tech.id)}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{tech.nome}</span>
                          <span className="text-sm text-gray-500">
                            Horário: {tech.horario_inicio} - {tech.horario_fim}
                          </span>
                        </div>
                        {!isAvailable && visitDate && (
                          <p className="text-xs text-red-500 mt-1">
                            Fora do horário de trabalho
                          </p>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-gray-500 text-center py-4">Nenhum técnico disponível no momento.</p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data e Hora da Visita:
              </label>
              <input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="w-full p-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="flex space-x-3 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSchedule}
                disabled={!selectedTech || !visitDate}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  selectedTech && visitDate
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Agendar Visita
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}