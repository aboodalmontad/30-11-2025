import * as React from 'react';
import { Session } from '../types';
import { formatDate, toInputDateString } from '../utils/dateUtils';
import { ExclamationTriangleIcon, CalendarIcon } from './icons';

interface UnpostponedSessionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: Session[];
    onPostpone: (sessionId: string, newDate: Date, newReason: string) => void;
    assistants: string[];
}

const SessionPostponeItem: React.FC<{
    session: Session;
    onPostpone: (sessionId: string, newDate: Date, newReason: string) => void;
}> = ({ session, onPostpone }) => {
    const [nextDate, setNextDate] = React.useState('');
    const [nextReason, setNextReason] = React.useState('');
    const [error, setError] = React.useState<string | null>(null);

    const handlePostpone = () => {
        if (!nextDate || !nextReason) {
            setError('يرجى إدخال تاريخ وسبب الجلسة القادمة.');
            return;
        }
        const newDate = new Date(nextDate);
        const sessionDate = new Date(session.date);

        if (newDate <= sessionDate) {
            setError('تاريخ الجلسة القادمة يجب أن يكون بعد تاريخ الجلسة الحالية.');
            return;
        }

        setError(null);
        onPostpone(session.id, newDate, nextReason);
    };

    return (
        <div className="p-4 border rounded-lg bg-gray-50 space-y-3">
            <div>
                <p className="font-semibold text-gray-800">{session.clientName} ضد {session.opponentName}</p>
                <p className="text-sm text-gray-600">{session.court} - أساس: {session.caseNumber}</p>
                <p className="text-sm text-red-600">تاريخ الجلسة الفائتة: {formatDate(session.date)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs font-medium text-gray-700">تاريخ الجلسة القادمة</label>
                    <input
                        type="date"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        className="mt-1 w-full p-2 border rounded-md text-sm"
                        aria-label="تاريخ الجلسة القادمة"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700">سبب التأجيل القادم</label>
                    <input
                        type="text"
                        value={nextReason}
                        onChange={(e) => setNextReason(e.target.value)}
                        className="mt-1 w-full p-2 border rounded-md text-sm"
                        placeholder="سبب التأجيل..."
                        aria-label="سبب التأجيل القادم"
                    />
                </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
                onClick={handlePostpone}
                disabled={!nextDate || !nextReason}
                className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
                حفظ الترحيل
            </button>
        </div>
    );
};


const UnpostponedSessionsModal: React.FC<UnpostponedSessionsModalProps> = ({ isOpen, onClose, sessions, onPostpone }) => {

    React.useEffect(() => {
        if (isOpen && sessions.length === 0) {
            onClose();
        }
    }, [isOpen, sessions, onClose]);

    if (!isOpen || sessions.length === 0) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 no-print p-4" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="text-center mb-4">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-4">
                        <CalendarIcon className="h-8 w-8 text-yellow-600" aria-hidden="true" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">جلسات غير مرحّلة</h2>
                    <p className="text-gray-600 mt-2">
                        لديك <strong className="font-bold">{sessions.length}</strong> جلسات بتاريخ سابق لم يتم ترحيلها. يرجى تحديد موعد للجلسة القادمة.
                    </p>
                </div>

                <div className="flex-grow overflow-y-auto space-y-4 p-2 -m-2">
                    {sessions.map(session => (
                        <SessionPostponeItem
                            key={session.id}
                            session={session}
                            onPostpone={onPostpone}
                        />
                    ))}
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        type="button"
                        className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                        onClick={onClose}
                    >
                        ذكرني لاحقاً
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UnpostponedSessionsModal;