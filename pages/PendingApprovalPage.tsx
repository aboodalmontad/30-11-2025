import * as React from 'react';
import { PowerIcon } from '../components/icons';

interface PendingApprovalPageProps {
    onLogout: () => void;
}

const PendingApprovalPage: React.FC<PendingApprovalPageProps> = ({ onLogout }) => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 text-center bg-white rounded-lg shadow-md">
                <h1 className="text-2xl font-bold text-gray-800">الحساب قيد المراجعة</h1>
                <p className="mt-4 text-gray-600">
                    شكراً لتسجيلك. تم إرسال طلبك إلى المسؤول للموافقة عليه. ستتمكن من الدخول إلى حسابك فور الموافقة.
                </p>
                <button
                    onClick={onLogout}
                    className="mt-8 inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
                >
                    <PowerIcon className="w-5 h-5" />
                    <span>تسجيل الخروج</span>
                </button>
            </div>
        </div>
    );
};

export default PendingApprovalPage;