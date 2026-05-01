import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, Users, Edit2, Trash2, Loader2, Search, UserPlus, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext'; 
import Sidebar from '../components/Sidebar';

export default function Designers() {
  const navigate = useNavigate();
  
  // --- АВТОРИЗАЦИЯ И РОЛИ ---
  const { user } = useAuth(); 

  const myAdminEmail = '3d_cross@mail.ru'; 
  const isVisualizer = user?.email === myAdminEmail;

  // Проверка доступа
  useEffect(() => {
    if (!user) {
      navigate('/auth'); 
    } else if (!isVisualizer) {
      navigate('/projects'); 
    }
  }, [user, isVisualizer, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // --- СОСТОЯНИЯ ---
  const [designers, setDesigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDesignerName, setNewDesignerName] = useState('');
  const [editingDesigner, setEditingDesigner] = useState(null);
  const [editName, setEditName] = useState('');

  // --- ЗАГРУЗКА И ДЕЙСТВИЯ ---
  const fetchDesigners = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('profiles').select('id, name, projects(id)').eq('role', 'designer').order('name');
      if (error) throw error;
      setDesigners(data || []);
    } catch (error) {
      console.error('Ошибка загрузки:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    // Загружаем данные только если юзер авторизован
    if (user) fetchDesigners(); 
  }, [user]);

  const handleAddDesigner = async () => {
    if (!newDesignerName.trim()) return;
    try {
      const { error } = await supabase.from('profiles').insert([{ name: newDesignerName, role: 'designer' }]);
      if (error) throw error;
      setNewDesignerName('');
      setIsAddModalOpen(false);
      fetchDesigners();
    } catch (error) {
      alert('Ошибка: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('ВНИМАНИЕ! Удаление дизайнера автоматически удалит ВСЕ его проекты, комнаты и рендеры. Продолжить?')) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchDesigners();
    }
  };

  const handleUpdate = async () => {
    if (!editName.trim()) return;
    const { error } = await supabase.from('profiles').update({ name: editName }).eq('id', editingDesigner.id);
    if (error) alert(error.message);
    else { setEditingDesigner(null); fetchDesigners(); }
  };

  const filteredDesigners = designers.filter(d => d.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  // Если пользователя еще нет, не рендерим интерфейс, ждем редиректа
  if (!user) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#0a0a0a', color: 'white', fontFamily: 'Manrope, sans-serif' }}>
      
      {/* МЫ УДАЛИЛИ ВЕСЬ СТАРЫЙ КОД И ПОСТАВИЛИ ЭТО: */}
      <Sidebar />

      {/* ПРАВАЯ ОСНОВНАЯ ЧАСТЬ */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
          <h1 style={{ margin: 0, fontWeight: '300', fontSize: '2rem' }}>База дизайнеров</h1>
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#555' }} />
              <input type="text" placeholder="Поиск..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: '#111', border: '1px solid #333', color: 'white', padding: '10px 15px 10px 40px', borderRadius: '6px', fontSize: '0.9rem', width: '250px' }} />
            </div>
            <button 
  onClick={() => setIsAddModalOpen(true)} 
  style={{ 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    background: '#00ff88', /* Наш неоновый акцент */
    color: '#000', /* Черный контрастный текст */
    border: 'none', 
    padding: '10px 20px', 
    borderRadius: '8px', 
    fontWeight: '600', 
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0, 255, 136, 0.2)', /* Мягкое зеленое свечение */
    transition: 'all 0.2s ease' /* Плавность анимации */
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-2px)';
    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.4)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.2)';
  }}
>
  <UserPlus size={18} /> 
  Добавить дизайнера
</button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#555' }}>
            <Loader2 size={20} style={{ animation: 'spin 2s linear infinite' }} /> Загрузка...
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ 
            background: 'rgba(26, 26, 26, 0.4)', 
            backdropFilter: 'blur(12px)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '16px', 
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}>
            
            {/* Шапка таблицы */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr', 
              padding: '16px 24px', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
              color: '#666', 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              letterSpacing: '1px', 
              textTransform: 'uppercase' 
            }}>
              <span>Имя дизайнера</span>
              <span>Количество проектов</span>
              <span style={{ textAlign: 'right' }}>Действия</span>
            </div>

            {/* Список дизайнеров */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredDesigners.map((d) => (
                <div 
                  key={d.id} 
                  onClick={() => navigate(`/designer/${d.id}`)} 
                  style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '2fr 1fr 1fr', 
                    alignItems: 'center', 
                    padding: '16px 24px', 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.02)', 
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  
                  {/* Аватарка и имя */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ 
                      width: '38px', height: '38px', borderRadius: '50%', 
                      background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: '1.2rem', fontWeight: 'bold', border: '1px solid rgba(0, 255, 136, 0.2)' 
                    }}>
                      {d.name ? d.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span style={{ fontSize: '1rem', color: '#fff', fontWeight: '500', letterSpacing: '0.3px' }}>
                      {d.name}
                    </span>
                  </div>

                  {/* Красивый бейдж количества проектов */}
                  <div>
                    <span style={{ 
                      background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', 
                      padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', color: '#aaa' 
                    }}>
                      Проектов: <span style={{ color: '#fff', fontWeight: 'bold' }}>{Array.isArray(d.projects) ? d.projects.length : 0}</span>
                    </span>
                  </div>

                  {/* Кнопки действий */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }} onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => { setEditingDesigner(d); setEditName(d.name); }} 
                      style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', transition: '0.2s', padding: '5px' }} 
                      onMouseEnter={(e) => e.currentTarget.style.color = '#00ff88'} 
                      onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                      title="Редактировать"
                    >
                      <Edit2 size={20} />
                    </button>
                    
                    <button 
                      onClick={() => handleDelete(d.id)} 
                      style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', transition: '0.2s', padding: '5px' }} 
                      onMouseEnter={(e) => e.currentTarget.style.color = '#f44336'} 
                      onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
                      title="Удалить"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>

                </div>
              ))}
              
              {/* Заглушка, если дизайнеров пока нет */}
              {filteredDesigners.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                  Дизайнеры не найдены
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* МОДАЛКА: ДОБАВИТЬ ДИЗАЙНЕРА */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', width: '350px', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0, fontSize: '1.4rem' }}>Добавить дизайнера</h3>
            <input type="text" autoFocus placeholder="Имя дизайнера..." value={newDesignerName} onChange={(e) => setNewDesignerName(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: 'white', marginBottom: '20px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }}>Отмена</button>
              <button onClick={handleAddDesigner} disabled={!newDesignerName.trim()} style={{ background: 'white', color: 'black', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Добавить</button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА: РЕДАКТИРОВАТЬ ДИЗАЙНЕРА */}
      {editingDesigner && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1a1a', padding: '30px', borderRadius: '12px', width: '350px', border: '1px solid #333' }}>
            <h3 style={{ marginTop: 0 }}>Изменить имя</h3>
            <input type="text" autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: '100%', padding: '12px', background: '#0a0a0a', border: '1px solid #333', borderRadius: '6px', color: 'white', marginBottom: '20px', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setEditingDesigner(null)} style={{ background: 'transparent', color: '#888', border: 'none', cursor: 'pointer' }}>Отмена</button>
              <button onClick={handleUpdate} disabled={!editName.trim()} style={{ background: 'white', color: 'black', border: 'none', padding: '8px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}