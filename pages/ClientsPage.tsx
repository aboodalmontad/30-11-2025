
import * as React from 'react';
import ClientsTreeView from '../components/ClientsTreeView';
import ClientsListView from '../components/ClientsListView';
import { PlusIcon, SearchIcon, ListBulletIcon, ViewColumnsIcon, ExclamationTriangleIcon, PrintIcon, ScaleIcon, FolderOpenIcon, GavelIcon, AddressBookIcon } from '../components/icons';
import { Client, Case, Stage, Session, AccountingEntry } from '../types';
import { formatDate, toInputDateString, parseInputDateString } from '../utils/dateUtils';
import PrintableClientReport from '../components/PrintableClientReport';
import { printElement } from '../utils/printUtils';
import { MenuItem } from '../components/ContextMenu';
import { useDebounce } from '../hooks/useDebounce';
import { useData } from '../context/DataContext';

interface ClientsPageProps {
    onOpenAdminTaskModal: (initialData?: any) => void;
    showContextMenu: (event: React.MouseEvent, menuItems: MenuItem[]) => void;
    onCreateInvoice: (clientId: string, caseId?: string) => void;
}

const ClientsPage: React.FC<ClientsPageProps> = ({ showContextMenu, onOpenAdminTaskModal, onCreateInvoice }) => {
    const { 
        clients, 
        setClients, 
        accountingEntries, 
        setAccountingEntries, 
        assistants, 
        setFullData, 
        deleteClient, 
        deleteCase, 
        deleteStage, 
        deleteSession,
        postponeSession,
        permissions // Destructure permissions
    } = useData();
    const [modal, setModal] = React.useState<{ type: 'client' | 'case' | 'stage' | 'session' | null, context?: any, isEditing: boolean }>({ type: null, isEditing: false });
    const [formData, setFormData] = React.useState<any>({});
    const [searchQuery, setSearchQuery] = React.useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [viewMode, setViewMode] = React.useState<'tree' | 'list'>('tree');
    const [isDeleteSessionModalOpen, setIsDeleteSessionModalOpen] = React.useState(false);
    const [sessionToDelete, setSessionToDelete] = React.useState<{ sessionId: string, stageId: string, caseId: string, clientId: string, message: string } | null>(null);
    const [isDeleteCaseModalOpen, setIsDeleteCaseModalOpen] = React.useState(false);
    const [caseToDelete, setCaseToDelete] = React.useState<{ caseId: string, clientId: string, caseSubject: string } | null>(null);
    const [isDeleteClientModalOpen, setIsDeleteClientModalOpen] = React.useState(false);
    const [clientToDelete, setClientToDelete] = React.useState<Client | null>(null);
    const [isDeleteStageModalOpen, setIsDeleteStageModalOpen] = React.useState(false);
    const [stageToDelete, setStageToDelete] = React.useState<{ stageId: string; caseId: string; clientId: string; stageInfo: string } | null>(null);
    
    // State for contact picker support
    const [isContactPickerSupported, setIsContactPickerSupported] = React.useState(false);

    React.useEffect(() => {
        // Check if Contact Picker API is supported
        setIsContactPickerSupported('contacts' in navigator && 'ContactsManager' in window);
    }, []);

    // State for printing logic
    const [isPrintChoiceModalOpen, setIsPrintChoiceModalOpen] = React.useState(false);
    const [clientForPrintChoice, setClientForPrintChoice] = React.useState<Client | null>(null);
    const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);
    const [printData, setPrintData] = React.useState<{ client: Client; caseData?: Case; entries: AccountingEntry[]; totals: any } | null>(null);
    const printClientReportRef = React.useRef<HTMLDivElement>(null);

    // State for Decide Session Modal
    const [decideModal, setDecideModal] = React.useState<{ isOpen: boolean; session?: Session, stage?: Stage }>({ isOpen: false });
    const [decideFormData, setDecideFormData] = React.useState({ decisionNumber: '', decisionSummary: '', decisionNotes: '' });


    const filteredClients = React.useMemo(() => {
        if (!debouncedSearchQuery) return clients;
        const lowercasedQuery = debouncedSearchQuery.toLowerCase();

        return clients.map(client => {
            const matchingCases = client.cases.filter(c => 
                c.subject.toLowerCase().includes(lowercasedQuery) ||
                c.opponentName.toLowerCase().includes(lowercasedQuery) ||
                c.stages.some(s => 
                    s.court.toLowerCase().includes(lowercasedQuery) ||
                    s.caseNumber.toLowerCase().includes(lowercasedQuery) ||
                    s.sessions.some(session => 
                        (session.postponementReason && session.postponementReason.toLowerCase().includes(lowercasedQuery)) ||
                        (session.nextPostponementReason && session.nextPostponementReason.toLowerCase().includes(lowercasedQuery)) ||
                        (session.assignee && session.assignee.toLowerCase().includes(lowercasedQuery))
                    )
                )
            );

            if (client.name.toLowerCase().includes(lowercasedQuery) || client.contactInfo.toLowerCase().includes(lowercasedQuery)) {
                return client;
            }
            
            if (matchingCases.length > 0) {
                return { ...client, cases: matchingCases };
            }

            return null;
        }).filter((client): client is Client => client !== null);
    }, [clients, debouncedSearchQuery]);


    const handleOpenModal = (type: 'client' | 'case' | 'stage' | 'session', isEditing = false, context: any = {}) => {
        setModal({ type, context, isEditing });
        if (isEditing && context.item) {
            const item = context.item;
            if (type === 'session') {
                 setFormData({ ...item, date: toInputDateString(item.date), nextSessionDate: toInputDateString(item.nextSessionDate) });
            } else if (type === 'stage') {
                const { firstSessionDate, decisionDate, ...restOfStage } = item;
                setFormData({ 
                    ...restOfStage, 
                    firstSessionDate: toInputDateString(firstSessionDate),
                    decisionDate: toInputDateString(decisionDate)
                });
            } else {
                setFormData(item);
            }
        } else {
            setFormData(context.id ? { [`${type}Id`]: context.id } : {});
        }
    };

    const handleCloseModal = () => {
        setModal({ type: null, isEditing: false });
        setFormData({});
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        // @ts-ignore
        const val = isCheckbox ? e.target.checked : value;
        setFormData(prev => ({ ...prev, [name]: val }));
    };
    
    const handleImportContact = async () => {
        try {
            const props = ['name', 'tel'];
            const opts = { multiple: false };
            // @ts-ignore - Typescript might not know about contacts API
            const contacts = await navigator.contacts.select(props, opts);

            if (contacts.length > 0) {
                const contact = contacts[0];
                const name = contact.name ? contact.name[0] : '';
                const phone = contact.tel ? contact.tel[0] : '';

                setFormData((prev: any) => ({
                    ...prev,
                    name: name || prev.name,
                    contactInfo: phone || prev.contactInfo
                }));
            }
        } catch (ex) {
            console.error("Contact import failed or cancelled", ex);
        }
    };
    
    const onUpdateSession = (sessionId: string, updatedFields: Partial<Session>) => {
        setClients(currentClients => {
            return currentClients.map(client => ({
                ...client,
                updated_at: new Date(),
                cases: client.cases.map(caseItem => ({
                    ...caseItem,
                    updated_at: new Date(),
                    stages: caseItem.stages.map(stage => {
                        const sessionIndex = stage.sessions.findIndex(s => s.id === sessionId);
                        if (sessionIndex === -1) {
                            return stage;
                        }

                        const updatedSessions = [...stage.sessions];
                        updatedSessions[sessionIndex] = {
                            ...updatedSessions[sessionIndex],
                            ...updatedFields,
                            updated_at: new Date(),
                        };

                        return {
                            ...stage,
                            sessions: updatedSessions,
                            updated_at: new Date(),
                        };
                    }),
                })),
            }));
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { type, context, isEditing } = modal;

        if (type === 'client') {
            const clientName = formData.name?.trim();
            if (!clientName) {
                alert("اسم الموكل مطلوب.");
                return;
            }
            
            const normalizedClientName = clientName.toLowerCase();
            const foundClient = clients.find(c => c.name.trim().toLowerCase() === normalizedClientName);

            if (foundClient) {
                if (!isEditing) {
                    alert(`تنبيه: الموكل "${clientName}" موجود بالفعل.`);
                    return;
                }
                if (isEditing && context?.item?.id !== foundClient.id) {
                     alert(`تنبيه: الموكل "${clientName}" موجود بالفعل.`);
                     return;
                }
            }
            
            if (isEditing) {
                 if (context?.item?.id) {
                    setClients(prev => prev.map(c => c.id === context.item.id ? { ...c, ...formData, name: clientName, updated_at: new Date() } : c));
                }
            } else {
                const newClient: Client = { 
                    id: `client-${Date.now()}`, 
                    name: clientName, 
                    contactInfo: formData.contactInfo || '', 
                    cases: [],
                    updated_at: new Date(),
                };
                setClients(prev => [...prev, newClient]);
            }
        } else if (type === 'case') {
            if (isEditing) {
                setClients(prev => prev.map(c => c.id === context.client.id ? {
                    ...c,
                    updated_at: new Date(),
                    cases: c.cases.map(cs => cs.id === context.item.id ? { ...cs, ...formData, updated_at: new Date() } : cs)
                } : c));
            } else {
                const clientForCase = clients.find(c => c.id === context.clientId);
                if (clientForCase) {
                    const newCase: Case = {
                        id: `case-${Date.now()}`,
                        subject: formData.subject || 'قضية بدون موضوع',
                        opponentName: formData.opponentName || '',
                        feeAgreement: formData.feeAgreement || '',
                        status: formData.status || 'active',
                        clientName: clientForCase.name,
                        stages: [],
                        updated_at: new Date(),
                    };
        
                    const { court, caseNumber, firstSessionDate, firstSessionReason } = formData;
                    if (court || caseNumber || firstSessionDate) {
                        const parsedFirstSessionDate = parseInputDateString(firstSessionDate);
                        const newStage: Stage = {
                            id: `stage-${Date.now()}`,
                            court: court || 'غير محدد',
                            caseNumber: caseNumber || '',
                            firstSessionDate: parsedFirstSessionDate || undefined,
                            sessions: [],
                            updated_at: new Date(),
                        };
        
                        if (parsedFirstSessionDate) {
                            const newSession: Session = {
                                id: `session-${Date.now()}-first`,
                                court: newStage.court,
                                caseNumber: newStage.caseNumber,
                                date: parsedFirstSessionDate,
                                clientName: clientForCase.name,
                                opponentName: newCase.opponentName,
                                isPostponed: false,
                                postponementReason: firstSessionReason || undefined,
                                assignee: 'بدون تخصيص',
                                updated_at: new Date(),
                            };
                            newStage.sessions.push(newSession);
                        }
        
                        newCase.stages.push(newStage);
                    }
        
                    setClients(prev => prev.map(c => c.id === context.clientId ? { ...c, updated_at: new Date(), cases: [...c.cases, newCase] } : c));
                }
            }
        } else if (type === 'stage') {
            if (isEditing) {
                const stageData = { ...formData };
                stageData.firstSessionDate = parseInputDateString(stageData.firstSessionDate) || undefined;
                stageData.decisionDate = parseInputDateString(stageData.decisionDate) || undefined;
                
                setClients(prev => prev.map(c => c.id === context.client.id ? {
                    ...c,
                    updated_at: new Date(),
                    cases: c.cases.map(cs => cs.id === context.case.id ? {
                        ...cs,
                        updated_at: new Date(),
                        stages: cs.stages.map(st => st.id === context.item.id ? { ...st, ...stageData, updated_at: new Date() } : st)
                    } : cs)
                } : c));
            } else {
                const stageData = { ...formData };
                const parsedFirstSessionDate = parseInputDateString(stageData.firstSessionDate);
                const newStage: Stage = {
                    id: `stage-${Date.now()}`,
                    court: stageData.court || 'غير محدد',
                    caseNumber: stageData.caseNumber || '',
                    firstSessionDate: parsedFirstSessionDate || undefined,
                    sessions: [],
                    updated_at: new Date(),
                };
                 if (newStage.firstSessionDate) {
                    const client = clients.find(c => c.id === context.clientId);
                    const caseItem = client?.cases.find(c => c.id === context.caseId);
                    if (client && caseItem) {
                        newStage.sessions.push({
                            id: `session-${Date.now()}-first`,
                            court: newStage.court,
                            caseNumber: newStage.caseNumber,
                            date: newStage.firstSessionDate,
                            clientName: client.name,
                            opponentName: caseItem.opponentName,
                            isPostponed: false,
                            postponementReason: stageData.firstSessionReason || undefined,
                            assignee: 'بدون تخصيص',
                            updated_at: new Date(),
                        });
                    }
                }
                setClients(prev => prev.map(c => c.id === context.clientId ? {
                    ...c,
                    updated_at: new Date(),
                    cases: c.cases.map(cs => cs.id === context.caseId ? { ...cs, updated_at: new Date(), stages: [...cs.stages, newStage] } : cs)
                } : c));
            }
        } else if (type === 'session') {
            if (isEditing) {
                 const sessionData = { ...formData };
                 const parsedDate = parseInputDateString(sessionData.date);
                 if (!parsedDate) {
                     alert("تاريخ الجلسة غير صالح.");
                     return;
                 }
                 sessionData.date = parsedDate;
                 sessionData.nextSessionDate = parseInputDateString(sessionData.nextSessionDate) || undefined;

                 setClients(prev => prev.map(c => c.id === context.client.id ? {
                    ...c,
                    updated_at: new Date(),
                    cases: c.cases.map(cs => cs.id === context.case.id ? {
                        ...cs,
                        updated_at: new Date(),
                        stages: cs.stages.map(st => st.id === context.stage.id ? {
                            ...st,
                            updated_at: new Date(),
                            sessions: st.sessions.map(s => s.id === context.item.id ? { ...s, ...sessionData, updated_at: new Date() } : s)
                        } : st)
                    } : cs)
                } : c));
            } else {
                const parsedDate = parseInputDateString(formData.date);
                if (!parsedDate) {
                    alert("تاريخ الجلسة غير صالح.");
                    return;
                }
                const client = clients.find(c => c.id === context.clientId);
                const caseItem = client?.cases.find(c => c.id === context.caseId);
                const stage = caseItem?.stages.find(st => st.id === context.stageId);
                if (client && caseItem && stage) {
                    const newSession: Session = {
                        id: `session-${Date.now()}`,
                        date: parsedDate,
                        court: stage.court,
                        caseNumber: stage.caseNumber,
                        clientName: client.name,
                        opponentName: caseItem.opponentName,
                        isPostponed: false,
                        assignee: formData.assignee || 'بدون تخصيص',
                        updated_at: new Date(),
                    };
                    setClients(prev => prev.map(c => c.id === context.clientId ? {
                        ...c,
                        updated_at: new Date(),
                        cases: c.cases.map(cs => cs.id === context.caseId ? { 
                            ...cs, 
                            updated_at: new Date(), 
                            stages: cs.stages.map(st => st.id === context.stage.id ? {
                                ...st,
                                sessions: [...st.sessions, newSession],
                                updated_at: new Date(),
                            } : st)
                        } : cs)
                    } : c));
                }
            }
        }
        handleCloseModal();
    };
    
    // Deletion Handlers
    const handleDeleteClient = (client: Client) => {
        setClientToDelete(client);
        setIsDeleteClientModalOpen(true);
    };

    const handleConfirmDeleteClient = () => {
        if (clientToDelete) {
            deleteClient(clientToDelete.id);
        }
        setIsDeleteClientModalOpen(false);
        setClientToDelete(null);
    };

    const handleDeleteCase = (caseId: string, clientId: string, caseSubject: string) => {
        setCaseToDelete({ caseId, clientId, caseSubject });
        setIsDeleteCaseModalOpen(true);
    };

    const handleConfirmDeleteCase = () => {
        if (caseToDelete) {
            deleteCase(caseToDelete.caseId, caseToDelete.clientId);
        }
        setIsDeleteCaseModalOpen(false);
        setCaseToDelete(null);
    };
    
    const handleDeleteStage = (stageId: string, caseId: string, clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        const caseItem = client?.cases.find(c => c.id === caseId);
        const stage = caseItem?.stages.find(s => s.id === stageId);
        const stageInfo = stage ? `${stage.court} (${stage.caseNumber})` : 'هذه المرحلة';
        setStageToDelete({ stageId, caseId, clientId, stageInfo });
        setIsDeleteStageModalOpen(true);
    };
    
    const handleConfirmDeleteStage = () => {
        if (stageToDelete) {
            deleteStage(stageToDelete.stageId, stageToDelete.caseId, stageToDelete.clientId);
        }
        setIsDeleteStageModalOpen(false);
        setStageToDelete(null);
    };

    const handleDeleteSession = (sessionId: string, stageId: string, caseId: string, clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        const caseItem = client?.cases.find(c => c.id === caseId);
        const stage = caseItem?.stages.find(s => s.id === stageId);
        const session = stage?.sessions.find(s => s.id === sessionId);
        const message = session ? `جلسة يوم ${formatDate(session.date)} الخاصة بقضية ${caseItem?.subject}` : 'هذه الجلسة';
        setSessionToDelete({ sessionId, stageId, caseId, clientId, message });
        setIsDeleteSessionModalOpen(true);
    };

    const handleConfirmDeleteSession = () => {
        if (sessionToDelete) {
            deleteSession(sessionToDelete.sessionId, sessionToDelete.stageId, sessionToDelete.caseId, sessionToDelete.clientId);
        }
        setIsDeleteSessionModalOpen(false);
        setSessionToDelete(null);
    };
    
    // Printing
    const handlePrintClientStatement = (clientId: string) => {
        const client = clients.find(c => c.id === clientId);
        if (client) {
            setClientForPrintChoice(client);
            setIsPrintChoiceModalOpen(true);
        }
    };

    const handleGeneratePrintData = (client: Client, caseData?: Case) => {
        const entries = caseData 
            ? accountingEntries.filter(e => e.caseId === caseData.id)
            : accountingEntries.filter(e => e.clientId === client.id);
        
        const income = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const expense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        
        setPrintData({ client, caseData, entries, totals: { income, expense, balance: income - expense } });
        setIsPrintChoiceModalOpen(false);
        setIsPrintModalOpen(true);
    };
    
    // Decide Session
    const handleOpenDecideModal = (session: Session) => {
        if (!session.stageId) return;

        let foundStage: Stage | null = null;
        for (const client of clients) {
            for (const caseItem of client.cases) {
                const stage = caseItem.stages.find(st => st.id === session.stageId);
                if (stage) {
                    foundStage = stage;
                    break;
                }
            }
            if (foundStage) break;
        }

        if (!foundStage) return;

        setDecideFormData({ decisionNumber: foundStage.decisionNumber || '', decisionSummary: foundStage.decisionSummary || '', decisionNotes: foundStage.decisionNotes || '' });
        setDecideModal({ isOpen: true, session, stage: foundStage });
    };

    const handleCloseDecideModal = () => setDecideModal({ isOpen: false });

    const handleDecideSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { session, stage } = decideModal;
        if (!session || !stage) return;

        setClients(currentClients => currentClients.map(client => ({
            ...client,
            updated_at: new Date(),
            cases: client.cases.map(c => ({
                ...c,
                updated_at: new Date(),
                stages: c.stages.map(st => {
                    if (st.id === stage.id) {
                        return {
                            ...st,
                            decisionDate: session.date,
                            decisionNumber: decideFormData.decisionNumber,
                            decisionSummary: decideFormData.decisionSummary,
                            decisionNotes: decideFormData.decisionNotes,
                            updated_at: new Date(),
                        };
                    }
                    return st;
                })
            }))
        })));
        
        handleCloseDecideModal();
    };
    
    const getModalTitle = () => {
        const { type, isEditing } = modal;
        if (!type) return '';
        const action = isEditing ? 'تعديل' : 'إضافة';
        switch (type) {
            case 'client': return `${action} موكل`;
            case 'case': return `${action} قضية`;
            case 'stage': return `${action} مرحلة تقاضي`;
            case 'session': return `${action} جلسة`;
            default: return '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                 <h1 className="text-3xl font-bold text-gray-800">الموكلين والقضايا</h1>
                 <div className="flex items-center gap-2">
                    {permissions.can_add_client && (
                        <button onClick={() => handleOpenModal('client')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            <PlusIcon className="w-5 h-5" />
                            <span>إضافة موكل</span>
                        </button>
                    )}
                 </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow space-y-4">
                 <div className="flex justify-between items-center flex-wrap gap-4">
                    <div className="relative flex-grow">
                        <input type="search" placeholder="ابحث عن موكل، قضية، محكمة..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:w-80 p-2 ps-10 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500" />
                        <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                            <SearchIcon className="w-4 h-4 text-gray-500" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
                        <button onClick={() => setViewMode('tree')} className={`p-2 rounded-md ${viewMode === 'tree' ? 'bg-white shadow' : ''}`} title="عرض شجري"><ViewColumnsIcon className="w-5 h-5" /></button>
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white shadow' : ''}`} title="عرض قائمة"><ListBulletIcon className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>

            <div>
                {viewMode === 'tree' ? (
                    <ClientsTreeView 
                        clients={filteredClients} 
                        setClients={setClients} 
                        accountingEntries={accountingEntries} 
                        setAccountingEntries={setAccountingEntries} 
                        onAddCase={permissions.can_add_case ? (clientId) => handleOpenModal('case', false, { clientId }) : () => {}} 
                        onEditCase={permissions.can_edit_case ? (caseItem, client) => handleOpenModal('case', true, { item: caseItem, client }) : () => {}} 
                        onDeleteCase={permissions.can_delete_case ? (caseId, clientId) => handleDeleteCase(caseId, clientId, clients.find(c=>c.id===clientId)?.cases.find(cs=>cs.id===caseId)?.subject || 'هذه القضية') : () => {}} 
                        onAddStage={permissions.can_add_case ? (clientId, caseId) => handleOpenModal('stage', false, { clientId, caseId }) : () => {}}
                        onEditStage={permissions.can_edit_case ? (stage, caseItem, client) => handleOpenModal('stage', true, { item: stage, case: caseItem, client }) : () => {}} 
                        onDeleteStage={permissions.can_delete_case ? handleDeleteStage : () => {}} 
                        onAddSession={permissions.can_add_session ? (clientId, caseId, stageId) => handleOpenModal('session', false, { clientId, caseId, stageId }) : () => {}} 
                        onEditSession={permissions.can_edit_session ? (session, stage, caseItem, client) => handleOpenModal('session', true, { item: session, stage, case: caseItem, client }) : () => {}} 
                        onDeleteSession={permissions.can_delete_session ? handleDeleteSession : () => {}} 
                        onEditClient={permissions.can_edit_client ? (client) => handleOpenModal('client', true, { item: client }) : () => {}} 
                        onDeleteClient={permissions.can_delete_client ? (clientId) => handleDeleteClient(clients.find(c=>c.id===clientId)!) : () => {}} 
                        onPrintClientStatement={handlePrintClientStatement} 
                        assistants={assistants} 
                        onPostponeSession={permissions.can_postpone_session ? postponeSession : undefined} 
                        onUpdateSession={permissions.can_edit_session ? onUpdateSession : undefined} 
                        onDecide={permissions.can_decide_session ? handleOpenDecideModal : undefined} 
                        showContextMenu={showContextMenu} 
                        onOpenAdminTaskModal={onOpenAdminTaskModal} 
                        onCreateInvoice={onCreateInvoice}
                        permissions={permissions} 
                    />
                ) : (
                    <ClientsListView 
                        clients={filteredClients} 
                        setClients={setClients} 
                        accountingEntries={accountingEntries} 
                        setAccountingEntries={setAccountingEntries} 
                        onAddCase={permissions.can_add_case ? (clientId) => handleOpenModal('case', false, { clientId }) : () => {}} 
                        onEditCase={permissions.can_edit_case ? (caseItem, client) => handleOpenModal('case', true, { item: caseItem, client }) : () => {}} 
                        onDeleteCase={permissions.can_delete_case ? (caseId, clientId) => handleDeleteCase(caseId, clientId, clients.find(c=>c.id===clientId)?.cases.find(cs=>cs.id===caseId)?.subject || 'هذه القضية') : () => {}} 
                        onAddStage={permissions.can_add_case ? (clientId, caseId) => handleOpenModal('stage', false, { clientId, caseId }) : () => {}} 
                        onEditStage={permissions.can_edit_case ? (stage, caseItem, client) => handleOpenModal('stage', true, { item: stage, case: caseItem, client }) : () => {}} 
                        onDeleteStage={permissions.can_delete_case ? handleDeleteStage : () => {}} 
                        onAddSession={permissions.can_add_session ? (clientId, caseId, stageId) => handleOpenModal('session', false, { clientId, caseId, stageId }) : () => {}} 
                        onEditSession={permissions.can_edit_session ? (session, stage, caseItem, client) => handleOpenModal('session', true, { item: session, stage, case: caseItem, client }) : () => {}} 
                        onDeleteSession={permissions.can_delete_session ? handleDeleteSession : () => {}} 
                        onEditClient={permissions.can_edit_client ? (client) => handleOpenModal('client', true, { item: client }) : () => {}} 
                        onDeleteClient={permissions.can_delete_client ? (clientId) => handleDeleteClient(clients.find(c=>c.id===clientId)!) : () => {}} 
                        onPrintClientStatement={handlePrintClientStatement} 
                        assistants={assistants} 
                        onPostponeSession={permissions.can_postpone_session ? postponeSession : undefined} 
                        onUpdateSession={permissions.can_edit_session ? onUpdateSession : undefined} 
                        onDecide={permissions.can_decide_session ? handleOpenDecideModal : undefined} 
                        showContextMenu={showContextMenu} 
                        onOpenAdminTaskModal={onOpenAdminTaskModal} 
                        onCreateInvoice={onCreateInvoice}
                        permissions={permissions}
                    />
                )}
            </div>

            {modal.type && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handleCloseModal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">{getModalTitle()}</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* ... (Client, Case, Stage forms remain same) ... */}
                            {modal.type === 'client' && (
                                <>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className="block text-sm font-medium">اسم الموكل</label>
                                        {isContactPickerSupported && (
                                            <button 
                                                type="button" 
                                                onClick={handleImportContact}
                                                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                                            >
                                                <AddressBookIcon className="w-4 h-4" />
                                                استيراد من جهات الاتصال
                                            </button>
                                        )}
                                    </div>
                                    <input type="text" name="name" value={formData.name || ''} onChange={handleFormChange} className="w-full p-2 border rounded mt-1" required />
                                </div>
                                <div><label className="block text-sm font-medium">معلومات الاتصال</label><input type="text" name="contactInfo" value={formData.contactInfo || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div>
                                </>
                            )}
                            {modal.type === 'case' && (
                                <>
                                <div><label className="block text-sm font-medium">موضوع القضية</label><input type="text" name="subject" value={formData.subject || ''} onChange={handleFormChange} className="w-full p-2 border rounded" required /></div>
                                <div><label className="block text-sm font-medium">اسم الخصم</label><input type="text" name="opponentName" value={formData.opponentName || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div>
                                <div><label className="block text-sm font-medium">اتفاقية الأتعاب</label><textarea name="feeAgreement" value={formData.feeAgreement || ''} onChange={handleFormChange} className="w-full p-2 border rounded" rows={3}></textarea></div>
                                <div><label className="block text-sm font-medium">حالة القضية</label><select name="status" value={formData.status || 'active'} onChange={handleFormChange} className="w-full p-2 border rounded"><option value="active">نشطة</option><option value="closed">مغلقة</option><option value="on_hold">معلقة</option></select></div>
                                {!modal.isEditing && <div className="p-4 bg-gray-50 border rounded-lg space-y-4"><h3 className="font-semibold text-gray-700">إضافة المرحلة الأولى (اختياري)</h3><div><label className="block text-xs font-medium">المحكمة</label><input type="text" name="court" value={formData.court || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium">رقم الأساس</label><input type="text" name="caseNumber" value={formData.caseNumber || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div><div><label className="block text-xs font-medium">تاريخ أول جلسة</label><input type="date" name="firstSessionDate" value={formData.firstSessionDate || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div></div><div><label className="block text-xs font-medium">سبب التأجيل (إن وجد)</label><input type="text" name="firstSessionReason" value={formData.firstSessionReason || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div></div>}
                                </>
                            )}
                            {modal.type === 'stage' && (
                                <>
                                <div><label className="block text-sm font-medium">المحكمة</label><input type="text" name="court" value={formData.court || ''} onChange={handleFormChange} className="w-full p-2 border rounded" required/></div>
                                <div><label className="block text-sm font-medium">رقم الأساس</label><input type="text" name="caseNumber" value={formData.caseNumber || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div>
                                {!modal.isEditing && <div><label className="block text-sm font-medium">تاريخ أول جلسة (اختياري)</label><input type="date" name="firstSessionDate" value={formData.firstSessionDate || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div>}
                                {!modal.isEditing && <div><label className="block text-sm font-medium">سبب التأجيل الأول (إن وجد)</label><input type="text" name="firstSessionReason" value={formData.firstSessionReason || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div>}
                                {modal.isEditing && <div className="p-4 bg-gray-50 border rounded-lg space-y-4"><h3 className="font-semibold">قرار الحسم (إن وجد)</h3><div className="grid grid-cols-2 gap-4"><div><label className="block text-xs font-medium">تاريخ الحسم</label><input type="date" name="decisionDate" value={formData.decisionDate || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div><div><label className="block text-xs font-medium">رقم القرار</label><input type="text" name="decisionNumber" value={formData.decisionNumber || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div></div><div><label className="block text-xs font-medium">ملخص القرار</label><textarea name="decisionSummary" value={formData.decisionSummary || ''} onChange={handleFormChange} className="w-full p-2 border rounded" rows={2}></textarea></div><div><label className="block text-xs font-medium">ملاحظات</label><textarea name="decisionNotes" value={formData.decisionNotes || ''} onChange={handleFormChange} className="w-full p-2 border rounded" rows={2}></textarea></div></div>}
                                </>
                            )}
                            {modal.type === 'session' && (
                                <>
                                <div><label className="block text-sm font-medium">تاريخ الجلسة</label><input type="date" name="date" value={formData.date || ''} onChange={handleFormChange} className="w-full p-2 border rounded" required /></div>
                                {modal.isEditing && <div><label className="block text-sm font-medium">سبب التأجيل (السابق)</label><input type="text" name="postponementReason" value={formData.postponementReason || ''} onChange={handleFormChange} className="w-full p-2 border rounded" /></div>}
                                <div><label className="block text-sm font-medium">المكلف بالحضور</label><select name="assignee" value={formData.assignee || 'بدون تخصيص'} onChange={handleFormChange} className="w-full p-2 border rounded">{assistants.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                                </>
                            )}
                            <div className="mt-6 flex justify-end gap-4"><button type="button" onClick={handleCloseModal} className="px-4 py-2 bg-gray-200 rounded-lg">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg">حفظ</button></div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* ... (Delete modals remain same) ... */}
            {isDeleteClientModalOpen && clientToDelete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => setIsDeleteClientModalOpen(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف الموكل</h3><p className="my-4">هل أنت متأكد من حذف الموكل "{clientToDelete.name}"؟ سيتم حذف جميع القضايا والبيانات المرتبطة به بشكل نهائي.</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => setIsDeleteClientModalOpen(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handleConfirmDeleteClient}>نعم، قم بالحذف</button></div></div></div>)}
            {isDeleteCaseModalOpen && caseToDelete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => setIsDeleteCaseModalOpen(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف القضية</h3><p className="my-4">هل أنت متأكد من حذف قضية "{caseToDelete.caseSubject}"؟</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => setIsDeleteCaseModalOpen(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handleConfirmDeleteCase}>نعم، قم بالحذف</button></div></div></div>)}
            {isDeleteStageModalOpen && stageToDelete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => setIsDeleteStageModalOpen(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف المرحلة</h3><p className="my-4">هل أنت متأكد من حذف مرحلة "{stageToDelete.stageInfo}"؟</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => setIsDeleteStageModalOpen(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handleConfirmDeleteStage}>نعم، قم بالحذف</button></div></div></div>)}
            {isDeleteSessionModalOpen && sessionToDelete && (<div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={() => setIsDeleteSessionModalOpen(false)}><div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}><div className="text-center"><div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div><h3 className="text-2xl font-bold">تأكيد حذف الجلسة</h3><p className="my-4">هل أنت متأكد من حذف "{sessionToDelete.message}"؟</p></div><div className="mt-6 flex justify-center gap-4"><button className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => setIsDeleteSessionModalOpen(false)}>إلغاء</button><button className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handleConfirmDeleteSession}>نعم، قم بالحذف</button></div></div></div>)}
            {isPrintChoiceModalOpen && clientForPrintChoice && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print" onClick={() => setIsPrintChoiceModalOpen(false)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 border-b pb-3">اختر كشف الحساب للطباعة</h2>
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                            <button onClick={() => handleGeneratePrintData(clientForPrintChoice)} className="w-full text-right px-4 py-3 bg-blue-50 text-blue-800 font-semibold rounded-lg hover:bg-blue-100">كشف حساب شامل للموكل</button>
                            {clientForPrintChoice.cases.map(c => <button key={c.id} onClick={() => handleGeneratePrintData(clientForPrintChoice, c)} className="w-full text-right block px-4 py-2 bg-gray-50 text-gray-800 rounded-md hover:bg-gray-100">كشف حساب قضية: {c.subject}</button>)}
                        </div>
                    </div>
                </div>
            )}
            {isPrintModalOpen && printData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] no-print" onClick={() => setIsPrintModalOpen(false)}>
                    <div className="bg-white p-2 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="overflow-y-auto" ref={printClientReportRef}><PrintableClientReport client={printData.client} caseData={printData.caseData} entries={printData.entries} totals={printData.totals} /></div>
                        <div className="mt-4 flex justify-end gap-4 border-t p-4"><button onClick={() => setIsPrintModalOpen(false)} className="px-6 py-2 bg-gray-200 rounded-lg">إغلاق</button><button onClick={() => printElement(printClientReportRef.current)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg"><PrintIcon className="w-5 h-5"/>طباعة</button></div>
                    </div>
                </div>
            )}
            {decideModal.isOpen && decideModal.session && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handleCloseDecideModal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><GavelIcon className="w-6 h-6"/> تسجيل قرار الحسم</h2>
                        <form onSubmit={handleDecideSubmit} className="space-y-4">
                            <div><label className="block text-sm font-medium">تاريخ الحسم</label><input type="date" value={toInputDateString(decideModal.session.date)} readOnly className="w-full p-2 border rounded bg-gray-100" /></div>
                            <div><label className="block text-sm font-medium">رقم القرار</label><input type="text" value={decideFormData.decisionNumber} onChange={e => setDecideFormData(p => ({...p, decisionNumber: e.target.value}))} className="w-full p-2 border rounded" /></div>
                            <div><label className="block text-sm font-medium">ملخص القرار</label><textarea value={decideFormData.decisionSummary} onChange={e => setDecideFormData(p => ({...p, decisionSummary: e.target.value}))} className="w-full p-2 border rounded" rows={3}></textarea></div>
                            <div><label className="block text-sm font-medium">ملاحظات</label><textarea value={decideFormData.decisionNotes} onChange={e => setDecideFormData(p => ({...p, decisionNotes: e.target.value}))} className="w-full p-2 border rounded" rows={2}></textarea></div>
                            <div className="mt-6 flex justify-end gap-4"><button type="button" onClick={handleCloseDecideModal} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ القرار</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ClientsPage;
