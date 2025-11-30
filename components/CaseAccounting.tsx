
import * as React from 'react';
import { Case, Client, AccountingEntry } from '../types';
import { formatDate } from '../utils/dateUtils';
import { PlusIcon, PencilIcon, TrashIcon, ExclamationCircleIcon } from './icons';
import { useData } from '../context/DataContext';

interface CaseAccountingProps {
    caseData: Case;
    client: Client;
    caseAccountingEntries: AccountingEntry[];
    setAccountingEntries: (updater: (prev: AccountingEntry[]) => AccountingEntry[]) => void;
    onFeeAgreementChange: (newFeeAgreement: string) => void;
}

const CaseAccounting: React.FC<CaseAccountingProps> = ({ caseData, client, caseAccountingEntries, setAccountingEntries, onFeeAgreementChange }) => {
    const { permissions } = useData();
    const [isEditingFee, setIsEditingFee] = React.useState(false);
    const [feeAgreement, setFeeAgreement] = React.useState(caseData.feeAgreement);
    const [modal, setModal] = React.useState<{ isOpen: boolean; data?: AccountingEntry, type: 'income' | 'expense' }>({ isOpen: false, type: 'income' });
    const [formData, setFormData] = React.useState<Partial<AccountingEntry>>({});

    // --- Permission Check ---
    if (!permissions.can_view_finance) {
        return (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                <ExclamationCircleIcon className="w-12 h-12 text-gray-300 mb-2" />
                <p>ليس لديك صلاحية للاطلاع على التفاصيل المالية لهذه القضية.</p>
            </div>
        );
    }

    const sortedEntries = React.useMemo(() =>
        [...caseAccountingEntries].sort((a, b) => b.date.getTime() - a.date.getTime()),
        [caseAccountingEntries]
    );

    const totals = React.useMemo(() => {
        const income = caseAccountingEntries
            .filter(e => e.type === 'income')
            .reduce((sum, e) => sum + e.amount, 0);
        const expense = caseAccountingEntries
            .filter(e => e.type === 'expense')
            .reduce((sum, e) => sum + e.amount, 0);
        return { income, expense, balance: income - expense };
    }, [caseAccountingEntries]);

    const handleSaveFee = () => {
        onFeeAgreementChange(feeAgreement);
        setIsEditingFee(false);
    };

    const handleOpenModal = (type: 'income' | 'expense', entry?: AccountingEntry) => {
        setFormData(entry ? { ...entry, date: entry.date.toISOString().split('T')[0] as any } : { date: new Date().toISOString().split('T')[0] as any });
        setModal({ isOpen: true, data: entry, type });
    };

    const handleCloseModal = () => setModal({ isOpen: false, type: 'income' });

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const entryData: Omit<AccountingEntry, 'id'> = {
            type: modal.type,
            amount: formData.amount!,
            date: new Date(formData.date!),
            description: formData.description!,
            clientId: client.id,
            caseId: caseData.id,
            clientName: client.name,
            updated_at: new Date(),
        };

        if (modal.data) { // Editing
            setAccountingEntries(prev => prev.map(item => item.id === modal.data!.id ? { ...item, ...entryData } as AccountingEntry : item));
        } else { // Adding
            setAccountingEntries(prev => [...prev, { ...entryData, id: `acc-${Date.now()}` } as AccountingEntry]);
        }
        handleCloseModal();
    };

    const handleDelete = (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذا القيد؟')) {
            setAccountingEntries(prev => prev.filter(item => item.id !== id));
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 border rounded-lg bg-white">
                <h4 className="font-semibold mb-2">اتفاقية الأتعاب</h4>
                {isEditingFee ? (
                    <div className="flex items-center gap-2">
                        <input type="text" value={feeAgreement} onChange={e => setFeeAgreement(e.target.value)} className="w-full p-2 border rounded" />
                        <button onClick={handleSaveFee} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ</button>
                        <button onClick={() => setIsEditingFee(false)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-gray-700">{feeAgreement || 'لم تحدد بعد'}</p>
                        {/* Allow edit only if user can edit case (fee agreement is part of case data) or has full finance view permissions logic could be applied here too */}
                        {permissions.can_edit_case && <button onClick={() => setIsEditingFee(true)} className="p-2 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>}
                    </div>
                )}
            </div>
            
            <div>
                <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold">كشف حساب القضية</h4>
                    <div className="flex gap-2">
                        {permissions.can_add_financial_entry && (
                            <>
                                <button onClick={() => handleOpenModal('income')} className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200 transition-colors">
                                    <PlusIcon className="w-4 h-4" />إضافة مقبوضات
                                </button>
                                <button onClick={() => handleOpenModal('expense')} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors">
                                    <PlusIcon className="w-4 h-4" />إضافة مصروفات
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 text-xs uppercase">
                            <tr>
                                <th className="px-4 py-2">التاريخ</th>
                                <th className="px-4 py-2">البيان</th>
                                <th className="px-4 py-2">المقبوضات</th>
                                <th className="px-4 py-2">المصروفات</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedEntries.length > 0 ? sortedEntries.map(entry => (
                                <tr key={entry.id} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-2">{formatDate(entry.date)}</td>
                                    <td className="px-4 py-2">{entry.description}</td>
                                    <td className="px-4 py-2 font-semibold text-green-600">
                                        {entry.type === 'income' ? `${entry.amount.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-4 py-2 font-semibold text-red-600">
                                        {entry.type === 'expense' ? `${entry.amount.toLocaleString()}` : '-'}
                                    </td>
                                    <td className="px-4 py-2 flex items-center gap-1">
                                        {permissions.can_add_financial_entry && <button onClick={() => handleOpenModal(entry.type, entry)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>}
                                        {permissions.can_delete_financial_entry && <button onClick={() => handleDelete(entry.id)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="text-center p-4 text-gray-500">لا توجد قيود محاسبية لهذه القضية.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 font-bold bg-gray-50">
                                <td colSpan={2} className="px-4 py-2 text-left">إجمالي المقبوضات</td>
                                <td className="px-4 py-2 text-green-600">{totals.income.toLocaleString()} ل.س</td>
                                <td className="px-4 py-2">-</td>
                                <td></td>
                            </tr>
                            <tr className="font-bold bg-gray-50">
                                <td colSpan={2} className="px-4 py-2 text-left">إجمالي المصروفات</td>
                                <td className="px-4 py-2">-</td>
                                <td className="px-4 py-2 text-red-600">{totals.expense.toLocaleString()} ل.س</td>
                                <td></td>
                            </tr>
                            <tr className="bg-gray-100 font-bold border-t-2">
                                <td colSpan={2} className="px-4 py-2 text-left">الرصيد</td>
                                <td colSpan={2} className="px-4 py-2 text-center">{totals.balance.toLocaleString()} ل.س</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

             {modal.isOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleCloseModal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">{modal.data ? 'تعديل' : 'إضافة'} {modal.type === 'income' ? 'مقبوضات' : 'مصروفات'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                             <div>
                                <label className="block text-sm font-medium text-gray-700">المبلغ</label>
                                <input type="number" name="amount" value={formData.amount || ''} onChange={handleFormChange} className="w-full p-2 border rounded" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">التاريخ</label>
                                <input type="date" name="date" value={formData.date as any} onChange={handleFormChange} className="w-full p-2 border rounded" placeholder="DD/MM/YYYY" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">البيان</label>
                                <input type="text" name="description" value={formData.description || ''} onChange={handleFormChange} className="w-full p-2 border rounded" required />
                            </div>
                            <div className="mt-6 flex justify-end gap-4">
                                <button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CaseAccounting;
