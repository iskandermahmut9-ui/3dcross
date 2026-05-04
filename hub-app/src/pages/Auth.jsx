import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true); // true = Вход, false = Регистрация
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // 🟢 ДОБАВИЛИ СОСТОЯНИЕ ДЛЯ ИМЕНИ
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Логика ВХОДА
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        
        navigate('/'); // Перекидываем на главную после успеха
      } else {
        // Логика РЕГИСТРАЦИИ
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        // === АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ПРОФИЛЯ ===
        if (data?.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                email: email,
                name: name,          // 🟢 ПЕРЕДАЕМ ИМЯ В БАЗУ
                role: 'designer'
              }
            ]);

          if (profileError) throw profileError;
        }

        navigate('/');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0a0a0a', color: 'white', fontFamily: 'sans-serif' }}>
      
      <div style={{ background: '#111', padding: '40px', borderRadius: '16px', border: '1px solid #222', width: '100%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        
        {/* Переключатель Вход / Регистрация */}
        <div style={{ display: 'flex', marginBottom: '30px', background: '#1a1a1a', borderRadius: '8px', padding: '4px' }}>
          <button 
            type="button"
            onClick={() => setIsLogin(true)}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: isLogin ? '#333' : 'transparent', color: isLogin ? 'white' : '#777', cursor: 'pointer', fontWeight: isLogin ? 'bold' : 'normal', transition: '0.2s' }}
          >
            Вход
          </button>
          <button 
            type="button"
            onClick={() => setIsLogin(false)}
            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: 'none', background: !isLogin ? '#333' : 'transparent', color: !isLogin ? 'white' : '#777', cursor: 'pointer', fontWeight: !isLogin ? 'bold' : 'normal', transition: '0.2s' }}
          >
            Регистрация
          </button>
        </div>

        <h2 style={{ textAlign: 'center', margin: '0 0 20px 0', fontSize: '1.5rem' }}>
          {isLogin ? 'С возвращением' : 'Создать аккаунт'}
        </h2>

        {error && (
          <div style={{ background: 'rgba(255, 68, 68, 0.1)', border: '1px solid #ff4444', color: '#ff4444', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          {/* 🟢 ПОЛЕ ИМЯ ПОКАЗЫВАЕТСЯ ТОЛЬКО ПРИ РЕГИСТРАЦИИ */}
          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#888' }}>Имя</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Иван"
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: 'white', outline: 'none', boxSizing: 'border-box' }}
                required={!isLogin} // Обязательно только если мы регистрируемся
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#888' }}>Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="designer@mail.com"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: 'white', outline: 'none', boxSizing: 'border-box' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem', color: '#888' }}>Пароль</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#1a1a1a', color: 'white', outline: 'none', boxSizing: 'border-box' }}
              required
              minLength={6}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ background: '#00ff88', color: '#000', padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '10px', opacity: loading ? 0.7 : 1, transition: '0.2s' }}
          >
            {loading ? 'Загрузка...' : (isLogin ? 'Войти' : 'Зарегистрироваться')}
          </button>
        </form>

      </div>
    </div>
  );
}