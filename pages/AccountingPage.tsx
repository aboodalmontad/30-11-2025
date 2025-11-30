
import * as React from 'react';
import { AccountingEntry, Client, Invoice, InvoiceItem, Case, Stage, Session } from '../types';
import { formatDate, toInputDateString, parseInputDateString } from '../utils/dateUtils';
import { PlusIcon, PencilIcon, TrashIcon, SearchIcon, ExclamationTriangleIcon, PrintIcon, DocumentTextIcon, CalculatorIcon, ChartPieIcon } from '../components/icons';
import { useData } from '../context/DataContext';
import PrintableInvoice from '../components/PrintableInvoice';
import { printElement } from '../utils/printUtils';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- TAB: ENTRIES ---
const EntriesTab: React.FC = () => {
    const { accountingEntries, setAccountingEntries, clients, deleteAccountingEntry, permissions } = useData();
    const [modal, setModal] = React.useState<{ isOpen: boolean; data?: AccountingEntry }>({ isOpen: false });
    const [formData, setFormData] = React.useState<Partial<AccountingEntry>>({});
    const [searchQuery, setSearchQuery] = React.useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [entryToDelete, setEntryToDelete] = React.useState<AccountingEntry | null>(null);

    const financialSummary = React.useMemo(() => {
        const totalIncome = accountingEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = accountingEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses };
    }, [accountingEntries]);

    const filteredAndSortedEntries = React.useMemo(() => {
        const filtered = accountingEntries.filter(entry => {
            if (!searchQuery) return true;
            const lowercasedQuery = searchQuery.toLowerCase();
            return (
                entry.description.toLowerCase().includes(lowercasedQuery) ||
                entry.clientName.toLowerCase().includes(lowercasedQuery) ||
                entry.amount.toString().includes(searchQuery)
            );
        });
        return filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
    }, [accountingEntries, searchQuery]);

    const handleOpenModal = (entry?: AccountingEntry) => {
        setFormData(entry ? { ...entry, date: toInputDateString(entry.date) as unknown as any } : { type: 'income', date: toInputDateString(new Date()) as unknown as any });
        setModal({ isOpen: true, data: entry });
    };

    const handleCloseModal = () => setModal({ isOpen: false });

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };

    const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const clientId = e.target.value;
        const client = clients.find(c => c.id === clientId);
        setFormData(prev => ({ ...prev, clientId, clientName: client?.name || '', caseId: '' }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const entryData: Omit<AccountingEntry, 'id'> = {
            type: formData.type as 'income' | 'expense',
            amount: Number(formData.amount),
            date: new Date(formData.date!),
            description: formData.description!,
            clientId: formData.clientId || '',
            caseId: formData.caseId || '',
            clientName: formData.clientName || '',
            updated_at: new Date(),
        };

        if (modal.data) {
            setAccountingEntries(prev => prev.map(item => item.id === modal.data!.id ? { ...item, ...entryData } : item));
        } else {
            setAccountingEntries(prev => [...prev, { ...entryData, id: `acc-${Date.now()}` }]);
        }
        handleCloseModal();
    };

    const confirmDelete = (entry: AccountingEntry) => {
        setEntryToDelete(entry);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        if (entryToDelete) {
            deleteAccountingEntry(entryToDelete.id);
            setIsDeleteModalOpen(false);
            setEntryToDelete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-100 p-4 rounded-lg shadow-sm border border-green-200">
                    <h3 className="text-green-800 font-semibold">إجمالي المقبوضات</h3>
                    <p className="text-2xl font-bold text-green-900">{financialSummary.totalIncome.toLocaleString()} ل.س</p>
                </div>
                <div className="bg-red-100 p-4 rounded-lg shadow-sm border border-red-200">
                    <h3 className="text-red-800 font-semibold">إجمالي المصروفات</h3>
                    <p className="text-2xl font-bold text-red-900">{financialSummary.totalExpenses.toLocaleString()} ل.س</p>
                </div>
                <div className="bg-blue-100 p-4 rounded-lg shadow-sm border border-blue-200">
                    <h3 className="text-blue-800 font-semibold">الرصيد الصافي</h3>
                    <p className="text-2xl font-bold text-blue-900">{financialSummary.balance.toLocaleString()} ل.س</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="relative w-full sm:w-64">
                        <input type="search" placeholder="بحث في القيود..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-2 ps-10 border rounded-lg bg-gray-50 focus:ring-blue-500" />
                        <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    </div>
                    {permissions.can_add_financial_entry && (
                        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                            <PlusIcon className="w-5 h-5" /> <span>قيد جديد</span>
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-600">
                        <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                                <th className="px-4 py-3">التاريخ</th>
                                <th className="px-4 py-3">البيان</th>
                                <th className="px-4 py-3">الموكل</th>
                                <th className="px-4 py-3">المبلغ</th>
                                <th className="px-4 py-3">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAndSortedEntries.map(entry => (
                                <tr key={entry.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3">{formatDate(entry.date)}</td>
                                    <td className="px-4 py-3">{entry.description}</td>
                                    <td className="px-4 py-3">{entry.clientName || '-'}</td>
                                    <td className={`px-4 py-3 font-bold ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                        {entry.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => handleOpenModal(entry)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>
                                        {permissions.can_delete_financial_entry && <button onClick={() => confirmDelete(entry)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>}
                                    </td>
                                </tr>
                            ))}
                            {filteredAndSortedEntries.length === 0 && <tr><td colSpan={5} className="text-center p-4">لا توجد قيود.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

            {modal.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleCloseModal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">{modal.data ? 'تعديل قيد' : 'إضافة قيد جديد'}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium">النوع</label><select name="type" value={formData.type} onChange={handleFormChange} className="w-full p-2 border rounded"><option value="income">مقبوضات</option><option value="expense">مصروفات</option></select></div>
                                <div><label className="block text-sm font-medium">التاريخ</label><input type="date" name="date" value={formData.date as any} onChange={handleFormChange} className="w-full p-2 border rounded" required /></div>
                            </div>
                            <div><label className="block text-sm font-medium">المبلغ</label><input type="number" name="amount" value={formData.amount} onChange={handleFormChange} className="w-full p-2 border rounded" required /></div>
                            <div><label className="block text-sm font-medium">البيان</label><input type="text" name="description" value={formData.description || ''} onChange={handleFormChange} className="w-full p-2 border rounded" required /></div>
                            <div><label className="block text-sm font-medium">الموكل (اختياري)</label><select name="clientId" value={formData.clientId || ''} onChange={handleClientChange} className="w-full p-2 border rounded"><option value="">-- عام --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div className="flex justify-end gap-4 mt-6"><button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">حفظ</button></div>
                        </form>
                    </div>
                </div>
            )}
            
            {isDeleteModalOpen && entryToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsDeleteModalOpen(false)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold mb-2">تأكيد الحذف</h3>
                            <p className="text-gray-600 mb-6">هل أنت متأكد من حذف القيد "{entryToDelete.description}"؟</p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                                <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded">حذف</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- TAB: INVOICES ---
const InvoicesTab: React.FC<{ initialInvoiceData?: { clientId: string, caseId?: string }, clearInitialInvoiceData: () => void }> = ({ initialInvoiceData, clearInitialInvoiceData }) => {
    const { invoices, setInvoices, clients, deleteInvoice, permissions } = useData();
    const [modal, setModal] = React.useState<{ isOpen: boolean; data?: Invoice }>({ isOpen: false });
    const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);
    const [invoiceToPrint, setInvoiceToPrint] = React.useState<Invoice | null>(null);
    const invoicePrintRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (initialInvoiceData) {
            const client = clients.find(c => c.id === initialInvoiceData.clientId);
            const caseItem = client?.cases.find(c => c.id === initialInvoiceData.caseId);
            const newInvoice: Partial<Invoice> = {
                clientId: initialInvoiceData.clientId,
                clientName: client?.name || '',
                caseId: initialInvoiceData.caseId,
                caseSubject: caseItem?.subject,
                issueDate: new Date(),
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +1 week
                items: [{ id: `item-${Date.now()}`, description: 'أتعاب محاماة', amount: 0 }],
                taxRate: 0,
                discount: 0,
                status: 'draft'
            };
            // @ts-ignore
            setModal({ isOpen: true, data: newInvoice }); 
            clearInitialInvoiceData();
        }
    }, [initialInvoiceData, clients, clearInitialInvoiceData]);

    const handleSaveInvoice = (invoice: Invoice) => {
        if (modal.data && modal.data.id) {
            setInvoices(prev => prev.map(inv => inv.id === invoice.id ? invoice : inv));
        } else {
            setInvoices(prev => [...prev, invoice]);
        }
        setModal({ isOpen: false });
    };

    const handleDeleteInvoice = (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
            deleteInvoice(id);
        }
    };

    const handlePrintInvoice = (invoice: Invoice) => {
        setInvoiceToPrint(invoice);
        setIsPrintModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold text-gray-800">سجل الفواتير</h2>
                {permissions.can_manage_invoices && (
                    <button onClick={() => setModal({ isOpen: true })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                        <PlusIcon className="w-5 h-5" /> <span>فاتورة جديدة</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {invoices.length > 0 ? invoices.map(inv => (
                    <div key={inv.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{inv.clientName}</h3>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                                inv.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                inv.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>{inv.status === 'paid' ? 'مدفوعة' : inv.status === 'sent' ? 'مرسلة' : inv.status === 'overdue' ? 'متأخرة' : 'مسودة'}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">رقم: {inv.id}</p>
                        <p className="text-sm text-gray-600 mb-2">تاريخ: {formatDate(inv.issueDate)}</p>
                        <div className="border-t pt-2 mt-2 flex justify-between items-center">
                            <span className="font-bold text-lg text-blue-900">
                                {(inv.items.reduce((s, i) => s + i.amount, 0) + (inv.items.reduce((s, i) => s + i.amount, 0) * inv.taxRate / 100) - inv.discount).toLocaleString()} ل.س
                            </span>
                            <div className="flex gap-1">
                                <button onClick={() => handlePrintInvoice(inv)} className="p-2 text-gray-500 hover:text-green-600" title="طباعة"><PrintIcon className="w-4 h-4" /></button>
                                {permissions.can_manage_invoices && <button onClick={() => setModal({ isOpen: true, data: inv })} className="p-2 text-gray-500 hover:text-blue-600" title="تعديل"><PencilIcon className="w-4 h-4" /></button>}
                                {permissions.can_manage_invoices && <button onClick={() => handleDeleteInvoice(inv.id)} className="p-2 text-gray-500 hover:text-red-600" title="حذف"><TrashIcon className="w-4 h-4" /></button>}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">لا توجد فواتير مسجلة.</div>
                )}
            </div>

            {modal.isOpen && (
                <InvoiceModal 
                    isOpen={modal.isOpen} 
                    onClose={() => setModal({ isOpen: false })} 
                    initialData={modal.data} 
                    onSave={handleSaveInvoice} 
                    clients={clients}
                />
            )}

            {isPrintModalOpen && invoiceToPrint && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => setIsPrintModalOpen(false)}>
                    <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="overflow-y-auto flex-grow" ref={invoicePrintRef}>
                            <PrintableInvoice invoice={invoiceToPrint} />
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-end gap-4">
                            <button onClick={() => setIsPrintModalOpen(false)} className="px-6 py-2 bg-gray-200 rounded-lg">إغلاق</button>
                            <button onClick={() => printElement(invoicePrintRef.current)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg"><PrintIcon className="w-5 h-5"/> طباعة</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INVOICE MODAL ---
const InvoiceModal: React.FC<{ isOpen: boolean; onClose: () => void; initialData?: Partial<Invoice>; onSave: (inv: Invoice) => void; clients: Client[] }> = ({ isOpen, onClose, initialData, onSave, clients }) => {
    const [formData, setFormData] = React.useState<Partial<Invoice>>({
        items: [{ id: `item-${Date.now()}`, description: '', amount: 0 }],
        taxRate: 0,
        discount: 0,
        status: 'draft',
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    React.useEffect(() => {
        if (initialData) {
            setFormData({ ...initialData, issueDate: initialData.issueDate || new Date(), dueDate: initialData.dueDate || new Date() });
        }
    }, [initialData]);

    const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const clientId = e.target.value;
        const client = clients.find(c => c.id === clientId);
        setFormData(prev => ({ ...prev, clientId, clientName: client?.name || '', caseId: undefined, caseSubject: undefined }));
    };

    const handleCaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const caseId = e.target.value;
        const client = clients.find(c => c.id === formData.clientId);
        const caseItem = client?.cases.find(c => c.id === caseId);
        setFormData(prev => ({ ...prev, caseId, caseSubject: caseItem?.subject }));
    };

    const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
        const newItems = [...(formData.items || [])];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => setFormData(prev => ({ ...prev, items: [...(prev.items || []), { id: `item-${Date.now()}`, description: '', amount: 0 }] }));
    const removeItem = (index: number) => setFormData(prev => ({ ...prev, items: prev.items?.filter((_, i) => i !== index) }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const invoice: Invoice = {
            ...formData as Invoice,
            id: formData.id || `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
            updated_at: new Date()
        };
        onSave(invoice);
    };

    const subtotal = (formData.items || []).reduce((sum, item) => sum + Number(item.amount), 0);
    const total = subtotal + (subtotal * (formData.taxRate || 0) / 100) - (formData.discount || 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{initialData?.id ? 'تعديل فاتورة' : 'إنشاء فاتورة جديدة'}</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">الموكل</label>
                            <select value={formData.clientId || ''} onChange={handleClientChange} className="w-full p-2 border rounded" required>
                                <option value="">اختر موكل...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">القضية (اختياري)</label>
                            <select value={formData.caseId || ''} onChange={handleCaseChange} className="w-full p-2 border rounded" disabled={!formData.clientId}>
                                <option value="">-- عام --</option>
                                {clients.find(c => c.id === formData.clientId)?.cases.map(cs => <option key={cs.id} value={cs.id}>{cs.subject}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-sm font-medium">تاريخ الإصدار</label><input type="date" value={toInputDateString(formData.issueDate)} onChange={e => setFormData({...formData, issueDate: new Date(e.target.value)})} className="w-full p-2 border rounded" required /></div>
                        <div><label className="block text-sm font-medium">تاريخ الاستحقاق</label><input type="date" value={toInputDateString(formData.dueDate)} onChange={e => setFormData({...formData, dueDate: new Date(e.target.value)})} className="w-full p-2 border rounded" required /></div>
                    </div>

                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold">بنود الفاتورة</h3>
                            <button type="button" onClick={addItem} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"><PlusIcon className="w-4 h-4"/> إضافة بند</button>
                        </div>
                        {formData.items?.map((item, index) => (
                            <div key={item.id} className="flex gap-2 mb-2 items-center">
                                <input type="text" placeholder="البيان" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="flex-grow p-2 border rounded text-sm" required />
                                <input type="number" placeholder="المبلغ" value={item.amount} onChange={e => handleItemChange(index, 'amount', Number(e.target.value))} className="w-24 p-2 border rounded text-sm" required />
                                <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t pt-4">
                        <div><label className="block text-xs font-medium">ضريبة (%)</label><input type="number" value={formData.taxRate} onChange={e => setFormData({...formData, taxRate: Number(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div>
                        <div><label className="block text-xs font-medium">خصم (مبلغ)</label><input type="number" value={formData.discount} onChange={e => setFormData({...formData, discount: Number(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div>
                        <div><label className="block text-xs font-medium">الحالة</label><select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})} className="w-full p-2 border rounded text-sm"><option value="draft">مسودة</option><option value="sent">مرسلة</option><option value="paid">مدفوعة</option><option value="overdue">متأخرة</option></select></div>
                    </div>
                    
                    <div className="flex justify-between items-center font-bold text-lg bg-gray-50 p-2 rounded">
                        <span>الإجمالي:</span>
                        <span>{total.toLocaleString()} ل.س</span>
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">حفظ الفاتورة</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- TAB: REPORTS ---
const ReportsTab: React.FC = () => {
    const { accountingEntries } = useData();
    const reportsData = React.useMemo(() => {
        const income = accountingEntries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const expense = accountingEntries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        return [
            { name: 'الإيرادات', value: income, color: '#10B981' },
            { name: 'المصروفات', value: expense, color: '#EF4444' }
        ];
    }, [accountingEntries]);

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-bold text-gray-800">التقارير المالية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow h-[400px]">
                    <h3 className="text-lg font-semibold mb-4 text-center">توزيع الإيرادات والمصروفات</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={reportsData} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                                {reportsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-white p-6 rounded-lg shadow h-[400px]">
                    <h3 className="text-lg font-semibold mb-4 text-center">المقارنة العمودية</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#8884d8">
                                 {reportsData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const AccountingPage: React.FC<{ initialInvoiceData?: { clientId: string, caseId?: string }, clearInitialInvoiceData: () => void }> = ({ initialInvoiceData, clearInitialInvoiceData }) => {
    const [activeTab, setActiveTab] = React.useState<'entries' | 'invoices' | 'reports'>('entries');
    
    // Automatically switch to invoices tab if initial data is present
    React.useEffect(() => {
        if (initialInvoiceData) setActiveTab('invoices');
    }, [initialInvoiceData]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">المحاسبة</h1>
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex border-b">
                    <button onClick={() => setActiveTab('entries')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'entries' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <div className="flex items-center gap-2"><CalculatorIcon className="w-5 h-5"/> القيود اليومية</div>
                    </button>
                    <button onClick={() => setActiveTab('invoices')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'invoices' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <div className="flex items-center gap-2"><DocumentTextIcon className="w-5 h-5"/> الفواتير</div>
                    </button>
                    <button onClick={() => setActiveTab('reports')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'reports' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <div className="flex items-center gap-2"><ChartPieIcon className="w-5 h-5"/> التقارير</div>
                    </button>
                </div>
                <div className="p-6">
                    {activeTab === 'entries' && <EntriesTab />}
                    {activeTab === 'invoices' && <InvoicesTab initialInvoiceData={initialInvoiceData} clearInitialInvoiceData={clearInitialInvoiceData} />}
                    {activeTab === 'reports' && <ReportsTab />}
                </div>
            </div>
        </div>
    );
};

export default AccountingPage;
