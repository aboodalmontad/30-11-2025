
import * as React from 'react';
import { Profile, Permissions, defaultPermissions } from '../types';
import { useData } from '../context/DataContext';
import { getSupabaseClient } from '../supabaseClient';
import { UserIcon, CheckCircleIcon, NoSymbolIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from './icons';

interface AssistantsManagerProps {
    onClose: () => void;
}

const PermissionsEditor: React.FC<{ 
    permissions: Permissions; 
    onChange: (newPermissions: Permissions) => void; 
}> = ({ permissions, onChange }) => {
    const handleToggle = (key: keyof Permissions) => {
        onChange({ ...permissions, [key]: !permissions[key] });
    };

    const groups = [
        {
            title: 'عام',
            items: [
                { key: 'can_view_agenda', label: 'عرض المفكرة والصفحة الرئيسية' },
            ]
        },
        {
            title: 'الموكلين',
            items: [
                { key: 'can_view_clients', label: 'عرض الموكلين' },
                { key: 'can_add_client', label: 'إضافة موكل' },
                { key: 'can_edit_client', label: 'تعديل بيانات موكل' },
                { key: 'can_delete_client', label: 'حذف موكل' },
            ]
        },
        {
            title: 'القضايا',
            items: [
                { key: 'can_view_cases', label: 'عرض القضايا' },
                { key: 'can_add_case', label: 'إضافة قضية' },
                { key: 'can_edit_case', label: 'تعديل قضية' },
                { key: 'can_delete_case', label: 'حذف قضية' },
            ]
        },
        {
            title: 'الجلسات',
            items: [
                { key: 'can_view_sessions', label: 'عرض الجلسات' },
                { key: 'can_add_session', label: 'إضافة جلسة' },
                { key: 'can_edit_session', label: 'تعديل جلسة' },
                { key: 'can_postpone_session', label: 'ترحيل جلسة' },
                { key: 'can_decide_session', label: 'حسم جلسة/مرحلة' },
                { key: 'can_delete_session', label: 'حذف جلسة' },
            ]
        },
        {
            title: 'المالية والمحاسبة',
            items: [
                { key: 'can_view_finance', label: 'الاطلاع على المحاسبة (موكلين/قضايا/مكتب)' },
                { key: 'can_add_financial_entry', label: 'إضافة قيود مالية' },
                { key: 'can_delete_financial_entry', label: 'حذف قيود مالية' },
                { key: 'can_manage_invoices', label: 'إدارة الفواتير' },
            ]
        },
        {
            title: 'الوثائق',
            items: [
                { key: 'can_view_documents', label: 'عرض وتنزيل الوثائق' },
                { key: 'can_add_document', label: 'رفع وثائق' },
                { key: 'can_delete_document', label: 'حذف وثائق' },
            ]
        },
        {
            title: 'المهام الإدارية',
            items: [
                { key: 'can_view_admin_tasks', label: 'عرض المهام' },
                { key: 'can_add_admin_task', label: 'إضافة مهمة' },
                { key: 'can_edit_admin_task', label: 'تعديل مهمة' },
                { key: 'can_delete_admin_task', label: 'حذف مهمة' },
            ]
        },
        {
            title: 'أخرى',
            items: [
                { key: 'can_view_reports', label: 'عرض التقارير والتحليلات' },
            ]
        }
    ];

    return (
        <div className="mt-4 bg-gray-50 p-4 rounded-lg h-96 overflow-y-auto">
            <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">تحديد الصلاحيات الدقيقة:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groups.map((group, idx) => (
                    <div key={idx} className="bg-white p-3 rounded shadow-sm border">
                        <h5 className="font-semibold text-blue-600 mb-2">{group.title}</h5>
                        <div className="space-y-2">
                            {group.items.map((item) => (
                                <label key={item.key} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-gray-50 rounded">
                                    <input
                                        type="checkbox"
                                        checked={permissions[item.key as keyof Permissions]}
                                        onChange={() => handleToggle(item.key as keyof Permissions)}
                                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{item.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const AssistantsManager: React.FC<AssistantsManagerProps> = ({ onClose }) => {
    const { profiles, setProfiles, userId } = useData();
    const [assistants, setAssistants] = React.useState<Profile[]>([]);
    const [editingAssistant, setEditingAssistant] = React.useState<Profile | null>(null);
    const [tempPermissions, setTempPermissions] = React.useState<Permissions>(defaultPermissions);
    const supabase = getSupabaseClient();

    React.useEffect(() => {
        // Filter profiles to find users where lawyer_id == current user's ID
        if (userId) {
            setAssistants(profiles.filter(p => p.lawyer_id === userId));
        }
    }, [profiles, userId]);

    const handleUpdateAssistant = async (assistant: Profile, updates: Partial<Profile>) => {
        if (!supabase) return;
        
        try {
            const { error } = await supabase.from('profiles').update(updates).eq('id', assistant.id);
            if (error) throw error;

            setProfiles(prev => prev.map(p => p.id === assistant.id ? { ...p, ...updates } : p));
            if (editingAssistant?.id === assistant.id) setEditingAssistant(null);
        } catch (err: any) {
            alert("فشل تحديث بيانات المساعد: " + err.message);
        }
    };

    const handleEditPermissions = (assistant: Profile) => {
        setEditingAssistant(assistant);
        // Ensure permissions object has all keys from defaultPermissions to avoid undefined errors
        setTempPermissions({ ...defaultPermissions, ...(assistant.permissions || {}) });
    };

    const savePermissions = () => {
        if (editingAssistant) {
            handleUpdateAssistant(editingAssistant, { permissions: tempPermissions });
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("هل أنت متأكد من حذف هذا المساعد؟ سيتم إلغاء ارتباطه بحسابك.")) {
             if (!supabase) return;
             try {
                 const { error } = await supabase.from('profiles').update({ lawyer_id: null, permissions: null }).eq('id', id);
                 if (error) throw error;
                 setProfiles(prev => prev.filter(p => p.id !== id)); // Remove from local view immediately
             } catch (err: any) {
                 alert("فشل حذف المساعد: " + err.message);
             }
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold text-gray-800">إدارة المساعدين وصلاحياتهم</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-xl">&times;</button>
                </div>

                <div className="flex-grow overflow-y-auto p-1">
                    {assistants.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <UserIcon className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                            <p>لا يوجد مساعدين مرتبطين بحسابك حالياً.</p>
                            <p className="text-sm mt-2">يمكن للمساعدين الانضمام إليك عن طريق إدخال رقم هاتفك أثناء تسجيل حساب جديد.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {assistants.map(assistant => (
                                <div key={assistant.id} className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-full">
                                                <UserIcon className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-800">{assistant.full_name}</h3>
                                                <p className="text-sm text-gray-500" dir="ltr">{assistant.mobile_number}</p>
                                                {!assistant.is_approved && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                                                        بانتظار الموافقة
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleUpdateAssistant(assistant, { is_approved: !assistant.is_approved })}
                                                className={`p-2 rounded-full transition-colors ${assistant.is_approved ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                title={assistant.is_approved ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                                            >
                                                {assistant.is_approved ? <CheckCircleIcon className="w-5 h-5" /> : <NoSymbolIcon className="w-5 h-5" />}
                                            </button>
                                            <button 
                                                onClick={() => handleEditPermissions(assistant)}
                                                className={`p-2 rounded-full hover:bg-blue-200 transition-colors ${editingAssistant?.id === assistant.id ? 'bg-blue-200 text-blue-800' : 'bg-blue-100 text-blue-600'}`}
                                                title="تعديل الصلاحيات"
                                            >
                                                <PencilIcon className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(assistant.id)}
                                                className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                                                title="حذف المساعد"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {editingAssistant?.id === assistant.id && (
                                        <div className="mt-4 border-t pt-4 animate-fade-in">
                                            <PermissionsEditor 
                                                permissions={tempPermissions} 
                                                onChange={setTempPermissions} 
                                            />
                                            <div className="mt-4 flex justify-end gap-2">
                                                <button onClick={() => setEditingAssistant(null)} className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">إلغاء</button>
                                                <button onClick={savePermissions} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">حفظ الصلاحيات</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AssistantsManager;
