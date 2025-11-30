import * as React from 'react';
import { PowerIcon, ExclamationTriangleIcon } from '../components/icons';

interface SubscriptionExpiredPageProps {
    onLogout: () => void;
}

const SubscriptionExpiredPage: React.FC<SubscriptionExpiredPageProps> = ({ onLogout }) => {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="w-full max-w-md p-8 text-center bg-white rounded-lg shadow-md">
                 <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
                </div>
                <h1 className="mt-4 text-2xl font-bold text-gray-800">انتهى اشتراكك</h1>
                <p className="mt-4 text-gray-600">
                    لقد انتهت صلاحية اشتراكك في التطبيق. يرجى التواصل مع المسؤول لتجديد اشتراكك واستعادة الوصول إلى حسابك.
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

export default SubscriptionExpiredPage;