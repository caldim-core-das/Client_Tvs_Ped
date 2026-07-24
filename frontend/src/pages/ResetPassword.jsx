import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api/axiosConfig';

import imgTvsLogo from '../assets/tvslogo.jpg';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const { token } = useParams();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            toast.error('Password must be at least 8 characters long');
            return;
        }

        setIsLoading(true);
        try {
            await api.put(`/auth/reset-password/${token}`, { password });
            setIsSuccess(true);
            toast.success('Password reset successful!');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to reset password. The link might be invalid or expired.');
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
                        Set New Password
                    </h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Please enter your new password below.
                    </p>
                </div>

                {!isSuccess ? (
                    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-tvs-primary focus:border-tvs-primary sm:text-sm transition-colors bg-gray-50 focus:bg-white"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPwd(!showPwd)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    >
                                        {showPwd ? (
                                            <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                        ) : (
                                            <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Confirm New Password
                                </label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                        type={showConfirmPwd ? 'text' : 'password'}
                                        required
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="appearance-none block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-tvs-primary focus:border-tvs-primary sm:text-sm transition-colors bg-gray-50 focus:bg-white"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    >
                                        {showConfirmPwd ? (
                                            <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                        ) : (
                                            <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={isLoading || !password || !confirmPassword}
                                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-tvs-primary hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-tvs-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Saving...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Save className="w-4 h-4" />
                                        Save Password
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="mt-8 bg-green-50 rounded-lg p-6 text-center border border-green-100">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-medium text-green-800 mb-2">Password Reset Successful</h3>
                        <p className="text-sm text-green-700 mb-6">
                            Your password has been successfully updated. You can now log in with your new password.
                        </p>
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none transition-all"
                        >
                            Go to Log In
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResetPassword;
