import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Folder, Users, LogOut, Settings } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // 🟢 Состояние для отслеживания мобильной версии
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const myAdminEmail = '3d_cross@mail.ru'; 
  const isVisualizer = user?.email === myAdminEmail;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Красивая подсветка для десктопа
  const getLinkStyle = (path) => {
    const isActive = location.pathname === path || (path === '/projects' && location.pathname.includes('/projects'));
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

  // Подсветка иконок для мобилки
  const getMobileIconStyle = (path) => {
    const isActive = location.pathname === path || (path === '/projects' && location.pathname.includes('/projects'));
    return {
      padding: '10px',
      borderRadius: '8px',
      color: isActive ? '#00ff88' : '#888', // Зеленый акцент для активной вкладки
      background: isActive ? 'rgba(0, 255, 136, 0.1)' : 'transparent',
      cursor: 'pointer',
    };
  };

  const avatarLetter = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  // ==========================================
  // 📱 МОБИЛЬНАЯ ВЕРСИЯ (Верхняя шапка)
  // ==========================================
  if (isMobile) {
    return (
      <div style={{ width: '100%', height: '60px', backgroundColor: '#111', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxSizing: 'border-box', zIndex: 100 }}>
        
        {/* Логотип */}
        <div style={{ fontSize: '1.2rem', fontWeight: '700', letterSpacing: '1px', cursor: 'pointer', color: '#fff' }} onClick={() => navigate('/')}>
          3D\HUB
        </div>

        {/* Центральные иконки навигации */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {isVisualizer ? (
            <div onClick={() => navigate('/')} style={getMobileIconStyle('/')} title="База дизайнеров">
              <Users size={22} />
            </div>
          ) : (
            <div onClick={() => navigate('/projects')} style={getMobileIconStyle('/projects')} title="Мои проекты">
              <Folder size={22} />
            </div>
          )}
        </div>

        {/* Правый блок: Аватарка, Настройки, Выход */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>
            {avatarLetter}
          </div>
          <div onClick={() => navigate('/settings')} style={{ color: '#aaa', cursor: 'pointer', padding: '5px' }}>
            <Settings size={20} />
          </div>
          <div onClick={handleLogout} style={{ color: '#ff4d4d', cursor: 'pointer', padding: '5px' }}>
            <LogOut size={20} />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // 💻 ДЕСКТОПНАЯ ВЕРСИЯ (Боковая панель)
  // ==========================================
  return (
    <div style={{ width: '250px', backgroundColor: '#111', borderRight: '1px solid #222', padding: '24px 20px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', height: '100vh', flexShrink: 0 }}>
      
      <div style={{ fontSize: '1.5rem', fontWeight: '700', letterSpacing: '2px', marginBottom: '40px', cursor: 'pointer', color: '#fff' }} onClick={() => navigate('/')}>
        3D\HUB
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {isVisualizer && (
          <div onClick={() => navigate('/')} style={getLinkStyle('/')} onMouseEnter={(e) => location.pathname !== '/' && (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => location.pathname !== '/' && (e.currentTarget.style.color = '#888')}>
            <Users size={20} /> База дизайнеров
          </div>
        )}
        <div onClick={() => navigate('/projects')} style={getLinkStyle('/projects')} onMouseEnter={(e) => !location.pathname.includes('/projects') && (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => !location.pathname.includes('/projects') && (e.currentTarget.style.color = '#888')}>
          <Folder size={20} /> 
          {isVisualizer ? 'Все проекты' : 'Мои проекты'}
        </div>
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #222', display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#fff', fontSize: '1rem', flexShrink: 0 }}>
            {avatarLetter}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.85rem', color: '#ccc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div>
            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>{isVisualizer ? 'Визуализатор' : 'Дизайнер'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate('/settings')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: '#1a1a1a', border: '1px solid #333', color: '#aaa', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', fontSize: '0.8rem' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#222'; e.currentTarget.style.color = '#fff'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#aaa'; }}>
            <Settings size={16} /> Настройки
          </button>
          <button onClick={handleLogout} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'transparent', border: '1px solid transparent', color: '#666', cursor: 'pointer', padding: '8px', borderRadius: '6px', transition: '0.2s', fontSize: '0.8rem' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#ff4d4d'; e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)'; }} onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.background = 'transparent'; }}>
            <LogOut size={16} /> Выйти
          </button>
        </div>
      </div>
    </div>
  );
}