import { createContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (authUser) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
        
      if (error) throw error;
      
      setUser({
        id: authUser.id,
        email: authUser.email,
        fullName: data.full_name,
        role: data.role,
        mustChangePassword: Boolean(data.must_change_password || authUser?.user_metadata?.must_change_password),
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      if (error?.code === 'PGRST116' || error?.status === 406) {
        const fallbackRole = authUser?.user_metadata?.role || authUser?.app_metadata?.role || 'pilot';

        setUser({
          id: authUser.id,
          email: authUser.email,
          fullName: authUser?.user_metadata?.full_name || 'Unknown User',
          role: fallbackRole,
          mustChangePassword: Boolean(authUser?.user_metadata?.must_change_password),
        });
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    });
    if (error) throw error;
    return { success: true };
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false },
    });
    if (error) throw error;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    const userId = authUser?.id || user?.id;

    if (userId) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', userId);

      if (profileError) {
        console.warn('Unable to clear must_change_password on profile. Confirm the column exists in Supabase.', profileError);
      }
    }

    setUser((currentUser) => currentUser ? { ...currentUser, mustChangePassword: false } : currentUser);
    return { success: true };
  };

  useEffect(() => {
    if (!user) return;

    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // 15 minutes = 15 * 60 * 1000 = 900000 ms
      timeoutId = setTimeout(() => {
        logout();
      }, 900000);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Initialize the timer
    resetTimer();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
};
