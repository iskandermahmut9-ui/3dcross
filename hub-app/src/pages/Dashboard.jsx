import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Folder, Users, Plus, ArrowRight, Loader2, User } from 'lucide-react';
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

  // === НАШ ЖЕЛЕЗОБЕТОННЫЙ ЗАМОК ===
  const lastFetchRef = useRef(null);

  // ЗАЩИТА СТРАНИЦЫ: Если юзера нет, выкидываем на страницу входа
  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
  const fetchData = async () => {
    if (!user?.id) return; 

    try {
      setLoading(true); 
      
      let query = supabase
        .from('profiles')
        .select(`id, name, projects ( id, title, status, created_at )`)
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

  // ПРАВИЛЬНЫЙ ЗАПУСК ЧЕРЕЗ ЗАМОК
  useEffect(() => {
    // Создаем уникальный ключ для текущего запроса
    const currentKey = `${user?.id}-${designerId || 'all'}`;

    // Код запустится ТОЛЬКО если мы эти данные еще не загружали
    if (user?.id && lastFetchRef.current !== currentKey) {
      lastFetchRef.current = currentKey; // Закрываем замок
      fetchData();
    }
  }, [user?.id, designerId, isVisualizer]);

  // СОЗДАНИЕ ПРОЕКТА
  const handleCreateProject = async () => {
    if (!newProjectTitle.trim()) return;
    if (selectedDesignerId === 'new' && !newDesignerName.trim()) return;
    if (!selectedDesignerId) return;

    try {
      setIsCreating(true);
      let targetDesignerId = selectedDesignerId;

      if (selectedDesignerId === 'new') {
        const { data: newProfile, error: profileError } = await supabase
          .from('profiles')
          .insert([{ name: newDesignerName, role: 'designer' }])
          .select()
          .single();
          
        if (profileError) throw profileError;
        targetDesignerId = newProfile.id;
      }

      const { error: projectError } = await supabase
        .from('projects')
        .insert([{ title: newProjectTitle, designer_id: targetDesignerId, status: 'В работе' }]);
        
      if (projectError) throw projectError;

      setNewProjectTitle(''); 
      setNewDesignerName(''); 
      setIsModalOpen(false);
      
      // Сбрасываем замок, чтобы подтянуть свежие проекты, и обновляем данные
      lastFetchRef.current = null;
      fetchData(); 
      
    } catch (error) {
      alert('Ошибка: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif' }}>
      
      <Sidebar />

      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h1 style={{ margin: 0, fontWeight: '300', fontSize: '2rem' }}>{designerId ? `Проекты: ${designersData[0]?.name || ''}` : 'Все проекты'}</h1>
          
          {isVisualizer && (
            <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', color: 'black', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
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
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '500' }}>{designer.name}</h2>
                    <span style={{ background: '#222', color: '#888', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>Проектов: {designer.projects.length}</span>
                  </div>
                )}
                
                {designer.projects.length === 0 ? (
                  <p style={{ color: '#555', margin: 0 }}>У этого дизайнера пока нет проектов.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {designer.projects.map((project) => (
                      <TiltCard 
                        key={project.id} 
                        onClick={() => navigate(`/project/${project.id}`)} 
                        style={{ 
                          background: 'rgba(26, 26, 26, 0.4)', 
                          backdropFilter: 'blur(12px)', 
                          border: '1px solid rgba(255, 255, 255, 0.08)', 
                          borderRadius: '16px', 
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)', 
                          padding: '24px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '20px'
                        }}
                      >
                        {/* Шапка карточки: Статус с пульсирующей точкой */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ 
                              width: '8px', height: '8px', borderRadius: '50%', 
                              background: project.status === 'Ждет правок' ? '#ff4d4d' : project.status === 'В работе' ? '#fff' : '#00ff88',
                              boxShadow: `0 0 10px ${project.status === 'Ждет правок' ? '#ff4d4d' : project.status === 'В работе' ? 'rgba(255,255,255,0.5)' : '#00ff88'}`
                            }} />
                            <span style={{ color: '#aaa', fontSize: '0.8rem', fontWeight: '500' }}>
                              {project.status || 'В работе'}
                            </span>
                          </div>
                          <ArrowRight size={18} color="#555" />
                        </div>

                        {/* Название */}
                        <h3 style={{ margin: 0, color: '#fff', fontSize: '1.4rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                          {project.title}
                        </h3>

                        {/* 🟢 Декоративный инфо-блок (убирает пустоту) */}
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #333' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '1.4rem' }}>Новый проект</h2>
            
            <label style={{ display: 'block', marginBottom: '15px' }}>
              <span style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Заказчик (Дизайнер)</span>
              <select value={selectedDesignerId} onChange={(e) => setSelectedDesignerId(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: 'white', fontSize: '1rem', appearance: 'none' }}>
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

            {selectedDesignerId === 'new' && !designerId && (
              <label style={{ display: 'block', marginBottom: '15px' }}>
                <span style={{ display: 'block', marginBottom: '8px', color: '#00ff88', fontSize: '0.9rem' }}>Имя нового дизайнера</span>
                <input type="text" autoFocus placeholder="Например: Анна С." value={newDesignerName} onChange={(e) => setNewDesignerName(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #00ff88', borderRadius: '6px', color: 'white', boxSizing: 'border-box', fontSize: '1rem' }} />
              </label>
            )}

            <label style={{ display: 'block', marginBottom: '25px' }}>
              <span style={{ display: 'block', marginBottom: '8px', color: '#aaa', fontSize: '0.9rem' }}>Название проекта</span>
              <input type="text" placeholder="Например: ЖК Freedom" value={newProjectTitle} onChange={(e) => setNewProjectTitle(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: 'white', boxSizing: 'border-box', fontSize: '1rem' }} />
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { setIsModalOpen(false); setSelectedDesignerId(designerId || ''); setNewDesignerName(''); setNewProjectTitle(''); }} style={{ padding: '10px 16px', background: 'transparent', color: '#fff', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer' }}>Отмена</button>
              <button onClick={handleCreateProject} disabled={isCreating || !newProjectTitle.trim() || !selectedDesignerId || (selectedDesignerId === 'new' && !newDesignerName.trim())} style={{ padding: '10px 16px', background: 'white', color: 'black', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', opacity: (isCreating || !newProjectTitle.trim() || !selectedDesignerId || (selectedDesignerId === 'new' && !newDesignerName.trim())) ? 0.5 : 1 }}>
                {isCreating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}