"use client"

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      router.refresh();
      router.push('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Background Image */}
      <Image
        src="/bg-v3.webp"
        alt="Background"
        fill
        className="object-cover -z-20"
        priority
        quality={100}
      />
      {/* Subtle overlay to ensure card pops */}
      <div className="absolute inset-0 bg-slate-900/10 -z-10" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-sm relative z-10">
        
        {/* Main Card Container with Glassmorphism */}
        <div className="bg-white/70 backdrop-blur-lg shadow-2xl shadow-black/5 rounded-2xl overflow-hidden border border-white/40 transition-all hover:bg-white/80">
          
          <div className="py-8 px-4 sm:px-6">
            {/* Header INSIDE the card */}
            <div className="flex flex-col items-center mb-8">
                <div className="relative w-48 h-12 mb-4">
                   <Image
                      src="/chimilogosidebar.svg"
                      alt="Chimivuelos"
                      fill
                      className="object-contain"
                      priority
                    />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">
                  Bienvenido
                </h2>
            </div>

            <form className="space-y-6" onSubmit={handleLogin}>
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="text-sm text-red-600 font-medium">{error}</span>
                    </div>
                )}
                
                <div className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                        Correo Electrónico
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@chimivuelos.pe"
                        className="appearance-none block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-chimipink/20 focus:border-chimipink transition-all focus:bg-white/80"
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="appearance-none block w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-chimipink/20 focus:border-chimipink transition-all focus:bg-white/80 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                        >
                            {showPassword ? (
                                <EyeOff className="h-5 w-5" />
                            ) : (
                                <Eye className="h-5 w-5" />
                            )}
                        </button>
                      </div>
                    </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-chimipink hover:bg-chimipink-hover hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-chimipink disabled:opacity-70 disabled:cursor-not-allowed transition-all transform active:scale-[0.99]"
                  >
                    {loading ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Accediendo...
                        </>
                    ) : (
                      'Iniciar Sesión'
                    )}
                  </button>
                </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
