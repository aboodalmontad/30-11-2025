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
    // Fix: Added invoice_id to the type definition to resolve property access errors in sync filters.
    invoice_items: (InvoiceItem & { invoice_id: string })[];
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
        'sync_deletions': 'id',
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
                if (code === '42P01' || message.includes('does not exist') || message.includes('relation') ) {
                    return { success: false, error: 'uninitialized', message: `Missing: ${result.table}.` };
                } else {
                    throw result.error;
                }
            }
        }
        return { success: true, error: null, message: '' };
    } catch (err: any) {
        return { success: false, error: 'unknown', message: err.message };
    }
};


/**
 * Fetches the entire dataset for the current user from Supabase.
 */
export const fetchDataFromSupabase = async (): Promise<Partial<FlatData>> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const queries = [
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
    ];

    const results = await Promise.all(queries);
    const names = ['clients', 'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'invoices', 'cases', 'stages', 'sessions', 'invoice_items', 'case_documents', 'profiles', 'site_finances'];

    const flatData: any = {};
    results.forEach((res, i) => {
        if (res.error) throw new Error(`Fetch ${names[i]} failed: ${res.error.message}`);
        flatData[names[i]] = res.data || [];
    });

    return flatData;
};

export const fetchDeletionsFromSupabase = async (): Promise<SyncDeletion[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) return [];
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
        const { data, error } = await supabase
            .from('sync_deletions')
            .select('*')
            .gte('deleted_at', thirtyDaysAgo.toISOString());

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.warn("Fetch deletions failed (likely table not ready):", err);
        return [];
    }
};

export const deleteDataFromSupabase = async (deletions: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const deletionOrder: (keyof FlatData)[] = [
        'case_documents', 'invoice_items', 'sessions', 'stages', 'cases', 'invoices', 
        'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'clients',
        'site_finances', 'profiles',
    ];

    for (const table of deletionOrder) {
        const itemsToDelete = (deletions as any)[table];
        if (itemsToDelete && itemsToDelete.length > 0) {
            const pk = table === 'assistants' ? 'name' : 'id';
            const ids = itemsToDelete.map((i: any) => i[pk]);
            
            if (table !== 'profiles') {
                const logEntries = ids.map((id: string) => ({ table_name: table, record_id: id, user_id: user.id }));
                await supabase.from('sync_deletions').insert(logEntries).select().catch(() => {});
            }

            const { error } = await supabase.from(table).delete().in(pk, ids);
            if (error) {
                const err: any = new Error(error.message);
                err.table = table;
                throw err;
            }
        }
    }
};

export const upsertDataToSupabase = async (data: Partial<FlatData>, user: User) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const userId = user.id;

    // Helper to filter orphans before upsert
    const validClientIds = new Set(data.clients?.map(c => c.id));
    const validCaseIds = new Set(data.cases?.map(c => c.id));
    const validStageIds = new Set(data.stages?.map(s => s.id));
    const validInvoiceIds = new Set(data.invoices?.map(i => i.id));

    const upsertTable = async (table: string, records: any[] | undefined, options: any = {}) => {
        if (!records || records.length === 0) return [];
        const { data: resData, error } = await supabase.from(table).upsert(records, options).select();
        if (error) throw new Error(`${table} upsert error: ${error.message}`);
        return resData || [];
    };
    
    const results: any = {};
    
    // Ordered Upserts to prevent FK violations
    results.profiles = await upsertTable('profiles', data.profiles?.map(p => ({ ...p })));
    results.assistants = await upsertTable('assistants', data.assistants?.map(a => ({ ...a, user_id: userId })), { onConflict: 'user_id,name' });
    results.clients = await upsertTable('clients', data.clients?.map(c => ({ ...c, user_id: userId, contact_info: (c as any).contactInfo })));
    
    results.cases = await upsertTable('cases', data.cases?.filter(c => validClientIds.has(c.client_id)).map(c => ({ ...c, user_id: userId, client_name: (c as any).clientName, opponent_name: (c as any).opponentName, fee_agreement: (c as any).feeAgreement })));
    
    results.stages = await upsertTable('stages', data.stages?.filter(s => validCaseIds.has(s.case_id)).map(s => ({ ...s, user_id: userId, case_number: (s as any).caseNumber, first_session_date: (s as any).firstSessionDate, decision_date: (s as any).decisionDate, decision_number: (s as any).decisionNumber, decision_summary: (s as any).decisionSummary, decision_notes: (s as any).decisionNotes })));
    
    results.sessions = await upsertTable('sessions', data.sessions?.filter(s => validStageIds.has(s.stage_id)).map(s => ({
        id: s.id, user_id: userId, stage_id: s.stage_id, court: s.court, case_number: (s as any).caseNumber, date: s.date,
        client_name: (s as any).clientName, opponent_name: (s as any).opponentName, postponement_reason: (s as any).postponementReason,
        next_postponement_reason: (s as any).nextPostponementReason, is_postponed: (s as any).isPostponed,
        next_session_date: (s as any).nextSessionDate, assignee: s.assignee, updated_at: s.updated_at
    })));

    // Fix: Corrected property access from i.client_id to i.clientId to match the Invoice type.
    results.invoices = await upsertTable('invoices', data.invoices?.filter(i => validClientIds.has(i.clientId)).map(i => ({ ...i, user_id: userId, client_id: (i as any).clientId, client_name: (i as any).clientName, case_id: (i as any).caseId, case_subject: (i as any).caseSubject, issue_date: (i as any).issueDate, due_date: (i as any).dueDate, tax_rate: (i as any).taxRate })));
    
    // Fix: Corrected property access to i.invoice_id which is available on flattened InvoiceItem objects.
    results.invoice_items = await upsertTable('invoice_items', data.invoice_items?.filter(i => validInvoiceIds.has(i.invoice_id)).map(i => ({ ...i, user_id: userId })));
    results.case_documents = await upsertTable('case_documents', data.case_documents?.filter(d => validCaseIds.has(d.caseId)).map(d => ({ ...d, user_id: userId, case_id: d.caseId, added_at: d.addedAt, storage_path: d.storagePath })));
    
    results.admin_tasks = await upsertTable('admin_tasks', data.admin_tasks?.map(t => ({ ...t, user_id: userId, due_date: (t as any).dueDate, order_index: (t as any).orderIndex })));
    results.appointments = await upsertTable('appointments', data.appointments?.map(a => ({ ...a, user_id: userId, reminder_time_in_minutes: (a as any).reminderTimeInMinutes })));
    results.accounting_entries = await upsertTable('accounting_entries', data.accounting_entries?.map(e => ({ ...e, user_id: userId, client_id: (e as any).clientId, case_id: (e as any).caseId, client_name: (e as any).clientName })));
    results.site_finances = await upsertTable('site_finances', data.site_finances?.map(sf => ({ ...sf, user_id: sf.user_id, payment_date: sf.payment_date })));
    
    return results;
};

/**
 * Admin utility: Fetches every record from every table in the database.
 * Restricted by RLS to only work for 'admin' role profiles.
 */
export const adminFetchFullDatabase = async () => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    const tables = [
        'profiles', 'clients', 'cases', 'stages', 'sessions', 
        'admin_tasks', 'appointments', 'accounting_entries', 
        'assistants', 'invoices', 'invoice_items', 'case_documents', 
        'site_finances', 'sync_deletions'
    ];

    const results = await Promise.all(tables.map(table => supabase.from(table).select('*')));
    
    const dbDump: any = {};
    results.forEach((res, i) => {
        if (res.error) throw new Error(`Backup of ${tables[i]} failed: ${res.error.message}`);
        dbDump[tables[i]] = res.data || [];
    });

    return dbDump;
};

/**
 * Admin utility: Restores a full database dump.
 * Restricted by RLS to only work for 'admin' role profiles.
 */
export const adminRestoreDatabase = async (dump: any) => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase client not available.');

    // Order is important for FKs
    const tables = [
        'profiles', 'assistants', 'clients', 'cases', 'stages', 'sessions',
        'invoices', 'invoice_items', 'case_documents', 'admin_tasks', 
        'appointments', 'accounting_entries', 'site_finances', 'sync_deletions'
    ];

    for (const table of tables) {
        const records = dump[table];
        if (records && Array.isArray(records) && records.length > 0) {
            // Chunking might be needed for very large backups, but we'll start simple
            const { error } = await supabase.from(table).upsert(records);
            if (error) throw new Error(`Restore of ${table} failed: ${error.message}`);
        }
    }
};
