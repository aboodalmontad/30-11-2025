
import * as React from 'react';
// Fix: Use `import type` for User as it is used as a type, not a value. This resolves module resolution errors in some environments.
import type { User } from '@supabase/supabase-js';
import { checkSupabaseSchema, fetchDataFromSupabase, upsertDataToSupabase, FlatData, deleteDataFromSupabase, fetchDeletionsFromSupabase } from './useOnlineData';
import { getSupabaseClient } from '../supabaseClient';
import { Client, Case, Stage, Session, CaseDocument, AppData, DeletedIds, getInitialDeletedIds, SyncDeletion } from '../types';

export type SyncStatus = 'loading' | 'syncing' | 'synced' | 'error' | 'unconfigured' | 'uninitialized';


interface UseSyncProps {
    user: User | null;
    localData: AppData;
    deletedIds: DeletedIds;
    onDataSynced: (mergedData: AppData) => void;
    onDeletionsSynced: (syncedDeletions: Partial<DeletedIds>) => void;
    onSyncStatusChange: (status: SyncStatus, error: string | null) => void;
    isOnline: boolean;
    isAuthLoading: boolean;
    syncStatus: SyncStatus;
}

const flattenData = (data: AppData): FlatData => {
    const cases = data.clients.flatMap(c => c.cases.map(cs => ({ ...cs, client_id: c.id })));
    const stages = cases.flatMap(cs => cs.stages.map(st => ({ ...st, case_id: cs.id })));
    const sessions = stages.flatMap(st => st.sessions.map(s => ({ ...s, stage_id: st.id })));
    const invoice_items = data.invoices.flatMap(inv => inv.items.map(item => ({ ...item, invoice_id: inv.id })));

    return {
        clients: data.clients.map(({ cases, ...client }) => client),
        cases: cases.map(({ stages, ...caseItem }) => caseItem),
        stages: stages.map(({ sessions, ...stage }) => stage),
        sessions,
        admin_tasks: data.adminTasks,
        appointments: data.appointments,
        accounting_entries: data.accountingEntries,
        assistants: data.assistants.map(name => ({ name })),
        invoices: data.invoices.map(({ items, ...inv }) => inv),
        invoice_items,
        case_documents: data.documents,
        profiles: data.profiles,
        site_finances: data.siteFinances,
    };
};

const constructData = (flatData: Partial<FlatData>): AppData => {
    const sessionMap = new Map<string, Session[]>();
    (flatData.sessions || []).forEach(s => {
        const stageId = (s as any).stage_id;
        if (!sessionMap.has(stageId)) sessionMap.set(stageId, []);
        sessionMap.get(stageId)!.push(s as Session);
    });

    const stageMap = new Map<string, Stage[]>();
    (flatData.stages || []).forEach(st => {
        const stage = { ...st, sessions: sessionMap.get(st.id) || [] } as Stage;
        const caseId = (st as any).case_id;
        if (!stageMap.has(caseId)) stageMap.set(caseId, []);
        stageMap.get(caseId)!.push(stage);
    });

    const caseMap = new Map<string, Case[]>();
    (flatData.cases || []).forEach(cs => {
        const caseItem = { ...cs, stages: stageMap.get(cs.id) || [] } as Case;
        const clientId = (cs as any).client_id;
        if (!caseMap.has(clientId)) caseMap.set(clientId, []);
        caseMap.get(clientId)!.push(caseItem);
    });
    
    const invoiceItemMap = new Map<string, any[]>();
    (flatData.invoice_items || []).forEach(item => {
        const invoiceId = (item as any).invoice_id;
        if(!invoiceItemMap.has(invoiceId)) invoiceItemMap.set(invoiceId, []);
        invoiceItemMap.get(invoiceId)!.push(item);
    });

    return {
        clients: (flatData.clients || []).map(c => ({ ...c, cases: caseMap.get(c.id) || [] } as Client)),
        adminTasks: (flatData.admin_tasks || []) as any,
        appointments: (flatData.appointments || []) as any,
        accountingEntries: (flatData.accounting_entries || []) as any,
        assistants: Array.from(new Set((flatData.assistants || []).map(a => a.name))).filter(Boolean),
        invoices: (flatData.invoices || []).map(inv => ({...inv, items: invoiceItemMap.get(inv.id) || []})) as any,
        documents: (flatData.case_documents || []) as any,
        profiles: (flatData.profiles || []) as any,
        siteFinances: (flatData.site_finances || []) as any,
    };
};

const mergeItems = <T extends { id?: any; name?: string; updated_at?: Date | string }>(local: T[], remote: T[], deletedSet: Set<string>, tableName: string): { merged: T[], toUpsert: T[] } => {
    const finalMap = new Map<string, T>();
    const toUpsert: T[] = [];
    
    const getPk = (item: T) => (item.id ?? item.name ?? '').toString();

    // 1. Process Local Items
    for (const localItem of local) {
        const id = getPk(localItem);
        if (!id) continue;
        
        // If it was recently deleted remotely, skip it (Resurrection prevention)
        if (deletedSet.has(`${tableName}:${id}`)) continue;

        const remoteItem = remote.find(r => getPk(r) === id);
        if (remoteItem) {
            const localDate = new Date(localItem.updated_at || 0).getTime();
            const remoteDate = new Date(remoteItem.updated_at || 0).getTime();
            
            if (localDate > remoteDate + 1000) { // Local is newer (with small buffer)
                toUpsert.push(localItem);
                finalMap.set(id, localItem);
            } else {
                finalMap.set(id, remoteItem);
            }
        } else {
            // Truly new local item
            toUpsert.push(localItem);
            finalMap.set(id, localItem);
        }
    }

    // 2. Add Remote Items not in finalMap
    for (const remoteItem of remote) {
        const id = getPk(remoteItem);
        if (!id || finalMap.has(id)) continue;
        
        // Only add if not locally or remotely deleted
        if (!deletedSet.has(`${tableName}:${id}`)) {
            finalMap.set(id, remoteItem);
        }
    }

    return { merged: Array.from(finalMap.values()), toUpsert };
};

// Filters local items against remote deletion log to prevent "Zombie" data resurrection.
const applyDeletionsToLocal = (localFlatData: FlatData, deletions: SyncDeletion[]): FlatData => {
    if (!deletions || deletions.length === 0) return localFlatData;

    const deletionMap = new Map<string, string>(); // Table:RecordID -> DeletedAt ISO
    deletions.forEach(d => {
        deletionMap.set(`${d.table_name}:${d.record_id}`, d.deleted_at);
    });

    const filterItems = (items: any[], tableName: string) => {
        return items.filter(item => {
            const id = item.id ?? item.name;
            const key = `${tableName}:${id}`;
            const deletedAtStr = deletionMap.get(key);
            
            if (deletedAtStr) {
                const deletedAt = new Date(deletedAtStr).getTime();
                const updatedAt = new Date(item.updated_at || 0).getTime();
                // If the local item hasn't been updated since it was deleted remotely, purge it.
                if (updatedAt < (deletedAt + 2000)) return false; 
            }
            return true;
        });
    };

    const clients = filterItems(localFlatData.clients, 'clients');
    const clientIds = new Set(clients.map(c => c.id));
    
    let cases = filterItems(localFlatData.cases, 'cases').filter(c => clientIds.has(c.client_id));
    const caseIds = new Set(cases.map(c => c.id));
    
    let stages = filterItems(localFlatData.stages, 'stages').filter(s => caseIds.has(s.case_id));
    const stageIds = new Set(stages.map(s => s.id));
    
    let sessions = filterItems(localFlatData.sessions, 'sessions').filter(s => stageIds.has(s.stage_id));
    let invoices = filterItems(localFlatData.invoices, 'invoices').filter(i => clientIds.has(i.client_id));
    const invoiceIds = new Set(invoices.map(i => i.id));
    let invoice_items = filterItems(localFlatData.invoice_items, 'invoice_items').filter(i => invoiceIds.has(i.invoice_id));
    let case_documents = filterItems(localFlatData.case_documents, 'case_documents').filter(d => caseIds.has(d.caseId));
    let accounting_entries = filterItems(localFlatData.accounting_entries, 'accounting_entries').filter(e => !e.clientId || clientIds.has(e.clientId));

    return {
        ...localFlatData,
        clients, cases, stages, sessions, invoices, invoice_items, case_documents, accounting_entries,
        admin_tasks: filterItems(localFlatData.admin_tasks, 'admin_tasks'),
        appointments: filterItems(localFlatData.appointments, 'appointments'),
        assistants: filterItems(localFlatData.assistants, 'assistants'),
        site_finances: filterItems(localFlatData.site_finances, 'site_finances'),
        profiles: localFlatData.profiles,
    };
};


export const useSync = ({ user, localData, deletedIds, onDataSynced, onDeletionsSynced, onSyncStatusChange, isOnline, isAuthLoading, syncStatus }: UseSyncProps) => {
    const userRef = React.useRef(user);
    userRef.current = user;

    const setStatus = (status: SyncStatus, error: string | null = null) => { onSyncStatusChange(status, error); };

    const manualSync = React.useCallback(async () => {
        if (syncStatus === 'syncing' || isAuthLoading) return;
        const currentUser = userRef.current;
        if (!isOnline || !currentUser) {
            setStatus('error', isOnline ? 'يجب تسجيل الدخول للمزامنة.' : 'يجب أن تكون متصلاً بالإنترنت للمزامنة.');
            return;
        }
    
        setStatus('syncing', 'جاري التحقق من حالة السحابة...');
        const schemaCheck = await checkSupabaseSchema();
        if (!schemaCheck.success) {
            if (schemaCheck.error === 'unconfigured') setStatus('unconfigured');
            else if (schemaCheck.error === 'uninitialized') setStatus('uninitialized', `قاعدة البيانات غير مهيأة.`);
            else setStatus('error', `فشل الاتصال: ${schemaCheck.message}`);
            return;
        }
    
        try {
            setStatus('syncing', 'جاري جلب البيانات والتغييرات...');
            const [remoteDataRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase(),
                fetchDeletionsFromSupabase().catch(() => [] as SyncDeletion[])
            ]);
            const remoteFlatData = transformRemoteToLocal(remoteDataRaw);
            const localFlatData = applyDeletionsToLocal(flattenData(localData), remoteDeletions);

            // Set of all deleted keys (local + remote)
            const deletedKeys = new Set<string>();
            remoteDeletions.forEach(d => deletedKeys.add(`${d.table_name}:${d.record_id}`));
            Object.entries(deletedIds).forEach(([table, ids]) => {
                const dbTable = table === 'adminTasks' ? 'admin_tasks' : table === 'accountingEntries' ? 'accounting_entries' : table === 'invoiceItems' ? 'invoice_items' : table === 'siteFinances' ? 'site_finances' : table;
                (ids as string[]).forEach(id => deletedKeys.add(`${dbTable}:${id}`));
            });

            const flatUpserts: Partial<FlatData> = {};
            const mergedFlatData: Partial<FlatData> = {};

            const tables: (keyof FlatData)[] = [
                'clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 
                'accounting_entries', 'assistants', 'invoices', 'invoice_items', 'case_documents', 
                'profiles', 'site_finances'
            ];

            for (const table of tables) {
                const { merged, toUpsert } = mergeItems(
                    (localFlatData as any)[table] || [], 
                    (remoteFlatData as any)[table] || [], 
                    deletedKeys, 
                    table
                );
                (mergedFlatData as any)[table] = merged;
                (flatUpserts as any)[table] = toUpsert;
            }

            // Cleanup local items about to be deleted remotely
            let successfulDeletions = getInitialDeletedIds();

            if (deletedIds.documentPaths?.length > 0) {
                const supabase = getSupabaseClient();
                if (supabase) {
                    const { error } = await supabase.storage.from('documents').remove(deletedIds.documentPaths);
                    if (!error) successfulDeletions.documentPaths = deletedIds.documentPaths;
                }
            }
            
            const flatDeletes: Partial<FlatData> = {
                clients: deletedIds.clients.map(id => ({ id })) as any,
                cases: deletedIds.cases.map(id => ({ id })) as any,
                stages: deletedIds.stages.map(id => ({ id })) as any,
                sessions: deletedIds.sessions.map(id => ({ id })) as any,
                admin_tasks: deletedIds.adminTasks.map(id => ({ id })) as any,
                appointments: deletedIds.appointments.map(id => ({ id })) as any,
                accounting_entries: deletedIds.accountingEntries.map(id => ({ id })) as any,
                assistants: deletedIds.assistants.map(name => ({ name })),
                invoices: deletedIds.invoices.map(id => ({ id })) as any,
                invoice_items: deletedIds.invoiceItems.map(id => ({ id })) as any,
                case_documents: deletedIds.documents.map(id => ({ id })) as any,
                site_finances: deletedIds.siteFinances.map(id => ({ id })) as any,
            };

            if (Object.values(flatDeletes).some(arr => arr && arr.length > 0)) {
                setStatus('syncing', 'جاري إرسال عمليات الحذف...');
                await deleteDataFromSupabase(flatDeletes, currentUser);
                successfulDeletions = { ...successfulDeletions, ...deletedIds };
            }

            setStatus('syncing', 'جاري إرسال التعديلات الجديدة...');
            const upsertedDataRaw = await upsertDataToSupabase(flatUpserts as FlatData, currentUser);
            const upsertedFlatData = transformRemoteToLocal(upsertedDataRaw);
            const upsertedMap = new Map();
            Object.values(upsertedFlatData).forEach(arr => (arr as any[])?.forEach(item => upsertedMap.set(item.id ?? item.name, item)));

            // Update merged data with fresh data from server (timestamps, etc.)
            for (const table of tables) {
                const merged = (mergedFlatData as any)[table];
                if (Array.isArray(merged)) {
                    (mergedFlatData as any)[table] = merged.map((item: any) => upsertedMap.get(item.id ?? item.name) || item);
                }
            }

            onDataSynced(constructData(mergedFlatData as FlatData));
            onDeletionsSynced(successfulDeletions);
            setStatus('synced');
        } catch (err: any) {
            console.error("Sync Critical Error:", err);
            const msg = err.message || 'فشلت المزامنة.';
            setStatus('error', msg.includes('failed to fetch') ? 'فشل الاتصال بالخادم.' : msg);
        }
    }, [localData, userRef, isOnline, onDataSynced, deletedIds, onDeletionsSynced, isAuthLoading, syncStatus]);

    const fetchAndRefresh = React.useCallback(async () => {
        if (syncStatus === 'syncing' || isAuthLoading || !isOnline || !userRef.current) return;
        try {
            const [remoteDataRaw, remoteDeletions] = await Promise.all([
                fetchDataFromSupabase(),
                fetchDeletionsFromSupabase().catch(() => [] as SyncDeletion[])
            ]);
            const remoteFlatData = transformRemoteToLocal(remoteDataRaw);
            const localFlatData = applyDeletionsToLocal(flattenData(localData), remoteDeletions);
            
            const mergedData: any = {};
            const tables: (keyof FlatData)[] = [
                'clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 
                'accounting_entries', 'assistants', 'invoices', 'invoice_items', 'case_documents', 
                'profiles', 'site_finances'
            ];

            const deletedKeys = new Set(remoteDeletions.map(d => `${d.table_name}:${d.record_id}`));

            for (const table of tables) {
                const { merged } = mergeItems((localFlatData as any)[table] || [], (remoteFlatData as any)[table] || [], deletedKeys, table);
                mergedData[table] = merged;
            }

            onDataSynced(constructData(mergedData));
            setStatus('synced');
        } catch (err) {
            console.warn("Realtime refresh failed silently (will retry next turn):", err);
        }
    }, [localData, userRef, isOnline, onDataSynced, isAuthLoading, syncStatus]);

    return { manualSync, fetchAndRefresh };
};

const toDate = (val: any) => val ? new Date(val) : undefined;
const toDateReq = (val: any) => val ? new Date(val) : new Date();

export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    return {
        clients: remote.clients?.map(({ contact_info, updated_at, ...r }: any) => ({ ...r, contactInfo: contact_info, updated_at: toDate(updated_at) })),
        cases: remote.cases?.map(({ client_name, opponent_name, fee_agreement, updated_at, ...r }: any) => ({ ...r, clientName: client_name, opponentName: opponent_name, feeAgreement: fee_agreement, updated_at: toDate(updated_at) })),
        stages: remote.stages?.map(({ case_number, first_session_date, decision_date, decision_number, decision_summary, decision_notes, updated_at, ...r }: any) => ({ ...r, caseNumber: case_number, firstSessionDate: toDate(first_session_date), decisionDate: toDate(decision_date), decisionNumber: decision_number, decisionSummary: decision_summary, decisionNotes: decision_notes, updated_at: toDate(updated_at) })),
        sessions: remote.sessions?.map(({ case_number, client_name, opponent_name, postponement_reason, next_postponement_reason, is_postponed, next_session_date, updated_at, date, ...r }: any) => ({ ...r, caseNumber: case_number, clientName: client_name, opponentName: opponent_name, postponementReason: postponement_reason, nextPostponementReason: next_postponement_reason, isPostponed: is_postponed, nextSessionDate: toDate(next_session_date), date: toDateReq(date), updated_at: toDate(updated_at) })),
        admin_tasks: remote.admin_tasks?.map(({ due_date, order_index, updated_at, ...r }: any) => ({ ...r, dueDate: toDateReq(due_date), orderIndex: order_index, updated_at: toDate(updated_at) })),
        appointments: remote.appointments?.map(({ reminder_time_in_minutes, updated_at, date, ...r }: any) => ({ ...r, reminderTimeInMinutes: reminder_time_in_minutes, date: toDateReq(date), updated_at: toDate(updated_at) })),
        accounting_entries: remote.accounting_entries?.map(({ client_id, case_id, client_name, updated_at, date, ...r }: any) => ({ ...r, clientId: client_id, caseId: case_id, clientName: client_name, date: toDateReq(date), updated_at: toDate(updated_at) })),
        assistants: remote.assistants?.map((a: any) => ({ name: a.name })),
        invoices: remote.invoices?.map(({ client_id, client_name, case_id, case_subject, issue_date, due_date, tax_rate, updated_at, ...r }: any) => ({ ...r, clientId: client_id, clientName: client_name, caseId: case_id, caseSubject: case_subject, issueDate: toDateReq(issue_date), dueDate: toDateReq(due_date), taxRate: tax_rate, updated_at: toDate(updated_at) })),
        invoice_items: remote.invoice_items?.map(({updated_at, ...r}: any) => ({...r, updated_at: toDate(updated_at)})),
        case_documents: remote.case_documents?.map(({ user_id, case_id, added_at, storage_path, updated_at, ...r }: any) => ({...r, userId: user_id, caseId: case_id, addedAt: toDateReq(added_at), storagePath: storage_path, updated_at: toDate(updated_at) })),
        profiles: remote.profiles?.map(({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, created_at, updated_at, ...r }: any) => ({ ...r, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, created_at, updated_at: toDate(updated_at) })),
        site_finances: remote.site_finances?.map(({updated_at, payment_date, ...r}: any) => ({...r, payment_date, updated_at: toDate(updated_at)})),
    };
};
