import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShake, setIsShake] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      triggerShake();
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials. Please try again.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const triggerShake = () => {
    setIsShake(true);
    setTimeout(() => setIsShake(false), 500);
  };

  return (
    <div className="flex min-h-screen bg-bg-primary text-text-primary font-sans">
      {/* Left Panel */}
      <div className="hidden lg:flex flex-col justify-center w-2/5 px-16 relative overflow-hidden border-r border-border bg-bg-surface">
        <div className="absolute inset-0 opacity-20 pointer-events-none" 
          style={{
            backgroundImage: `linear-gradient(#3B82F6 1px, transparent 1px), linear-gradient(90deg, #3B82F6 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: 'center center'
          }}>
        </div>
        
        <div className="z-10 flex flex-col items-start">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 rounded bg-accent flex items-center justify-center font-heading font-bold text-white text-xl tracking-wider">DSZ</div>
            <span className="font-heading font-bold text-sm tracking-[0.2em] text-text-muted uppercase">Drone Solutions Zimbabwe</span>
          </div>
          
          <h1 className="font-heading text-5xl font-bold leading-tight mb-4 tracking-wide">
            Drone Pilot<br />Management System
          </h1>
          
          <p className="text-xl text-text-secondary font-sans font-light tracking-wide mb-12">
            Secure. Compliant. Operational.
          </p>

          <div className="mt-auto inline-flex items-center gap-3 px-4 py-2 rounded-full border border-border bg-bg-elevated/50 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-status-success animate-pulse"></div>
            <span className="text-xs font-medium tracking-wider text-text-secondary">Compliant with CAAZ SI 271 of 2018</span>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-bg-surface to-bg-primary">
        <div className={clsx(
            "w-full max-w-md p-10 rounded-xl glassmorphism shadow-2xl transition-transform",
            isShake && "animate-[shake_0.5s_ease-in-out]"
          )}>
          <h2 className="font-heading text-3xl font-bold mb-8 text-text-primary tracking-wide">Welcome back</h2>
          
          {error && (
            <div className="mb-6 p-4 rounded border border-status-danger/50 bg-status-danger/10 flex items-start gap-3">
              <AlertCircle size={20} className="text-status-danger shrink-0 mt-0.5" />
              <p className="text-sm text-status-danger font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">Email Address</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={clsx(
                    "input-field pl-10 h-11",
                    error && !email && "border-status-danger ring-1 ring-status-danger"
                  )}
                  placeholder="pilot@dronesolutions.co.zw"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">Password</label>
                <a href="#" className="text-xs text-accent hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={clsx(
                    "input-field pl-10 h-11",
                    error && !password && "border-status-danger ring-1 ring-status-danger"
                  )}
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full btn-primary h-11 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Sign In'}
            </button>
            
            <p className="text-center text-xs text-text-muted mt-6">
              Authorized personnel only. Access is monitored.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
