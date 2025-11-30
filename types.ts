
export interface Permissions {
    // General (عام)
    can_view_agenda: boolean; // عرض المفكرة والصفحة الرئيسية

    // Clients (الموكلين)
    can_view_clients: boolean;
    can_add_client: boolean;
    can_edit_client: boolean;
    can_delete_client: boolean;

    // Cases (القضايا)
    can_view_cases: boolean;
    can_add_case: boolean;
    can_edit_case: boolean;
    can_delete_case: boolean;

    // Sessions (الجلسات)
    can_view_sessions: boolean;
    can_add_session: boolean;
    can_edit_session: boolean;
    can_delete_session: boolean;
    can_postpone_session: boolean; // ترحيل الجلسات
    can_decide_session: boolean;   // حسم الجلسات/المراحل

    // Documents (الوثائق)
    can_view_documents: boolean;
    can_add_document: boolean;
    can_delete_document: boolean;

    // Finance (المالية)
    can_view_finance: boolean;
    can_add_financial_entry: boolean; // إضافة قيود
    can_delete_financial_entry: boolean; // حذف قيود
    can_manage_invoices: boolean; // إدارة الفواتير كاملة

    // Admin Tasks (المهام الإدارية)
    can_view_admin_tasks: boolean;
    can_add_admin_task: boolean;
    can_edit_admin_task: boolean;
    can_delete_admin_task: boolean;

    // Reports (التقارير)
    can_view_reports: boolean;
}

export const defaultPermissions: Permissions = {
    // Default restricted permissions for a new assistant
    can_view_agenda: true,

    can_view_clients: true,
    can_add_client: false,
    can_edit_client: false,
    can_delete_client: false,

    can_view_cases: true,
    can_add_case: false,
    can_edit_case: false,
    can_delete_case: false,

    can_view_sessions: true,
    can_add_session: true,
    can_edit_session: false,
    can_delete_session: false,
    can_postpone_session: true,
    can_decide_session: false,

    can_view_documents: true,
    can_add_document: true,
    can_delete_document: false,

    can_view_finance: false,
    can_add_financial_entry: false,
    can_delete_financial_entry: false,
    can_manage_invoices: false,

    can_view_admin_tasks: true,
    can_add_admin_task: true,
    can_edit_admin_task: true,
    can_delete_admin_task: false,

    can_view_reports: false,
};

export interface Profile {
  id: string; // uuid
  full_name: string;
  mobile_number: string;
  is_approved: boolean;
  is_active: boolean;
  mobile_verified?: boolean; 
  otp_code?: string | null; 
  otp_expires_at?: string | null; 
  subscription_start_date: string | null; // ISO string
  subscription_end_date: string | null; // ISO string
  role: 'user' | 'admin';
  lawyer_id?: string | null; // ID of the lawyer this user assists
  permissions?: Permissions; // Granular permissions
  created_at?: string; // ISO string
  updated_at?: Date;
}


export interface Session {
  id: string;
  court: string;
  caseNumber: string;
  date: Date;
  clientName: string;
  opponentName: string;
  postponementReason?: string;
  nextPostponementReason?: string;
  isPostponed: boolean;
  nextSessionDate?: Date;
  assignee?: string;
  // For contextual rendering in flat lists
  stageId?: string;
  stageDecisionDate?: Date;
  updated_at?: Date;
  user_id?: string;
}

export interface Stage {
  id: string;
  court: string;
  caseNumber: string;
  firstSessionDate?: Date;
  sessions: Session[];
  decisionDate?: Date;
  decisionNumber?: string;
  decisionSummary?: string;
  decisionNotes?: string;
  updated_at?: Date;
  user_id?: string;
}

export interface Case {
  id: string;
  subject: string;
  clientName: string;
  opponentName: string;
  stages: Stage[];
  feeAgreement: string;
  status: 'active' | 'closed' | 'on_hold';
  updated_at?: Date;
  user_id?: string;
}

export interface Client {
  id: string;
  name: string;
  contactInfo: string;
  cases: Case[];
  updated_at?: Date;
  user_id?: string;
}

export interface AdminTask {
    id: string;
    task: string;
    dueDate: Date;
    completed: boolean;
    importance: 'normal' | 'important' | 'urgent';
    assignee?: string;
    location?: string;
    updated_at?: Date;
    orderIndex?: number;
}

export interface Appointment {
    id: string;
    title: string;
    time: string;
    date: Date;
    importance: 'normal' | 'important' | 'urgent';
    completed: boolean;
    notified?: boolean;
    reminderTimeInMinutes?: number;
    assignee?: string;
    updated_at?: Date;
}

export interface AccountingEntry {
    id: string;
    type: 'income' | 'expense';
    amount: number;
    date: Date;
    description: string;
    clientId: string;
    caseId: string;
    clientName: string;
    updated_at?: Date;
}

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  updated_at?: Date;
}

export interface Invoice {
  id: string; // e.g., INV-2024-001
  clientId: string;
  clientName: string;
  caseId?: string;
  caseSubject?: string;
  issueDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  taxRate: number; // Percentage, e.g., 14 for 14%
  discount: number; // Fixed amount
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  notes?: string;
  updated_at?: Date;
}

export interface SiteFinancialEntry {
  id: number;
  user_id: string | null;
  type: 'income' | 'expense';
  payment_date: string;
  amount: number;
  description: string | null;
  payment_method: string | null;
  category?: string | null;
  profile_full_name?: string;
  updated_at?: Date;
}

export interface CaseDocument {
  id: string;
  caseId: string;
  userId: string;
  name: string;
  type: string;
  size: number;
  addedAt: Date;
  storagePath: string; // e.g., 'user-uuid/case-id/doc-id-filename.pdf'
  localState: 'synced' | 'pending_upload' | 'pending_download' | 'error' | 'downloading';
  updated_at?: Date;
}

export interface AppData {
    clients: Client[];
    adminTasks: AdminTask[];
    appointments: Appointment[];
    accountingEntries: AccountingEntry[];
    invoices: Invoice[];
    assistants: string[];
    documents: CaseDocument[];
    profiles: Profile[];
    siteFinances: SiteFinancialEntry[];
}

export interface DeletedIds {
    clients: string[];
    cases: string[];
    stages: string[];
    sessions: string[];
    adminTasks: string[];
    appointments: string[];
    accountingEntries: string[];
    invoices: string[];
    invoiceItems: string[];
    assistants: string[];
    documents: string[];
    documentPaths: string[];
    profiles: string[];
    siteFinances: string[];
}

export interface SyncDeletion {
    id: number;
    table_name: string;
    record_id: string;
    user_id: string;
    deleted_at: string;
}

export const getInitialDeletedIds = (): DeletedIds => ({
    clients: [], cases: [], stages: [], sessions: [], adminTasks: [], appointments: [], accountingEntries: [], invoices: [], invoiceItems: [], assistants: [], documents: [], documentPaths: [], profiles: [], siteFinances: []
});