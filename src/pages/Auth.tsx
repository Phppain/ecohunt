import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { EcoButton } from '@/components/eco/EcoButton';
import { EcoCard } from '@/components/eco/EcoCard';
import { Leaf, Mail, Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import logo from '@/assets/logo.jpeg';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignUp) {
        // Check username uniqueness
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', username.trim())
          .maybeSingle();
        if (existing) {
          setError('Этот никнейм уже занят. Выберите другой.');
          setLoading(false);
          return;
        }
        await signUp(email, password, username.trim());
      } else {
        await signIn(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="EcoHunt" className="w-20 h-20 rounded-full object-cover mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">EcoHunt</h1>
          <p className="text-muted-foreground text-sm mt-1">Clean the planet, earn rewards</p>
        </div>

        <EcoCard variant="elevated" className="p-6">
          <h2 className="text-lg font-bold text-foreground mb-4">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required={isSignUp}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-2 focus:ring-primary text-sm"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-2 focus:ring-primary text-sm"
              />
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}

            <EcoButton type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
            </EcoButton>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
              className="text-primary font-semibold hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </EcoCard>
      </div>
    </div>
  );
}
