
import { getSupabaseClient } from '../supabaseClient';
import { Client, AdminTask, Appointment, AccountingEntry, Invoice, InvoiceItem, CaseDocument, Profile, SiteFinancialEntry, SyncDeletion } from '../types';
// Fix: Use `import type` for User as it is used as a type, not a value. This resolves module resolution errors in some environments.
import type { User } from '@supabase/supabase-js';

// This file defines the shape of data when flattened for sync operations.
export type FlatData = {
    clients: Omit<Client, 'cases'>[];
    cases: any[];
    stages: any[];
    sessions: any[];
    admin_tasks: AdminTask[];
    appointments: Appointment[];
    accounting_entries: AccountingEntry[];
    assistants: { name: string }[];
    invoices: Omit<Invoice, 'items'>[];
    invoice_items: InvoiceItem[];
    case_documents: CaseDocument[];
    profiles: Profile[];
    site_finances: SiteFinancialEntry[];
};


/**
 * Checks if all required tables exist in the Supabase database schema.
 */
export const checkSupabaseSchema = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return { success: false, error: 'unconfigured', message: 'Supabase client is not configured.' };
    }

    const tableChecks: { [key: string]: string } = {
        'profiles': 'id', 'clients': 'id', 'cases': 'id',
        'stages': 'id', 'sessions': 'id', 'admin_tasks': 'id',
        'appointments': 'id', 'accounting_entries': 'id', 'assistants': 'name',
        'invoices': 'id', 'invoice_items': 'id', 'case_documents': 'id',
        'site_finances': 'id',
        'sync_deletions': 'id', // Checked for resurrection fix
    };
    
    const tableCheckPromises = Object.entries(tableChecks).map(([table, query]) =>
        supabase.from(table).select(query, { head: true }).then(res => ({ ...res, table }))
    );

    try {
        const results = await Promise.all(tableCheckPromises);
        for (const result of results) {
            if (result.error) {
                const message = String(result.error.message || '').toLowerCase();
                const code = String(result.error.code || '');
                
                if (code === '42P01' || message.includes('does not exist') || message.includes('could not find the table') || message.includes('schema cache') || message.includes('relation') ) {
                    return { success: false, error: 'uninitialized', message: `Database uninitialized. Missing table or relation: ${result.table}.` };
                } else {
                    throw result.error;
                }
            }
        }
        return { success: true, error: null, message: '' };
    } catch (err: any) {
        const message = String(err?.message || '').toLowerCase();
        const code = String(err?.code || '');

        if (message.includes('failed to fetch')) {
            return { success: false, error: 'network', message: 'Failed to connect to the server. Check internet connection and CORS settings.' };
        }
        
        if (message.includes('does not exist') || code === '42P01' || message.includes('could not find the table') || message.includes('schema cache')) {
            return { success: false, error: 'uninitialized', message: 'Database is not fully initialized.' };
        }

        return { success: false, error: 'unknown', message: `Database schema check failed: ${err.message}` };
    }
};


/**
 * Fetches the entire dataset for the current user from Supabase.
 */
export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const [
        clientsRes, adminTasksRes, appointmentsRes, accountingEntriesRes,
        assistantsRes, invoicesRes, casesRes, stagesRes, sessionsRes, invoiceItemsRes,
        caseDocumentsRes, profilesRes, siteFinancesRes
    ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('admin_tasks').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('accounting_entries').select('*'),
        supabase.from('assistants').select('name'),
        supabase.from('invoices').select('*'),
        supabase.from('cases').select('*'),
        supabase.from('stages').select('*'),
        supabase.from('sessions').select('*'),
        supabase.from('invoice_items').select('*'),
        supabase.from('case_documents').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('site_finances').select('*'),
    ]);

    const results = [
        { res: clientsRes, name: 'clients' },
        { res: adminTasksRes, name: 'admin_tasks' },
        { res: appointmentsRes, name: 'appointments' },
        { res: accountingEntriesRes, name: 'accounting_entries' },
        { res: assistantsRes, name: 'assistants' },
        { res: invoicesRes, name: 'invoices' },
        { res: casesRes, name: 'cases' },
        { res: stagesRes, name: 'stages' },
        { res: sessionsRes, name: 'sessions' },
        { res: invoiceItemsRes, name: 'invoice_items' },
        { res: caseDocumentsRes, name: 'case_documents' },
        { res: profilesRes, name: 'profiles' },
        { res: siteFinancesRes, name: 'site_finances' },
    ];

    for (const { res, name } of results) {
        if (res.error) {
            throw new Error(`Failed to fetch ${name}: ${res.error.message}`);
        }
    }

    return {
        clients: clientsRes.data || [],
        cases: casesRes.data || [],
        stages: stagesRes.data || [],
        sessions: sessionsRes.data || [],
        admin_tasks: adminTasksRes.data || [],
        appointments: appointmentsRes.data || [],
        accounting_entries: accountingEntriesRes.data || [],
        assistants: assistantsRes.data || [],
        invoices: invoicesRes.data || [],
        invoice_items: invoiceItemsRes.data || [],
        case_documents: caseDocumentsRes.data || [],
        profiles: profilesRes.data || [],
        site_finances: siteFinancesRes.data || [],
    };
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    // Fetch deletions from the last 30 days to keep payload small but effective
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const { data, error } = await supabase
            .from('sync_deletions')
            .select('*')
            .gte('deleted_at', thirtyDaysAgo.toISOString());

        if (error) {
            // Robust error stringification to avoid [object Object]
            const errorMsg = error.message || JSON.stringify(error) || 'Unknown Supabase error';
            throw new Error(errorMsg);
        }
        return data || [];
    } catch (err: any) {
        let msg = 'Unknown error fetching deletions';
        if (err instanceof Error) {
            msg = err.message;
        } else if (typeof err === 'object' && err !== null) {
            msg = (err as any).message || JSON.stringify(err);
        } else {
            msg = String(err);
        }
        console.error("Fetch deletions error:", msg);
        throw new Error(msg); 
    }
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const deletionOrder: (keyof FlatData)[] = [
        'case_documents', 'invoice_items', 'sessions', 'stages', 'cases', 'invoices', 
        'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'clients',
        'site_finances',
        'profiles',
    ];

    for (const table of deletionOrder) {
        const itemsToDelete = (deletions as any)[table];
        if (itemsToDelete && itemsToDelete.length > 0) {
            const primaryKeyColumn = table === 'assistants' ? 'name' : 'id';
            const ids = itemsToDelete.map((i: any) => i[primaryKeyColumn]);
            
            // 1. Log the deletion for sync resurrection prevention
            if (table !== 'profiles') {
                const deletionsLog = ids.map((id: string) => ({
                    table_name: table,
                    record_id: id,
                    user_id: user.id
                }));
                
                const { error: logError } = await supabase.from('sync_deletions').insert(deletionsLog).select();
                
                if (logError) {
                    console.warn("Could not log deletion (safe to ignore if DB not updated):", logError.message || JSON.stringify(logError));
                }
            }

            // 2. Perform the hard delete
            const { error } = await supabase.from(table).delete().in(primaryKeyColumn, ids);
            if (error) {
                console.error(`Error deleting from ${table}:`, error);
                const msg = error.message || JSON.stringify(error);
                const newError = new Error(msg);
                (newError as any).table = table;
                throw newError;
            }
        }
    }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    // IMPORTANT: 'user' passed here might be a constructed object with 'effectiveUserId' as 'id'.
    // We use this ID to assign ownership of new records.
    const userId = user.id;

    // Map application data (camelCase) to database schema (snake_case)
    const dataToUpsert = {
        clients: data.clients?.map(({ contactInfo, ...rest }) => ({ ...rest, user_id: userId, contact_info: contactInfo })),
        cases: data.cases?.map(({ clientName, opponentName, feeAgreement, ...rest }) => ({ ...rest, user_id: userId, client_name: clientName, opponent_name: opponentName, fee_agreement: feeAgreement })),
        stages: data.stages?.map(({ caseNumber, firstSessionDate, decisionDate, decisionNumber, decisionSummary, decisionNotes, ...rest }) => ({ ...rest, user_id: userId, case_number: caseNumber, first_session_date: firstSessionDate, decision_date: decisionDate, decision_number: decisionNumber, decision_summary: decisionSummary, decision_notes: decisionNotes })),
        sessions: data.sessions?.map((s: any) => ({
            id: s.id,
            user_id: userId,
            stage_id: s.stage_id,
            court: s.court,
            case_number: s.caseNumber,
            date: s.date,
            client_name: s.clientName,
            opponent_name: s.opponentName,
            postponement_reason: s.postponementReason,
            next_postponement_reason: s.nextPostponementReason,
            is_postponed: s.isPostponed,
            next_session_date: s.nextSessionDate,
            assignee: s.assignee,
            updated_at: s.updated_at
        })),
        admin_tasks: data.admin_tasks?.map(({ dueDate, orderIndex, ...rest }) => ({ ...rest, user_id: userId, due_date: dueDate, order_index: orderIndex })),
        appointments: data.appointments?.map(({ reminderTimeInMinutes, ...rest }) => ({ ...rest, user_id: userId, reminder_time_in_minutes: reminderTimeInMinutes })),
        accounting_entries: data.accounting_entries?.map(({ clientId, caseId, clientName, ...rest }) => ({ ...rest, user_id: userId, client_id: clientId, case_id: caseId, client_name: clientName })),
        assistants: data.assistants?.map(item => ({ ...item, user_id: userId })),
        invoices: data.invoices?.map(({ clientId, clientName, caseId, caseSubject, issueDate, dueDate, taxRate, ...rest }) => ({ ...rest, user_id: userId, client_id: clientId, client_name: clientName, case_id: caseId, case_subject: caseSubject, issue_date: issueDate, due_date: dueDate, tax_rate: taxRate })),
        invoice_items: data.invoice_items?.map(({ ...item }) => ({ ...item, user_id: userId })),
        case_documents: data.case_documents?.map(({ caseId, userId: localUserId, addedAt, storagePath, localState, ...rest }) => ({ ...rest, user_id: userId, case_id: caseId, added_at: addedAt, storage_path: storagePath })),
        profiles: data.profiles?.map(({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, ...rest }) => ({ ...rest, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions })),
        site_finances: data.site_finances?.map(({ user_id, payment_date, ...rest }) => ({ ...rest, user_id, payment_date })),
    };
    
    const upsertTable = async (table: string, records: any[] | undefined, options: { onConflict?: string } = {}) => {
        if (!records || records.length === 0) return [];
        const { data: responseData, error } = await supabase.from(table).upsert(records, options).select();
        if (error) {
            console.error(`Error upserting to ${table}:`, error);
            // Fix: properly extract error message to prevent [object Object]
            const errorDetails = error.message || JSON.stringify(error);
            const msg = `Error upserting to ${table}: ${errorDetails}`;
            const newError = new Error(msg);
            (newError as any).table = table;
            throw newError;
        }
        return responseData || [];
    };
    
    const results: Partial<Record<keyof FlatData, any[]>> = {};

    results.profiles = await upsertTable('profiles', dataToUpsert.profiles);
    results.assistants = await upsertTable('assistants', dataToUpsert.assistants, { onConflict: 'user_id,name' });
    
    // Core Hierarchy: Clients -> Cases -> Stages -> Sessions
    results.clients = await upsertTable('clients', dataToUpsert.clients);
    results.cases = await upsertTable('cases', dataToUpsert.cases);
    results.stages = await upsertTable('stages', dataToUpsert.stages);
    results.sessions = await upsertTable('sessions', dataToUpsert.sessions);
    
    // Dependencies on Core
    results.invoices = await upsertTable('invoices', dataToUpsert.invoices);
    results.invoice_items = await upsertTable('invoice_items', dataToUpsert.invoice_items);
    results.case_documents = await upsertTable('case_documents', dataToUpsert.case_documents);
    
    // Miscellaneous (Accounting often links to Clients/Cases, so it should come after)
    const [adminTasks, appointments, accountingEntries, site_finances] = await Promise.all([
        upsertTable('admin_tasks', dataToUpsert.admin_tasks),
        upsertTable('appointments', dataToUpsert.appointments),
        upsertTable('accounting_entries', dataToUpsert.accounting_entries),
        upsertTable('site_finances', dataToUpsert.site_finances),
    ]);
    results.admin_tasks = adminTasks;
    results.appointments = appointments;
    results.accounting_entries = accountingEntries;
    results.site_finances = site_finances;
    
    return results;
};

// Helper to transform remote snake_case data to local camelCase format
export const transformRemoteToLocal = (remote: any): Partial<FlatData> => {
    if (!remote) return {};
    return {
        clients: remote.clients?.map(({ contact_info, ...r }: any) => ({ ...r, contactInfo: contact_info })),
        cases: remote.cases?.map(({ client_name, opponent_name, fee_agreement, ...r }: any) => ({ ...r, clientName: client_name, opponentName: opponent_name, feeAgreement: fee_agreement })),
        stages: remote.stages?.map(({ case_number, first_session_date, decision_date, decision_number, decision_summary, decision_notes, ...r }: any) => ({ ...r, caseNumber: case_number, firstSessionDate: first_session_date, decisionDate: decision_date, decisionNumber: decision_number, decisionSummary: decision_summary, decisionNotes: decision_notes })),
        sessions: remote.sessions?.map(({ case_number, client_name, opponent_name, postponement_reason, next_postponement_reason, is_postponed, next_session_date, ...r }: any) => ({ ...r, caseNumber: case_number, clientName: client_name, opponentName: opponent_name, postponementReason: postponement_reason, nextPostponementReason: next_postponement_reason, isPostponed: is_postponed, nextSessionDate: next_session_date })),
        admin_tasks: remote.admin_tasks?.map(({ due_date, order_index, ...r }: any) => ({ ...r, dueDate: due_date, orderIndex: order_index })),
        appointments: remote.appointments?.map(({ reminder_time_in_minutes, ...r }: any) => ({ ...r, reminderTimeInMinutes: reminder_time_in_minutes })),
        accounting_entries: remote.accounting_entries?.map(({ client_id, case_id, client_name, ...r }: any) => ({ ...r, clientId: client_id, caseId: case_id, clientName: client_name })),
        assistants: remote.assistants?.map((a: any) => ({ name: a.name })),
        invoices: remote.invoices?.map(({ client_id, client_name, case_id, case_subject, issue_date, due_date, tax_rate, ...r }: any) => ({ ...r, clientId: client_id, clientName: client_name, caseId: case_id, caseSubject: case_subject, issueDate: issue_date, dueDate: due_date, taxRate: tax_rate })),
        invoice_items: remote.invoice_items,
        case_documents: remote.case_documents?.map(({ user_id, case_id, added_at, storage_path, ...r }: any) => ({...r, userId: user_id, caseId: case_id, addedAt: added_at, storagePath: storage_path })),
        profiles: remote.profiles?.map(({ full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions, ...r }: any) => ({ ...r, full_name, mobile_number, is_approved, is_active, subscription_start_date, subscription_end_date, lawyer_id, permissions })),
        site_finances: remote.site_finances,
    };
};

// Admin Backup Fetch: Returns RAW DB data (snake_case)
export const adminFetchFullDatabase = async () => {
    return fetchDataFromSupabase();
};

// Admin Restore: Accepts RAW DB data (snake_case) and upserts it directly
// preserving all IDs including user_id.
export const adminRestoreDatabase = async (rawData: any) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const upsertTable = async (table: string, records: any[] | undefined, options: { onConflict?: string } = {}) => {
        if (!records || records.length === 0) return;
        
        // Batch operations to avoid payload limits (Supabase/PostgREST limit)
        const batchSize = 1000;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const { error } = await supabase.from(table).upsert(batch, options);
            if (error) {
                console.error(`Error restoring ${table} (batch ${i}):`, error);
                const errorDetails = error.message || JSON.stringify(error);
                throw new Error(`Error restoring ${table}: ${errorDetails}`);
            }
        }
    };

    // Restoration Order (Critical for Foreign Keys)
    // 1. Profiles (Users) - Must exist first for user_id FK
    // 2. Clients
    // 3. Cases
    // 4. Stages
    // 5. Sessions
    // ... others
    
    await upsertTable('profiles', rawData.profiles);
    await upsertTable('assistants', rawData.assistants, { onConflict: 'user_id,name' });
    await upsertTable('clients', rawData.clients);
    await upsertTable('cases', rawData.cases);
    await upsertTable('stages', rawData.stages);
    await upsertTable('sessions', rawData.sessions);
    
    await upsertTable('admin_tasks', rawData.admin_tasks);
    await upsertTable('appointments', rawData.appointments);
    await upsertTable('accounting_entries', rawData.accounting_entries);
    await upsertTable('invoices', rawData.invoices);
    await upsertTable('invoice_items', rawData.invoice_items);
    await upsertTable('case_documents', rawData.case_documents);
    await upsertTable('site_finances', rawData.site_finances);
};
