import * as React from 'react';
import { Session, Appointment, AdminTask } from '../types';
import { formatDate } from '../utils/dateUtils';

interface PrintableReportProps {
    reportData: {
        assignee: string;
        date: Date;
        appointments: Appointment[];
        sessions: Session[];
        adminTasks: Record<string, AdminTask[]>;
    } | null;
}

const importanceMap: { [key: string]: { text: string, className: string } } = {
    normal: { text: 'عادي', className: 'bg-gray-100 text-gray-800' },
    important: { text: 'مهم', className: 'bg-yellow-100 text-yellow-800' },
    urgent: { text: 'عاجل', className: 'bg-red-100 text-red-800' },
};

const formatTime = (time: string) => {
    if (!time) return '';
    let [hours, minutes] = time.split(':');
    let hh = parseInt(hours, 10);
    const ampm = hh >= 12 ? 'مساءً' : 'صباحًا';
    hh = hh % 12;
    hh = hh ? hh : 12;
    const finalHours = hh.toString().padStart(2, '0');
    return `${finalHours}:${minutes} ${ampm}`;
};


const PrintableReport: React.FC<PrintableReportProps> = ({ reportData }) => {
    if (!reportData) {
        return <div className="p-4 text-center">لا توجد بيانات للطباعة.</div>;
    }

    const { assignee, date, appointments, sessions, adminTasks } = reportData;

    return (
        <div className="p-4">
            <header className="text-center border-b pb-4 mb-6">
                <h1 className="text-3xl font-bold text-gray-800">مكتب المحامي</h1>
                <h2 className="text-2xl font-semibold text-gray-700 mt-2">جدول الأعمال اليومي لـِ: {assignee}</h2>
                <p className="text-lg text-gray-600">{formatDate(date)}</p>
            </header>

            <main className="space-y-8">
                {appointments.length === 0 && sessions.length === 0 && Object.keys(adminTasks).length === 0 ? (
                     <p className="p-4 text-gray-500 text-center">لا توجد بنود في جدول الأعمال لهذا اليوم.</p>
                ) : (
                    <>
                        {appointments.length > 0 && (
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 bg-gray-100 p-2 rounded-t-lg">المواعيد</h3>
                                <div className="overflow-x-auto border border-t-0 rounded-b-lg">
                                    <table className="w-full text-sm text-right text-gray-600">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3">الوقت</th>
                                                <th className="px-4 py-3">الموضوع</th>
                                                <th className="px-4 py-3">الأهمية</th>
                                                <th className="px-4 py-3">الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {appointments.map((item) => (
                                                <tr key={item.id} className="bg-white border-b">
                                                    <td className="px-4 py-3 font-medium">{formatTime(item.time)}</td>
                                                    <td className="px-4 py-3">{item.title}</td>
                                                    <td className="px-4 py-3">{importanceMap[item.importance]?.text}</td>
                                                    <td className="px-4 py-3">{item.completed ? 'تم' : 'قيد الانتظار'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {sessions.length > 0 && (
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 bg-gray-100 p-2 rounded-t-lg">الجلسات</h3>
                                <div className="overflow-x-auto border border-t-0 rounded-b-lg">
                                    <table className="w-full text-sm text-right text-gray-600 table-fixed">
                                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                            <tr>
                                                <th className="px-2 py-3 w-[15%]">المحكمة / الأساس</th>
                                                <th className="px-2 py-3 w-[25%]">القضية</th>
                                                <th className="px-2 py-3 w-[15%]">المكلف بالحضور</th>
                                                <th className="px-2 py-3 w-[15%]">سبب التأجيل السابق</th>
                                                <th className="px-2 py-3 w-[30%]">الجلسة القادمة والسبب</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {sessions.map((item) => (
                                                <tr key={item.id} className="bg-white border-b">
                                                    <td className="px-2 py-3 align-top">{item.court} / {item.caseNumber}</td>
                                                    <td className="px-2 py-3 align-top">{item.clientName} ضد {item.opponentName}</td>
                                                    <td className="px-2 py-3 align-top">{item.assignee}</td>
                                                    <td className="px-2 py-3 align-top">{item.postponementReason || '-'}</td>
                                                    <td className="px-2 py-3 h-16 align-top"></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}

                        {Object.keys(adminTasks).length > 0 && (
                            <section>
                                <h3 className="text-xl font-bold text-gray-800 bg-gray-100 p-2 rounded-lg mb-4">المهام الإدارية الغير منجزة</h3>
                                <div className="space-y-6">
                                    {Object.entries(adminTasks).map(([location, tasks]) => {
                                        const taskList = tasks as AdminTask[];
                                        return (
                                        <div key={location}>
                                            <h4 className="text-lg font-semibold text-gray-700 bg-gray-50 p-3 rounded-t-lg">{location} <span className="text-sm font-normal text-gray-500">({taskList.length} مهام)</span></h4>
                                            <div className="overflow-x-auto border border-t-0 rounded-b-lg">
                                                <table className="w-full text-sm text-right text-gray-600">
                                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-3">تاريخ الاستحقاق</th>
                                                            <th className="px-4 py-3">المهمة</th>
                                                            <th className="px-4 py-3">المسؤول</th>
                                                            <th className="px-4 py-3">الأهمية</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {taskList.map((item) => (
                                                            <tr key={item.id} className="bg-white border-b">
                                                                <td className="px-4 py-3">{formatDate(item.dueDate)}</td>
                                                                <td className="px-4 py-3">{item.task}</td>
                                                                <td className="px-4 py-3">{item.assignee}</td>
                                                                <td className="px-4 py-3">{importanceMap[item.importance]?.text}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default PrintableReport;