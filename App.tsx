
import * as React from 'react';
// Fix: Use `import type` for Session and User as they are used as types, not values. This resolves module resolution errors in some environments.
import type { Session as AuthSession, User } from '@supabase/supabase-js';

// Statically import ALL page components.
// Removed .tsx extension to ensure compatibility with bundlers.
import ClientsPage from './pages/ClientsPage';
import HomePage from './pages/HomePage';
import AccountingPage from './pages/AccountingPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import PendingApprovalPage from './pages/PendingApprovalPage';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage';


import ConfigurationModal from './components/ConfigurationModal';
import { useSupabaseData, SyncStatus } from './hooks/useSupabaseData';
import { UserIcon, CalculatorIcon, Cog6ToothIcon, NoSymbolIcon, PowerIcon, PrintIcon, ShareIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, ExclamationCircleIcon, ArrowPathIcon } from './components/icons';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import AdminTaskModal from './components/AdminTaskModal';
import { AdminTask, Profile, Client, Appointment, AccountingEntry, Invoice, CaseDocument, AppData, SiteFinancialEntry, Permissions } from './types';
import { getSupabaseClient } from './supabaseClient';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import UnpostponedSessionsModal from './components/UnpostponedSessionsModal';
import NotificationCenter, { RealtimeAlert } from './components/RealtimeNotifier';
import { IDataContext, DataProvider } from './context/DataContext';
import PrintableReport from './components/PrintableReport';
import { printElement } from './utils/printUtils';
import { formatDate, isSameDay } from './utils/dateUtils';
import SyncStatusIndicator from './components/SyncStatusIndicator';


type Page = 'home' | 'admin-tasks' | 'clients' | 'accounting' | 'settings';

interface AppProps {
    onRefresh: () => void;
}

const Navbar: React.FC<{
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    syncStatus: SyncStatus;
    lastSyncError: string | null;
    isDirty: boolean;
    isOnline: boolean;
    onManualSync: () => void;
    profile: Profile | null;
    isAutoSyncEnabled: boolean;
    homePageActions?: React.ReactNode;
    permissions: Permissions;
}> = ({ currentPage, onNavigate, onLogout, syncStatus, lastSyncError, isDirty, isOnline, onManualSync, profile, isAutoSyncEnabled, homePageActions, permissions }) => {
    
    // Define all items, then filter based on permissions
    const allNavItems = [
        { id: 'home', label: 'المفكرة', icon: CalendarDaysIcon, visible: permissions.can_view_agenda }, // Changed to check permissions
        { id: 'admin-tasks', label: 'المهام الإدارية', icon: ClipboardDocumentCheckIcon, visible: permissions.can_view_admin_tasks },
        { id: 'clients', label: 'الموكلين', icon: UserIcon, visible: permissions.can_view_clients || permissions.can_view_cases },
        { id: 'accounting', label: 'المحاسبة', icon: CalculatorIcon, visible: permissions.can_view_finance },
    ];

    const navItems = allNavItems.filter(item => item.visible);
    
    return (
        <header className="bg-white shadow-md p-2 sm:p-4 flex justify-between items-center no-print sticky top-0 z-30">
            <nav className="flex items-center gap-1 sm:gap-4 flex-wrap">
                <button onClick={() => permissions.can_view_agenda && onNavigate('home')} className="flex items-center" aria-label="العودة إلى الصفحة الرئيسية" disabled={!permissions.can_view_agenda}>
                    <div className="flex flex-col items-start sm:flex-row sm:items-baseline gap-0 sm:gap-2">
                        <h1 className="text-xl font-bold text-gray-800">مكتب المحامي</h1>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span>الإصدار: 30-11-2025</span>
                            {profile && (
                                <>
                                    <span className="mx-1 text-gray-300">|</span>
                                    <span className="font-semibold text-blue-600 truncate max-w-[150px]">{profile.full_name}</span>
                                </>
                            )}
                        </div>
                    </div>
                </button>
                 {/* Desktop Navigation - Hidden on Mobile */}
                 <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id as Page)}
                            title={item.label}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === item.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
                {/* Page Actions - Always visible if conditions met */}
                {currentPage === 'home' && homePageActions}
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
                <SyncStatusIndicator 
                    status={syncStatus} 
                    lastError={lastSyncError} 
                    isDirty={isDirty} 
                    isOnline={isOnline}
                    onManualSync={onManualSync}
                    isAutoSyncEnabled={isAutoSyncEnabled}
                />
                <button 
                    onClick={() => onNavigate('settings')} 
                    className={`p-2 rounded-full transition-colors ${currentPage === 'settings' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`} 
                    title="الإعدادات"
                >
                    <Cog6ToothIcon className="w-5 h-5" />
                </button>
                <button onClick={onLogout} className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors" title="تسجيل الخروج">
                    <PowerIcon className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
};

const MobileNavbar: React.FC<{
    currentPage: Page;
    onNavigate: (page: Page) => void;
    permissions: Permissions;
}> = ({ currentPage, onNavigate, permissions }) => {
    const allNavItems = [
        { id: 'home', label: 'المفكرة', icon: CalendarDaysIcon, visible: permissions.can_view_agenda }, // Changed to check permissions
        { id: 'admin-tasks', label: 'المهام', icon: ClipboardDocumentCheckIcon, visible: permissions.can_view_admin_tasks },
        { id: 'clients', label: 'الموكلين', icon: UserIcon, visible: permissions.can_view_clients || permissions.can_view_cases },
        { id: 'accounting', label: 'المحاسبة', icon: CalculatorIcon, visible: permissions.can_view_finance },
    ];

    const navItems = allNavItems.filter(item => item.visible);

    return (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-1 px-2 flex justify-around items-center z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] h-[70px]">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => onNavigate(item.id as Page)}
                    className={`flex flex-col items-center justify-center w-full h-full rounded-lg transition-colors ${
                        currentPage === item.id 
                        ? 'text-blue-600' 
                        : 'text-gray-500 active:bg-gray-50'
                    }`}
                >
                    <item.icon className={`w-7 h-7 mb-1 ${currentPage === item.id ? 'text-blue-600 fill-current' : ''}`} />
                    <span className="text-[10px] font-bold">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};

const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [isVisible, setIsVisible] = React.useState(!isOnline);
    const [isRendered, setIsRendered] = React.useState(!isOnline);

    React.useEffect(() => {
        if (!isOnline) {
            setIsRendered(true);
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => {
                setIsRendered(false);
            }, 300); // Match transition duration
            return () => clearTimeout(timer);
        }
    }, [isOnline]);
    
    if (!isRendered) {
        return null;
    }

    return (
        <div 
            className={`no-print w-full bg-yellow-100 text-yellow-800 p-3 text-center text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}
            role="status"
            aria-live="polite"
        >
            <NoSymbolIcon className="w-5 h-5" />
            <span>أنت غير متصل بالإنترنت. التغييرات محفوظة محلياً وستتم مزامنتها تلقائياً عند عودة الاتصال.</span>
        </div>
    );
};


const LAST_USER_CACHE_KEY = 'lawyerAppLastUser';
const LAST_USER_CREDENTIALS_CACHE_KEY = 'lawyerAppLastUserCredentials';
const UNPOSTPONED_MODAL_SHOWN_KEY = 'lawyerAppUnpostponedModalShown';

const FullScreenLoader: React.FC<{ text?: string }> = ({ text = 'جاري التحميل...' }) => (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
      <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-600">{text}</p>
    </div>
);

const App: React.FC<AppProps> = ({ onRefresh }) => {
    // 1. Optimistic Session Initialization from LocalStorage
    // This prevents the "flash of login page" and allows instant offline access.
    const [session, setSession] = React.useState<AuthSession | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const lastUserRaw = localStorage.getItem(LAST_USER_CACHE_KEY);
                if (lastUserRaw) {
                    const user = JSON.parse(lastUserRaw) as User;
                    // Construct a minimal valid session object for offline use
                    return {
                        access_token: "optimistic_access_token",
                        refresh_token: "optimistic_refresh_token",
                        expires_in: 86400,
                        token_type: "bearer",
                        user: user
                    } as AuthSession;
                }
            } catch (e) {
                console.error("Failed to parse cached user session:", e);
            }
        }
        return null;
    });

    // 2. Auth loading is false if we have an optimistic session, allowing instant render.
    const [isAuthLoading, setIsAuthLoading] = React.useState(!session);
    
    const [profile, setProfile] = React.useState<Profile | null>(null);
    const [authError, setAuthError] = React.useState<string | null>(null);
    const [showConfigModal, setShowConfigModal] = React.useState(false);
    const [loginMessage, setLoginMessage] = React.useState<string | null>(null);

    const [currentPage, setCurrentPage] = React.useState<Page>('home');
    const [isAdminTaskModalOpen, setIsAdminTaskModalOpen] = React.useState(false);
    const [initialAdminTaskData, setInitialAdminTaskData] = React.useState<any>(null);
    const [contextMenu, setContextMenu] = React.useState<{ isOpen: boolean; position: { x: number; y: number }; menuItems: MenuItem[] }>({ isOpen: false, position: { x: 0, y: 0 }, menuItems: [] });
    const [initialInvoiceData, setInitialInvoiceData] = React.useState<{ clientId: string; caseId?: string } | undefined>();
    
    // State lifted from HomePage for printing
    const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);
    const [isPrintAssigneeModalOpen, setIsPrintAssigneeModalOpen] = React.useState(false);
    const [isShareAssigneeModalOpen, setIsShareAssigneeModalOpen] = React.useState(false);
    const [printableReportData, setPrintableReportData] = React.useState<any | null>(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState(new Date());

    const printReportRef = React.useRef<HTMLDivElement>(null);
    const actionsMenuRef = React.useRef<HTMLDivElement>(null);

    const supabase = getSupabaseClient();
    const isOnline = useOnlineStatus();

    // This effect handles authentication state changes and initial verification.
    React.useEffect(() => {
        const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, newSession) => {
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setIsAuthLoading(false);
                localStorage.removeItem(LAST_USER_CACHE_KEY);
                localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
                localStorage.setItem('lawyerAppLoggedOut', 'true');
            } else if (newSession) {
                setSession(newSession);
                setIsAuthLoading(false);
                localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(newSession.user));
                localStorage.removeItem('lawyerAppLoggedOut');
            } else {
                setIsAuthLoading(false);
            }
        });
        
        // Initial Session Check Logic
        const checkSession = async () => {
             // 1. If we are OFFLINE, skip server verification entirely.
             //    Trust the optimistic session we loaded from localStorage.
             if (!isOnline) {
                 console.log("App started offline. Trusting cached session.");
                 setIsAuthLoading(false);
                 return;
             }

             // 2. If ONLINE, attempt to verify with Supabase.
             try {
                const { data: { session: serverSession }, error } = await supabase!.auth.getSession();
                
                if (error) {
                    console.warn("Initial session verification failed:", error.message);
                    const errorMessage = error.message.toLowerCase();
                    
                    // Handle "Invalid Refresh Token" specifically by aggressively clearing local state
                    if (errorMessage.includes("refresh token") || errorMessage.includes("not found")) {
                        console.error("Critical Auth Error: Invalid Refresh Token. Cleaning up...");
                        
                        localStorage.removeItem(LAST_USER_CACHE_KEY);
                        localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
                        Object.keys(localStorage).forEach(key => {
                            if (key.startsWith('sb-')) localStorage.removeItem(key);
                        });
                        
                        await supabase!.auth.signOut().catch(() => {}); 
                        setSession(null);
                        onRefresh(); 
                    }
                    else if (errorMessage.includes("failed to fetch") || errorMessage.includes("network")) {
                        console.warn("Network error during session check. Keeping optimistic session.");
                    } else {
                         setSession(null);
                    }
                } else if (serverSession) {
                    setSession(serverSession);
                    localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(serverSession.user));
                } else {
                    // No session found (logged out)
                    if (session) {
                         setSession(null);
                         localStorage.removeItem(LAST_USER_CACHE_KEY);
                    }
                }
             } catch (err) {
                 console.warn("Unexpected error during session check:", err);
             } finally {
                 setIsAuthLoading(false);
             }
        };

        checkSession();

        return () => subscription.unsubscribe();
    }, [supabase, onRefresh, isOnline]);
    
    // Fetch user profile when session is available
    const data = useSupabaseData(session?.user ?? null, isAuthLoading);

    React.useEffect(() => {
        if (session && data.profiles) {
            const userProfile = data.profiles.find(p => p.id === session.user.id);
            setProfile(userProfile || null);
        } else {
            setProfile(null);
        }
        
        // Show unpostponed sessions modal once per session
        const modalShown = sessionStorage.getItem(UNPOSTPONED_MODAL_SHOWN_KEY);
        if (session && data.unpostponedSessions.length > 0 && !modalShown) {
            data.setShowUnpostponedSessionsModal(true);
            sessionStorage.setItem(UNPOSTPONED_MODAL_SHOWN_KEY, 'true');
        }

    }, [session, data.profiles, data.unpostponedSessions, data.setShowUnpostponedSessionsModal]);

    // Check for forced update flag on mount
    React.useEffect(() => {
        const justUpdated = localStorage.getItem('lawyerAppUpdated');
        if (justUpdated === 'true') {
            data.addRealtimeAlert('تم تحديث التطبيق إلى آخر إصدار بنجاح', 'sync');
            localStorage.removeItem('lawyerAppUpdated');
        }
    }, [data.addRealtimeAlert]);

    // Close actions menu on outside click
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleLogout = async () => {
        try {
            // 1. Clear storage first
            localStorage.removeItem(LAST_USER_CACHE_KEY);
            localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
            // Clear Supabase internal keys
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) localStorage.removeItem(key);
            });
            
            // 2. Immediately update state to show Login Page and hide Loader
            setSession(null);
            setProfile(null);
            setIsAuthLoading(false);

            // 3. Try to sign out from Supabase (if online)
            await supabase!.auth.signOut();
        } catch (error) {
            console.warn("Logout network failed, state cleared anyway:", error);
        } finally {
            // 4. Force a hard app refresh/remount instead of browser reload to avoid 404s/refused connections in preview envs
            onRefresh();
        }
    };
    
    const handleNavigation = (page: Page) => {
        setCurrentPage(page);
    };

    const handleOpenAdminTaskModal = (initialData: any = null) => {
        setInitialAdminTaskData(initialData);
        setIsAdminTaskModalOpen(true);
    };

    const handleSaveAdminTask = (taskData: Omit<AdminTask, 'completed'> & { id?: string }) => {
        if (taskData.id) { // Editing
            data.setAdminTasks(prev => prev.map(t => t.id === taskData.id ? { ...t, ...taskData, updated_at: new Date() } : t));
        } else { // Adding
            const { id, ...restOfTaskData } = taskData;

            const newLocation = restOfTaskData.location || 'غير محدد';
            const maxOrderIndex = data.adminTasks
                .filter(t => (t.location || 'غير محدد') === newLocation)
                .reduce((max, t) => Math.max(max, t.orderIndex || 0), -1);

            const newTask: AdminTask = {
                id: `task-${Date.now()}`,
                ...restOfTaskData,
                completed: false,
                orderIndex: maxOrderIndex + 1,
                updated_at: new Date(),
            };
            data.setAdminTasks(prev => [...prev, newTask]);
        }
        setIsAdminTaskModalOpen(false);
    };

    const showContextMenu = (event: React.MouseEvent, menuItems: MenuItem[]) => {
        event.preventDefault();
        setContextMenu({
            isOpen: true,
            position: { x: event.clientX, y: event.clientY },
            menuItems,
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ ...contextMenu, isOpen: false });
    };
    
    const handleCreateInvoice = (clientId: string, caseId?: string) => {
        setInitialInvoiceData({ clientId, caseId });
        setCurrentPage('accounting');
    };

    // --- Print/Share Logic (Lifted from HomePage) ---
    // ... (Report generation logic remains same)
    const handleGenerateAssigneeReport = (assignee: string | null) => {
        const dailyAppointments = data.appointments
            .filter(a => isSameDay(a.date, selectedDate))
            .sort((a, b) => a.time.localeCompare(b.time));
    
        const dailySessions = data.allSessions.filter(s => isSameDay(s.date, selectedDate));
    
        const allUncompletedTasks = data.adminTasks.filter(t => !t.completed);
        const filteredForAssigneeTasks = assignee ? allUncompletedTasks.filter(t => t.assignee === assignee) : allUncompletedTasks;
    
        const groupedAndSortedTasks = filteredForAssigneeTasks.reduce((acc, task) => {
            const location = task.location || 'غير محدد';
            if (!acc[location]) acc[location] = [];
            acc[location].push(task);
            return acc;
        }, {} as Record<string, AdminTask[]>);
    
        const importanceOrder = { 'urgent': 3, 'important': 2, 'normal': 1 };
    
        for (const location in groupedAndSortedTasks) {
            groupedAndSortedTasks[location].sort((a, b) => {
                const importanceA = importanceOrder[a.importance];
                const importanceB = importanceOrder[b.importance];
                if (importanceA !== importanceB) return importanceB - importanceA;
                const dateA = new Date(a.dueDate).getTime();
                const dateB = new Date(b.dueDate).getTime();
                if (dateA !== dateB) return dateA - dateB;
                return a.task.localeCompare(b.task, 'ar');
            });
        }
    
        const filteredAppointments = assignee ? dailyAppointments.filter(a => a.assignee === assignee) : dailyAppointments;
        const filteredSessions = assignee ? dailySessions.filter(s => s.assignee === assignee) : dailySessions;
    
        setPrintableReportData({
            assignee: assignee || 'جدول الأعمال العام',
            date: selectedDate,
            appointments: filteredAppointments,
            sessions: filteredSessions,
            adminTasks: groupedAndSortedTasks,
        });
    
        setIsPrintAssigneeModalOpen(false);
        setIsPrintModalOpen(true);
    };

    const handleShareAssigneeReport = (assignee: string | null) => {
        const dailyAppointments = data.appointments.filter(a => isSameDay(a.date, selectedDate)).sort((a, b) => a.time.localeCompare(b.time));
        const dailySessions = data.allSessions.filter(s => isSameDay(s.date, selectedDate));
        const allUncompletedTasks = data.adminTasks.filter(t => !t.completed);
        const filteredForAssigneeTasks = assignee ? allUncompletedTasks.filter(t => t.assignee === assignee) : allUncompletedTasks;
        const groupedAndSortedTasks = filteredForAssigneeTasks.reduce((acc, task) => {
            const location = task.location || 'غير محدد';
            if (!acc[location]) acc[location] = [];
            acc[location].push(task);
            return acc;
        }, {} as Record<string, AdminTask[]>);
        
        const importanceOrder = { 'urgent': 3, 'important': 2, 'normal': 1 };
        for (const location in groupedAndSortedTasks) {
            groupedAndSortedTasks[location].sort((a, b) => {
                const importanceA = importanceOrder[a.importance];
                const importanceB = importanceOrder[b.importance];
                if (importanceA !== importanceB) return importanceB - importanceA;
                const dateA = new Date(a.dueDate).getTime();
                const dateB = new Date(b.dueDate).getTime();
                if (dateA !== dateB) return dateA - dateB;
                return a.task.localeCompare(b.task, 'ar');
            });
        }
        const filteredAppointments = assignee ? dailyAppointments.filter(a => a.assignee === assignee) : dailyAppointments;
        const filteredSessions = assignee ? dailySessions.filter(s => s.assignee === assignee) : dailySessions;

        let message = `*جدول أعمال مكتب المحامي*\n*التاريخ:* ${formatDate(selectedDate)}\n*لـِ:* ${assignee || 'الجميع'}\n\n`;
        if (filteredSessions.length > 0) {
            message += `*القسم الأول: الجلسات (${filteredSessions.length})*\n`;
            filteredSessions.forEach(s => { message += `- (${s.court}) قضية ${s.clientName} ضد ${s.opponentName} (أساس: ${s.caseNumber}).\n`; if (s.postponementReason) message += `  سبب التأجيل السابق: ${s.postponementReason}\n`; });
            message += `\n`;
        }
        if (filteredAppointments.length > 0) {
             const formatTime = (time: string) => { if (!time) return ''; let [hours, minutes] = time.split(':'); let hh = parseInt(hours, 10); const ampm = hh >= 12 ? 'مساءً' : 'صباحًا'; hh = hh % 12; hh = hh ? hh : 12; const finalHours = hh.toString().padStart(2, '0'); return `${finalHours}:${minutes} ${ampm}`; };
             const importanceMap: { [key: string]: { text: string } } = { normal: { text: 'عادي' }, important: { text: 'مهم' }, urgent: { text: 'عاجل' } };
            message += `*القسم الثاني: المواعيد (${filteredAppointments.length})*\n`;
            filteredAppointments.forEach(a => { message += `- (${formatTime(a.time)}) ${a.title}`; if (a.importance !== 'normal') message += ` (${importanceMap[a.importance]?.text})`; message += `\n`; });
            message += `\n`;
        }
        const taskLocations = Object.keys(groupedAndSortedTasks);
        if (taskLocations.length > 0) {
            message += `*القسم الثالث: المهام الإدارية (غير منجزة)*\n`;
            taskLocations.forEach(location => {
                const tasks = groupedAndSortedTasks[location];
                if (tasks.length > 0) {
                    message += `*المكان: ${location}*\n`;
                    tasks.forEach(t => { let importanceText = ''; if (t.importance === 'urgent') importanceText = '[عاجل] '; if (t.importance === 'important') importanceText = '[مهم] '; message += `- ${importanceText}${t.task} - تاريخ الاستحقاق: ${formatDate(t.dueDate)}\n`; });
                }
            });
        }
        if (filteredSessions.length === 0 && filteredAppointments.length === 0 && taskLocations.length === 0) message += "لا توجد بنود في جدول الأعمال لهذا اليوم.";
        
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        setIsShareAssigneeModalOpen(false);
    };

    // --- Render Logic ---

    // Do not show loader if we have a session (optimistic load). 
    // Only show it if we are truly waiting for initial auth and have no cached session.
    if (isAuthLoading && !session) {
        return <FullScreenLoader text="جاري تحميل البيانات..." />;
    }
    
    // If we have a session, but data is still loading from IDB, show loader.
    // NOTE: useSupabaseData now sets isDataLoading to false immediately after loading local data.
    if (data.isDataLoading && session) {
         return <FullScreenLoader text="جاري تحميل البيانات..." />;
    }
    
    const handleLoginSuccess = (user: User, isOfflineLogin: boolean = false) => {
        if (!isOfflineLogin) {
            localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(user));
        }
        // If offline login, we manually update session here because onAuthStateChange might not fire.
        if (isOfflineLogin) {
             const offlineSession = {
                 access_token: "offline_access_token",
                 refresh_token: "offline_refresh_token",
                 expires_in: 3600 * 24 * 7,
                 token_type: "bearer",
                 user: user
             } as AuthSession;
             setSession(offlineSession);
        }
    };

    if (showConfigModal) {
        return <ConfigurationModal onRetry={() => { data.manualSync(); setShowConfigModal(false); }} />;
    }
    
    if (data.syncStatus === 'unconfigured' || data.syncStatus === 'uninitialized') {
        return <ConfigurationModal onRetry={data.manualSync} />;
    }
    
    if (!session) {
        return <LoginPage onForceSetup={() => setShowConfigModal(true)} onLoginSuccess={handleLoginSuccess}/>;
    }
    
    // Safety check for profile existence before accessing properties
    const effectiveProfile = profile || data.profiles.find(p => p.id === session.user.id);
    
    if (!effectiveProfile) {
         // If absolutely no profile data is available yet, show loader
         // Exception: Offline mode might have no profile loaded yet if cache was cleared.
         if (isOnline && data.profiles.length === 0) {
             return <FullScreenLoader text="جاري تحميل الملف الشخصي..." />;
         }
         // Fallback for offline edge case or initial load delay
         if (!isOnline && !profile) {
             return <FullScreenLoader text="جاري تحميل البيانات..." />;
         }
    }

    // Check mobile verification first
    if (effectiveProfile && !effectiveProfile.mobile_verified && effectiveProfile.role !== 'admin') {
         return <LoginPage 
             onForceSetup={() => setShowConfigModal(true)} 
             onLoginSuccess={handleLoginSuccess}
             initialMode="otp"
             currentUser={session.user}
             currentMobile={effectiveProfile.mobile_number}
             onLogout={handleLogout}
             onVerificationSuccess={data.fetchAndRefresh}
         />;
    }

    if (effectiveProfile && !effectiveProfile.is_approved) {
        return <PendingApprovalPage onLogout={handleLogout} />;
    }

    if (effectiveProfile && (!effectiveProfile.is_active || (effectiveProfile.subscription_end_date && new Date(effectiveProfile.subscription_end_date) < new Date()))) {
        return <SubscriptionExpiredPage onLogout={handleLogout} />;
    }
    
    if (effectiveProfile && effectiveProfile.role === 'admin') {
         return (
            <DataProvider value={data}>
                <AdminDashboard onLogout={handleLogout} onOpenConfig={() => setShowConfigModal(true)} />
                <NotificationCenter 
                    appointmentAlerts={data.triggeredAlerts}
                    realtimeAlerts={data.realtimeAlerts}
                    userApprovalAlerts={data.userApprovalAlerts}
                    dismissAppointmentAlert={data.dismissAlert}
                    dismissRealtimeAlert={data.dismissRealtimeAlert}
                    dismissUserApprovalAlert={data.dismissUserApprovalAlert}
                />
            </DataProvider>
        );
    }

    const renderPage = () => {
        // Permission check wrapper
        const checkPermission = (allowed: boolean) => {
            if (allowed) return true;
            return false;
        };

        switch (currentPage) {
            case 'clients':
                if (!checkPermission(data.permissions.can_view_clients || data.permissions.can_view_cases)) return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <ClientsPage showContextMenu={showContextMenu} onOpenAdminTaskModal={handleOpenAdminTaskModal} onCreateInvoice={handleCreateInvoice} />;
            case 'accounting':
                if (!checkPermission(data.permissions.can_view_finance)) return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <AccountingPage initialInvoiceData={initialInvoiceData} clearInitialInvoiceData={() => setInitialInvoiceData(undefined)} />;
            case 'settings':
                return <SettingsPage />;
            case 'admin-tasks':
                if (!checkPermission(data.permissions.can_view_admin_tasks)) return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="adminTasks" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
            case 'home':
            default:
                if (!checkPermission(data.permissions.can_view_agenda)) {
                    return (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                            <ExclamationCircleIcon className="w-16 h-16 text-gray-300 mb-4" />
                            <p className="text-lg font-semibold">ليس لديك صلاحية لعرض المفكرة.</p>
                            <p className="text-sm">يرجى التواصل مع المحامي لتحديث الصلاحيات.</p>
                        </div>
                    );
                }
                return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
        }
    };
    
    const homePageActions = (
        <div ref={actionsMenuRef} className="relative">
            <button
                onClick={() => setIsActionsMenuOpen(prev => !prev)}
                className="p-2 text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="إجراءات جدول الأعمال"
                aria-haspopup="true"
                aria-expanded={isActionsMenuOpen}
            >
                <PrintIcon className="w-5 h-5" />
            </button>
            {isActionsMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 origin-top-left bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        <button onClick={() => { setIsPrintAssigneeModalOpen(true); setIsActionsMenuOpen(false); }} className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                            <PrintIcon className="w-5 h-5 text-gray-500" />
                            <span>طباعة جدول الأعمال</span>
                        </button>
                        <button onClick={() => { setIsShareAssigneeModalOpen(true); setIsActionsMenuOpen(false); }} className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem">
                            <ShareIcon className="w-5 h-5 text-gray-500" />
                            <span>إرسال عبر واتساب</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <DataProvider value={data}>
            <div className="flex flex-col h-screen bg-gray-50">
                <Navbar
                    currentPage={currentPage}
                    onNavigate={handleNavigation}
                    onLogout={handleLogout}
                    syncStatus={data.syncStatus}
                    lastSyncError={data.lastSyncError}
                    isDirty={data.isDirty}
                    isOnline={isOnline}
                    onManualSync={data.manualSync}
                    profile={effectiveProfile}
                    isAutoSyncEnabled={data.isAutoSyncEnabled}
                    homePageActions={homePageActions}
                    permissions={data.permissions}
                />
                <OfflineBanner />
                {/* Added padding-bottom to main content to prevent overlap with the mobile nav */}
                <main className="flex-grow p-4 sm:p-6 overflow-y-auto pb-20 sm:pb-6">
                    {renderPage()}
                </main>
                
                <MobileNavbar currentPage={currentPage} onNavigate={handleNavigation} permissions={data.permissions} />

                <AdminTaskModal 
                    isOpen={isAdminTaskModalOpen}
                    onClose={() => setIsAdminTaskModalOpen(false)}
                    onSubmit={handleSaveAdminTask}
                    initialData={initialAdminTaskData}
                    assistants={data.assistants}
                />

                <ContextMenu 
                    isOpen={contextMenu.isOpen}
                    position={contextMenu.position}
                    menuItems={contextMenu.menuItems}
                    onClose={closeContextMenu}
                />
                
                <UnpostponedSessionsModal
                    isOpen={data.showUnpostponedSessionsModal}
                    onClose={() => data.setShowUnpostponedSessionsModal(false)}
                    sessions={data.unpostponedSessions}
                    onPostpone={data.postponeSession}
                    assistants={data.assistants}
                />

                <NotificationCenter 
                    appointmentAlerts={data.triggeredAlerts}
                    realtimeAlerts={data.realtimeAlerts}
                    userApprovalAlerts={data.userApprovalAlerts}
                    dismissAppointmentAlert={data.dismissAlert}
                    dismissRealtimeAlert={data.dismissRealtimeAlert}
                    dismissUserApprovalAlert={data.dismissUserApprovalAlert}
                />

                 {/* Modals lifted from HomePage */}
                {isPrintAssigneeModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => setIsPrintAssigneeModalOpen(false)}>
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                            <h2 className="text-xl font-bold mb-4 border-b pb-3">اختر الشخص لطباعة جدول أعماله</h2>
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                <button onClick={() => handleGenerateAssigneeReport(null)} className="w-full text-right px-4 py-3 bg-blue-50 text-blue-800 font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                                    طباعة جدول الأعمال العام (لكل المهام اليومية)
                                </button>
                                <h3 className="text-md font-semibold text-gray-600 pt-2">أو طباعة لشخص محدد:</h3>
                                {data.assistants.map(name => (
                                    <button
                                        key={name}
                                        onClick={() => handleGenerateAssigneeReport(name)}
                                        className="w-full text-right block px-4 py-2 bg-gray-50 text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button type="button" onClick={() => setIsPrintAssigneeModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">إغلاق</button>
                            </div>
                        </div>
                    </div>
                )}
                
                {isShareAssigneeModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => setIsShareAssigneeModalOpen(false)}>
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                            <h2 className="text-xl font-bold mb-4 border-b pb-3">اختر الشخص لإرسال جدول أعماله عبر واتساب</h2>
                            <div className="space-y-3 max-h-80 overflow-y-auto">
                                <button
                                    onClick={() => handleShareAssigneeReport(null)}
                                    className="w-full text-right px-4 py-3 bg-green-50 text-green-800 font-semibold rounded-lg hover:bg-green-100 transition-colors"
                                >
                                    إرسال جدول الأعمال العام (لكل المهام اليومية)
                                </button>
                                <h3 className="text-md font-semibold text-gray-600 pt-2">أو إرسال لشخص محدد:</h3>
                                {data.assistants.map(name => (
                                    <button
                                        key={name}
                                        onClick={() => handleShareAssigneeReport(name)}
                                        className="w-full text-right block px-4 py-2 bg-gray-50 text-gray-800 rounded-md hover:bg-gray-100 transition-colors"
                                    >
                                        {name}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button type="button" onClick={() => setIsShareAssigneeModalOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">إغلاق</button>
                            </div>
                        </div>
                    </div>
                )}

                {isPrintModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsPrintModalOpen(false)}>
                        <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="overflow-y-auto" ref={printReportRef}>
                                <PrintableReport reportData={printableReportData} />
                            </div>
                            <div className="mt-6 flex justify-end gap-4 border-t pt-4 no-print">
                                <button
                                    type="button"
                                    className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                                    onClick={() => setIsPrintModalOpen(false)}
                                >
                                    إغلاق
                                </button>
                                <button
                                    type="button"
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                                    onClick={() => printElement(printReportRef.current)}
                                >
                                    <PrintIcon className="w-5 h-5" />
                                    <span>طباعة</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DataProvider>
    );
};

export default App;