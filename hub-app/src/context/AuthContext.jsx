import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../supabaseClient';

// Создаем сам контекст
const AuthContext = createContext();

// Провайдер, который будет оборачивать всё наше приложение
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. При загрузке страницы проверяем, есть ли сохраненный вход (токен)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Слушаем события (когда кто-то нажал "Войти" или "Выйти")
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Хук, чтобы мы могли легко вытаскивать пользователя в любом файле
export const useAuth = () => useContext(AuthContext);