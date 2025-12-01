
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
        adminTasks: safeArray(loadedData.adminTasks, (task, index) => {
            if (!isValidObject(task) || !task.id) return undefined;
            return {
                id: String(task.id),
                task: String(task.task || ''),
                dueDate: reviveDate(task.dueDate),
                completed: !!task.completed,
                importance: ['normal', 'important', 'urgent'].includes(task.importance) ? task.importance : 'normal',
                assignee: task.assignee,
                location: task.location,
                updated_at: reviveDate(task.updated_at),
                orderIndex: typeof task.orderIndex === 'number' ? task.orderIndex : index,
            };
        }),
        appointments: safeArray(loadedData.appointments, (apt) => {
            if (!isValidObject(apt) || !apt.id) return undefined;
            return {
                id: String(apt.id),
                title: String(apt.title || ''),
                time: String(apt.time || '00:00'),
                date: reviveDate(apt.date),
                importance: ['normal', 'important', 'urgent'].includes(apt.importance) ? apt.importance : 'normal',
                completed: !!apt.completed,
                notified: !!apt.notified,
                reminderTimeInMinutes: Number(apt.reminderTimeInMinutes || 15),
                assignee: apt.assignee,
                updated_at: reviveDate(apt.updated_at),
            };
        }),
        accountingEntries: safeArray(loadedData.accountingEntries, (entry) => {
            if (!isValidObject(entry) || !entry.id) return undefined;
            return {
                id: String(entry.id),
                type: ['income', 'expense'].includes(entry.type) ? entry.type : 'income',
                amount: Number(entry.amount || 0),
                date: reviveDate(entry.date),
                description: String(entry.description || ''),
                clientId: String(entry.clientId || ''),
                caseId: String(entry.caseId || ''),
                clientName: String(entry.clientName || ''),
                updated_at: reviveDate(entry.updated_at),
            };
        }),
        invoices: safeArray(loadedData.invoices, (invoice) => {
            if (!isValidObject(invoice) || !invoice.id) return undefined;
            return {
                id: String(invoice.id),
                clientId: String(invoice.clientId || ''),
                clientName: String(invoice.clientName || ''),
                caseId: invoice.caseId,
                caseSubject: invoice.caseSubject,
                issueDate: reviveDate(invoice.issueDate),
                dueDate: reviveDate(invoice.dueDate),
                items: safeArray(invoice.items, (item) => {
                    if (!isValidObject(item) || !item.id) return undefined;
                    return {
                        id: String(item.id),
                        description: String(item.description || ''),
                        amount: Number(item.amount || 0),
                        updated_at: reviveDate(item.updated_at),
                    };
                }),
                taxRate: Number(invoice.taxRate || 0),
                discount: Number(invoice.discount || 0),
                status: ['draft', 'sent', 'paid', 'overdue'].includes(invoice.status) ? invoice.status : 'draft',
                notes: invoice.notes,
                updated_at: reviveDate(invoice.updated_at),
            };
        }),
        assistants: validateAssistantsList(loadedData.assistants),
        documents: safeArray(loadedData.documents, (doc) => validateDocuments(doc, userId)),
        profiles: safeArray(loadedData.profiles, (p) => {
            if (!isValidObject(p) || !p.id) return undefined;
            return {
                id: String(p.id),
                full_name: String(p.full_name || ''),
                mobile_number: String(p.mobile_number || ''),
                is_approved: !!p.is_approved,
                is_active: p.is_active !== false,
                mobile_verified: !!p.mobile_verified,
                otp_code: p.otp_code,
                otp_expires_at: p.otp_expires_at,
                subscription_start_date: p.subscription_start_date || null,
                subscription_end_date: p.subscription_end_date || null,
                role: ['user', 'admin'].includes(p.role) ? p.role : 'user',
                lawyer_id: p.lawyer_id || null, 
                permissions: p.permissions || undefined, 
                created_at: p.created_at,
                updated_at: reviveDate(p.updated_at),
            };
        }),
        siteFinances: safeArray(loadedData.siteFinances, (sf) => {
            if (!isValidObject(sf) || !sf.id) return undefined;
            return {
                id: Number(sf.id),
                user_id: sf.user_id || null,
                type: ['income', 'expense'].includes(sf.type) ? sf.type : 'income',
                payment_date: String(sf.payment_date || ''),
                amount: Number(sf.amount || 0),
                description: sf.description || null,
                payment_method: sf.payment_method || null,
                category: sf.category,
                profile_full_name: sf.profile_full_name,
                updated_at: reviveDate(sf.updated_at),
            };
        }),
    };
};

// --- Image Compression Utility ---
const compressImage = async (file: File): Promise<File> => {
    // Only compress images
    if (!file.type.startsWith('image/')) return file;
    // Don't compress small images (< 300KB)
    if (file.size < 300 * 1024) return file;

    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };
        reader.onerror = (e) => reject(e);

        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Max dimension (e.g., 1920px is enough for documents)
            const MAX_WIDTH = 1920;
            const MAX_HEIGHT = 1920;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file); // Fallback
                return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (blob) {
                    // Create new file with compressed data
                    const compressedFile = new File([blob], file.name, {
                        type: 'image/jpeg', // Standardize to JPEG for better compression
                        lastModified: Date.now(),
                    });
                    console.log(`Compressed: ${(file.size/1024).toFixed(0)}KB -> ${(compressedFile.size/1024).toFixed(0)}KB`);
                    resolve(compressedFile);
                } else {
                    resolve(file); // Fallback
                }
            }, 'image/jpeg', 0.7); // 0.7 Quality is good for documents
        };
        
        reader.readAsDataURL(file);
    });
};

// Helper function to robustly extract error messages
const extractErrorMessage = (e: any): string => {
    if (!e) return 'Unknown Error';
    if (typeof e === 'string') return e;
    if (e instanceof Error) return e.message;
    
    if (typeof e === 'object') {
        // Prioritize explicit message properties
        if (e.message) return e.message;
        if (e.error_description) return e.error_description;
        if (typeof e.error === 'string') return e.error; 
        
        // Check for status codes
        if (e.statusCode === 404 || e.status === 404) return 'File not found on server (404)';
        if (e.statusCode === '404') return 'File not found on server (404)';
        
        // Fallback: Try to stringify, but prevent "{}"
        try {
            const json = JSON.stringify(e);
            if (json !== '{}') return json;
        } catch {}
        
        return 'Unknown Error Object (Check Console)';
    }
    return String(e);
};

export const useSupabaseData = (user: User | null, isAuthLoading: boolean) => {
    const [data, setData] = React.useState<AppData>(getInitialData);
    const [deletedIds, setDeletedIds] = React.useState<DeletedIds>(getInitialDeletedIds);
    const [isDirty, setDirty] = React.useState(false);
    const [syncStatus, setSyncStatus] = React.useState<SyncStatus>('loading');
    const [lastSyncError, setLastSyncError] = React.useState<string | null>(null);
    const [isDataLoading, setIsDataLoading] = React.useState(true);
    const [triggeredAlerts, setTriggeredAlerts] = React.useState<Appointment[]>([]);
    const [showUnpostponedSessionsModal, setShowUnpostponedSessionsModal] = React.useState(false);
    const [realtimeAlerts, setRealtimeAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userApprovalAlerts, setUserApprovalAlerts] = React.useState<RealtimeAlert[]>([]);
    const [userSettings, setUserSettings] = React.useState<any>({ isAutoSyncEnabled: true, isAutoBackupEnabled: true, adminTasksLayout: 'horizontal', locationOrder: [] });
    const isOnline = useOnlineStatus();
    
    const userRef = React.useRef(user);
    userRef.current = user;

    // --- EFFECTIVE USER ID LOGIC (CACHE FIRST) ---
    const [effectiveUserId, setEffectiveUserId] = React.useState<string | null>(() => {
        if (!user) return null;
        try {
            if (typeof window !== 'undefined') {
                return localStorage.getItem(`lawyer_app_owner_${user.id}`) || user.id;
            }
        } catch (e) {
            console.warn("LocalStorage access failed (possibly disabled)", e);
        }
        return user.id;
    });

    // Background: Determine effective ID from loaded profile data
    React.useEffect(() => {
        if (!user) return;
        const currentUserProfile = data.profiles.find(p => p.id === user.id);
        
        let newOwnerId = user.id;
        
        if (currentUserProfile) {
            if (currentUserProfile.lawyer_id) {
                newOwnerId = currentUserProfile.lawyer_id;
            }
        }

        if (newOwnerId !== effectiveUserId) {
            console.log("Detected new data owner ID, updating context...", newOwnerId);
            setEffectiveUserId(newOwnerId);
            try {
                localStorage.setItem(`lawyer_app_owner_${user.id}`, newOwnerId);
            } catch(e) {
                console.warn("Failed to cache owner ID", e);
            }
        }
    }, [user, data.profiles, effectiveUserId]);

    // Current user's permissions logic...
    const currentUserPermissions: Permissions = React.useMemo(() => {
        if (!user) return defaultPermissions;
        const currentUserProfile = data.profiles.find(p => p.id === user.id);
        if (currentUserProfile && currentUserProfile.lawyer_id) {
            return { ...defaultPermissions, ...currentUserProfile.permissions };
        }
        return {
            can_view_agenda: true,
            can_view_clients: true,
            can_add_client: true,
            can_edit_client: true,
            can_delete_client: true,
            can_view_cases: true,
            can_add_case: true,
            can_edit_case: true,
            can_delete_case: true,
            can_view_sessions: true,
            can_add_session: true,
            can_edit_session: true,
            can_delete_session: true,
            can_postpone_session: true,
            can_decide_session: true,
            can_view_documents: true,
            can_add_document: true,
            can_delete_document: true,
            can_view_finance: true,
            can_add_financial_entry: true,
            can_delete_financial_entry: true,
            can_manage_invoices: true,
            can_view_admin_tasks: true,
            can_add_admin_task: true,
            can_edit_admin_task: true,
            can_delete_admin_task: true,
            can_view_reports: true,
        };
    }, [user, data.profiles]);

    // Update Data function
    const updateData = React.useCallback((updater: React.SetStateAction<AppData>) => {
        if (!userRef.current || !effectiveUserId) return;
        
        setData(currentData => {
            const newData = typeof updater === 'function' ? (updater as (prevState: AppData) => AppData)(currentData) : updater;
            getDb().then(db => {
                db.put(DATA_STORE_NAME, newData, effectiveUserId);
            }).catch(err => console.error("DB Write Error (Safe to ignore)", err));
            setDirty(true);
            return newData;
        });
    }, [effectiveUserId]); 

    const setFullData = React.useCallback(async (newData: any) => {
        const validated = validateAndFixData(newData, userRef.current);
        updateData(validated);
    }, [updateData]);

    // Settings Load
    React.useEffect(() => {
        const settingsKey = `userSettings_${user?.id}`;
        try {
            const storedSettings = localStorage.getItem(settingsKey);
            if (storedSettings) {
                setUserSettings(JSON.parse(storedSettings));
            }
        } catch (e) {
            console.error("Failed to load user settings", e);
        }
    }, [user?.id]);

    const updateSettings = (updater: (prev: any) => any) => {
        const newSettings = updater(userSettings);
        setUserSettings(newSettings);
        try {
            const settingsKey = `userSettings_${user?.id}`;
            localStorage.setItem(settingsKey, JSON.stringify(newSettings));
        } catch (e) { console.warn("Failed to save settings", e); }
    };

    // --- MAIN DATA LOADING EFFECT (INSTANT LOAD) ---
    React.useEffect(() => {
        if (!user || isAuthLoading) {
            if (!isAuthLoading) setIsDataLoading(false);
            return;
        }

        if (data.clients.length === 0 && data.profiles.length === 0) setIsDataLoading(true);

        let cancelled = false;

        const loadData = async () => {
            // Use cached effectiveUserId for instant load
            const ownerId = effectiveUserId || user.id;

            try {
                const db = await getDb();
                const [storedData, storedDeletedIds, localDocsMetadata] = await Promise.all([
                    db.get(DATA_STORE_NAME, ownerId),
                    db.get(DATA_STORE_NAME, `deletedIds_${ownerId}`),
                    db.getAll(DOCS_METADATA_STORE_NAME)
                ]);
                
                if (cancelled) return;

                // Process and Render Data IMMEDIATELY
                const validatedData = validateAndFixData(storedData, user);
                const localDocsMetadataMap = new Map((localDocsMetadata as any[]).map((meta: any) => [meta.id, meta]));
                const finalDocs = validatedData.documents.map(doc => {
                    const localMeta: any = localDocsMetadataMap.get(doc.id);
                    return { ...doc, localState: localMeta?.localState || doc.localState || 'pending_download' };
                }).filter(doc => !!doc) as CaseDocument[];
                
                const finalData = { ...validatedData, documents: finalDocs };

                setData(finalData);
                setDeletedIds(storedDeletedIds || getInitialDeletedIds());
                
                // HIDE LOADER IMMEDIATELY
                setIsDataLoading(false); 

                if (!navigator.onLine) {
                    setSyncStatus('synced');
                }

            } catch (error) {
                console.error('Failed to load local data:', error);
                setSyncStatus('error');
                setLastSyncError('فشل تحميل البيانات المحلية.');
                setIsDataLoading(false);
            }
        };

        loadData();
        return () => { cancelled = true; };
    }, [user, isAuthLoading]); 
    
    // Reload data if effectiveUserId changes
    React.useEffect(() => {
        if (!user || isAuthLoading || isDataLoading) return;
        const reloadForNewOwner = async () => {
             const ownerId = effectiveUserId || user.id;
             console.log("Reloading data for new owner:", ownerId);
             try {
                 const db = await getDb();
                 const storedData = await db.get(DATA_STORE_NAME, ownerId);
                 const validatedData = validateAndFixData(storedData, user);
                 setData(prev => ({...validatedData, documents: prev.documents})); 
             } catch (e) {
                 console.error("Failed to reload for new owner", e);
             }
        };
        reloadForNewOwner();
    }, [effectiveUserId]);


    // Sync Status Callback
    const handleSyncStatusChange = React.useCallback((status: SyncStatus, error: string | null) => {
        setSyncStatus(status);
        setLastSyncError(error);
    }, []);

    const handleDataSynced = React.useCallback(async (mergedData: AppData) => {
        if (!effectiveUserId) return;
        try {
            const validatedMergedData = validateAndFixData(mergedData, userRef.current);
            const db = await getDb();
            const localDocsMetadata = await db.getAll(DOCS_METADATA_STORE_NAME);
            
            // 1. Process merged documents from Sync
            const syncedDocsIds = new Set(validatedMergedData.documents.map(d => d.id));
            
            let finalDocs = safeArray(validatedMergedData.documents, (doc: any) => {
                if (!doc || typeof doc !== 'object' || !doc.id) return undefined;
                const localMeta = (localDocsMetadata as any[]).find((meta: any) => meta.id === doc.id);
                // Keep local state if available, otherwise default to pending_download
                const mergedDoc = {
                    ...doc,
                    localState: localMeta?.localState || doc.localState || 'pending_download'
                };
                return validateDocuments(mergedDoc, userRef.current?.id || '');
            });

            // 2. SAFETY CHECK: Re-inject local-only documents that might have been dropped by Sync
            // Use a Map for faster lookup and merging
            const finalDocsMap = new Map(finalDocs.map(d => [d.id, d]));

            (localDocsMetadata as any[]).forEach((localMeta: any) => {
                // If it's pending upload or error (failed upload), and not in the synced list
                if ((localMeta.localState === 'pending_upload' || localMeta.localState === 'error') && !syncedDocsIds.has(localMeta.id)) {
                    if (!finalDocsMap.has(localMeta.id)) {
                        const restoredDoc = validateDocuments(localMeta, userRef.current?.id || '');
                        if (restoredDoc) {
                            console.log(`Restoring pending document: ${restoredDoc.name}`);
                            finalDocsMap.set(localMeta.id, restoredDoc);
                        }
                    }
                }
            });
            
            finalDocs = Array.from(finalDocsMap.values());

            const finalData = { ...validatedMergedData, documents: finalDocs };

            await db.put(DATA_STORE_NAME, finalData, effectiveUserId);
            setData(finalData);
            setDirty(false);
        } catch (e) {
            console.error("Critical error in handleDataSynced:", e);
            handleSyncStatusChange('error', 'فشل تحديث البيانات المحلية بعد المزامنة.');
        }
    }, [userRef, effectiveUserId, handleSyncStatusChange]);
    
    const handleDeletionsSynced = React.useCallback(async (syncedDeletions: Partial<DeletedIds>) => {
        if (!effectiveUserId) return;
        const newDeletedIds = { ...deletedIds };
        let changed = false;
        for (const key of Object.keys(syncedDeletions) as Array<keyof DeletedIds>) {
            const synced = new Set((syncedDeletions[key] || []) as any[]);
            if (synced.size > 0) {
                newDeletedIds[key] = newDeletedIds[key].filter(id => !synced.has(id as any));
                changed = true;
            }
        }
        if (changed) {
            setDeletedIds(newDeletedIds);
            const db = await getDb();
            await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`);
        }
    }, [deletedIds, effectiveUserId]);

    // Use Sync Hook
    const { manualSync, fetchAndRefresh } = useSync({
        user: userRef.current ? { ...userRef.current, id: effectiveUserId || userRef.current.id } as User : null,
        localData: data, 
        deletedIds,
        onDataSynced: handleDataSynced,
        onDeletionsSynced: handleDeletionsSynced,
        onSyncStatusChange: handleSyncStatusChange,
        isOnline, isAuthLoading, syncStatus
    });

    // Background Sync Trigger
    React.useEffect(() => {
        if (!isDataLoading && isOnline && user) {
            const timer = setTimeout(() => {
                fetchAndRefresh();
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [isDataLoading, isOnline, user]); 

    // Supabase Realtime Subscription
    React.useEffect(() => {
        if (!isOnline || !user) return;
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const channel = supabase.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                if (payload.table === 'sync_deletions') return; 
                const record = payload.new as any || payload.old as any;
                const relevantId = effectiveUserId || user.id;
                
                if (record && (record.user_id === relevantId || record.lawyer_id === relevantId || record.id === relevantId)) {
                    console.log('Realtime change detected, refreshing...');
                    fetchAndRefresh();
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [isOnline, user, effectiveUserId, fetchAndRefresh]);

    // Auto Sync
    React.useEffect(() => {
        if (isOnline && isDirty && userSettings.isAutoSyncEnabled && syncStatus !== 'syncing') {
            const handler = setTimeout(() => { manualSync(); }, 3000);
            return () => clearTimeout(handler);
        }
    }, [isOnline, isDirty, userSettings.isAutoSyncEnabled, syncStatus, manualSync]);

    const addRealtimeAlert = React.useCallback((message: string, type: 'sync' | 'userApproval' = 'sync') => {
        setRealtimeAlerts(prev => [...prev, { id: Date.now(), message, type }]);
    }, []);

    const createDeleteFunction = <T extends keyof DeletedIds>(entity: T) => async (id: DeletedIds[T][number]) => {
        if (!effectiveUserId) return;
        const db = await getDb();
        const newDeletedIds = { ...deletedIds, [entity]: [...deletedIds[entity], id] };
        setDeletedIds(newDeletedIds);
        await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`);
        setDirty(true);
    };

    // --- AUTO-UPLOAD BACKGROUND SERVICE ---
    // Automatically upload files that are pending upload
    React.useEffect(() => {
        if (!isOnline || !user) return;

        const uploadNext = async () => {
            // Find a document that needs uploading
            // We verify it has a valid ID and storagePath to be safe
            const pendingDoc = data.documents.find(d => d.localState === 'pending_upload' && d.storagePath);
            
            if (!pendingDoc) return;

            console.log(`Starting background upload for: ${pendingDoc.name}`);
            const db = await getDb();
            const file = await db.get(DOCS_FILES_STORE_NAME, pendingDoc.id);
            
            if (!file) {
                console.warn(`File content missing locally for ${pendingDoc.name}. Marking as error.`);
                const errorDoc = { ...pendingDoc, localState: 'error' };
                await db.put(DOCS_METADATA_STORE_NAME, errorDoc, pendingDoc.id);
                updateData(p => ({...p, documents: p.documents.map(d => d.id === pendingDoc.id ? errorDoc as CaseDocument : d)}));
                return;
            }

            const supabase = getSupabaseClient();
            if (!supabase) return;

            try {
                // Perform Upload
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(pendingDoc.storagePath, file, {
                        cacheControl: '3600',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                console.log(`Upload successful: ${pendingDoc.name}`);
                
                // Update state to Synced
                const syncedDoc = { ...pendingDoc, localState: 'synced' };
                await db.put(DOCS_METADATA_STORE_NAME, syncedDoc, pendingDoc.id);
                updateData(p => ({...p, documents: p.documents.map(d => d.id === pendingDoc.id ? syncedDoc as CaseDocument : d)}));

            } catch (e: any) {
                let errorMsg = e.message || 'Upload failed';
                console.error(`Upload failed for ${pendingDoc.name}:`, errorMsg);
                
                // Mark as error to stop the loop for this specific file
                const errorDoc = { ...pendingDoc, localState: 'error' };
                await db.put(DOCS_METADATA_STORE_NAME, errorDoc, pendingDoc.id);
                updateData(p => ({...p, documents: p.documents.map(d => d.id === pendingDoc.id ? errorDoc as CaseDocument : d)}));
            }
        };

        // Check for uploads every 2 seconds to avoid flooding
        const timer = setTimeout(uploadNext, 2000);
        return () => clearTimeout(timer);
    }, [data.documents, isOnline, user, updateData]);

    // Define getDocumentFile BEFORE it is used in the auto-download effect to prevent hoisting issues
    const getDocumentFile = React.useCallback(async (docId: string): Promise<File | null> => {
        const db = await getDb();
        const supabase = getSupabaseClient();
        const doc = data.documents.find(d => d.id === docId);
        if (!doc) return null;
        
        const localFile = await db.get(DOCS_FILES_STORE_NAME, docId);
        if (localFile) return localFile;
        
        if (!isOnline || !supabase) return null;
        
        // Safety Check: Missing storage path
        if (!doc.storagePath) {
             console.error(`Download failed for ${doc.name}: Storage path is missing in metadata.`);
             await db.put(DOCS_METADATA_STORE_NAME, { ...doc, localState: 'error' }, doc.id);
             updateData(p => ({...p, documents: p.documents.map(d => d.id === docId ? {...d, localState: 'error'} : d)}));
             return null;
        }

        if (doc.localState === 'pending_download' || doc.localState === 'error') {
            try {
                updateData(p => ({...p, documents: p.documents.map(d => d.id === docId ? {...d, localState: 'downloading' } : d)}));
                
                const { data: blob, error } = await supabase.storage.from('documents').download(doc.storagePath);
                
                if (error) throw error;
                if (!blob) throw new Error("Empty blob received");
                
                const downloadedFile = new File([blob], doc.name, { type: doc.type });
                
                await db.put(DOCS_FILES_STORE_NAME, downloadedFile, doc.id);
                await db.put(DOCS_METADATA_STORE_NAME, { ...doc, localState: 'synced' }, doc.id);
                
                updateData(p => ({...p, documents: p.documents.map(d => d.id === docId ? {...d, localState: 'synced'} : d)}));
                
                return downloadedFile;
            } catch (e: any) {
                const errorMsg = extractErrorMessage(e);

                // Suppress console spam for common network issues
                const isNetworkError = errorMsg.toLowerCase().includes('failed to fetch') || errorMsg.toLowerCase().includes('network');
                const isNotFound = errorMsg.toLowerCase().includes('not found') || errorMsg.includes('404');

                if (isNetworkError) {
                    console.debug(`Download paused for ${doc.name}: Network unavailable.`);
                } else if (isNotFound) {
                    console.warn(`Download failed for ${doc.name}: File not found on server.`);
                } else {
                    console.error(`Download failed for ${doc.name}: ${errorMsg}`);
                }
                
                // Persist error state
                await db.put(DOCS_METADATA_STORE_NAME, { ...doc, localState: 'error' }, doc.id);
                updateData(p => ({...p, documents: p.documents.map(d => d.id === docId ? {...d, localState: 'error'} : d)}));
            }
        }
        return null;
    }, [data.documents, isOnline, updateData]);


    // --- AUTO-DOWNLOAD BACKGROUND SERVICE (WhatsApp Style) ---
    React.useEffect(() => {
        if (!isOnline || !user || isDataLoading) return;

        // Prevent parallel downloads
        const isDownloading = data.documents.some(d => d.localState === 'downloading');
        if (isDownloading) return;

        // Find the first document that needs downloading
        const pendingDoc = data.documents.find(d => d.localState === 'pending_download');

        if (pendingDoc) {
            console.log(`Auto-downloading document: ${pendingDoc.name}`);
            
            const timer = setTimeout(() => {
                getDocumentFile(pendingDoc.id).catch(() => {
                    // Errors are handled inside getDocumentFile
                });
            }, 1500); // Slightly increased delay

            return () => clearTimeout(timer);
        }
    }, [data.documents, isOnline, user, isDataLoading, getDocumentFile]); 

    // ... (rest of the hook matches previous structure with image compression in addDocuments)
    return {
        ...data,
        setClients: (updater) => updateData(prev => ({ ...prev, clients: typeof updater === 'function' ? (updater as (p: Client[]) => Client[])(prev.clients) : updater })),
        setAdminTasks: (updater) => updateData(prev => ({ ...prev, adminTasks: typeof updater === 'function' ? (updater as (p: AdminTask[]) => AdminTask[])(prev.adminTasks) : updater })),
        setAppointments: (updater) => updateData(prev => ({ ...prev, appointments: typeof updater === 'function' ? (updater as (p: Appointment[]) => Appointment[])(prev.appointments) : updater })),
        setAccountingEntries: (updater) => updateData(prev => ({ ...prev, accountingEntries: typeof updater === 'function' ? (updater as (p: AccountingEntry[]) => AccountingEntry[])(prev.accountingEntries) : updater })),
        setInvoices: (updater) => updateData(prev => ({ ...prev, invoices: typeof updater === 'function' ? (updater as (p: Invoice[]) => Invoice[])(prev.invoices) : updater })),
        setAssistants: (updater) => updateData(prev => ({ ...prev, assistants: typeof updater === 'function' ? (updater as (p: string[]) => string[])(prev.assistants) : updater })),
        setDocuments: (updater) => updateData(prev => ({ ...prev, documents: typeof updater === 'function' ? (updater as (p: CaseDocument[]) => CaseDocument[])(prev.documents) : updater })),
        setProfiles: (updater) => updateData(prev => ({ ...prev, profiles: typeof updater === 'function' ? (updater as (p: Profile[]) => Profile[])(prev.profiles) : updater })),
        setSiteFinances: (updater) => updateData(prev => ({ ...prev, siteFinances: typeof updater === 'function' ? (updater as (p: SiteFinancialEntry[]) => SiteFinancialEntry[])(prev.siteFinances) : updater })),
        setFullData,
        allSessions: React.useMemo(() => data.clients.flatMap(c => c.cases.flatMap(cs => cs.stages.flatMap(st => st.sessions.map(s => ({...s, stageId: st.id, stageDecisionDate: st.decisionDate}))))), [data.clients]),
        unpostponedSessions: React.useMemo(() => {
            return data.clients.flatMap(c => c.cases.flatMap(cs => cs.stages.flatMap(st => st.sessions.filter(s => !s.isPostponed && isBeforeToday(s.date) && !st.decisionDate).map(s => ({...s, stageId: st.id, stageDecisionDate: st.decisionDate})))));
        }, [data.clients]),
        syncStatus, manualSync, lastSyncError, isDirty, userId: user?.id, isDataLoading,
        effectiveUserId,
        permissions: currentUserPermissions,
        isAutoSyncEnabled: userSettings.isAutoSyncEnabled, setAutoSyncEnabled: (v: boolean) => updateSettings(p => ({...p, isAutoSyncEnabled: v})),
        isAutoBackupEnabled: userSettings.isAutoBackupEnabled, setAutoBackupEnabled: (v: boolean) => updateSettings(p => ({...p, isAutoBackupEnabled: v})),
        adminTasksLayout: userSettings.adminTasksLayout, setAdminTasksLayout: (v: any) => updateSettings(p => ({...p, adminTasksLayout: v})),
        locationOrder: userSettings.locationOrder, setLocationOrder: (v: any) => updateSettings(p => ({...p, locationOrder: v})),
        exportData: React.useCallback(() => {
             try {
                const dataToExport = { ...data, profiles: undefined, siteFinances: undefined };
                const jsonString = JSON.stringify(dataToExport, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url;
                a.download = `lawyer_app_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                return true;
            } catch (e) { console.error(e); return false; }
        }, [data]),
        triggeredAlerts, dismissAlert: (id: string) => setTriggeredAlerts(p => p.filter(a => a.id !== id)),
        realtimeAlerts, dismissRealtimeAlert: (id: number) => setRealtimeAlerts(p => p.filter(a => a.id !== id)),
        addRealtimeAlert,
        userApprovalAlerts, dismissUserApprovalAlert: (id: number) => setUserApprovalAlerts(p => p.filter(a => a.id !== id)),
        showUnpostponedSessionsModal, setShowUnpostponedSessionsModal,
        fetchAndRefresh,
        deleteClient: (id: string) => { updateData(p => ({ ...p, clients: p.clients.filter(c => c.id !== id) })); createDeleteFunction('clients')(id); },
        deleteCase: async (caseId: string, clientId: string) => {
             const docsToDelete = data.documents.filter(doc => doc.caseId === caseId);
             const docIdsToDelete = docsToDelete.map(doc => doc.id);
             const docPathsToDelete = docsToDelete.map(doc => doc.storagePath).filter(Boolean);
             updateData(p => {
                const updatedClients = p.clients.map(c => c.id === clientId ? { ...c, cases: c.cases.filter(cs => cs.id !== caseId) } : c);
                return { ...p, clients: updatedClients, documents: p.documents.filter(doc => doc.caseId !== caseId) };
             });
             if (effectiveUserId) {
                 const db = await getDb();
                 const newDeletedIds = { ...deletedIds, cases: [...deletedIds.cases, caseId], documents: [...deletedIds.documents, ...docIdsToDelete], documentPaths: [...deletedIds.documentPaths, ...docPathsToDelete] };
                 setDeletedIds(newDeletedIds);
                 await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`);
                 setDirty(true);
             }
        },
        deleteStage: (sid: string, cid: string, clid: string) => { updateData(p => ({ ...p, clients: p.clients.map(c => c.id === clid ? { ...c, cases: c.cases.map(cs => cs.id === cid ? { ...cs, stages: cs.stages.filter(st => st.id !== sid) } : cs) } : c) })); createDeleteFunction('stages')(sid); },
        deleteSession: (sessId: string, stId: string, cid: string, clid: string) => { updateData(p => ({ ...p, clients: p.clients.map(c => c.id === clid ? { ...c, cases: c.cases.map(cs => cs.id === cid ? { ...cs, stages: cs.stages.map(st => st.id === stId ? { ...st, sessions: st.sessions.filter(s => s.id !== sessId) } : st) } : cs) } : c) })); createDeleteFunction('sessions')(sessId); },
        deleteAdminTask: (id: string) => { updateData(p => ({...p, adminTasks: p.adminTasks.filter(t => t.id !== id)})); createDeleteFunction('adminTasks')(id); },
        deleteAppointment: (id: string) => { updateData(p => ({...p, appointments: p.appointments.filter(a => a.id !== id)})); createDeleteFunction('appointments')(id); },
        deleteAccountingEntry: (id: string) => { updateData(p => ({...p, accountingEntries: p.accountingEntries.filter(e => e.id !== id)})); createDeleteFunction('accountingEntries')(id); },
        deleteInvoice: (id: string) => { updateData(p => ({...p, invoices: p.invoices.filter(i => i.id !== id)})); createDeleteFunction('invoices')(id); },
        deleteAssistant: (name: string) => { updateData(p => ({...p, assistants: p.assistants.filter(a => a !== name)})); createDeleteFunction('assistants')(name); },
        deleteDocument: async (doc: CaseDocument) => {
            const db = await getDb();
            await db.delete(DOCS_FILES_STORE_NAME, doc.id);
            await db.delete(DOCS_METADATA_STORE_NAME, doc.id);
            updateData(p => ({ ...p, documents: p.documents.filter(d => d.id !== doc.id) }));
            if(effectiveUserId) {
                const newDeletedIds = { ...deletedIds, documents: [...deletedIds.documents, doc.id], documentPaths: [...deletedIds.documentPaths, doc.storagePath] };
                setDeletedIds(newDeletedIds);
                await db.put(DATA_STORE_NAME, newDeletedIds, `deletedIds_${effectiveUserId}`);
            }
        },
        addDocuments: async (caseId: string, files: FileList) => {
             const db = await getDb();
             const newDocs: CaseDocument[] = [];
             
             // Process files sequentially to handle compression
             for (let i = 0; i < files.length; i++) {
                 let file = files[i];
                 
                 try {
                     // Attempt compression
                     file = await compressImage(file);
                 } catch (e) {
                     console.warn("Image compression failed, using original file", e);
                 }

                 const docId = `doc-${Date.now()}-${i}`;
                 const lastDot = file.name.lastIndexOf('.');
                 const extension = lastDot !== -1 ? file.name.substring(lastDot) : '';
                 // Normalize extension for compressed images
                 const finalExtension = file.type === 'image/jpeg' && extension !== '.jpg' && extension !== '.jpeg' ? '.jpg' : extension;
                 
                 const safeStoragePath = `${effectiveUserId || user!.id}/${caseId}/${docId}${finalExtension}`;
                 
                 const doc: CaseDocument = {
                     id: docId, 
                     caseId, 
                     userId: effectiveUserId || user!.id, 
                     name: file.name, 
                     type: file.type || 'application/octet-stream', 
                     size: file.size, 
                     addedAt: new Date(), 
                     storagePath: safeStoragePath, 
                     localState: 'pending_upload', 
                     updated_at: new Date(),
                 };
                 
                 await db.put(DOCS_FILES_STORE_NAME, file, doc.id);
                 await db.put(DOCS_METADATA_STORE_NAME, doc, doc.id);
                 newDocs.push(doc);
             }
             updateData(p => ({...p, documents: [...p.documents, ...newDocs]}));
        },
        getDocumentFile,
        postponeSession: (sessionId: string, newDate: Date, newReason: string) => {
             updateData(prev => {
                 const newClients = prev.clients.map(client => {
                    let clientModified = false;
                    const newCases = client.cases.map(caseItem => {
                        let caseModified = false;
                        const newStages = caseItem.stages.map(stage => {
                            const sessionIndex = stage.sessions.findIndex(s => s.id === sessionId);
                            if (sessionIndex !== -1) {
                                const oldSession = stage.sessions[sessionIndex];
                                const newSession: Session = { id: `session-${Date.now()}`, court: oldSession.court, caseNumber: oldSession.caseNumber, date: newDate, clientName: oldSession.clientName, opponentName: oldSession.opponentName, postponementReason: newReason, isPostponed: false, assignee: oldSession.assignee, updated_at: new Date(), user_id: oldSession.user_id };
                                const updatedOldSession: Session = { ...oldSession, isPostponed: true, nextSessionDate: newDate, nextPostponementReason: newReason, updated_at: new Date() };
                                const newSessions = [...stage.sessions]; newSessions[sessionIndex] = updatedOldSession; newSessions.push(newSession);
                                caseModified = true; clientModified = true;
                                return { ...stage, sessions: newSessions, updated_at: new Date() };
                            }
                            return stage;
                        });
                        if (caseModified) return { ...caseItem, stages: newStages, updated_at: new Date() };
                        return caseItem;
                    });
                    if (clientModified) return { ...client, cases: newCases, updated_at: new Date() };
                    return client;
                });
                return newClients.some((c, i) => c !== prev.clients[i]) ? { ...prev, clients: newClients } : prev;
             });
        }
    };
};
