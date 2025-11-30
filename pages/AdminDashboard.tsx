
import * as React from 'react';
import AdminPage from './AdminPage';
import { PowerIcon, UserGroupIcon, ChartPieIcon, Bars3Icon, XMarkIcon, CurrencyDollarIcon, Cog6ToothIcon, ExclamationTriangleIcon, CircleStackIcon } from '../components/icons';
import { useData } from '../context/DataContext';
import AdminAnalyticsPage from './AdminAnalyticsPage';
import SiteFinancesPage from './SiteFinancesPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminBackupPage from './AdminBackupPage';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface AdminDashboardProps {
    onLogout: () => void;
    onOpenConfig: () => void;
}

type AdminView = 'analytics' | 'users' | 'finances' | 'settings' | 'backup';

const NavLink: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive: boolean;
    onClick: () => void;
    badgeCount?: number;
}> = ({ label, icon, isActive, onClick, badgeCount }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
            isActive
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
        }`}
    >
        <div className="flex items-center gap-3">
            {icon}
            <span className="font-semibold">{label}</span>
        </div>
        {badgeCount && badgeCount > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                {badgeCount}
            </span>
        )}
    </button>
);


const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout, onOpenConfig }) => {
    const { profiles, isDataLoading: loading, syncStatus, lastSyncError, isDirty, manualSync, isAutoSyncEnabled } = useData();
    // Changed default view from 'analytics' to 'users'
    const [view, setView] = React.useState<AdminView>('users');
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
    const isOnline = useOnlineStatus();

    const pendingUsersCount = React.useMemo(() => {
        return profiles.filter(p => !p.is_approved && p.role !== 'admin').length;
    }, [profiles]);

    // Automatically unlock audio and vibration on component mount.
    // This is required by modern browsers which restrict autoplay until a user interaction.
    React.useEffect(() => {
        const unlockAudioAndVibration = () => {
            // A minimal, silent audio file to unlock the AudioContext.
            const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
            
            const tryVibrate = () => {
                if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
                    // A minimal vibration to "wake up" the vibration API.
                    navigator.vibrate(0);
                }
            };
            
            const attemptPlay = () => silentAudio.play();
            
            attemptPlay().then(() => {
                console.log('Audio and Vibration APIs unlocked on mount.');
                tryVibrate();
            }).catch(() => {
                console.warn('Audio autoplay was blocked. It will be enabled after the first user interaction.');
                const enableOnInteraction = () => {
                    attemptPlay().catch(() => {}); // Try again, ignore further errors.
                    tryVibrate();
                    // Fix: The event listeners are added with the `once: true` option, which automatically
                    // removes them after they are invoked. Manually calling `removeEventListener` is not
                    // necessary and was causing an error because it was passed an invalid options object.
                    console.log('Audio and Vibration APIs unlocked after user interaction.');
                };
                // Set up listeners for the first interaction.
                window.addEventListener('click', enableOnInteraction, { once: true });
                window.addEventListener('touchend', enableOnInteraction, { once: true });
            }); 
        };

        unlockAudioAndVibration();
    }, []); // Empty dependency array ensures this runs only once on mount.


    const renderView = () => {
        switch (view) {
            case 'analytics':
                return <AdminAnalyticsPage />;
            case 'users':
                return <AdminPage />;
            case 'finances':
                return <SiteFinancesPage />;
            case 'backup':
                return <AdminBackupPage />;
            case 'settings':
                return <AdminSettingsPage onOpenConfig={onOpenConfig} />;
            default:
                return <AdminPage />;
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-screen">جاري تحميل...</div>
    }

    const sidebarContent = (
        <>
            <div className="text-center py-4 mb-4 border-b">
                <h1 className="text-2xl font-bold text-gray-800">لوحة تحكم المدير</h1>
            </div>
            <nav className="flex-grow space-y-2">
                <NavLink
                    label="إدارة المستخدمين"
                    icon={<UserGroupIcon className="w-6 h-6" />}
                    isActive={view === 'users'}
                    onClick={() => { setView('users'); setIsSidebarOpen(false); }}
                    badgeCount={pendingUsersCount}
                />
                 <NavLink
                    label="التحليلات"
                    icon={<ChartPieIcon className="w-6 h-6" />}
                    isActive={view === 'analytics'}
                    onClick={() => { setView('analytics'); setIsSidebarOpen(false); }}
                />
                 <NavLink
                    label="المحاسبة المالية"
                    icon={<CurrencyDollarIcon className="w-6 h-6" />}
                    isActive={view === 'finances'}
                    onClick={() => { setView('finances'); setIsSidebarOpen(false); }}
                />
                <NavLink
                    label="النسخ الاحتياطي"
                    icon={<CircleStackIcon className="w-6 h-6" />}
                    isActive={view === 'backup'}
                    onClick={() => { setView('backup'); setIsSidebarOpen(false); }}
                />
                <NavLink
                    label="الإعدادات"
                    icon={<Cog6ToothIcon className="w-6 h-6" />}
                    isActive={view === 'settings'}
                    onClick={() => { setView('settings'); setIsSidebarOpen(false); }}
                />
            </nav>
            {/* Sync Indicator in Sidebar for Desktop */}
            <div className="mt-auto border-t pt-4 space-y-3">
                <div className="hidden lg:block px-2">
                    <SyncStatusIndicator 
                        status={syncStatus} 
                        lastError={lastSyncError} 
                        isDirty={isDirty} 
                        isOnline={isOnline}
                        onManualSync={manualSync}
                        isAutoSyncEnabled={isAutoSyncEnabled}
                        className="w-full justify-center bg-gray-100"
                    />
                </div>
                <p className="mb-2 text-center text-xs text-gray-400">الإصدار: 1-12-2025</p>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors"
                >
                    <PowerIcon className="w-6 h-6" />
                    <span className="font-semibold">تسجيل الخروج</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-gray-100" dir="rtl">
            {/* Overlay for mobile */}
            <div className={`fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)}></div>
            
            {/* Sidebar */}
            <aside className={`fixed lg:relative inset-y-0 right-0 z-40 w-64 bg-white shadow-md flex flex-col p-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden self-start p-2 mb-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <XMarkIcon className="w-6 h-6" />
                </button>
                {sidebarContent}
            </aside>
            
            {/* Main content */}
            <div className="lg:mr-64">
                <header className="sticky top-0 bg-white/75 backdrop-blur-sm p-4 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 lg:hidden">
                            <Bars3Icon className="w-6 h-6"/>
                        </button>
                        <h1 className="text-xl font-bold lg:hidden">لوحة التحكم</h1>
                    </div>
                    {/* Sync Indicator in Header for Mobile/Tablet */}
                    <div className="lg:hidden">
                        <SyncStatusIndicator 
                            status={syncStatus} 
                            lastError={lastSyncError} 
                            isDirty={isDirty} 
                            isOnline={isOnline}
                            onManualSync={manualSync}
                            isAutoSyncEnabled={isAutoSyncEnabled}
                        />
                    </div>
                </header>
                <main className="p-4 sm:p-8">
                    {renderView()}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;