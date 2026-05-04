import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// 1. Добавь FileArchive сюда!
import { ArrowLeft, ChevronRight, Plus, Home, Loader2, FileText, Trash2, FileArchive } from 'lucide-react'; 
import { supabase } from '../supabaseClient';
import Sidebar from '../components/Sidebar';
import TiltCard from '../components/TiltCard';

export default function ProjectView() {
  const navigate = useNavigate();
  const { id } = useParams(); 

  const [project, setProject] = useState(null);
  const [generalRoom, setGeneralRoom] = useState(null); 
  const [rooms, setRooms] = useState([]); 
  const [loading, setLoading] = useState(true);

  // 🟢 2. Добавляем состояние для пользователя
  const [user, setUser] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingGeneral, setIsCreatingGeneral] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // 🟢 3. Твоя проверка теперь будет работать, когда user подгрузится
  const isVisualizer = user?.email === '3d_cross@mail.ru';

  useEffect(() => {
    // 🟢 4. Получаем данные пользователя при загрузке
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    fetchUser();

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        const roomsWithCovers = await Promise.all(allRoomsData.map(async (room) => {
          const { data: latestIteration } = await supabase
            .from('iterations')
            .select('image_url')
            .eq('room_id', room.id)
            .order('created_at', { ascending: false }) 
            .limit(1);

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
  // 🟢 Функция архивации проекта
  // 🟢 1. Сначала вставь эту функцию ПЕРЕД словом return (над ним)
  const handleArchiveProject = async () => {
    if (!window.confirm("Отправить проект в архив?")) return;
    
    const { error } = await supabase
      .from('projects')
      .update({ is_archived: true })
      .eq('id', project.id); 

    if (error) {
      console.error("Ошибка при архивации:", error);
    } else {
      window.location.reload(); 
    }
  };
  const handleDeleteRoom = async (e, roomId) => {
    e.stopPropagation(); 
    
    if (window.confirm('Точно удалить это помещение?')) {
      try {
        const { error } = await supabase
          .from('rooms')
          .delete()
          .eq('id', roomId);
          
        if (error) throw error;
        
        // 🟢 МЕНЯЕМ НА ПРАВИЛЬНОЕ НАЗВАНИЕ:
        fetchProjectAndRooms(); 
        
      } catch (error) {
        alert('Ошибка при удалении: ' + error.message);
      }
    }
  };

  // 🟢 2. А это сама верстка шапки (внутри return)
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif' }}>
      
      <Sidebar />

      <div style={{ flex: 1, padding: isMobile ? '20px' : '40px', overflowY: 'auto' }}>
        
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Loader2 size={32} style={{ animation: 'spin 2s linear infinite', color: '#555' }} />
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : !project ? (
          <div style={{ color: '#888' }}>Проект не найден.</div>
        ) : (
          <div style={{ maxWidth: '100%' }}>
            
            {/* --- НАЧАЛО ШАПКИ --- */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px', flexWrap: 'wrap' }}>
              
              {/* Кнопка Назад */}
              <button 
                onClick={() => navigate('/projects')} 
                style={{ 
                  background: 'linear-gradient(145deg, #1a1a1a, #111)', 
                  border: '1px solid #00ff88', 
                  color: '#00ff88', 
                  width: isMobile ? '36px' : '40px', 
                  height: isMobile ? '36px' : '40px', 
                  borderRadius: '10px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  cursor: 'pointer', 
                  padding: 0, 
                  flexShrink: 0,
                  boxShadow: '4px 4px 10px rgba(0,0,0,0.5), -2px -2px 10px rgba(255,255,255,0.02), 0 0 12px rgba(0, 255, 136, 0.4), inset 0 0 8px rgba(0, 255, 136, 0.15)' 
                }}
              >
                <ArrowLeft size={20} strokeWidth={2.5} />
              </button>
              
              {/* Заголовок проекта */}
              <h1 style={{ margin: 0, fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: '500' }}>
                {project.title}
              </h1>

              {/* Кнопка "Завершить" (только для тебя и если проект активен) */}
              {isVisualizer && !project.is_archived && (
                <button 
                  onClick={handleArchiveProject}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.3)', 
                    color: '#ff4d4d', padding: '8px 16px', borderRadius: '8px', 
                    cursor: 'pointer', transition: '0.3s', fontSize: '0.9rem',
                    marginLeft: 'auto' 
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 77, 0.2)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)' }}
                >
                  <FileArchive size={18} />
                  Завершить
                </button>
              )}

              {/* Статус "В архиве" (если проект завершен) */}
              {project.is_archived && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 77, 77, 0.1)', color: '#ff4d4d', padding: '8px 16px', borderRadius: '8px', fontSize: '0.9rem', marginLeft: 'auto' }}>
                  <FileArchive size={18} /> В архиве
                </div>
              )}
            </div>
            {/* --- КОНЕЦ ШАПКИ --- */}

            {/* БЛОК: ДОКУМЕНТАЦИЯ (ОБЩЕЕ ТЗ) */}
            <div style={{ marginBottom: '40px' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#888', marginBottom: '15px', fontWeight: '400' }}>Документация</h2>
              
              {generalRoom ? (
                <div 
                  onClick={() => navigate(`/workspace/${generalRoom.id}`)} 
                  style={{ 
                    maxWidth: '500px', /* 🟢 ВОТ ОНО! ДОБАВЛЯЕМ СЮДА */
                    background: '#111', 
                    borderRadius: '12px', 
                    border: '1px solid #333', 
                    padding: isMobile ? '15px' : '20px', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    transition: '0.3s' 
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#00ff88'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = '#333'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '10px' : '15px' }}>
                    <div style={{ background: '#1a1a1a', padding: '10px', borderRadius: '8px' }}>
                      <FileText size={20} color="#00ff88" />
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0', fontSize: isMobile ? '1rem' : '1.1rem' }}>Общее ТЗ проекта</h3>
                      <p style={{ margin: 0, color: '#666', fontSize: '0.85rem' }}>Обмерочный план, мудборды, материалы</p>
                    </div>
                  </div>
                  <ChevronRight size={20} color="#555" />
                </div>
              ) : (
                <div 
                  onClick={handleCreateGeneralRoom} 
                  style={{ background: 'rgba(0, 255, 136, 0.05)', borderRadius: '12px', border: '1px dashed #00ff88', padding: '20px', cursor: isCreatingGeneral ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.3s', opacity: isCreatingGeneral ? 0.5 : 1, textAlign: 'center' }}
                  onMouseEnter={(e) => !isCreatingGeneral && (e.currentTarget.style.background = 'rgba(0, 255, 136, 0.1)')}
                  onMouseLeave={(e) => !isCreatingGeneral && (e.currentTarget.style.background = 'rgba(0, 255, 136, 0.05)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#00ff88', fontWeight: 'bold', flexDirection: isMobile ? 'column' : 'row' }}>
                    {isCreatingGeneral ? <Loader2 size={20} style={{ animation: 'spin 2s linear infinite' }} /> : <Plus size={20} />}
                    {isCreatingGeneral ? 'Создаем файл...' : 'Сгенерировать файл Общего ТЗ'}
                  </div>
                </div>
              )}
            </div>

            {/* БЛОК: ПОМЕЩЕНИЯ */}
            <h2 style={{ fontSize: '1.1rem', color: '#888', marginBottom: '15px', fontWeight: '400' }}>Помещения</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', paddingBottom: '120px' }}>
              
              {rooms.map((room) => (
                <TiltCard 
                  key={room.id} 
                  onClick={() => navigate(`/workspace/${room.id}`)} 
                  style={{ 
                    height: '200px',
                    borderRadius: '16px',
                    position: 'relative',
                    overflow: 'hidden', 
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '20px',
                    backgroundImage: room.cover_image ? `url(${room.cover_image})` : 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >{/* 🟢 КНОПКА УДАЛЕНИЯ ПОМЕЩЕНИЯ (ТОЛЬКО ДЛЯ ТЕБЯ) */}
  {isVisualizer && (
    <button 
      onClick={(e) => handleDeleteRoom(e, room.id)}
      style={{
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'rgba(255, 68, 68, 0.2)', // Полупрозрачный красный
        color: '#ff4444',
        border: 'none',
        borderRadius: '8px',
        padding: '8px',
        cursor: 'pointer',
        zIndex: 10, // Чтобы быть выше градиента (у которого zIndex: 1)
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(4px)',
        transition: 'all 0.2s ease'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.4)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 68, 68, 0.2)'}
    >
      <Trash2 size={18} />
    </button>
  )}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'linear-gradient(to top, rgba(10,10,10, 0.95) 0%, rgba(10,10,10, 0.2) 60%, transparent 100%)',
                    zIndex: 1
                  }} />

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

              {/* Кнопка добавления новой комнаты */}
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

      {/* 🟢 4. ВСПЛЫВАЮЩЕЕ ОКНО: Адаптировано под мобилку */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '20px' }}>
          
          {/* 🟢 ДОБАВИЛИ maxHeight и overflowY: 'auto' сюда: */}
          <div style={{ background: '#1a1a1a', padding: isMobile ? '20px' : '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #333', boxSizing: 'border-box', maxHeight: '90dvh', overflowY: 'auto' }}>
            
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
              <button onClick={() => { setIsModalOpen(false); setNewRoomTitle(''); }} style={{ padding: '10px 16px', background: 'transparent', color: '#fff', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}>Отмена</button>
              <button 
                onClick={handleCreateRoom}
                disabled={isCreating || !newRoomTitle.trim()}
                style={{ padding: '10px 16px', background: 'white', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: isMobile ? '100%' : 'auto', opacity: (isCreating || !newRoomTitle.trim()) ? 0.5 : 1 }}
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