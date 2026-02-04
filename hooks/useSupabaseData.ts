
import * as React from 'react';
import { Client, Session, AdminTask, Appointment, AccountingEntry, Case, Stage, Invoice, InvoiceItem, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, Profile, SiteFinancialEntry, Permissions, defaultPermissions } from '../types';
import { useOnlineStatus } from './useOnlineStatus';
// Fix: Use `import type` for User and RealtimeChannel as they are used as types, not a value.
import type { User, RealtimeChannel } from '@supabase/supabase-js';
import { useSync, SyncStatus as SyncStatusType } from './useSync';
import { getSupabaseClient } from '../supabaseClient';
import { isBeforeToday, toInputDateString } from '../utils/dateUtils';
import { openDB, IDBPDatabase } from 'idb';
import { RealtimeAlert } from '../components/RealtimeNotifier';

export const APP_DATA_KEY = 'lawyerBusinessManagementData';
export type SyncStatus = SyncStatusType;
const defaultAssistants = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];
const DB_NAME = 'LawyerAppData';
const DB_VERSION = 11;
const DATA_STORE_NAME = 'appData';
const DOCS_FILES_STORE_NAME = 'caseDocumentFiles';
const DOCS_METADATA_STORE_NAME = 'caseDocumentMetadata';

// --- User Settings Management ---
interface UserSettings {
    isAutoSyncEnabled: boolean;
    isAutoBackupEnabled: boolean;
    adminTasksLayout: 'horizontal' | 'vertical';
    locationOrder?: string[];
}

const defaultSettings: UserSettings = {
    isAutoSyncEnabled: true,
    isAutoBackupEnabled: true,
    adminTasksLayout: 'horizontal',
    locationOrder: [],
};

const getInitialData = (): AppData => ({
    clients: [] as Client[],
    adminTasks: [] as AdminTask[],
    appointments: [] as Appointment[],
    accountingEntries: [] as AccountingEntry[],
    invoices: [] as Invoice[],
    assistants: [...defaultAssistants],
    documents: [] as CaseDocument[],
    profiles: [] as Profile[],
    siteFinances: [] as SiteFinancialEntry[],
});

async function getDb(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, tx) {
        if (oldVersion < 11) {
            if (db.objectStoreNames.contains(DOCS_METADATA_STORE_NAME)) db.deleteObjectStore(DOCS_METADATA_STORE_NAME);
            db.createObjectStore(DOCS_METADATA_STORE_NAME);
        }
        if (!db.objectStoreNames.contains(DATA_STORE_NAME)) db.createObjectStore(DATA_STORE_NAME);
        if (!db.objectStoreNames.contains(DOCS_FILES_STORE_NAME)) db.createObjectStore(DOCS_FILES_STORE_NAME);
    },
  });
}

const validateAssistantsList = (list: any): string[] => {
    if (!Array.isArray(list)) return [...defaultAssistants];
    const uniqueAssistants = new Set(list.filter(item => typeof item === 'string' && item.trim() !== ''));
    uniqueAssistants.add('بدون تخصيص');
    return Array.from(uniqueAssistants);
};

const safeArray = <T, U>(arr: any, mapFn: (doc: any, index: number) => U | undefined): U[] => {
    if (!Array.isArray(arr)) return [];
    return arr.reduce((acc: U[], doc: any, index: number) => {
        if (!doc) return acc;
        try {
            const result = mapFn(doc, index);
            if (result !== undefined) acc.push(result);
        } catch (e) { console.error('Error processing item:', e); }
        return acc;
    }, []);
};

const reviveDate = (date: any): Date => {
    if (!date) return new Date();
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
};

const validateDocuments = (doc: any, userId: string): CaseDocument | undefined => {
    if (!doc || typeof doc !== 'object' || !doc.id || !doc.name) return undefined;
    return {
        id: String(doc.id),
        caseId: String(doc.caseId),
        userId: String(doc.userId || userId),
        name: String(doc.name),
        type: String(doc.type || 'application/octet-stream'),
        size: Number(doc.size || 0),
        addedAt: reviveDate(doc.addedAt),
        storagePath: String(doc.storagePath || ''),
        localState: doc.localState || 'pending_download', 
        updated_at: reviveDate(doc.updated_at),
    };
};

const validateAndFixData = (loadedData: any, user: User | null): AppData => {
    const userId = user?.id || '';
    if (!loadedData || typeof loadedData !== 'object') return getInitialData();
    const isValidObject = (item: any): item is Record<string, any> => item && typeof item === 'object' && !Array.isArray(item);
    
    return {
        clients: safeArray(loadedData.clients, (client) => {
             if (!isValidObject(client) || !client.id || !client.name) return undefined;
             const clientUserId = client.user_id;
             return {
                 id: String(client.id),
                 name: String(client.name),
                 contactInfo: String(client.contactInfo || ''),
                 updated_at: reviveDate(client.updated_at),
                 user_id: clientUserId,
                 cases: safeArray(client.cases, (caseItem) => {
                     if (!isValidObject(caseItem) || !caseItem.id) return undefined;
                     return {
                         id: String(caseItem.id),
                         subject: String(caseItem.subject || ''),
                         clientName: String(caseItem.clientName || client.name),
                         opponentName: String(caseItem.opponentName || ''),
                         feeAgreement: String(caseItem.feeAgreement || ''),
                         status: ['active', 'closed', 'on_hold'].includes(caseItem.status) ? caseItem.status : 'active',
                         updated_at: reviveDate(caseItem.updated_at),
                         user_id: clientUserId,
                         stages: safeArray(caseItem.stages, (stage) => {
                             if (!isValidObject(stage) || !stage.id) return undefined;
                             return {
                                 id: String(stage.id),
                                 court: String(stage.court || ''),
                                 caseNumber: String(stage.caseNumber || ''),
                                 firstSessionDate: stage.firstSessionDate ? reviveDate(stage.firstSessionDate) : undefined,
                                 decisionDate: stage.decisionDate ? reviveDate(stage.decisionDate) : undefined,
                                 decisionNumber: String(stage.decisionNumber || ''),
                                 decisionSummary: String(stage.decisionSummary || ''),
                                 decisionNotes: String(stage.decisionNotes || ''),
                                 updated_at: reviveDate(stage.updated_at),
                                 user_id: clientUserId,
                                 sessions: safeArray(stage.sessions, (session) => {
                                     if (!isValidObject(session) || !session.id) return undefined;
                                     return {
                                         id: String(session.id),
                                         court: String(session.court || stage.court),
                                         caseNumber: String(session.caseNumber || stage.caseNumber),
                                         date: reviveDate(session.date),
                                         clientName: String(session.clientName || caseItem.clientName),
                                         opponentName: String(session.opponentName || caseItem.opponentName),
                                         postponementReason: session.postponementReason,
                                         nextPostponementReason: session.nextPostponementReason,
                                         isPostponed: !!session.isPostponed,
                                         nextSessionDate: session.nextSessionDate ? reviveDate(session.nextSessionDate) : undefined,
                                         assignee: session.assignee,
                                         stageId: session.stageId,
                                         stageDecisionDate: session.stageDecisionDate,
                                         updated_at: reviveDate(session.updated_at),
                                         user_id: clientUserId,
                                     };
                                 }),
                             };
                         }),
                     };
                 }),
             };
        }),
        adminTasks: safeArray(loadedData.adminTasks, (task) => {
            if (!isValidObject(task) || !task.id || !task.task) return undefined;
            return {
                id: String(task.id),
                task: String(task.task),
                dueDate: reviveDate(task.dueDate),
                completed: !!task.completed,
                importance: ['normal', 'important', 'urgent'].includes(task.importance) ? task.importance : 'normal',
                assignee: String(task.assignee || 'بدون تخصيص'),
                location: String(task.location || 'غير محدد'),
                orderIndex: typeof task.orderIndex === 'number' ? task.orderIndex : 0,
                updated_at: reviveDate(task.updated_at),
                user_id: task.user_id,
            };
        }),
        appointments: safeArray(loadedData.appointments, (apt) => {
            if (!isValidObject(apt) || !apt.id || !apt.title) return undefined;
            return {
                id: String(apt.id),
                title: String(apt.title),
                time: String(apt.time),
                date: reviveDate(apt.date),
                importance: ['normal', 'important', 'urgent'].includes(apt.importance) ? apt.importance : 'normal',
                completed: !!apt.completed,
                notified: !!apt.notified,
                reminderTimeInMinutes: typeof apt.reminderTimeInMinutes === 'number' ? apt.reminderTimeInMinutes : 15,
                assignee: String(apt.assignee || 'بدون تخصيص'),
                updated_at: reviveDate(apt.updated_at),
                user_id: apt.user_id,
            };
        }),
        accountingEntries: safeArray(loadedData.accountingEntries, (entry) => {
            if (!isValidObject(entry) || !entry.id || typeof entry.amount !== 'number') return undefined;
            return {
                id: String(entry.id),
                type: ['income', 'expense'].includes(entry.type) ? entry.type : 'expense',
                amount: Number(entry.amount),
                date: reviveDate(entry.date),
                description: String(entry.description || ''),
                clientId: String(entry.clientId || ''),
                caseId: String(entry.caseId || ''),
                clientName: String(entry.clientName || ''),
                updated_at: reviveDate(entry.updated_at),
                user_id: entry.user_id,
            };
        }),
        invoices: safeArray(loadedData.invoices, (inv) => {
            if (!isValidObject(inv) || !inv.id) return undefined;
            return {
                id: String(inv.id),
                clientId: String(inv.clientId),
                clientName: String(inv.clientName),
                caseId: inv.caseId ? String(inv.caseId) : undefined,
                caseSubject: inv.caseSubject ? String(inv.caseSubject) : undefined,
                issueDate: reviveDate(inv.issueDate),
                dueDate: reviveDate(inv.dueDate),
                items: safeArray(inv.items, (item) => {
                    if (!isValidObject(item) || !item.id) return undefined;
                    return {
                        id: String(item.id),
                        description: String(item.description),
                        amount: Number(item.amount),
                        updated_at: reviveDate(item.updated_at),
                    };
                }),
                taxRate: Number(inv.taxRate || 0),
                discount: Number(inv.discount || 0),
                status: ['draft', 'sent', 'paid', 'overdue'].includes(inv.status) ? inv.status : 'draft',
                notes: String(inv.notes || ''),
                updated_at: reviveDate(inv.updated_at),
                user_id: inv.user_id,
            };
        }),
        assistants: validateAssistantsList(loadedData.assistants),
        documents: safeArray(loadedData.documents, (doc) => validateDocuments(doc, userId)),
        profiles: safeArray(loadedData.profiles, (p) => ({
            id: String(p.id),
            full_name: String(p.full_name),
            mobile_number: String(p.mobile_number),
            is_approved: !!p.is_approved,
            is_active: !!p.is_active,
            mobile_verified: !!p.mobile_verified,
            subscription_start_date: p.subscription_start_date,
            subscription_end_date: p.subscription_end_date,
            role: p.role || 'user',
            lawyer_id: p.lawyer_id,
            permissions: p.permissions || defaultPermissions,
            created_at: p.created_at,
            updated_at: reviveDate(p.updated_at),
        })),
        siteFinances: safeArray(loadedData.siteFinances, (sf) => ({
            id: Number(sf.id),
            user_id: sf.user_id,
            type: sf.type || 'income',
            payment_date: String(sf.payment_date),
            amount: Number(sf.amount),
            description: String(sf.description || ''),
            payment_method: String(sf.payment_method || ''),
            category: String(sf.category || ''),
            updated_at: reviveDate(sf.updated_at),
        })),
    };
};

export const useSupabaseData = (user: User | null, isAuthLoading: boolean) => {
    // --- State Declarations ---
    const [clients, setClients] = React.useState<Client[]>([]);
    const [adminTasks, setAdminTasks] = React.useState<AdminTask[]>([]);
    const [appointments, setAppointments] = React.useState<Appointment[]>([]);
    const [accountingEntries, setAccountingEntries] = React.useState<AccountingEntry[]>([]);
    const [invoices, setInvoices] = React.useState<Invoice[]>([]);
    const [assistants, setAssistants] = React.useState<string[]>([...defaultAssistants]);
    const [documents, setDocuments] = React.useState<CaseDocument[]>([]);
    const [profiles, setProfiles] = React.useState<Profile[]>([]);
    const [siteFinances, setSiteFinances] = React.useState<SiteFinancialEntry[]>([]);
    
    // --- Sync & Metadata State ---
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('uninitialized');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [deletedIds, setDeletedIds] = React.useState<DeletedIds>(getInitialDeletedIds());
    const [isDirty, setIsDirty] = React.useState(false);
    
    // --- Settings State ---
    const [isAutoSyncEnabled, setAutoSyncEnabled] = React.useState(defaultSettings.isAutoSyncEnabled);
    const [isAutoBackupEnabled, setAutoBackupEnabled] = React.useState(defaultSettings.isAutoBackupEnabled);
    const [adminTasksLayout, setAdminTasksLayout] = React.useState<'horizontal' | 'vertical'>(defaultSettings.adminTasksLayout);
    const [locationOrder, setLocationOrder] = React.useState<string[]>([]);

    // --- UI State managed here for global access ---
    const [showUnpostponedSessionsModal, setShowUnpostponedSessionsModal] = React.useState(false);
    const [triggeredAlerts, setTriggeredAlerts] = React.useState<Appointment[]>([]);
    const [realtimeAlerts, setRealtimeAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userApprovalAlerts, setUserApprovalAlerts] = React.useState<RealtimeAlert[]>([]);

    const supabase = getSupabaseClient();
    const isOnline = useOnlineStatus();
    const channelRef = React.useRef<RealtimeChannel | null>(null);

    // Derived States
    const effectiveUserId = React.useMemo(() => {
        if (!user) return null;
        const currentUserProfile = profiles.find(p => p.id === user.id);
        return currentUserProfile?.lawyer_id || user.id;
    }, [user, profiles]);

    const effectiveUser = React.useMemo(() => {
        return user ? { ...user, id: effectiveUserId || user.id } : null;
    }, [user, effectiveUserId]);

    const permissions = React.useMemo(() => {
        if (!user) return defaultPermissions;
        const profile = profiles.find(p => p.id === user.id);
        if (profile?.role === 'admin' || !profile?.lawyer_id) {
             // Admin or Main Lawyer gets all permissions
             return {
                 can_view_agenda: true,
                 can_view_clients: true, can_add_client: true, can_edit_client: true, can_delete_client: true,
                 can_view_cases: true, can_add_case: true, can_edit_case: true, can_delete_case: true,
                 can_view_sessions: true, can_add_session: true, can_edit_session: true, can_delete_session: true, can_postpone_session: true, can_decide_session: true,
                 can_view_documents: true, can_add_document: true, can_delete_document: true,
                 can_view_finance: true, can_add_financial_entry: true, can_delete_financial_entry: true, can_manage_invoices: true,
                 can_view_admin_tasks: true, can_add_admin_task: true, can_edit_admin_task: true, can_delete_admin_task: true,
                 can_view_reports: true
             };
        }
        return { ...defaultPermissions, ...(profile.permissions || {}) };
    }, [user, profiles]);

    const allSessions = React.useMemo(() => clients.flatMap(c => c.cases.flatMap(cs => cs.stages.flatMap(st => st.sessions))), [clients]);
    
    const unpostponedSessions = React.useMemo(() => {
        if (!user) return [];
        return allSessions.filter(session => {
            const isAssignedToUser = permissions.can_view_sessions && (session.assignee === user.user_metadata?.full_name || !session.assignee || session.assignee === 'بدون تخصيص');
            return isBeforeToday(session.date) && !session.isPostponed && !session.stageDecisionDate && isAssignedToUser;
        });
    }, [allSessions, user, permissions]);

    // --- Data Persistence Helpers ---
    const loadSettings = async () => {
        const db = await getDb();
        const settings = await db.get(DATA_STORE_NAME, 'userSettings');
        if (settings) {
            setAutoSyncEnabled(settings.isAutoSyncEnabled ?? defaultSettings.isAutoSyncEnabled);
            setAutoBackupEnabled(settings.isAutoBackupEnabled ?? defaultSettings.isAutoBackupEnabled);
            setAdminTasksLayout(settings.adminTasksLayout ?? defaultSettings.adminTasksLayout);
            setLocationOrder(settings.locationOrder ?? []);
        }
    };

    const saveSettings = async () => {
        const db = await getDb();
        await db.put(DATA_STORE_NAME, { isAutoSyncEnabled, isAutoBackupEnabled, adminTasksLayout, locationOrder }, 'userSettings');
    };

    const saveLocalData = React.useCallback(async (data: AppData) => {
        const db = await getDb();
        await db.put(DATA_STORE_NAME, data, APP_DATA_KEY);
        await db.put(DATA_STORE_NAME, deletedIds, 'deletedIds');
        setIsDirty(true);
    }, [deletedIds]);

    const loadLocalData = async () => {
        const db = await getDb();
        const storedData = await db.get(DATA_STORE_NAME, APP_DATA_KEY);
        const storedDeletedIds = await db.get(DATA_STORE_NAME, 'deletedIds');
        const storedDocsMetadata = await db.getAll(DOCS_METADATA_STORE_NAME);

        if (storedData) {
            const validated = validateAndFixData({ ...storedData, documents: storedDocsMetadata }, user);
            setClients(validated.clients);
            setAdminTasks(validated.adminTasks);
            setAppointments(validated.appointments);
            setAccountingEntries(validated.accountingEntries);
            setInvoices(validated.invoices);
            setAssistants(validated.assistants);
            setDocuments(validated.documents);
            setProfiles(validated.profiles);
            setSiteFinances(validated.siteFinances);
        }
        if (storedDeletedIds) setDeletedIds(storedDeletedIds);
    };

    // --- Cleanup & Retention Policy ---
    const cleanupCloudStorage = React.useCallback(async () => {
        if (!isOnline || !supabase) return;
        
        try {
            const db = await getDb();
            const allDocs = await db.getAll(DOCS_METADATA_STORE_NAME) as CaseDocument[];
            const now = Date.now();
            const ONE_DAY = 24 * 60 * 60 * 1000;

            const expiredDocs = allDocs.filter(doc => {
                const isOld = (now - new Date(doc.addedAt).getTime()) > ONE_DAY;
                // Only cleanup if we have it locally (synced) and it's not already marked archived/expired
                return isOld && doc.localState === 'synced';
            });

            for (const doc of expiredDocs) {
                // We attempt to delete from cloud.
                // Even if it fails (already deleted by someone else), we mark as archived locally because WE have the file.
                // Note: The file stays in Supabase Database metadata (case_documents table), but is removed from Storage Bucket.
                const { error } = await supabase.storage.from('documents').remove([doc.storagePath]);
                
                if (!error || (error as any).statusCode === '404') {
                    const updatedDoc: CaseDocument = { ...doc, localState: 'archived' };
                    await db.put(DOCS_METADATA_STORE_NAME, updatedDoc);
                    setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));
                }
            }
        } catch (error) {
            console.error("Cleanup failed:", error);
        }
    }, [isOnline, supabase]);

    // --- Realtime Subscriptions ---
    React.useEffect(() => {
        if (!supabase || !isOnline || !user) return;

        const setupRealtime = () => {
            if (channelRef.current) return;

            const channel = supabase.channel('db-changes')
                .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    // Filter events relevant to the current user (own data or team data)
                    const newData = payload.new as any;
                    const oldData = payload.old as any;
                    
                    const isRelevant = 
                        (newData && (newData.user_id === effectiveUserId || newData.lawyer_id === effectiveUserId || (profiles.find(p=>p.id===user.id)?.role === 'admin'))) ||
                        (oldData && (oldData.user_id === effectiveUserId || oldData.lawyer_id === effectiveUserId));

                    if (isRelevant) {
                        // Special handling for new user approvals for Admin
                        if (payload.table === 'profiles' && payload.eventType === 'INSERT') {
                            const newProfile = payload.new as Profile;
                            if (!newProfile.is_approved && !newProfile.lawyer_id) {
                                addRealtimeAlert(`مستخدم جديد بانتظار الموافقة: ${newProfile.full_name}`, 'userApproval');
                            }
                        }
                        
                        // General Sync Alert
                        if (isAutoSyncEnabled) {
                            fetchAndRefresh();
                        } else {
                            addRealtimeAlert('هناك تحديثات جديدة من السحابة. اضغط للمزامنة.', 'sync');
                        }
                    }
                })
                .subscribe();

            channelRef.current = channel;
        };

        setupRealtime();

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [supabase, isOnline, user, effectiveUserId, isAutoSyncEnabled, profiles]);

    // --- Initial Load Effect ---
    React.useEffect(() => {
        let isMounted = true;
        
        const init = async () => {
            if (isAuthLoading) return;
            
            await loadSettings();
            await loadLocalData();
            
            // Only fetch from network if no data locally or we want fresh data
            if (isOnline) {
                try {
                    await manualSync();
                } catch (e) {
                    console.warn("Initial sync failed, using local data", e);
                }
            }
            
            if (isMounted) setIsDataLoading(false);
        };

        init();
        
        return () => { isMounted = false; };
    }, [user, isAuthLoading]);

    // --- Auto-Save Effect ---
    React.useEffect(() => {
        if (!isDataLoading) {
            const dataToSave: AppData = { clients, adminTasks, appointments, accountingEntries, invoices, assistants, documents, profiles, siteFinances };
            saveLocalData(dataToSave);
        }
    }, [clients, adminTasks, appointments, accountingEntries, invoices, assistants, documents, profiles, siteFinances, isDataLoading, saveLocalData]);

    // --- Settings Auto-Save Effect ---
    React.useEffect(() => {
        saveSettings();
    }, [isAutoSyncEnabled, isAutoBackupEnabled, adminTasksLayout, locationOrder]);

    // --- Periodic Cleanup Effect ---
    React.useEffect(() => {
        const timer = setInterval(() => {
            cleanupCloudStorage();
        }, 60 * 60 * 1000); // Check every hour
        
        if (isOnline && !isDataLoading) {
            cleanupCloudStorage();
        }
        
        return () => clearInterval(timer);
    }, [isOnline, cleanupCloudStorage, isDataLoading]);

    // --- Alerts Handlers ---
    const addRealtimeAlert = React.useCallback((message: string, type: 'sync' | 'userApproval' = 'sync') => {
        const newAlert = { id: Date.now(), message, type };
        if (type === 'userApproval') {
            setUserApprovalAlerts(prev => [...prev, newAlert]);
        } else {
            setRealtimeAlerts(prev => [...prev, newAlert]);
        }
    }, []);

    const dismissRealtimeAlert = (id: number) => setRealtimeAlerts(prev => prev.filter(a => a.id !== id));
    const dismissUserApprovalAlert = (id: number) => setUserApprovalAlerts(prev => prev.filter(a => a.id !== id));
    const dismissAlert = (id: string) => setTriggeredAlerts(prev => prev.filter(apt => apt.id !== id));

    // --- Document Helpers ---
    const updateDocumentState = async (docId: string, newState: CaseDocument['localState']) => {
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, localState: newState } : d));
        const db = await getDb();
        const doc = await db.get(DOCS_METADATA_STORE_NAME, docId);
        if (doc) await db.put(DOCS_METADATA_STORE_NAME, { ...doc, localState: newState });
    };

    const getDocumentFile = React.useCallback(async (docId: string): Promise<File | null> => {
        const db = await getDb();
        const doc = await db.get(DOCS_METADATA_STORE_NAME, docId) as CaseDocument;
        
        // 1. Try Local
        const fileBlob = await db.get(DOCS_FILES_STORE_NAME, docId);
        if (fileBlob && doc) {
            if (doc.localState !== 'synced' && doc.localState !== 'archived') {
                updateDocumentState(docId, 'synced');
            }
            return new File([fileBlob], doc.name, { type: doc.type });
        }

        // 2. Try Remote
        if (doc && isOnline && supabase) {
            try {
                updateDocumentState(docId, 'downloading');
                const { data, error } = await supabase.storage.from('documents').download(doc.storagePath);
                
                if (error) {
                    // Handle "Object not found" as expired
                    const errorStr = JSON.stringify(error);
                    if (errorStr.includes('Object not found') || (error as any).statusCode === '404' || (error as any).status === 404) {
                        await updateDocumentState(docId, 'expired');
                        return null;
                    }
                    throw error;
                }

                if (data) {
                    await db.put(DOCS_FILES_STORE_NAME, data, docId);
                    await updateDocumentState(docId, 'synced');
                    return new File([data], doc.name, { type: doc.type });
                }
            } catch (err: any) {
                console.error(`Download failed for ${doc.name}:`, err);
                
                // Handle empty error objects often returned by Supabase for 404s/Network issues
                if (err && Object.keys(err).length === 0) {
                     // Assume expired if we are online but get a weird empty error
                     if (isOnline) {
                         await updateDocumentState(docId, 'expired');
                         return null;
                     }
                }
                
                await updateDocumentState(docId, 'error');
            }
        } else if (doc && !isOnline) {
             // Offline and not in IDB
             await updateDocumentState(docId, 'pending_download');
        }

        return null;
    }, [isOnline, supabase]);

    const addDocuments = async (caseId: string, files: FileList) => {
        if (!user) return;
        const newDocs: CaseDocument[] = [];
        const db = await getDb();

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const docId = `doc-${Date.now()}-${i}`;
            const storagePath = `${effectiveUserId}/${caseId}/${docId}-${file.name}`;
            
            const newDoc: CaseDocument = {
                id: docId,
                caseId,
                userId: user.id,
                name: file.name,
                type: file.type,
                size: file.size,
                addedAt: new Date(),
                storagePath,
                localState: 'pending_upload', // Start as pending
            };

            // Save Metadata & File Locally immediately
            await db.put(DOCS_METADATA_STORE_NAME, newDoc);
            await db.put(DOCS_FILES_STORE_NAME, file, docId);
            setDocuments(prev => [...prev, newDoc]);
            
            // Attempt Upload
            if (isOnline && supabase) {
                try {
                    const { error } = await supabase.storage.from('documents').upload(storagePath, file);
                    if (error) throw error;
                    await updateDocumentState(docId, 'synced');
                } catch (e) {
                    console.error("Upload failed:", e);
                    await updateDocumentState(docId, 'error'); // Retry logic could be added here
                }
            }
        }
        setIsDirty(true);
    };

    const deleteDocument = async (doc: CaseDocument) => {
        const db = await getDb();
        // Delete Local
        await db.delete(DOCS_METADATA_STORE_NAME, doc.id);
        await db.delete(DOCS_FILES_STORE_NAME, doc.id);
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        
        // Mark for Remote Deletion
        setDeletedIds(prev => ({ 
            ...prev, 
            documents: [...prev.documents, doc.id],
            documentPaths: [...prev.documentPaths, doc.storagePath] 
        }));
        setIsDirty(true);
    };

    // --- Entity Deletion Handlers ---
    const deleteClient = (id: string) => {
        setClients(prev => prev.filter(c => c.id !== id));
        setDeletedIds(prev => ({ ...prev, clients: [...prev.clients, id] }));
        setIsDirty(true);
    };
    const deleteCase = (caseId: string, clientId: string) => {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, cases: c.cases.filter(cs => cs.id !== caseId) } : c));
        setDeletedIds(prev => ({ ...prev, cases: [...prev.cases, caseId] }));
        setIsDirty(true);
    };
    const deleteStage = (stageId: string, caseId: string, clientId: string) => {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, cases: c.cases.map(cs => cs.id === caseId ? { ...cs, stages: cs.stages.filter(s => s.id !== stageId) } : cs) } : c));
        setDeletedIds(prev => ({ ...prev, stages: [...prev.stages, stageId] }));
        setIsDirty(true);
    };
    const deleteSession = (sessionId: string, stageId: string, caseId: string, clientId: string) => {
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, cases: c.cases.map(cs => cs.id === caseId ? { ...cs, stages: cs.stages.map(s => s.id === stageId ? { ...s, sessions: s.sessions.filter(ss => ss.id !== sessionId) } : s) } : cs) } : c));
        setDeletedIds(prev => ({ ...prev, sessions: [...prev.sessions, sessionId] }));
        setIsDirty(true);
    };
    const deleteAdminTask = (id: string) => {
        setAdminTasks(prev => prev.filter(t => t.id !== id));
        setDeletedIds(prev => ({ ...prev, adminTasks: [...prev.adminTasks, id] }));
        setIsDirty(true);
    };
    const deleteAppointment = (id: string) => {
        setAppointments(prev => prev.filter(a => a.id !== id));
        setDeletedIds(prev => ({ ...prev, appointments: [...prev.appointments, id] }));
        setIsDirty(true);
    };
    const deleteAccountingEntry = (id: string) => {
        setAccountingEntries(prev => prev.filter(e => e.id !== id));
        setDeletedIds(prev => ({ ...prev, accountingEntries: [...prev.accountingEntries, id] }));
        setIsDirty(true);
    };
    const deleteInvoice = (id: string) => {
        setInvoices(prev => prev.filter(i => i.id !== id));
        setDeletedIds(prev => ({ ...prev, invoices: [...prev.invoices, id] }));
        setIsDirty(true);
    };
    const deleteAssistant = (name: string) => {
        setAssistants(prev => prev.filter(a => a !== name));
        setDeletedIds(prev => ({ ...prev, assistants: [...prev.assistants, name] }));
        setIsDirty(true);
    };

    // --- Complex Actions ---
    const postponeSession = (sessionId: string, newDate: Date, reason: string) => {
        setClients(prev => prev.map(client => ({
            ...client,
            cases: client.cases.map(caseItem => ({
                ...caseItem,
                stages: caseItem.stages.map(stage => {
                    const sessionIndex = stage.sessions.findIndex(s => s.id === sessionId);
                    if (sessionIndex === -1) return stage;

                    const updatedSessions = [...stage.sessions];
                    const currentSession = updatedSessions[sessionIndex];
                    
                    // Mark current as postponed
                    updatedSessions[sessionIndex] = {
                        ...currentSession,
                        isPostponed: true,
                        nextSessionDate: newDate,
                        nextPostponementReason: reason,
                        updated_at: new Date(),
                    };

                    // Create new session
                    const newSession: Session = {
                        id: `session-${Date.now()}`,
                        court: stage.court,
                        caseNumber: stage.caseNumber,
                        date: newDate,
                        clientName: client.name,
                        opponentName: caseItem.opponentName,
                        isPostponed: false,
                        postponementReason: reason,
                        assignee: currentSession.assignee, // Inherit assignee
                        updated_at: new Date(),
                        user_id: user?.id,
                    };
                    updatedSessions.push(newSession);

                    return { ...stage, sessions: updatedSessions, updated_at: new Date() };
                }),
                updated_at: new Date()
            })),
            updated_at: new Date()
        })));
        setIsDirty(true);
    };

    const setFullData = (data: any) => {
        const validated = validateAndFixData(data, user);
        setClients(validated.clients);
        setAdminTasks(validated.adminTasks);
        setAppointments(validated.appointments);
        setAccountingEntries(validated.accountingEntries);
        setInvoices(validated.invoices);
        setAssistants(validated.assistants);
        setIsDirty(true);
    };

    const exportData = () => {
        const data = { clients, adminTasks, appointments, accountingEntries, invoices, assistants };
        const jsonString = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lawyer_app_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    };

    // --- Sync Hook Integration ---
    const syncData = { clients, adminTasks, appointments, accountingEntries, invoices, assistants, documents, profiles, siteFinances };
    const { manualSync, fetchAndRefresh } = useSync({
        user: effectiveUser, // Sync using the lawyer's ID if user is an assistant
        localData: syncData,
        deletedIds,
        onDataSynced: (mergedData) => {
            setClients(mergedData.clients);
            setAdminTasks(mergedData.adminTasks);
            setAppointments(mergedData.appointments);
            setAccountingEntries(mergedData.accountingEntries);
            setInvoices(mergedData.invoices);
            setAssistants(mergedData.assistants);
            setDocuments(mergedData.documents);
            setProfiles(mergedData.profiles);
            setSiteFinances(mergedData.siteFinances);
            setIsDirty(false);
        },
        onDeletionsSynced: (syncedDeletions) => {
            setDeletedIds(prev => {
                const newDeletions = { ...prev };
                (Object.keys(syncedDeletions) as Array<keyof DeletedIds>).forEach(key => {
                    newDeletions[key] = prev[key].filter(id => !syncedDeletions[key]!.includes(id));
                });
                return newDeletions;
            });
        },
        onSyncStatusChange: (status, error) => {
            setSyncStatus(status);
            setLastSyncError(error);
        },
        isOnline,
        isAuthLoading,
        syncStatus
    });

    return {
        clients, setClients,
        adminTasks, setAdminTasks,
        appointments, setAppointments,
        accountingEntries, setAccountingEntries,
        invoices, setInvoices,
        assistants, setAssistants,
        documents, setDocuments, addDocuments, deleteDocument, getDocumentFile,
        profiles, setProfiles,
        siteFinances, setSiteFinances,
        permissions,
        
        isDataLoading,
        syncStatus,
        lastSyncError,
        isDirty,
        manualSync,
        fetchAndRefresh,
        
        deleteClient, deleteCase, deleteStage, deleteSession, deleteAdminTask, deleteAppointment, deleteAccountingEntry, deleteInvoice, deleteAssistant,
        postponeSession,
        setFullData, exportData,
        
        isAutoSyncEnabled, setAutoSyncEnabled,
        isAutoBackupEnabled, setAutoBackupEnabled,
        adminTasksLayout, setAdminTasksLayout,
        locationOrder, setLocationOrder,
        
        showUnpostponedSessionsModal, setShowUnpostponedSessionsModal,
        triggeredAlerts, dismissAlert,
        realtimeAlerts, dismissRealtimeAlert, addRealtimeAlert,
        userApprovalAlerts, dismissUserApprovalAlert,
        userId: user?.id,
        allSessions, // Exposed for App.tsx usage
        unpostponedSessions, // Exposed for App.tsx usage
    };
};
