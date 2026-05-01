import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Folder, Users, LogOut, Settings } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation(); // Чтобы понимать, на какой мы сейчас странице
  const { user } = useAuth();

  // Проверка роли
  const myAdminEmail = '3d_cross@mail.ru'; 
  const isVisualizer = user?.email === myAdminEmail;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Функция для красивой подсветки активной кнопки
  const getLinkStyle = (path) => {
    const isActive = location.pathname === path;
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '12px',
      borderRadius: '8px',
      cursor: 'pointer',
      textDecoration: 'none',
      transition: 'all 0.2s ease',
      color: isActive ? '#fff' : '#888',
      background: isActive ? '#222' : 'transparent',
      fontWeight: isActive ? '500' : '400',
    };
  };

  // Достаем первую букву почты для аватарки
  const avatarLetter = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  return (
    <div style={{ width: '250px', backgroundColor: '#111', borderRight: '1px solid #222', padding: '24px 20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      
      {/* ЛОГОТИП */}
      <div style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '2px', marginBottom: '40px', cursor: 'pointer', color: '#fff' }} onClick={() => navigate('/')}>
        3D\HUB
      </div>

      {/* НАВИГАЦИЯ */}
      {/* Кнопка базы дизайнеров видна только тебе */}
        {isVisualizer && (
          <div onClick={() => navigate('/')} style={getLinkStyle('/')} onMouseEnter={(e) => location.pathname !== '/' && (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => location.pathname !== '/' && (e.currentTarget.style.color = '#888')}>
            <Users size={20} /> База дизайнеров
          </div>
        )}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        <div onClick={() => navigate('/projects')} style={getLinkStyle('/projects')} onMouseEnter={(e) => !location.pathname.includes('/projects') && (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => !location.pathname.includes('/projects') && (e.currentTarget.style.color = '#888')}>
          <Folder size={20} /> 
          {isVisualizer ? 'Все проекты' : 'Мои проекты'}
        </div>
        
        
      </nav>

      {/* РЕДИЗАЙН ПРОФИЛЯ (Шаг 2) */}
      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* Блок с аватаркой и инфой */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '1rem', flexShrink: 0 }}>
            {avatarLetter}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
              {isVisualizer ? 'Визуализатор' : 'Дизайнер'}
            </div>
          </div>
        </div>
{/* Кнопки управления (Настройки и Выход) */}
        <div style={{ display: 'flex', gap: '10px' }}>
          
          {/* Кнопка НАСТРОЙКИ (ведет на /settings) */}
          <button onClick={() => navigate('/settings')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#1a1a1a', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', fontSize: '0.8rem' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#aaa'; }}>
            <Settings size={16} /> Настройки
          </button>
          
          {/* Кнопка ВЫЙТИ (вызывает функцию handleLogout) */}
          <button onClick={handleLogout} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'transparent', border: '1px solid transparent', color: '#666', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', fontSize: '0.8rem' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4d4d'; e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent'; }}>
            <LogOut size={16} /> Выйти
          </button>

        </div>

      </div>
    </div>
  );
}