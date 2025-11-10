import React, { useState } from 'react';
import { supabase } from '../config/supabase';
import { LogIn, UserPlus, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';

const Auth = ({ onAuthSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) throw error;

            if (data.user) {
                setMessage('¡Login exitoso! Redirigiendo...');
                setTimeout(() => {
                    onAuthSuccess(data.user);
                }, 1000);
            }
        } catch (error) {
            setError(error.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const { data, error } = await supabase.auth.signUp({
                email: email.trim(),
                password: password,
                options: {
                    emailRedirectTo: window.location.origin,
                }
            });

            if (error) throw error;

            if (data.user) {
                // Verificar si necesita confirmación por email
                if (data.user.identities && data.user.identities.length === 0) {
                    setError('Este email ya está registrado. Por favor inicia sesión.');
                } else {
                    setMessage('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
                    setTimeout(() => {
                        setIsLogin(true);
                        setPassword('');
                        setConfirmPassword('');
                    }, 2000);
                }
            }
        } catch (error) {
            setError(error.message || 'Error al crear cuenta');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            setError('Por favor ingresa tu email');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: `${window.location.origin}/reset-password`,
            });

            if (error) throw error;

            setMessage('Te hemos enviado un email para restablecer tu contraseña');
        } catch (error) {
            setError(error.message || 'Error al enviar email de recuperación');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo y Título */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mb-4 shadow-lg">
                        <span className="text-4xl">📊</span>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2">Bitácora de Trading</h1>
                    <p className="text-gray-400">Gestiona tus operaciones como un profesional</p>
                </div>

                {/* Card de Login/Registro */}
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-800">
                    {/* Tabs */}
                    <div className="flex gap-2 mb-6 bg-gray-800 rounded-lg p-1">
                        <button
                            onClick={() => {
                                setIsLogin(true);
                                setError('');
                                setMessage('');
                            }}
                            className={`flex-1 py-2 px-4 rounded-md font-semibold transition-all ${isLogin
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            onClick={() => {
                                setIsLogin(false);
                                setError('');
                                setMessage('');
                            }}
                            className={`flex-1 py-2 px-4 rounded-md font-semibold transition-all ${!isLogin
                                    ? 'bg-cyan-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Registrarse
                        </button>
                    </div>

                    {/* Mensajes */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {message && (
                        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-400 text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{message}</span>
                        </div>
                    )}

                    {/* Formulario */}
                    <form onSubmit={isLogin ? handleLogin : handleSignUp}>
                        {/* Email */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-semibold mb-2">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-gray-800 text-white pl-11 pr-4 py-3 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition-colors"
                                    placeholder="tu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-semibold mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-gray-800 text-white pl-11 pr-11 py-3 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition-colors"
                                    placeholder="••••••••"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password (solo en registro) */}
                        {!isLogin && (
                            <div className="mb-6">
                                <label className="block text-gray-400 text-sm font-semibold mb-2">
                                    Confirmar Contraseña
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-gray-800 text-white pl-11 pr-4 py-3 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none transition-colors"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Botón Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Procesando...</span>
                                </>
                            ) : (
                                <>
                                    {isLogin ? (
                                        <>
                                            <LogIn className="w-5 h-5" />
                                            <span>Iniciar Sesión</span>
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="w-5 h-5" />
                                            <span>Crear Cuenta</span>
                                        </>
                                    )}
                                </>
                            )}
                        </button>
                    </form>

                    {/* Olvidé mi contraseña */}
                    {isLogin && (
                        <div className="mt-4 text-center">
                            <button
                                onClick={handleResetPassword}
                                disabled={loading}
                                className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>
                    )}

                    {/* Info adicional */}
                    <div className="mt-6 pt-6 border-t border-gray-800">
                        <p className="text-gray-500 text-xs text-center">
                            {isLogin
                                ? '¿No tienes cuenta? Haz clic en "Registrarse" arriba'
                                : '¿Ya tienes cuenta? Haz clic en "Iniciar Sesión" arriba'}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center text-gray-500 text-sm">
                    <p>Tus datos están protegidos y encriptados 🔒</p>
                </div>
            </div>
        </div>
    );
};

export default Auth;