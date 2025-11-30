import * as React from 'react';
import { Client, AccountingEntry, Case } from '../types';
import { formatDate } from '../utils/dateUtils';

interface PrintableClientReportProps {
    client: Client;
    caseData?: Case;
    entries: AccountingEntry[];
    totals: { income: number; expense: number; balance: number };
}

const PrintableClientReport: React.FC<PrintableClientReportProps> = ({ client, caseData, entries, totals }) => {
    return (
        <div className="p-4">
            <header className="text-center border-b pb-4 mb-6">
                <h1 className="text-3xl font-bold text-gray-800">
                    {caseData ? 'كشف حساب قضية' : 'كشف حساب'}
                </h1>
                <h2 className="text-2xl font-semibold text-gray-700 mt-2">
                    {caseData ? caseData.subject : client.name}
                </h2>
                {caseData && <p className="text-md text-gray-600 mt-1">الموكل: {client.name}</p>}
                {!caseData && <p className="text-sm text-gray-500">{client.contactInfo}</p>}
            </header>

            <main className="space-y-8">
                <section>
                    <h3 className="text-xl font-bold text-gray-800 border-b-2 border-blue-600 pb-2 mb-4">ملخص مالي</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-green-100 text-green-800 rounded-lg text-center">
                            <h4 className="font-semibold">إجمالي المقبوضات</h4>
                            <p className="text-2xl font-bold">{totals.income.toLocaleString()} ل.س</p>
                        </div>
                        <div className="p-4 bg-red-100 text-red-800 rounded-lg text-center">
                            <h4 className="font-semibold">إجمالي المصروفات</h4>
                            <p className="text-2xl font-bold">{totals.expense.toLocaleString()} ل.س</p>
                        </div>
                        <div className="p-4 bg-blue-100 text-blue-800 rounded-lg text-center">
                            <h4 className="font-semibold">الرصيد الحالي</h4>
                            <p className="text-2xl font-bold">{totals.balance.toLocaleString()} ل.س</p>
                        </div>
                    </div>
                </section>

                <section>
                    <h3 className="text-xl font-bold text-gray-800 border-b-2 border-gray-400 pb-2 mb-4">تفاصيل الحركات المالية</h3>
                    {entries.length > 0 ? (
                        <table className="w-full text-sm text-right text-gray-600">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3">التاريخ</th>
                                    <th className="px-4 py-3">البيان</th>
                                    <th className="px-4 py-3">القضية</th>
                                    <th className="px-4 py-3">المقبوضات</th>
                                    <th className="px-4 py-3">المصروفات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => {
                                    const relatedCase = client.cases.find(c => c.id === entry.caseId);
                                    return (
                                        <tr key={entry.id} className="bg-white border-b">
                                            <td className="px-4 py-3">{formatDate(entry.date)}</td>
                                            <td className="px-4 py-3">{entry.description}</td>
                                            <td className="px-4 py-3">{relatedCase?.subject || 'عام'}</td>
                                            <td className="px-4 py-3 font-semibold text-green-600">
                                                {entry.type === 'income' ? `${entry.amount.toLocaleString()} ل.س` : '-'}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-red-600">
                                                {entry.type === 'expense' ? `${entry.amount.toLocaleString()} ل.س` : '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="p-4 text-gray-500">لا توجد حركات مالية لهذا الموكل.</p>
                    )}
                </section>
            </main>
        </div>
    );
};

export default PrintableClientReport;