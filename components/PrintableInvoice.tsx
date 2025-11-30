import * as React from 'react';
import { Invoice } from '../types';
import { formatDate } from '../utils/dateUtils';

interface PrintableInvoiceProps {
    invoice: Invoice | null;
    officeInfo?: { name: string; address?: string; phone?: string; email?: string; taxNumber?: string };
}

const PrintableInvoice: React.FC<PrintableInvoiceProps> = ({ invoice, officeInfo }) => {
    if (!invoice) {
        return <div className="p-8 text-center text-gray-500">لا توجد فاتورة لعرضها.</div>;
    }

    const subtotal = invoice.items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = (subtotal * invoice.taxRate) / 100;
    const total = subtotal + taxAmount - invoice.discount;

    const defaultOfficeInfo = {
        name: 'مكتب المحامي',
        address: 'دمشق، سوريا',
        phone: 'الهاتف: +963 11 123 4567',
        email: 'البريد: email@example.com',
        taxNumber: 'الرقم الضريبي: 123456789'
    };
    
    const displayOfficeInfo = { ...defaultOfficeInfo, ...officeInfo };

    return (
        <div className="bg-white p-8 font-sans" dir="rtl">
            {/* Header */}
            <div className="flex justify-between items-start pb-4 border-b-2 border-gray-200">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">{displayOfficeInfo.name}</h1>
                    <p className="text-sm text-gray-500 mt-1">{displayOfficeInfo.address}</p>
                    <p className="text-sm text-gray-500">{displayOfficeInfo.phone}</p>
                    <p className="text-sm text-gray-500">{displayOfficeInfo.email}</p>
                    <p className="text-sm text-gray-500">{displayOfficeInfo.taxNumber}</p>
                </div>
                <div className="text-left">
                    <h2 className="text-4xl font-bold text-gray-700 uppercase">فاتورة</h2>
                    <p className="text-sm text-gray-500 mt-2">رقم الفاتورة: <span className="font-mono">{invoice.id}</span></p>
                </div>
            </div>

            {/* Bill To & Dates */}
            <div className="flex justify-between mt-8">
                <div>
                    <h3 className="font-semibold text-gray-500">فاتورة إلى:</h3>
                    <p className="font-bold text-gray-800">{invoice.clientName}</p>
                    {invoice.caseSubject && <p className="text-sm text-gray-600">بخصوص قضية: {invoice.caseSubject}</p>}
                </div>
                <div className="text-left">
                    <div className="flex justify-between items-center">
                        <span className="font-semibold text-gray-500">تاريخ الإصدار:</span>
                        <span className="ms-4 text-gray-800">{formatDate(invoice.issueDate)}</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <span className="font-semibold text-gray-500">تاريخ الاستحقاق:</span>
                        <span className="ms-4 text-gray-800">{formatDate(invoice.dueDate)}</span>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="mt-8 overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-gray-100 border-b-2 border-gray-300">
                        <tr>
                            <th className="px-4 py-3 font-semibold text-gray-600 uppercase tracking-wider">البيان</th>
                            <th className="px-4 py-3 font-semibold text-gray-600 uppercase tracking-wider text-left">المبلغ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {invoice.items.map(item => (
                            <tr key={item.id}>
                                <td className="px-4 py-3">{item.description}</td>
                                <td className="px-4 py-3 text-left font-mono">{item.amount.toLocaleString('ar-SY')}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mt-8">
                <div className="w-full max-w-xs space-y-3">
                    <div className="flex justify-between text-gray-700">
                        <span>المجموع الفرعي:</span>
                        <span className="font-mono">{subtotal.toLocaleString('ar-SY')}</span>
                    </div>
                    {invoice.taxRate > 0 && (
                        <div className="flex justify-between text-gray-700">
                            <span>الضريبة ({invoice.taxRate}%):</span>
                            <span className="font-mono">{taxAmount.toLocaleString('ar-SY')}</span>
                        </div>
                    )}
                    {invoice.discount > 0 && (
                        <div className="flex justify-between text-gray-700">
                            <span>الخصم:</span>
                            <span className="font-mono text-red-600">-{invoice.discount.toLocaleString('ar-SY')}</span>
                        </div>
                    )}
                    <div className="flex justify-between font-bold text-lg text-gray-800 border-t-2 border-gray-300 pt-3">
                        <span>الإجمالي:</span>
                        <span className="font-mono">{total.toLocaleString('ar-SY')} ل.س</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
                <div className="mt-12 border-t pt-4">
                    <h4 className="font-semibold text-gray-600">ملاحظات:</h4>
                    <p className="text-sm text-gray-500 whitespace-pre-wrap">{invoice.notes}</p>
                </div>
            )}

            {/* Footer */}
            <footer className="text-center text-xs text-gray-400 mt-12 pt-4 border-t">
                <p>شكراً لتعاملكم معنا.</p>
                <p>{displayOfficeInfo.name}</p>
            </footer>
        </div>
    );
};

export default PrintableInvoice;