
import * as React from 'react';
import { TrashIcon, ExclamationTriangleIcon, CloudArrowUpIcon, ArrowPathIcon, PlusIcon, CheckCircleIcon, XCircleIcon, ArrowDownTrayIcon, ArrowUpTrayIcon, ShieldCheckIcon, UserGroupIcon } from '../components/icons';
import { Client, AdminTask, Appointment, AccountingEntry } from '../types';
import { APP_DATA_KEY } from '../hooks/useSupabaseData';
import { useData } from '../context/DataContext';
import { openDB } from 'idb';
import AssistantsManager from '../components/AssistantsManager';

interface SettingsPageProps {}

const SettingsPage: React.FC<SettingsPageProps> = () => {
    const { setFullData, assistants, setAssistants, userId, isAutoSyncEnabled, setAutoSyncEnabled, isAutoBackupEnabled, setAutoBackupEnabled, adminTasksLayout, setAdminTasksLayout, deleteAssistant, exportData, permissions } = useData();
    const [feedback, setFeedback] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = React.useState(false);
    const [isDeleteAssistantModalOpen, setIsDeleteAssistantModalOpen] = React.useState(false);
    const [assistantToDelete, setAssistantToDelete] = React.useState<string | null>(null);
    const [newAssistant, setNewAssistant] = React.useState('');
    const [dbStats, setDbStats] = React.useState<string | null>(null);
    const [isAssistantsManagerOpen, setIsAssistantsManagerOpen] = React.useState(false);

    const showFeedback = (message: string, type: 'success' | 'error') => {
        setFeedback({ message, type });
        setTimeout(() => setFeedback(null), 4000);
    };

    // ... (existing handlers: handleConfirmClearData, handleExportData, handleImportData, handleAddAssistant, handleDeleteAssistant, handleConfirmDeleteAssistant, handleInspectDb)
    const handleConfirmClearData = () => {
        try {
            const emptyData = { clients: [], adminTasks: [], appointments: [], accountingEntries: [], assistants: ['بدون تخصيص'] };
            setFullData(emptyData);
            showFeedback('تم مسح جميع البيانات بنجاح.', 'success');
        } catch (error) { showFeedback('حدث خطأ أثناء مسح البيانات.', 'error'); }
        setIsConfirmModalOpen(false);
    };
    const handleExportData = () => { if (exportData()) { showFeedback('تم تصدير البيانات بنجاح.', 'success'); } else { showFeedback('فشل تصدير البيانات.', 'error'); } };
    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { try { const text = e.target?.result; if (typeof text !== 'string') throw new Error("File could not be read."); const data = JSON.parse(text); setFullData(data); showFeedback('تم استيراد البيانات بنجاح.', 'success'); } catch (error) { showFeedback('فشل استيراد البيانات.', 'error'); } };
        reader.readAsText(file);
    };
    const handleAddAssistant = (e: React.FormEvent) => { e.preventDefault(); if (newAssistant && !assistants.includes(newAssistant) && newAssistant !== 'بدون تخصيص') { setAssistants(prev => [...prev, newAssistant.trim()]); setNewAssistant(''); } };
    const handleDeleteAssistant = (name: string) => { if (name !== 'بدون تخصيص') { setAssistantToDelete(name); setIsDeleteAssistantModalOpen(true); } };
    const handleConfirmDeleteAssistant = () => { if (assistantToDelete) { deleteAssistant(assistantToDelete); showFeedback(`تم حذف المساعد "${assistantToDelete}" بنجاح.`, 'success'); } setIsDeleteAssistantModalOpen(false); setAssistantToDelete(null); };
    const handleInspectDb = async () => { setDbStats('جاري الفحص...'); try { const db = await openDB('LawyerAppData', 2); let stats = ''; const stores = ['appData', 'caseDocumentMetadata', 'caseDocumentFiles']; for (const s of stores) { if (db.objectStoreNames.contains(s)) { const count = await db.count(s); stats += `- ${s}: ${count} سجل\n`; } } setDbStats(stats); } catch (e:any) { setDbStats('فشل: ' + e.message); } };

    const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void; label: string }> = ({ enabled, onChange, label }) => (
        <div className="flex items-center">
            <span className="text-gray-700 me-3 font-medium">{label}</span>
            <button type="button" className={`${enabled ? 'bg-blue-600' : 'bg-gray-200'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`} role="switch" aria-checked={enabled} onClick={() => onChange(!enabled)}>
                <span aria-hidden="true" className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`} />
            </button>
        </div>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">الإعدادات</h1>
            {feedback && <div className={`p-4 rounded-lg flex items-center gap-3 ${feedback.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}><span>{feedback.message}</span></div>}
            
            {permissions?.can_delete_client && (
                <div className="bg-white p-6 rounded-lg shadow space-y-4">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-2"><UserGroupIcon className="w-6 h-6 text-blue-600" />إدارة المساعدين والصلاحيات</h2>
                    <p className="text-gray-600 text-sm">هنا يمكنك استعراض المساعدين الذين انضموا لمكتبك، تفعيل حساباتهم، وتحديد صلاحيات الوصول الخاصة بهم بشكل دقيق.</p>
                    <button onClick={() => setIsAssistantsManagerOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"><UserGroupIcon className="w-5 h-5" /><span>فتح لوحة تعريف المساعدين</span></button>
                </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow space-y-4">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-3">إعدادات المزامنة</h2>
                <div className="pt-2"><ToggleSwitch label="المزامنة التلقائية" enabled={isAutoSyncEnabled} onChange={setAutoSyncEnabled} /></div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-3">النسخ الاحتياطي</h2>
                <div className="pt-2"><ToggleSwitch label="النسخ الاحتياطي اليومي التلقائي" enabled={isAutoBackupEnabled} onChange={setAutoBackupEnabled} /></div>
            </div>
            {/* ... (Other sections: Layout, DB Inspect, Export/Import, Assistants List, Clear Data) ... */}
            <div className="bg-white p-6 rounded-lg shadow space-y-4"><h2 className="text-xl font-bold text-gray-800 border-b pb-3">تخطيط المهام</h2><div className="pt-2 flex gap-4"><button onClick={() => setAdminTasksLayout('horizontal')} className={`px-4 py-2 rounded ${adminTasksLayout === 'horizontal' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>أفقي</button><button onClick={() => setAdminTasksLayout('vertical')} className={`px-4 py-2 rounded ${adminTasksLayout === 'vertical' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>عمودي</button></div></div>
            <div className="bg-white p-6 rounded-lg shadow space-y-4"><h2 className="text-xl font-bold text-gray-800 border-b pb-3">فحص البيانات</h2><button onClick={handleInspectDb} className="px-4 py-2 bg-gray-600 text-white rounded">فحص</button>{dbStats && <pre className="mt-4 bg-gray-100 p-4 rounded text-xs">{dbStats}</pre>}</div>
            <div className="bg-white p-6 rounded-lg shadow space-y-4"><h2 className="text-xl font-bold text-gray-800 border-b pb-3">نقل البيانات</h2><div className="flex gap-4"><button onClick={handleExportData} className="px-4 py-2 bg-gray-600 text-white rounded">تصدير</button><label className="px-4 py-2 bg-gray-600 text-white rounded cursor-pointer">استيراد<input type="file" className="hidden" onChange={handleImportData}/></label></div></div>
            <div className="bg-white p-6 rounded-lg shadow space-y-6"><h2 className="text-xl font-bold text-gray-800 border-b pb-3">قائمة المساعدين (للقوائم المنسدلة)</h2><div className="space-y-4"><form onSubmit={handleAddAssistant} className="flex gap-2"><input type="text" value={newAssistant} onChange={e => setNewAssistant(e.target.value)} className="flex-grow p-2 border rounded" placeholder="اسم" /><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">إضافة</button></form><ul className="space-y-2">{assistants.map(a => <li key={a} className="flex justify-between p-2 bg-gray-50 border rounded">{a}{a !== 'بدون تخصيص' && <button onClick={() => handleDeleteAssistant(a)}><TrashIcon className="w-4 h-4 text-red-500"/></button>}</li>)}</ul></div></div>
            <div className="bg-white p-6 rounded-lg shadow space-y-4"><h2 className="text-xl font-bold text-gray-800 border-b pb-3">خطر</h2><button onClick={() => setIsConfirmModalOpen(true)} className="px-4 py-2 bg-red-600 text-white rounded">مسح كافة البيانات</button></div>

            {isConfirmModalOpen && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white p-8 rounded shadow-lg"><p className="mb-4">هل أنت متأكد؟</p><div className="flex gap-4"><button onClick={() => setIsConfirmModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button><button onClick={handleConfirmClearData} className="px-4 py-2 bg-red-600 text-white rounded">نعم</button></div></div></div>}
            {isDeleteAssistantModalOpen && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white p-8 rounded shadow-lg"><p className="mb-4">حذف المساعد؟</p><div className="flex gap-4"><button onClick={() => setIsDeleteAssistantModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button><button onClick={handleConfirmDeleteAssistant} className="px-4 py-2 bg-red-600 text-white rounded">نعم</button></div></div></div>}
            
            {isAssistantsManagerOpen && <AssistantsManager onClose={() => setIsAssistantsManagerOpen(false)} />}
        </div>
    );
};

export default SettingsPage;
