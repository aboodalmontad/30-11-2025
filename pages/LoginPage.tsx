
import * as React from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { ExclamationCircleIcon, EyeIcon, EyeSlashIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon, UserGroupIcon } from '../components/icons';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import type { User } from '@supabase/supabase-js';

interface AuthPageProps {
    onForceSetup: () => void;
    onLoginSuccess: (user: User, isOfflineLogin?: boolean) => void;
    initialMode?: 'login' | 'signup' | 'otp';
    currentUser?: User;
    currentMobile?: string;
    onVerificationSuccess?: () => void;
    onLogout?: () => void;
}

const LAST_USER_CREDENTIALS_CACHE_KEY = 'lawyerAppLastUserCredentials';

const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button type="button" onClick={handleCopy} className="flex items-center gap-1 text-xs text-gray-300 hover:text-white" title="نسخ الأمر">
            {copied ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
            {copied ? 'تم النسخ' : 'نسخ'}
        </button>
    );
};

const DatabaseIcon: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
    </svg>
);

const LoginPage: React.FC<AuthPageProps> = ({ onForceSetup, onLoginSuccess, initialMode = 'login', currentUser, currentMobile, onVerificationSuccess, onLogout }) => {
    const [authStep, setAuthStep] = React.useState<'login' | 'signup' | 'otp'>(initialMode);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<React.ReactNode | null>(null);
    const [message, setMessage] = React.useState<string | null>(null);
    const [info, setInfo] = React.useState<string | null>(null);
    const [authFailed, setAuthFailed] = React.useState(false); 
    const [showPassword, setShowPassword] = React.useState(false);
    const [otpCode, setOtpCode] = React.useState('');
    const [isAssistantSignup, setIsAssistantSignup] = React.useState(false);
    const isOnline = useOnlineStatus();

    const [form, setForm] = React.useState({
        fullName: '',
        mobile: currentMobile || '',
        password: '',
        lawyerMobile: '',
    });
    
    React.useEffect(() => {
        if (currentMobile) {
            setForm(prev => ({ ...prev, mobile: currentMobile }));
        }
    }, [currentMobile]);

    // ... (cached credentials logic same as before)

    const supabase = getSupabaseClient();

    const toggleView = (e: React.MouseEvent) => {
        e.preventDefault();
        setAuthStep(prev => prev === 'login' ? 'signup' : 'login');
        setError(null);
        setMessage(null);
        setInfo(isOnline ? null : "أنت غير متصل. تسجيل الدخول متاح فقط للمستخدم الأخير الذي سجل دخوله على هذا الجهاز.");
        setAuthFailed(false);
        setIsAssistantSignup(false);
    };

    const normalizeMobileToE164 = (mobile: string): string | null => {
        const digits = mobile.replace(/\D/g, '');
        if (digits.length >= 9) {
            const lastNine = digits.slice(-9);
            if (lastNine.startsWith('9')) {
                return `+963${lastNine}`;
            }
        }
        return null;
    };
    
    const normalizeMobileForDB = (mobile: string): string | null => {
        const digits = mobile.replace(/\D/g, '');
        if (digits.length >= 9) {
            const lastNine = digits.slice(-9);
            if (lastNine.startsWith('9')) {
                return '0' + lastNine;
            }
        }
        return null;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        if (error) setError(null);
        if (authFailed) setAuthFailed(false);
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        // ... (otp submit logic same as before)
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (!supabase) throw new Error("Client not initialized");
            const normalizedMobile = normalizeMobileForDB(form.mobile);
            if (!normalizedMobile) throw new Error("رقم الجوال غير صالح.");
            const { data: isVerified, error: rpcError } = await supabase.rpc('verify_mobile_otp', { target_mobile: normalizedMobile, code_to_check: otpCode.trim() });
            if (rpcError) throw rpcError;
            if (isVerified) {
                if (onVerificationSuccess) onVerificationSuccess();
                else {
                    setMessage("تم التحقق بنجاح. جاري تسجيل الدخول...");
                    if (form.password) {
                        const phone = normalizeMobileToE164(form.mobile);
                        const email = `sy${phone!.substring(1)}@email.com`;
                        const { data: signInData } = await supabase.auth.signInWithPassword({ email, password: form.password });
                        if(signInData.user) onLoginSuccess(signInData.user);
                    } else { setAuthStep('login'); setOtpCode(''); }
                }
            } else { throw new Error("رمز التحقق غير صحيح."); }
        } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    };

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);
        setAuthFailed(false);
    
        const phone = normalizeMobileToE164(form.mobile);
        if (!phone) {
            setError('رقم الجوال غير صالح.');
            setLoading(false);
            setAuthFailed(true);
            return;
        }
        const email = `sy${phone.substring(1)}@email.com`;
    
        if (!supabase) { setError("Supabase client is not available."); setLoading(false); return; }
    
        if (authStep === 'login') {
            // ... (login logic)
            try {
                const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password: form.password });
                if (signInError) throw signInError;
                if (signInData.user) {
                    const { data: profile } = await supabase.from('profiles').select('mobile_verified, role, is_approved, lawyer_id').eq('id', signInData.user.id).single();
                    if (profile && profile.mobile_verified === false && profile.role !== 'admin') {
                        setMessage("يرجى تأكيد رقم الجوال للمتابعة.");
                        setAuthStep('otp');
                        setLoading(false);
                        return;
                    }
                    if (profile && profile.lawyer_id && !profile.is_approved) {
                         setError("حسابك بانتظار موافقة المحامي الرئيسي.");
                         setLoading(false);
                         await supabase.auth.signOut();
                         return;
                    }
                    localStorage.setItem(LAST_USER_CREDENTIALS_CACHE_KEY, JSON.stringify({ mobile: form.mobile, password: form.password }));
                }
            } catch (err: any) {
                 setError(err.message || "فشل تسجيل الدخول.");
            } finally { setLoading(false); }
        } else { // Sign up
            try {
                if (!isOnline) throw new Error('لا يمكن إنشاء حساب جديد بدون اتصال بالإنترنت.');
                const normalizedMobile = normalizeMobileForDB(form.mobile);
                if (!normalizedMobile) { setError('رقم الجوال غير صالح.'); setLoading(false); setAuthFailed(true); return; }

                let metaData: any = { full_name: form.fullName, mobile_number: form.mobile };
                
                if (isAssistantSignup) {
                    const normalizedLawyerMobile = normalizeMobileForDB(form.lawyerMobile);
                    if (!normalizedLawyerMobile) { setError('رقم جوال المحامي غير صالح.'); setLoading(false); return; }
                    metaData.lawyer_mobile_number = normalizedLawyerMobile;
                }
    
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password: form.password,
                    options: { data: metaData }
                });
    
                if (signUpError) throw signUpError;
                if (data.user) {
                    try { await supabase.rpc('generate_mobile_otp', { target_user_id: data.user.id }); } catch (e) {}
                    setMessage(isAssistantSignup ? "تم إرسال طلب الانضمام. يرجى التواصل مع المحامي لتفعيل حسابك." : "تم إنشاء الحساب بنجاح.");
                    setAuthStep('otp');
                }
            } catch (err: any) { setError(err.message); } finally { setLoading(false); }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4" dir="rtl">
            <div className="w-full max-w-md">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">مكتب المحامي</h1>
                    <p className="text-gray-500">إدارة أعمال المحاماة بكفاءة</p>
                </div>

                <div className="bg-white p-8 rounded-lg shadow-md">
                    <h2 className="text-2xl font-bold text-center text-gray-700 mb-6">
                        {authStep === 'login' ? 'تسجيل الدخول' : (authStep === 'signup' ? 'إنشاء حساب جديد' : 'تأكيد رقم الجوال')}
                    </h2>

                    {error && <div className="mb-4 p-4 text-sm text-red-800 bg-red-100 rounded-lg flex items-start gap-3"><ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" /><div>{error}</div></div>}
                    {message && <div className="mb-4 p-4 text-sm text-green-800 bg-green-100 rounded-lg flex items-center gap-2"><CheckCircleIcon className="w-5 h-5"/>{message}</div>}
                    {info && <div className="mb-4 p-4 text-sm text-blue-800 bg-blue-100 rounded-lg">{info}</div>}

                    {authStep === 'otp' ? (
                        <div className="space-y-6">
                            <form onSubmit={handleOtpSubmit} className="space-y-4">
                                <input type="text" value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="mt-2 block w-full text-center text-2xl tracking-widest px-3 py-3 border border-gray-300 rounded-md" placeholder="------" required />
                                <button type="submit" disabled={loading} className="w-full bg-green-600 text-white p-2 rounded">تأكيد الكود</button>
                            </form>
                            <div className="text-center">
                                {onLogout ? <button onClick={onLogout} className="text-sm text-gray-600">تسجيل الخروج</button> : <button onClick={() => setAuthStep('login')} className="text-sm text-blue-600">العودة</button>}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleAuth} className="space-y-6">
                            {authStep === 'signup' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">الاسم الكامل</label>
                                        <input name="fullName" value={form.fullName} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" />
                                    </div>
                                    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                                        <input type="checkbox" id="isAssistant" checked={isAssistantSignup} onChange={(e) => setIsAssistantSignup(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                                        <label htmlFor="isAssistant" className="text-sm font-medium text-blue-900 cursor-pointer flex items-center gap-2"><UserGroupIcon className="w-4 h-4"/>التسجيل كمساعد لمحامي</label>
                                    </div>
                                    {isAssistantSignup && (
                                        <div className="animate-fade-in">
                                            <label className="block text-sm font-medium text-gray-700">رقم جوال المحامي الرئيسي</label>
                                            <input name="lawyerMobile" type="tel" value={form.lawyerMobile} onChange={handleInputChange} required={isAssistantSignup} placeholder="09xxxxxxxx" className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md bg-blue-50" />
                                            <p className="text-xs text-gray-500 mt-1">سيتم ربط حسابك بمكتب المحامي صاحب هذا الرقم.</p>
                                        </div>
                                    )}
                                </>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">رقم الجوال</label>
                                <input name="mobile" type="tel" value={form.mobile} onChange={handleInputChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">كلمة المرور</label>
                                <div className="relative mt-1">
                                    <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleInputChange} required className="block w-full px-3 py-2 border rounded-md" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 left-0 px-3 flex items-center text-gray-400">{showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}</button>
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded">{loading ? 'جاري التحميل...' : (authStep === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب')}</button>
                        </form>
                    )}
                    {authStep !== 'otp' && (
                        <p className="mt-6 text-center text-sm text-gray-600">
                            {authStep === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}
                            <a href="#" onClick={toggleView} className="font-medium text-blue-600 ms-1">{authStep === 'login' ? 'أنشئ حساباً جديداً' : 'سجل الدخول'}</a>
                        </p>
                    )}
                </div>
                <div className="mt-4 flex flex-col items-center">
                    <button onClick={onForceSetup} className="mt-3 flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white hover:bg-blue-50 rounded-full border border-gray-200 shadow-sm"><DatabaseIcon className="w-4 h-4" /><span>معالجة قاعدة البيانات</span></button>
                </div>
                
                <div className="mt-8 text-center">
                    <p className="text-xs text-gray-400 mb-1">الإصدار: 30-11-2025</p>
                    <p className="text-xs text-gray-400">جميع حقوق الملكية محفوظة لشركة الحلول التقنية © {new Date().getFullYear()}</p>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;