import { Client, AdminTask, Appointment, AccountingEntry, Invoice, Case, Stage, Session, InvoiceItem } from '../types';

// Default list of assistants for assignment dropdowns
export const mockAssistants: string[] = ['أحمد', 'فاطمة', 'سارة', 'بدون تخصيص'];

const today = new Date();
const createDate = (daysOffset: number = 0, hours: number = 0, minutes: number = 0): Date => {
    const date = new Date(today);
    date.setDate(date.getDate() + daysOffset);
    date.setHours(hours, minutes, 0, 0);
    return date;
};

// --- Mock Sessions ---
const session1_1_1: Session = {
    id: 'session-1',
    court: 'محكمة البداية المدنية الأولى',
    caseNumber: '123/2023',
    date: createDate(-10),
    clientName: 'عبد الرحمن قضماني',
    opponentName: 'شركة الإسكان الحديثة',
    isPostponed: true,
    postponementReason: 'لتقديم المستندات',
    nextSessionDate: createDate(5),
    nextPostponementReason: 'لإبراز الوكالة',
    assignee: 'أحمد',
};

const session1_1_2: Session = {
    id: 'session-2',
    court: 'محكمة البداية المدنية الأولى',
    caseNumber: '123/2023',
    date: createDate(5),
    clientName: 'عبد الرحمن قضماني',
    opponentName: 'شركة الإسكان الحديثة',
    isPostponed: false,
    postponementReason: 'لإبراز الوكالة',
    assignee: 'أحمد',
};

const session2_1_1: Session = {
    id: 'session-3',
    court: 'محكمة العمل',
    caseNumber: '45/2024',
    date: createDate(2),
    clientName: 'فاطمة الزهراء',
    opponentName: 'المؤسسة التجارية المتحدة',
    isPostponed: false,
    assignee: 'فاطمة',
};

// --- Mock Stages ---
const stage1_1: Stage = {
    id: 'stage-1',
    court: 'محكمة البداية المدنية الأولى',
    caseNumber: '123/2023',
    firstSessionDate: createDate(-10),
    sessions: [session1_1_1, session1_1_2],
};

const stage2_1: Stage = {
    id: 'stage-2',
    court: 'محكمة العمل',
    caseNumber: '45/2024',
    firstSessionDate: createDate(2),
    sessions: [session2_1_1],
};

// --- Mock Cases ---
const case1: Case = {
    id: 'case-1',
    subject: 'نزاع عقاري على ملكية',
    clientName: 'عبد الرحمن قضماني',
    opponentName: 'شركة الإسكان الحديثة',
    stages: [stage1_1],
    feeAgreement: '10% من قيمة العقار عند الحكم النهائي',
    status: 'active',
};

const case2: Case = {
    id: 'case-2',
    subject: 'قضية عمالية - فصل تعسفي',
    clientName: 'فاطمة الزهراء',
    opponentName: 'المؤسسة التجارية المتحدة',
    stages: [stage2_1],
    feeAgreement: '500,000 ل.س مقدماً و 1,000,000 ل.س عند صدور الحكم',
    status: 'active',
};

const case3: Case = {
    id: 'case-3',
    subject: 'قضية إيجارية مغلقة',
    clientName: 'عبد الرحمن قضماني',
    opponentName: 'مستأجر سابق',
    stages: [],
    feeAgreement: 'مبلغ مقطوع 250,000 ل.س',
    status: 'closed',
};


// --- Mock Clients ---
export const mockClients: Client[] = [
    {
        id: 'client-1',
        name: 'عبد الرحمن قضماني',
        contactInfo: '0987654321 - a.kadmani@email.com',
        cases: [case1, case3],
    },
    {
        id: 'client-2',
        name: 'فاطمة الزهراء',
        contactInfo: '0912345678 - fatima.z@email.com',
        cases: [case2],
    },
     {
        id: 'client-3',
        name: 'محمد الشامي',
        contactInfo: '0933445566',
        cases: [],
    },
];

// --- Mock Admin Tasks ---
export const mockAdminTasks: AdminTask[] = [
    {
        id: 'task-1',
        task: 'مراجعة السجل العقاري بخصوص القضية رقم 123/2023',
        dueDate: createDate(1),
        completed: false,
        importance: 'important',
        assignee: 'أحمد',
        location: 'السجل العقاري'
    },
    {
        id: 'task-2',
        task: 'تحضير لائحة الرد على قضية الفصل التعسفي',
        dueDate: createDate(3),
        completed: false,
        importance: 'urgent',
        assignee: 'فاطمة',
        location: 'المكتب'
    },
    {
        id: 'task-3',
        task: 'شراء مستلزمات مكتبية',
        dueDate: createDate(-2),
        completed: true,
        importance: 'normal',
        assignee: 'سارة',
        location: 'خارج المكتب'
    },
];

// --- Mock Appointments ---
export const mockAppointments: Appointment[] = [
    {
        id: 'apt-1',
        title: 'اجتماع مع الموكل عبد الرحمن قضماني',
        time: '11:00',
        date: createDate(0),
        importance: 'important',
        assignee: 'أحمد',
        completed: false,
        reminderTimeInMinutes: 15,
        notified: false,
    },
    {
        id: 'apt-2',
        title: 'مقابلة شاهد في قضية عمالية',
        time: '14:30',
        date: createDate(1),
        importance: 'normal',
        assignee: 'فاطمة',
        completed: true,
        reminderTimeInMinutes: 30,
        notified: true,
    },
];

// --- Mock Accounting Entries ---
export const mockAccountingEntries: AccountingEntry[] = [
    {
        id: 'acc-1',
        type: 'income',
        amount: 500000,
        date: createDate(-20),
        description: 'دفعة مقدمة - قضية فصل تعسفي',
        clientId: 'client-2',
        caseId: 'case-2',
        clientName: 'فاطمة الزهراء',
    },
    {
        id: 'acc-2',
        type: 'expense',
        amount: 25000,
        date: createDate(-15),
        description: 'رسوم قضائية - قضية نزاع عقاري',
        clientId: 'client-1',
        caseId: 'case-1',
        clientName: 'عبد الرحمن قضماني',
    },
     {
        id: 'acc-3',
        type: 'expense',
        amount: 15000,
        date: createDate(-5),
        description: 'مصاريف تنقلات للمحكمة',
        clientId: '',
        caseId: '',
        clientName: 'مصاريف عامة',
    },
];

// --- Mock Invoices ---
const invoice1Items: InvoiceItem[] = [
    { id: 'invitem-1', description: 'أتعاب محاماة - الدفعة الأولى', amount: 250000 },
    { id: 'invitem-2', description: 'رسوم ومصاريف قضائية', amount: 35000 },
];

export const mockInvoices: Invoice[] = [
    {
        id: 'INV-2024-001',
        clientId: 'client-1',
        clientName: 'عبد الرحمن قضماني',
        caseId: 'case-1',
        caseSubject: 'نزاع عقاري على ملكية',
        issueDate: createDate(-5),
        dueDate: createDate(10),
        items: invoice1Items,
        taxRate: 0,
        discount: 10000,
        status: 'sent',
        notes: 'يرجى سداد المبلغ قبل تاريخ الاستحقاق.'
    }
];

// --- Main mock data getter ---
export const getMockData = () => ({
    clients: mockClients,
    adminTasks: mockAdminTasks,
    appointments: mockAppointments,
    accountingEntries: mockAccountingEntries,
    invoices: mockInvoices,
    assistants: mockAssistants,
});