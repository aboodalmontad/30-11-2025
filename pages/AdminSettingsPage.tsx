
import * as React from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { MusicalNoteIcon, PlayCircleIcon, TrashIcon, ArrowUpTrayIcon, ServerIcon } from '../components/icons';
import { defaultUserApprovalSoundBase64 } from '../components/RealtimeNotifier';

const USER_APPROVAL_SOUND_KEY = 'customUserApprovalSound';

interface AdminSettingsPageProps {
    onOpenConfig: () => void;
}

const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({ onOpenConfig }) => {
    const [customSound, setCustomSound] = useLocalStorage<string | null>(USER_APPROVAL_SOUND_KEY, null);
    const [feedback, setFeedback] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showFeedback = (message: string, type: 'success' | 'error') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 3000);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            showFeedback('الرجاء اختيار ملف صوتي صالح.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setCustomSound(base64);
            showFeedback('تم حفظ صوت التنبيه الجديد بنجاح.', 'success');
        };
        reader.onerror = () => {
            showFeedback('فشل في قراءة الملف.', 'error');
        };
        reader.readAsDataURL(file);
    };

    const playSound = () => {
        const soundSource = customSound || defaultUserApprovalSoundBase64;
        
        if (!soundSource) {
             showFeedback('الملف الصوتي المعتمد للتنبيه غير موجود. الرجاء اختيار نغمة جديدة.', 'error');
             return;
        }

        try {
            // Create a new Audio object on demand for robust preview playback.
            const audio = new Audio(soundSource);
            audio.play().catch(e => {
                console.error("Audio preview playback failed:", e);
                // Specific feedback based on the playback error
                showFeedback('فشل تشغيل الملف الصوتي. قد يكون الملف تالفاً أو غير مدعوم. الرجاء اختيار نغمة تنبيه جديدة.', 'error');
            });
        } catch (e) {
            console.error("Error creating Audio object for preview:", e);
            showFeedback('حدث خطأ في تهيئة الصوت. الرجاء إعادة تحميل الصفحة أو اختيار نغمة جديدة.', 'error');
        }
    };

    const resetSound = () => {
        setCustomSound(null);
        showFeedback('تمت استعادة الصوت الافتراضي.', 'success');
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">إعدادات المدير</h1>

            {feedback && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    <span>{feedback.message}</span>
                </div>
            )}
            
            <div className="bg-white p-6 rounded-lg shadow space-y-6">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-3">
                    <ServerIcon className="w-6 h-6 text-blue-600" />
                    <span>تكوين النظام</span>
                </h2>
                <div className="p-4 bg-gray-50 border rounded-lg">
                    <h3 className="font-semibold text-lg text-gray-800">معالج إعداد قاعدة البيانات</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        استخدم هذه الأداة لإعداد جداول قاعدة البيانات، وتكوين صلاحيات التخزين، وإصلاح مشاكل المزامنة. يجب استخدام هذه الأداة بحذر.
                    </p>
                    <div className="mt-4">
                        <button 
                            onClick={onOpenConfig}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <ServerIcon className="w-5 h-5" />
                            <span>فتح معالج الإعداد</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow space-y-6">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-3">
                    <MusicalNoteIcon className="w-6 h-6 text-blue-600" />
                    <span>تخصيص صوت التنبيهات</span>
                </h2>

                <div className="p-4 bg-gray-50 border rounded-lg">
                    <h3 className="font-semibold text-lg text-gray-800">صوت تنبيه تسجيل مستخدم جديد</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        اختر ملفًا صوتيًا (مثل MP3, WAV) ليتم تشغيله عند تسجيل مستخدم جديد في انتظار الموافقة.
                    </p>

                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-4">
                        <input
                            type="file"
                            id="sound-upload"
                            accept="audio/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <label
                            htmlFor="sound-upload"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                            <ArrowUpTrayIcon className="w-5 h-5" />
                            <span>اختر ملفًا صوتيًا...</span>
                        </label>

                        
                        <button
                            onClick={playSound}
                            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
                        >
                            <PlayCircleIcon className="w-5 h-5" />
                            <span>تشغيل الصوت الحالي</span>
                        </button>
                        {customSound && (
                            <button
                                onClick={resetSound}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                            >
                                <TrashIcon className="w-5 h-5" />
                                <span>استعادة الافتراضي</span>
                            </button>
                        )}
                    </div>
                     {customSound ? <p className="text-xs text-gray-500 mt-2">تم تعيين صوت مخصص.</p> : <p className="text-xs text-gray-500 mt-2">يتم استخدام الصوت الافتراضي حالياً.</p>}
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsPage;
