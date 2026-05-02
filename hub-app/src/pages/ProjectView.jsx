import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Plus, Home, Loader2, FileText } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Sidebar from '../components/Sidebar';
import TiltCard from '../components/TiltCard';
export default function ProjectView() {
  const navigate = useNavigate();
  const { id } = useParams(); 

  const [project, setProject] = useState(null);
  
  // Мы разделим комнаты на две категории
  const [generalRoom, setGeneralRoom] = useState(null); // Комната для Общего ТЗ
  const [rooms, setRooms] = useState([]); // Обычные комнаты

  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingGeneral, setIsCreatingGeneral] = useState(false);

  const fetchProjectAndRooms = async () => {
    try {
      setLoading(true);
      
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      const { data: allRoomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .eq('project_id', id)
        .order('title');

      if (roomsError) throw roomsError;
      
      if (allRoomsData) {
        // 🟢 МАГИЯ: Пробегаемся по всем комнатам и ищем последние рендеры
        const roomsWithCovers = await Promise.all(allRoomsData.map(async (room) => {
          const { data: latestIteration } = await supabase
            .from('iterations')
            .select('image_url')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false }) // Берем самый свежий рендер
            .limit(1);

         // 🟢 Стало: Подменяем домен прямо при формировании обложки
let safeCoverUrl = null;

if (latestIteration && latestIteration.length > 0 && latestIteration[0].image_url) {
  safeCoverUrl = latestIteration[0].image_url.replace(
    'https://bbaoigykxjsrgkthsuiu.supabase.co', 
    import.meta.env.VITE_SUPABASE_URL
  );
}

return {
  ...room,
  cover_image: safeCoverUrl
};
        }));

        // Разделяем комнаты на Общее ТЗ и обычные (теперь они уже с картинками)
        const general = roomsWithCovers.find(room => room.is_general === true);
        const regularRooms = roomsWithCovers.filter(room => room.is_general !== true);
        
        setGeneralRoom(general || null);
        setRooms(regularRooms);
      }
      
    } catch (error) {
      console.error('Ошибка загрузки:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchProjectAndRooms();
  }, [id]);

  // Функция создания ОБЫЧНОЙ комнаты
  const handleCreateRoom = async () => {
    if (!newRoomTitle.trim()) return;

    try {
      setIsCreating(true);
      const { error } = await supabase
        .from('rooms')
        .insert([{ project_id: id, title: newRoomTitle, is_general: false }]);

      if (error) throw error;

      setNewRoomTitle('');
      setIsModalOpen(false);
      fetchProjectAndRooms(); 
    } catch (error) {
      console.error('Ошибка создания комнаты:', error.message);
      alert('Ошибка: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Функция создания технической комнаты "Общее ТЗ"
  const handleCreateGeneralRoom = async () => {
    try {
      setIsCreatingGeneral(true);
      const { error } = await supabase
        .from('rooms')
        .insert([{ project_id: id, title: 'Общее ТЗ проекта', is_general: true }]);

      if (error) throw error;
      fetchProjectAndRooms(); 
    } catch (error) {
      console.error('Ошибка создания Общего ТЗ:', error.message);
      alert('Ошибка: ' + error.message);
    } finally {
      setIsCreatingGeneral(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif' }}>
      
      <Sidebar />

      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Loader2 size={32} style={{ animation: 'spin 2s linear infinite', color: '#555' }} />
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : !project ? (
          <div style={{ color: '#888' }}>Проект не найден.</div>
        ) : (
          <div style={{ maxWidth: '1200px' }}>
            {/* Шапка с навигацией */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px' }}>
              <button onClick={() => navigate('/projects')} style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#fff'} onMouseLeave={(e) => e.currentTarget.style.color = '#888'}>
                <ArrowLeft size={24} />
              </button>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '500' }}>{project.title}</h1>
            </div>

            {/* БЛОК: ДОКУМЕНТАЦИЯ (ОБЩЕЕ ТЗ) */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#888', marginBottom: '15px', fontWeight: '400' }}>Документация</h2>
              
              {generalRoom ? (
                // Если Общее ТЗ уже существует — выводим кнопку перехода в него
                <div 
                  onClick={() => navigate(`/workspace/${generalRoom.id}`)} 
                  style={{ background: '#111', borderRadius: '12px', border: '1px solid #333', padding: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: '0.3s' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#00ff88'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ background: '#1a1a1a', padding: '12px', borderRadius: '8px' }}>
                      <FileText size={24} color="#00ff88" />
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>Общее ТЗ проекта</h3>
                      <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>Обмерочный план, мудборды, материалы и стиль</p>
                    </div>
                  </div>
                  <ChevronRight size={20} color="#555" />
                </div>
              ) : (
                // Если Общего ТЗ еще нет — предлагаем его создать
                <div 
                  onClick={handleCreateGeneralRoom} 
                  style={{ background: 'rgba(0, 255, 136, 0.05)', borderRadius: '12px', border: '1px dashed #00ff88', padding: '20px', cursor: isCreatingGeneral ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s', opacity: isCreatingGeneral ? 0.5 : 1 }}
                  onMouseEnter={(e) => !isCreatingGeneral && (e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)')}
                  onMouseLeave={(e) => !isCreatingGeneral && (e.currentTarget.style.background = 'rgba(0, 255, 136, 0.05)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00ff88', fontWeight: 'bold' }}>
                    {isCreatingGeneral ? <Loader2 size={20} style={{ animation: 'spin 2s linear infinite' }} /> : <Plus size={20} />}
                    {isCreatingGeneral ? 'Создаем файл...' : 'Сгенерировать файл Общего ТЗ'}
                  </div>
                </div>
              )}
            </div>

            {/* БЛОК: ПОМЕЩЕНИЯ */}
            <h2 style={{ fontSize: '1.1rem', color: '#888', marginBottom: '15px', fontWeight: '400' }}>Помещения</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              
              {rooms.map((room) => (
                    <TiltCard 
                      key={room.id} 
                      onClick={() => navigate(`/workspace/${room.id}`)} 
                      style={{ 
                        height: '200px',
                        borderRadius: '16px',
                        position: 'relative',
                        overflow: 'hidden', // Чтобы картинка не вылезала за края
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        padding: '20px',
                        // 🟢 Если у комнаты есть картинка - ставим её, если нет - красивый технический градиент
                        backgroundImage: room.cover_image ? `url(${room.cover_image})` : 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      {/* 🟢 Магический градиент-оверлей (затемняет низ, чтобы белый текст всегда читался) */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'linear-gradient(to top, rgba(10,10,10, 0.95) 0%, rgba(10,10,10, 0.2) 60%, transparent 100%)',
                        zIndex: 1
                      }} />

                      {/* Контент поверх градиента */}
                      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                            {room.name || room.title}
                          </h3>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#888' }}>Перейти в комнату</span>
                          <span style={{ 
                            background: 'rgba(0, 255, 136, 0.1)', 
                            color: '#00ff88', 
                            padding: '4px 10px', 
                            borderRadius: '6px', 
                            fontSize: '0.75rem', 
                            fontWeight: 'bold',
                            border: '1px solid rgba(0, 255, 136, 0.2)'
                          }}>
                            Открыть
                          </span>
                        </div>
                      </div>
                    </TiltCard>
                  ))}

              {/* Кнопка добавления новой комнаты (Стеклянная версия) */}
              <div 
                onClick={() => setIsModalOpen(true)}
                style={{ 
                  height: '200px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '10px', 
                  background: 'rgba(255, 255, 255, 0.02)', 
                  border: '1px dashed rgba(255, 255, 255, 0.15)', 
                  borderRadius: '16px', 
                  color: '#777', 
                  cursor: 'pointer', 
                  transition: '0.2s',
                  backdropFilter: 'blur(4px)'
                }}
                onMouseEnter={(e) => { 
                  e.currentTarget.style.borderColor = '#00ff88'; 
                  e.currentTarget.style.color = '#00ff88'; 
                  e.currentTarget.style.background = 'rgba(0, 255, 136, 0.05)'; 
                }}
                onMouseLeave={(e) => { 
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; 
                  e.currentTarget.style.color = '#777'; 
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; 
                }}
              >
                <Plus size={32} />
                <span style={{ marginTop: '10px', fontSize: '0.9rem', fontWeight: '500' }}>Добавить комнату</span>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* ВСПЛЫВАЮЩЕЕ ОКНО СОЗДАНИЯ КОМНАТЫ */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #333' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.4rem' }}>Добавить помещение</h2>
            
            <label style={{ display: 'block', marginBottom: '25px' }}>
              <span style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Название (например: Кухня-гостиная)</span>
              <input 
                type="text" 
                autoFocus
                value={newRoomTitle} 
                onChange={(e) => setNewRoomTitle(e.target.value)} 
                style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: 'white', boxSizing: 'border-box', fontSize: '1rem' }} 
              />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { setIsModalOpen(false); setNewRoomTitle(''); }} style={{ padding: '10px 16px', background: 'transparent', color: '#fff', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer' }}>Отмена</button>
              <button 
                onClick={handleCreateRoom}
                disabled={isCreating || !newRoomTitle.trim()}
                style={{ padding: '10px 16px', background: 'white', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: (isCreating || !newRoomTitle.trim()) ? 0.5 : 1 }}
              >
                {isCreating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}