import * as React from 'react';
import { getSupabaseClient } from '../supabaseClient';
import { SiteFinancialEntry, Profile } from '../types';
import { formatDate, toInputDateString } from '../utils/dateUtils';
import { PlusIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '../components/icons';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useData } from '../context/DataContext';

const StatCard: React.FC<{ title: string; value: string; className?: string }> = ({ title, value, className = '' }) => (
    <div className={`p-6 rounded-lg shadow ${className}`}>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-3xl font-bold">{value}</p>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-2 border shadow-lg rounded-md text-sm">
                <p className="font-bold mb-1">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.color }}>
                        {`${pld.name}: ${pld.value.toLocaleString()} ل.س`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const SiteFinancesPage: React.FC = () => {
    const { siteFinances: entries, setSiteFinances, profiles: users, isDataLoading: loading } = useData();
    const [error, setError] = React.useState<string | null>(null);
    const [modal, setModal] = React.useState<{ isOpen: boolean; data?: SiteFinancialEntry }>({ isOpen: false });
    const [entryToDelete, setEntryToDelete] = React.useState<SiteFinancialEntry | null>(null);
    const [activeTab, setActiveTab] = React.useState<'entries' | 'reports'>('entries');

    const supabase = getSupabaseClient();

    const handleOpenModal = (entry?: SiteFinancialEntry) => setModal({ isOpen: true, data: entry });
    const handleCloseModal = () => setModal({ isOpen: false });

    const handleSubmit = async (formData: any, isSubscriptionRenewal: boolean) => {
        if (!supabase) return;

        const { new_subscription_start, new_subscription_end, ...financialData } = formData;
        const finalFinancialData = { ...financialData, user_id: financialData.user_id === 'none' ? null : financialData.user_id, updated_at: new Date() };

        if (modal.data) {
             setSiteFinances(prev => prev.map(e => e.id === modal.data!.id ? { ...e, ...finalFinancialData } : e));
        } else {
            const newEntry = { ...finalFinancialData, id: -Date.now() }; // Temporary negative ID
            setSiteFinances(prev => [...prev, newEntry]);
        }
        
        // This part remains to update profiles which is a separate concern from financial entries
        if (isSubscriptionRenewal && formData.user_id && formData.new_subscription_start && formData.new_subscription_end) {
            try {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        subscription_start_date: formData.new_subscription_start,
                        subscription_end_date: formData.new_subscription_end
                    })
                    .eq('id', formData.user_id);

                if (profileError) throw profileError;

            } catch (err: any) {
                let errorMessage = "فشل تحديث الاشتراك.";
                if (String(err.message).toLowerCase().includes('failed to fetch')) {
                    errorMessage += " يرجى التحقق من اتصالك بالإنترنت.";
                } else {
                    errorMessage += ` السبب: ${err.message}`;
                }
                setError(errorMessage);
            }
        }
        
        handleCloseModal();
    };

    const handleConfirmDelete = async () => {
        if (!supabase || !entryToDelete) return;
        setSiteFinances(prev => prev.filter(e => e.id !== entryToDelete.id));
        setEntryToDelete(null);
    };

    const financialSummary = React.useMemo(() => {
        const totalIncome = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        const subscriptionIncome = entries.filter(e => e.type === 'income' && e.description?.includes('تجديد اشتراك')).reduce((sum, e) => sum + e.amount, 0);
        return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, subscriptionIncome };
    }, [entries]);

    // Report Data Processing
    const reportsData = React.useMemo(() => {
        type MonthlyData = { month: string; monthDate: Date; income: number; expense: number };
        const monthlyData = entries.reduce((acc: Record<string, MonthlyData>, entry) => {
            const d = new Date(entry.payment_date);
            if (isNaN(d.getTime())) {
                console.warn("Skipping financial entry with invalid date:", entry);
                return acc; 
            }
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthKey = monthStart.toISOString();

            if (!acc[monthKey]) {
                acc[monthKey] = {
                    month: d.toLocaleString('ar-EG', { month: 'short', year: 'numeric' }),
                    monthDate: monthStart,
                    income: 0,
                    expense: 0
                };
            }
            if (entry.type === 'income') {
                acc[monthKey].income += entry.amount;
            } else {
                acc[monthKey].expense += entry.amount;
            }
            return acc;
        }, {});

        const incomeBreakdown = entries
            .filter(e => e.type === 'income')
            .reduce((acc, entry) => {
                const key = entry.description?.includes('تجديد اشتراك') ? 'الاشتراكات' : 'إيرادات أخرى';
                acc[key] = (acc[key] || 0) + entry.amount;
                return acc;
            }, {} as Record<string, number>);

        const expenseBreakdown = entries
            .filter(e => e.type === 'expense')
            .reduce((acc, entry) => {
                const key = entry.category || 'غير مصنف';
                acc[key] = (acc[key] || 0) + entry.amount;
                return acc;
            }, {} as Record<string, number>);

        return {
            monthly: Object.values(monthlyData).sort((a: MonthlyData, b: MonthlyData) => a.monthDate.getTime() - b.monthDate.getTime()),
            income: Object.entries(incomeBreakdown).map(([name, value]) => ({ name, value })),
            expense: Object.entries(expenseBreakdown).map(([name, value]) => ({ name, value })),
        };
    }, [entries]);

    if (loading) return <div className="text-center p-8">جاري تحميل البيانات المالية...</div>;
    if (error) return <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>;

    const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">المحاسبة المالية للموقع</h1>
                <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"><PlusIcon className="w-5 h-5" /><span>إضافة قيد مالي</span></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="إجمالي الإيرادات" value={`${financialSummary.totalIncome.toLocaleString()} ل.س`} className="bg-green-100 text-green-800" />
                <StatCard title="إجمالي المصروفات" value={`${financialSummary.totalExpenses.toLocaleString()} ل.س`} className="bg-red-100 text-red-800" />
                <StatCard title="صافي الربح" value={`${financialSummary.balance.toLocaleString()} ل.س`} className="bg-blue-100 text-blue-800" />
                <StatCard title="إيرادات الاشتراكات" value={`${financialSummary.subscriptionIncome.toLocaleString()} ل.س`} className="bg-purple-100 text-purple-800" />
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                 <div className="border-b border-gray-200"><nav className="-mb-px flex space-x-8"><button onClick={() => setActiveTab('entries')} className={`${activeTab === 'entries' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>القيود المالية</button><button onClick={() => setActiveTab('reports')} className={`${activeTab === 'reports' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>التقارير</button></nav></div>
                <div className="pt-6">
                    {activeTab === 'entries' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right text-gray-600">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3">التاريخ</th>
                                        <th className="px-6 py-3">البيان</th>
                                        <th className="px-6 py-3">الفئة</th>
                                        <th className="px-6 py-3">المستخدم</th>
                                        <th className="px-6 py-3">المبلغ</th>
                                        <th className="px-6 py-3">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map(entry => (
                                        <tr key={entry.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4">{formatDate(new Date(entry.payment_date))}</td>
                                            <td className="px-6 py-4">{entry.description}</td>
                                            <td className="px-6 py-4">{entry.category || '-'}</td>
                                            <td className="px-6 py-4">{users.find(u => u.id === entry.user_id)?.full_name || 'N/A'}</td>
                                            <td className={`px-6 py-4 font-semibold ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{entry.amount.toLocaleString()} ل.س</td>
                                            <td className="px-6 py-4 flex items-center gap-2">
                                                <button onClick={() => handleOpenModal(entry)} className="p-2 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => setEntryToDelete(entry)} className="p-2 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {activeTab === 'reports' && (
                        <div className="space-y-12">
                             <div>
                                <h3 className="font-bold mb-4 text-center text-gray-700">الإيرادات والمصروفات الشهرية</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={reportsData.monthly} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="income" name="الإيرادات" fill="#10B981" />
                                        <Bar dataKey="expense" name="المصروفات" fill="#EF4444" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-lg">
                                    <h3 className="font-bold mb-4 text-center text-gray-700">توزيع الإيرادات</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={reportsData.income} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                                {reportsData.income.map((_entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-white p-6 rounded-lg">
                                    <h3 className="font-bold mb-4 text-center text-gray-700">توزيع المصروفات</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={reportsData.expense} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                                {reportsData.expense.map((_entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {modal.isOpen && <FinancialEntryModal isOpen={modal.isOpen} onClose={handleCloseModal} onSubmit={handleSubmit} initialData={modal.data} users={users} />}
            {entryToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setEntryToDelete(null)}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div>
                            <h3 className="text-2xl font-bold text-gray-900">تأكيد حذف القيد</h3>
                            <p className="text-gray-600 my-4">هل أنت متأكد من حذف هذا القيد المالي؟ لا يمكن التراجع عن هذا الإجراء.</p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button type="button" className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => setEntryToDelete(null)}>إلغاء</button>
                            <button type="button" className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handleConfirmDelete}>نعم، قم بالحذف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Modal Component ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any, isSubscriptionRenewal: boolean) => void;
    initialData?: SiteFinancialEntry;
    users: Profile[];
}
const FinancialEntryModal: React.FC<ModalProps> = ({ isOpen, onClose, onSubmit, initialData, users }) => {
    const [formData, setFormData] = React.useState<any>({});
    const [isSubscriptionRenewal, setIsSubscriptionRenewal] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            const data = initialData ? { ...initialData, payment_date: toInputDateString(initialData.payment_date) } : { type: 'income', payment_date: toInputDateString(new Date()), amount: 0, user_id: 'none', category: 'غير مصنف' };
            setFormData(data);
            setIsSubscriptionRenewal(initialData?.description?.includes('تجديد اشتراك') || false);
        }
    }, [isOpen, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        
        if (name === 'isSubscriptionRenewal') {
            setIsSubscriptionRenewal(finalValue as boolean);
            if (finalValue) {
                const user = users.find(u => u.id === formData.user_id);
                setFormData((prev: any) => ({ ...prev, description: `تجديد اشتراك لـ ${user?.full_name || 'مستخدم'}` }));
            }
        } else {
            setFormData((prev: any) => ({ ...prev, [name]: finalValue }));
        }
    };
    
    const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const userId = e.target.value;
        setFormData((prev: any) => ({ ...prev, user_id: userId }));
        if (isSubscriptionRenewal) {
            const user = users.find(u => u.id === userId);
            setFormData((prev: any) => ({ ...prev, description: `تجديد اشتراك لـ ${user?.full_name || 'مستخدم'}` }));
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData, isSubscriptionRenewal);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{initialData ? 'تعديل قيد مالي' : 'إضافة قيد مالي جديد'}</h2>
                <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">النوع</label><select name="type" value={formData.type || 'income'} onChange={handleChange} className="w-full p-2 border rounded"><option value="income">إيراد</option><option value="expense">مصروف</option></select></div>
                        <div><label className="block text-sm font-medium">تاريخ الدفع</label><input type="date" name="payment_date" value={formData.payment_date || ''} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                    </div>
                    <div><label className="block text-sm font-medium">المبلغ</label><input type="number" name="amount" value={formData.amount || 0} onChange={handleChange} className="w-full p-2 border rounded" required /></div>
                    <div>
                        <label className="block text-sm font-medium">البيان</label>
                        <textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full p-2 border rounded" rows={3} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">المستخدم (إن وجد)</label>
                            <select name="user_id" value={formData.user_id || 'none'} onChange={handleUserChange} className="w-full p-2 border rounded">
                                <option value="none">-- لا يوجد --</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">الفئة</label>
                            <input type="text" name="category" value={formData.category || ''} onChange={handleChange} className="w-full p-2 border rounded" list="expense_categories" />
                            <datalist id="expense_categories">
                                <option value="رواتب" />
                                <option value="إيجار مكتب" />
                                <option value="فواتير (كهرباء, ماء, انترنت)" />
                                <option value="مستلزمات مكتبية" />
                                <option value="صيانة" />
                                <option value="ضرائب ورسوم" />
                                <option value="تسويق" />
                                <option value="نفقات أخرى" />
                            </datalist>
                        </div>
                    </div>
                    {formData.type === 'income' && (
                        <div className="pt-2">
                             <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                                <input type="checkbox" name="isSubscriptionRenewal" checked={isSubscriptionRenewal} onChange={handleChange} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                                هذا المبلغ هو تجديد اشتراك لمستخدم؟
                            </label>
                        </div>
                    )}
                    {isSubscriptionRenewal && formData.user_id !== 'none' && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                            <h4 className="font-semibold text-blue-800">تحديث تواريخ الاشتراك:</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium">تاريخ البدء الجديد</label><input type="date" name="new_subscription_start" value={formData.new_subscription_start || ''} onChange={handleChange} className="w-full p-2 border rounded" required={isSubscriptionRenewal} /></div>
                                <div><label className="block text-sm font-medium">تاريخ الانتهاء الجديد</label><input type="date" name="new_subscription_end" value={formData.new_subscription_end || ''} onChange={handleChange} className="w-full p-2 border rounded" required={isSubscriptionRenewal} /></div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">حفظ</button></div>
                </form>
            </div>
        </div>
    );
};
export default SiteFinancesPage;