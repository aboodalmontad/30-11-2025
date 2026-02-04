import * as React from 'react';
import { CloudArrowDownIcon, CloudArrowUpIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from '../components/icons';
import { adminFetchFullDatabase, adminRestoreDatabase } from '../hooks/useOnlineData';

const AdminBackupPage: React.FC = () => {
    const [isDownloading, setIsDownloading] = React.useState(false);
    const [isRestoring, setIsRestoring] = React.useState(false);
    const [restoreStatus, setRestoreStatus] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleDownloadBackup = async () => {
        setIsDownloading(true);
        setRestoreStatus(null);
        try {
            // Fetch raw data from Supabase using the admin utility
            const data = await adminFetchFullDatabase();
            
            // Create a JSON blob
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            
            // Trigger download
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lawyer_app_admin_full_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            setRestoreStatus({ message: 'تم تنزيل النسخة الاحتياطية بنجاح.', type: 'success' });
        } catch (error: any) {
            console.error("Backup failed:", error);
            setRestoreStatus({ message: `فشل التنزيل: ${error.message}`, type: 'error' });
        } finally {
            setIsDownloading(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset status
        setRestoreStatus(null);
        
        const confirmMsg = "تحذير: أنت على وشك استعادة قاعدة البيانات بالكامل. سيتم دمج البيانات الموجودة مع النسخة الاحتياطية (تحديث الموجود وإضافة الجديد). هل أنت متأكد من المتابعة؟";
        if (!window.confirm(confirmMsg)) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const content = e.target?.result as string;
            try {
                setIsRestoring(true);
                setRestoreStatus({ message: 'جاري تحليل الملف ورفع البيانات...', type: 'info' });
                
                const parsedData = JSON.parse(content);
                
                // Basic validation
                if (!parsedData.profiles || !Array.isArray(parsedData.profiles)) {
                    throw new Error("ملف غير صالح: لا يحتوي على بيانات المستخدمين (profiles).");
                }

                await adminRestoreDatabase(parsedData);
                
                setRestoreStatus({ message: 'تم استعادة قاعدة البيانات بنجاح.', type: 'success' });
            } catch (error: any) {
                console.error("Restore failed:", error);
                setRestoreStatus({ message: `فشل الاستعادة: ${error.message}`, type: 'error' });
            } finally {
                setIsRestoring(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.onerror = () => {
            setRestoreStatus({ message: 'فشل قراءة الملف.', type: 'error' });
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsText(file);
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">النسخ الاحتياطي واستعادة النظام</h1>
            
            {/* Status Message */}
            {restoreStatus && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                    restoreStatus.type === 'success' ? 'bg-green-100 text-green-800' : 
                    restoreStatus.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                    {restoreStatus.type === 'success' ? <CheckCircleIcon className="w-6 h-6" /> : 
                     restoreStatus.type === 'error' ? <ExclamationTriangleIcon className="w-6 h-6" /> : 
                     <ArrowPathIcon className="w-6 h-6 animate-spin" />}
                    <span>{restoreStatus.message}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Backup Section */}
                <div className="bg-white p-8 rounded-lg shadow-md border-t-4 border-blue-500 flex flex-col items-center text-center">
                    <div className="bg-blue-100 p-4 rounded-full mb-4">
                        <CloudArrowDownIcon className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">تنزيل نسخة احتياطية</h2>
                    <p className="text-gray-600 mb-6">
                        قم بتنزيل نسخة كاملة من قاعدة البيانات (جميع الجداول والمستخدمين) بصيغة JSON. احتفظ بهذه النسخة في مكان آمن.
                    </p>
                    <button
                        onClick={handleDownloadBackup}
                        disabled={isDownloading || isRestoring}
                        className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                        {isDownloading ? (
                            <>
                                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                جاري التنزيل...
                            </>
                        ) : (
                            <>
                                <CloudArrowDownIcon className="w-5 h-5" />
                                تنزيل الآن
                            </>
                        )}
                    </button>
                </div>

                {/* Restore Section */}
                <div className="bg-white p-8 rounded-lg shadow-md border-t-4 border-orange-500 flex flex-col items-center text-center">
                    <div className="bg-orange-100 p-4 rounded-full mb-4">
                        <CloudArrowUpIcon className="w-10 h-10 text-orange-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">استعادة نسخة احتياطية</h2>
                    <p className="text-gray-600 mb-6">
                        استعادة قاعدة البيانات من ملف JSON محفوظ مسبقاً. سيتم دمج البيانات، وفي حال وجود تعارض سيتم تحديث السجلات القديمة بالبيانات الجديدة من الملف.
                    </p>
                    
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileSelect} 
                    />
                    
                    <button
                        onClick={triggerFileSelect}
                        disabled={isDownloading || isRestoring}
                        className="w-full sm:w-auto px-8 py-3 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                        {isRestoring ? (
                            <>
                                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                                جاري الاستعادة...
                            </>
                        ) : (
                            <>
                                <CloudArrowUpIcon className="w-5 h-5" />
                                رفع ملف الاستعادة
                            </>
                        )}
                    </button>
                </div>
            </div>

            <div className="bg-yellow-50 border-r-4 border-yellow-400 p-4 rounded shadow-sm">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                    </div>
                    <div className="mr-3">
                        <h3 className="text-sm font-medium text-yellow-800">ملاحظات هامة</h3>
                        <div className="mt-2 text-sm text-yellow-700 space-y-1">
                            <p>1. تأكد من أن ملف النسخة الاحتياطية سليم وغير معدل يدوياً لتجنب أخطاء في قاعدة البيانات.</p>
                            <p>2. عملية الاستعادة قد تستغرق بضع دقائق اعتماداً على حجم البيانات وسرعة الإنترنت.</p>
                            <p>3. هذه العملية تقوم بتحديث الجداول: المستخدمين، الموكلين، القضايا، الجلسات، الفواتير، والقيود المالية.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminBackupPage;
