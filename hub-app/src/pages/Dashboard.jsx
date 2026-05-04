import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Folder, Users, Plus, ArrowRight, Loader2, User, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import TiltCard from '../components/TiltCard';

export default function Dashboard() {
  const navigate = useNavigate();
  const { designerId } = useParams();
  
  const { user } = useAuth();

  const myAdminEmail = '3d_cross@mail.ru'; 
  const isVisualizer = user?.email === myAdminEmail;

  const [designersData, setDesignersData] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDesignerId, setSelectedDesignerId] = useState('');
  const [newDesignerName, setNewDesignerName] = useState('');
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 🟢 1. Слушатель для мобильной версии
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const lastFetchRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const fetchData = async () => {
    if (!user?.id) return; 

    try {
      setLoading(true); 
      
      let query = supabase
        .from('profiles')
        .select(`id, name, projects ( id, title, status, created_at, is_archived )`)
        .eq('role', 'designer')
        .order('name');

      if (isVisualizer) {
        if (designerId) query = query.eq('id', designerId);
      } else {
        query = query.eq('id', user.id); 
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setDesignersData(data || []);
      
      if (designerId && isVisualizer && selectedDesignerId !== designerId) {
        setSelectedDesignerId(designerId);
      }

    } catch (error) {
      console.error('Ошибка загрузки:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const currentKey = `${user?.id}-${designerId || 'all'}`;

    if (user?.id && lastFetchRef.current !== currentKey) {
      lastFetchRef.current = currentKey;
      fetchData();
    }
  }, [user?.id, designerId, isVisualizer]);
  
  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;

    // 🟢 1. ОПРЕДЕЛЯЕМ ID: Если админ - берем из списка. Если дизайнер - берем его собственный
    let targetDesignerId = isVisualizer ? selectedDesignerId : user?.id;

    // 🟢 2. ПРОВЕРКИ ТОЛЬКО ДЛЯ АДМИНА
    if (isVisualizer) {
      if (selectedDesignerId === 'new' && !newDesignerName.trim()) return;
      if (!selectedDesignerId) return;
    }

    try {
      setIsCreating(true);

      // 🟢 3. Создание нового дизайнера "на лету" (только для админа)
      if (isVisualizer && selectedDesignerId === 'new') {
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert([{ name: newDesignerName, role: 'designer' }])
          .select()
          .single();
          
        if (profileError) throw profileError;
        targetDesignerId = newProfile.id;
      }

      // 🟢 4. Запись проекта в базу
      const { error: projectError } = await supabase
        .from('projects')
        .insert([{ title: newProjectTitle, designer_id: targetDesignerId, status: 'В работе' }]);
        
      if (projectError) throw projectError;

      setNewProjectTitle(''); 
      setNewDesignerName(''); 
      setIsModalOpen(false);
      
      lastFetchRef.current = null;
      fetchData(); 
      
    } catch (error) {
      alert('Ошибка: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };
  const handleDeleteProject = async (e, projectId) => {
  e.stopPropagation(); // Важно, чтобы не сработал переход в проект
  if (window.confirm('Точно удалить этот проект? Все данные внутри исчезнут навсегда!')) {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
      fetchData(); // Обновляем список
    } catch (error) {
      alert('Ошибка при удалении: ' + error.message);
    }
  }
};

  return (
    // 🟢 2. Главный контейнер теперь меняет направление: column на мобилках, row на десктопе
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif' }}>
      
      <Sidebar />

      {/* 🟢 3. Адаптивные отступы: 20px на телефоне, 40px на компе */}
      <div style={{ flex: 1, padding: isMobile ? '20px' : '40px', overflowY: 'auto' }}>
        
        {/* 🟢 4. Шапка страницы выстраивается в столбик на телефоне */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: isMobile ? '15px' : '0', marginBottom: '30px' }}>
          <h1 style={{ margin: 0, fontWeight: '300', fontSize: isMobile ? '1.5rem' : '2rem' }}>
            {designerId ? `Проекты: ${designersData[0]?.name || ''}` : 'Все проекты'}
          </h1>
          
          {(isVisualizer || !designerId || user?.id === designerId) && (
  <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', background: 'white', color: 'black', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
    <Plus size={18} /> Создать проект
  </button>
)}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#555' }}><Loader2 size={20} style={{ animation: 'spin 2s linear infinite' }} /> Загрузка...<style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style></div>
        ) : designersData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed #333', borderRadius: '12px' }}>
            <Folder size={48} color="#333" style={{ marginBottom: '15px' }} />
            <h2 style={{ margin: '0 0 10px 0', color: '#888', fontWeight: '400' }}>Проектов пока нет</h2>
            {isVisualizer ? (
              <p style={{ margin: 0, color: '#555' }}>Нажмите «Создать проект», чтобы добавить первую работу.</p>
            ) : (
              <p style={{ margin: 0, color: '#555' }}>Ожидайте, скоро здесь появятся ваши проекты.</p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            {designersData.map((designer) => (
              <div key={designer.id}>
                {!designerId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                    <User size={24} color="#888" />
                    <h2 style={{ margin: 0, fontSize: isMobile ? '1.2rem' : '1.4rem', fontWeight: '500' }}>{designer.name}</h2>
                    <span style={{ background: '#222', color: '#888', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>Проектов: {designer.projects.length}</span>
                  </div>
                )}
                
                {designer.projects.length === 0 ? (
                  <p style={{ color: '#555', margin: 0 }}>У этого дизайнера пока нет проектов.</p>
                ) : (
                 // 🟢 5. Карточки. Слегка уменьшили минимальную ширину карточки, чтобы она влезала в узкие экраны iPhone
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {designer.projects.map((project) => (
                      <TiltCard 
  key={project.id} 
  onClick={() => navigate(`/project/${project.id}`)} 
  style={{ 
    position: 'relative', // 🟢 ОБЯЗАТЕЛЬНО ДОБАВЬ ЭТО
    background: 'rgba(26, 26, 26, 0.4)', 
    backdropFilter: 'blur(12px)', 
    // ... твои остальные стили ...
    opacity: project.is_archived ? 0.6 : 1,
    transition: 'opacity 0.3s ease'
  }}
>
  {/* 🟢 ВОТ ОН, ПОСЛЕДНИЙ ПУНКТ (КНОПКА УДАЛЕНИЯ) */}
  {isVisualizer && (
    <button 
      onClick={(e) => handleDeleteProject(e, project.id)}
      style={{
        position: 'absolute',
        top: '15px',
        right: '15px',
        background: 'rgba(255, 68, 68, 0.1)',
        color: '#ff4444',
        border: 'none',
        borderRadius: '6px',
        padding: '6px',
        cursor: 'pointer',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <Trash2 size={16} />
    </button>
  )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* 🟢 Логика точки: Архив перекрывает всё красным. Иначе - зеленый для работы, красный для правок */}
                            <div style={{ 
                              width: '8px', height: '8px', borderRadius: '50%', 
                              background: project.is_archived ? '#ff4d4d' : (project.status === 'Ждет правок' ? '#ff4d4d' : '#00ff88'),
                              boxShadow: project.is_archived ? '0 0 10px rgba(255, 77, 77, 0.6)' : (project.status === 'Ждет правок' ? '0 0 10px rgba(255, 77, 77, 0.6)' : '0 0 10px rgba(0, 255, 136, 0.6)')
                            }} />
                            <span style={{ 
                              color: project.is_archived ? '#ff4d4d' : '#aaa', 
                              fontSize: '0.8rem', 
                              fontWeight: '500' 
                            }}>
                              {project.is_archived ? 'В архиве' : (project.status || 'В работе')}
                            </span>
                          </div>
                          <ArrowRight size={18} color="#555" />
                        </div>

                        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.4rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                          {project.title}
                        </h3>

                        <div style={{ display: 'flex', gap: '20px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)', marginTop: 'auto' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Действие</span>
                            <span style={{ color: '#eee', fontWeight: 'bold', fontSize: '0.95rem' }}>Открыть проект</span>
                          </div>
                        </div>
                      </TiltCard>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)', padding: '20px' }}>
          <div style={{ background: '#1a1a1a', padding: isMobile ? '20px' : '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #333', boxSizing: 'border-box' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.4rem' }}>Новый проект</h2>
            
            {/* 🟢 ПОКАЗЫВАЕМ СПИСОК ТОЛЬКО АДМИНУ */}
            {isVisualizer && (
              <label style={{ display: 'block', marginBottom: '15px' }}>
                <span style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Заказчик (Дизайнер)</span>
                <select value={selectedDesignerId} onChange={(e) => setSelectedDesignerId(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: 'white', fontSize: '1rem', appearance: 'none', boxSizing: 'border-box' }}>
                  <option value="" disabled>-- Выберите дизайнера --</option>
                  {designerId ? (
                    <option value={designersData[0]?.id}>{designersData[0]?.name}</option>
                  ) : (
                    <>
                      {designersData.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      <option value="new">+ Добавить нового дизайнера</option>
                    </>
                  )}
                </select>
              </label>
            )}

            {/* 🟢 ИНПУТ ДЛЯ НОВОГО ДИЗАЙНЕРА ТОЖЕ ТОЛЬКО ДЛЯ АДМИНА */}
            {isVisualizer && selectedDesignerId === 'new' && !designerId && (
              <label style={{ display: 'block', marginBottom: '15px' }}>
                <span style={{ display: 'block', marginBottom: '8px', color: '#00ff88', fontSize: '0.9rem' }}>Имя нового дизайнера</span>
                <input type="text" autoFocus placeholder="Например: Анна С." value={newDesignerName} onChange={(e) => setNewDesignerName(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #00ff88', borderRadius: '6px', color: 'white', boxSizing: 'border-box', fontSize: '1rem' }} />
              </label>
            )}

            {/* 🟢 НАЗВАНИЕ ПРОЕКТА - ВИДЯТ ВСЕ */}
            <label style={{ display: 'block', marginBottom: '25px' }}>
              <span style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Название проекта</span>
              <input type="text" placeholder="Например: ЖК Freedom" value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: 'white', boxSizing: 'border-box', fontSize: '1rem' }} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexDirection: isMobile ? 'column' : 'row' }}>
              <button onClick={() => { setIsModalOpen(false); setSelectedDesignerId(designerId || ''); setNewDesignerName(''); setNewProjectTitle(''); }} style={{ padding: '10px 16px', background: 'transparent', color: '#fff', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer', width: isMobile ? '100%' : 'auto' }}>Отмена</button>
              
              {/* 🟢 ОБНОВЛЕННАЯ ЛОГИКА КНОПКИ СОЗДАТЬ */}
              <button 
                onClick={handleCreateProject} 
                disabled={isCreating || !newProjectTitle.trim() || (isVisualizer && (!selectedDesignerId || (selectedDesignerId === 'new' && !newDesignerName.trim())))} 
                style={{ padding: '10px 16px', background: 'white', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', width: isMobile ? '100%' : 'auto', opacity: (isCreating || !newProjectTitle.trim() || (isVisualizer && (!selectedDesignerId || (selectedDesignerId === 'new' && !newDesignerName.trim())))) ? 0.5 : 1 }}
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