import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Mail, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import clsx from 'clsx';
import { cleanEmail } from '../lib/inputSanitizers';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [isShake, setIsShake] = useState(false);
  const { resetPassword } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });
    const normalizedEmail = cleanEmail(email);

    if (!normalizedEmail) {
      setStatus({ type: 'error', message: 'Please enter your email address' });
      triggerShake();
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword(normalizedEmail);
      setStatus({ type: 'success', message: 'Password reset link sent! Check your email.' });
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to send reset link. Please try again.' });
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
          <h2 className="font-heading text-3xl font-bold mb-8 text-text-primary tracking-wide">Reset Password</h2>

          {status.type === 'error' && (
            <div className="mb-6 p-4 rounded border border-status-danger/50 bg-status-danger/10 flex items-start gap-3">
              <AlertCircle size={20} className="text-status-danger shrink-0 mt-0.5" />
              <p className="text-sm text-status-danger font-medium">{status.message}</p>
            </div>
          )}

          {status.type === 'success' && (
            <div className="mb-6 p-4 rounded border border-status-success/50 bg-status-success/10 flex items-start gap-3">
              <CheckCircle size={20} className="text-status-success shrink-0 mt-0.5" />
              <p className="text-sm text-status-success font-medium">{status.message}</p>
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
                    status.type === 'error' && !email && "border-status-danger ring-1 ring-status-danger"
                  )}
                  placeholder="pilot@dronesolutions.co.zw"
                  disabled={isLoading || status.type === 'success'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || status.type === 'success'}
              className="w-full btn-primary h-11 flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Send Reset Link'}
            </button>

            <p className="text-center text-sm text-text-muted mt-6">
              Remembered your password? <Link to="/login" className="text-accent hover:underline">Back to Login</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
