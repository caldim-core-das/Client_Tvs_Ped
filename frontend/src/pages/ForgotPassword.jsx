import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api/axiosConfig';

import imgTvsLogo from '../assets/tvslogo.jpg';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            toast.error('Please enter your email address');
            return;
        }

        setIsLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setIsSent(true);
            toast.success('Password reset link sent to your email!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to send reset link. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-inter">
            <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
                <div className="text-center">
                    <img 
                        src={imgTvsLogo} 
                        alt="TVS Logo" 
                        className="mx-auto h-16 w-16 rounded-full border border-gray-200 object-cover shadow-sm"
                    />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 tracking-tight">
                        Forgot Password?
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        No worries, we'll send you reset instructions.
                    </p>
                </div>

                {!isSent ? (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                                Email address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400" />
                                </div>
                                <input
                                    id="email-address"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-tvs-primary focus:border-tvs-primary sm:text-sm transition-colors bg-gray-50 focus:bg-white"
                                    placeholder="Enter your email"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-tvs-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tvs-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Sending...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Send className="w-4 h-4" />
                                        Reset Password
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="mt-8 bg-green-50 rounded-lg p-6 text-center border border-green-100">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <Mail className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-medium text-green-800 mb-2">Check your email</h3>
                        <p className="text-sm text-green-700 mb-6">
                            We have sent a password reset link to <strong>{email}</strong>.
                        </p>
                        <button
                            onClick={() => setIsSent(false)}
                            className="text-sm font-medium text-tvs-primary hover:text-red-700 transition-colors"
                        >
                            Click to try another email address
                        </button>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <button
                        onClick={() => navigate('/login')}
                        className="flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors mx-auto"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to log in
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
