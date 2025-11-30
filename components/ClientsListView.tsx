
import * as React from 'react';
import { Client, Case, Stage, Session, AccountingEntry, CaseDocument, Permissions } from '../types';
import { PlusIcon, PencilIcon, TrashIcon, PrintIcon, ChevronLeftIcon, UserIcon, FolderIcon, ClipboardDocumentIcon, CalendarDaysIcon, GavelIcon, BuildingLibraryIcon, ShareIcon, DocumentTextIcon, DocumentDuplicateIcon } from './icons';
import SessionsTable from './SessionsTable';
import CaseAccounting from './CaseAccounting';
import { formatDate } from '../utils/dateUtils';
import { MenuItem } from './ContextMenu';
import CaseDocuments from './CaseDocuments';

interface ClientsListViewProps {
    clients: Client[];
    setClients: (updater: (prevClients: Client[]) => Client[]) => void;
    accountingEntries: AccountingEntry[];
    setAccountingEntries: (updater: (prev: AccountingEntry[]) => AccountingEntry[]) => void;
    onAddCase: (clientId: string) => void;
    onEditCase: (caseItem: Case, client: Client) => void;
    onDeleteCase: (caseId: string, clientId: string) => void;
    onAddStage: (clientId: string, caseId: string) => void;
    onEditStage: (stage: Stage, caseItem: Case, client: Client) => void;
    onDeleteStage: (stageId: string, caseId: string, clientId: string) => void;
    onAddSession: (clientId: string, caseId: string, stageId: string) => void;
    onEditSession: (session: Session, stage: Stage, caseItem: Case, client: Client) => void;
    onDeleteSession: (sessionId: string, stageId: string, caseId: string, clientId: string) => void;
    onPostponeSession?: (sessionId: string, newDate: Date, reason: string) => void;
    onEditClient: (client: Client) => void;
    onDeleteClient: (clientId: string) => void;
    onPrintClientStatement: (clientId: string) => void;
    assistants: string[];
    onUpdateSession?: (sessionId: string, updatedFields: Partial<Session>) => void;
    onDecide?: (session: Session) => void;
    showContextMenu: (event: React.MouseEvent, menuItems: MenuItem[]) => void;
    onOpenAdminTaskModal: (initialData?: any) => void;
    onCreateInvoice: (clientId: string, caseId?: string) => void;
    permissions?: Permissions;
}

const ClientCard: React.FC<{ client: Client; props: ClientsListViewProps; expanded: boolean; onToggle: () => void; }> = ({ client, props, expanded, onToggle }) => {
    const [expandedCaseId, setExpandedCaseId] = React.useState<string | null>(null);
    const [activeTab, setActiveTab] = React.useState<'stages' | 'accounting' | 'documents'>('stages');
    const clientLongPressTimer = React.useRef<number | null>(null);
    const caseLongPressTimer = React.useRef<number | null>(null);
    const stageLongPressTimer = React.useRef<number | null>(null);
    const { permissions } = props;

    const handleFeeChange = (caseId: string, newFee: string) => {
        props.setClients(clients => clients.map(c => c.id === client.id ? {
            ...c,
            updated_at: new Date(),
            cases: c.cases.map(cs => cs.id === caseId ? {...cs, feeAgreement: newFee, updated_at: new Date()} : cs)
        } : c));
    };
    
    // --- Context Menu Handlers ---
    const handleClientContextMenu = (event: React.MouseEvent) => {
        const menuItems: MenuItem[] = [{
            label: 'إرسال إلى المهام الإدارية',
            icon: <BuildingLibraryIcon className="w-4 h-4" />,
            onClick: () => {
                const description = `متابعة ملف الموكل: ${client.name}.\nمعلومات الاتصال: ${client.contactInfo || 'لا يوجد'}.`;
                props.onOpenAdminTaskModal({ task: description });
            }
        },
        {
            label: 'مشاركة عبر واتساب',
            icon: <ShareIcon className="w-4 h-4" />,
            onClick: () => {
                const message = [
                    `*ملف موكل:*`,
                    `*الاسم:* ${client.name}`,
                    `*معلومات الاتصال:* ${client.contactInfo || 'لا يوجد'}`,
                    `*عدد القضايا:* ${client.cases.length}`
                ].join('\n');
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            }
        }];
        props.showContextMenu(event, menuItems);
    };

    const handleCaseContextMenu = (event: React.MouseEvent, caseItem: Case) => {
        const statusMap: Record<Case['status'], string> = { active: 'نشطة', closed: 'مغلقة', on_hold: 'معلقة' };
        
        const details = [
            `*الموكل:* ${client.name}`,
            `*الخصم:* ${caseItem.opponentName}`,
            `*القضية:* ${caseItem.subject}`,
            `*الحالة:* ${statusMap[caseItem.status]}`
        ];

        let latestStage: Stage | null = null;
        let latestSession: Session | null = null;
        if (caseItem.stages.length > 0) {
            const allSessions = caseItem.stages.flatMap(s => s.sessions);
            if (allSessions.length > 0) {
                latestSession = allSessions.reduce((latest, current) => new Date(current.date) > new Date(latest.date) ? current : latest);
                latestStage = caseItem.stages.find(s => s.sessions.some(sess => sess.id === latestSession!.id)) || null;
            } else {
                latestStage = caseItem.stages[caseItem.stages.length - 1];
            }
        }
        
        if (latestStage) {
            details.push('---');
            details.push('*آخر مرحلة:*');
            details.push(`*المحكمة:* ${latestStage.court}`);
            details.push(`*رقم الأساس:* ${latestStage.caseNumber}`);

            if (latestSession) {
                details.push(`*تاريخ آخر جلسة:* ${formatDate(latestSession.date)}`);
            }
            
            if (latestStage.decisionDate) {
                details.push(`*تم حسم المرحلة:*`);
                details.push(`*تاريخ الحسم:* ${formatDate(new Date(latestStage.decisionDate))}`);
                if (latestStage.decisionNumber) details.push(`*رقم القرار:* ${latestStage.decisionNumber}`);
                if (latestStage.decisionSummary) details.push(`*ملخص القرار:* ${latestStage.decisionSummary}`);
            }
        }
        
        const description = `متابعة قضية:\n- ${details.join('\n- ')}`;
        const message = `*ملخص قضية:*\n${details.join('\n')}`;

        const menuItems: MenuItem[] = [{
            label: 'إنشاء فاتورة لهذه القضية',
            icon: <DocumentTextIcon className="w-4 h-4" />,
            onClick: () => props.onCreateInvoice(client.id, caseItem.id),
        },{
            label: 'إرسال إلى المهام الإدارية',
            icon: <BuildingLibraryIcon className="w-4 h-4" />,
            onClick: () => {
                 props.onOpenAdminTaskModal({ task: description });
            }
        },
        {
            label: 'مشاركة عبر واتساب',
            icon: <ShareIcon className="w-4 h-4" />,
            onClick: () => {
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            }
        }];
        props.showContextMenu(event, menuItems);
    };

    const handleStageContextMenu = (event: React.MouseEvent, stage: Stage, caseItem: Case) => {
        const latestSession = stage.sessions.length > 0 ? stage.sessions.reduce((latest, current) => new Date(current.date) > new Date(latest.date) ? current : latest) : null;

        const details = [
            `*الموكل:* ${client.name}`,
            `*الخصم:* ${caseItem.opponentName}`,
            `*القضية:* ${caseItem.subject}`,
            `*المحكمة:* ${stage.court}`,
            `*رقم الأساس:* ${stage.caseNumber}`
        ];

        if (latestSession) {
            details.push(`*تاريخ آخر جلسة:* ${formatDate(latestSession.date)}`);
        }

        if (stage.decisionDate) {
            details.push('---');
            details.push(`*تم حسم المرحلة:*`);
            details.push(`*تاريخ الحسم:* ${formatDate(new Date(stage.decisionDate))}`);
            if (stage.decisionNumber) details.push(`*رقم القرار:* ${stage.decisionNumber}`);
            if (stage.decisionSummary) details.push(`*ملخص القرار:* ${stage.decisionSummary}`);
        }

        const description = `متابعة مرحلة قضائية:\n- ${details.join('\n- ')}`;
        const message = `*ملخص مرحلة قضائية:*\n${details.join('\n')}`;

        const menuItems: MenuItem[] = [{
            label: 'إرسال إلى المهام الإدارية',
            icon: <BuildingLibraryIcon className="w-4 h-4" />,
            onClick: () => {
                props.onOpenAdminTaskModal({ task: description });
            }
        },
        {
            label: 'مشاركة عبر واتساب',
            icon: <ShareIcon className="w-4 h-4" />,
            onClick: () => {
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            }
        }];
        props.showContextMenu(event, menuItems);
    };

    const handleSessionContextMenu = (event: React.MouseEvent, session: Session, caseItem: Case, stage: Stage) => {
        const details = [
            `*الموكل:* ${client.name}`,
            `*الخصم:* ${caseItem.opponentName}`,
            `*القضية:* ${caseItem.subject}`,
            `*المحكمة:* ${stage.court}`,
            `*رقم الأساس:* ${stage.caseNumber}`,
            `*تاريخ الجلسة:* ${formatDate(session.date)}`,
            `*المكلف بالحضور:* ${session.assignee || 'غير محدد'}`,
            `*سبب التأجيل السابق:* ${session.postponementReason || 'لا يوجد'}`
        ];

        if (stage.decisionDate) {
            details.push('---');
            details.push(`*تم حسم المرحلة:*`);
            details.push(`*تاريخ الحسم:* ${formatDate(new Date(stage.decisionDate))}`);
            if (stage.decisionNumber) details.push(`*رقم القرار:* ${stage.decisionNumber}`);
            if (stage.decisionSummary) details.push(`*ملخص القرار:* ${stage.decisionSummary}`);
        }
        
        const description = `متابعة جلسة قضائية:\n- ${details.join('\n- ')}`;
        const message = `*ملخص جلسة قضائية:*\n${details.join('\n')}`;

        const menuItems: MenuItem[] = [{
            label: 'إرسال إلى المهام الإدارية',
            icon: <BuildingLibraryIcon className="w-4 h-4" />,
            onClick: () => {
                props.onOpenAdminTaskModal({ 
                    task: description,
                    assignee: session.assignee,
                });
            }
        },
        {
            label: 'مشاركة عبر واتساب',
            icon: <ShareIcon className="w-4 h-4" />,
            onClick: () => {
                const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            }
        }];
        props.showContextMenu(event, menuItems);
    };
    
    // --- Long Press Handlers ---
    const createTouchStartHandler = (timerRef: React.MutableRefObject<number | null>, callback: (e: React.TouchEvent) => void) => (e: React.TouchEvent) => {
        timerRef.current = window.setTimeout(() => {
            callback(e);
        }, 500);
    };
    const createTouchEndHandler = (timerRef: React.MutableRefObject<number | null>) => () => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    return (
        <div className="bg-sky-50 border rounded-lg shadow-sm">
            <header
                className="flex justify-between items-center p-4 cursor-pointer bg-sky-100 hover:bg-sky-200 transition-colors"
                onClick={onToggle}
                onContextMenu={handleClientContextMenu}
                onTouchStart={createTouchStartHandler(clientLongPressTimer, (e) => {
                    const touch = e.touches[0];
                    const mockEvent = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY };
                    handleClientContextMenu(mockEvent as any);
                })}
                onTouchEnd={createTouchEndHandler(clientLongPressTimer)}
                onTouchMove={createTouchEndHandler(clientLongPressTimer)}
            >
                <div className="flex items-center gap-3">
                    <UserIcon className="w-6 h-6 text-sky-700" />
                    <div>
                        <h3 className="font-bold text-lg text-sky-900">{client.name}</h3>
                        <p className="text-sm text-gray-500">{client.contactInfo}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded-full">{client.cases.length} قضايا</span>
                    <button onClick={(e) => { e.stopPropagation(); props.onPrintClientStatement(client.id); }} className="p-2 text-gray-500 hover:text-green-600" title="طباعة كشف حساب"><PrintIcon className="w-4 h-4" /></button>
                    {permissions?.can_edit_client && <button onClick={(e) => { e.stopPropagation(); props.onEditClient(client); }} className="p-2 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>}
                    {permissions?.can_delete_client && <button onClick={(e) => { e.stopPropagation(); props.onDeleteClient(client.id); }} className="p-2 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>}
                     <ChevronLeftIcon className={`w-5 h-5 transition-transform text-gray-500 ${expanded ? '-rotate-90' : ''}`} />
                </div>
            </header>
            {expanded && (
                <div className="border-t border-sky-200 p-4 space-y-3 bg-white">
                    <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-gray-800">قضايا الموكل</h4>
                        <div className="flex items-center gap-2">
                            {permissions?.can_add_case && (
                                <button onClick={() => props.onAddCase(client.id)} className="flex items-center gap-2 text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200">
                                    <PlusIcon className="w-4 h-4" />
                                    <span>قضية جديدة</span>
                                </button>
                            )}
                             <button onClick={() => props.onPrintClientStatement(client.id)} className="flex items-center gap-2 text-sm px-3 py-1 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
                                <PrintIcon className="w-4 h-4" />
                                <span>كشف حساب</span>
                            </button>
                        </div>
                    </div>
                    {client.cases.length > 0 ? (
                        client.cases.map(caseItem => (
                            <div key={caseItem.id} className="border rounded-md bg-indigo-50 overflow-hidden">
                                <div 
                                    className="flex justify-between items-center p-3 bg-indigo-100 cursor-pointer hover:bg-indigo-200" 
                                    onClick={() => setExpandedCaseId(expandedCaseId === caseItem.id ? null : caseItem.id)}
                                    onContextMenu={(e) => handleCaseContextMenu(e, caseItem)}
                                    onTouchStart={createTouchStartHandler(caseLongPressTimer, (e) => {
                                        const touch = e.touches[0];
                                        const mockEvent = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY };
                                        handleCaseContextMenu(mockEvent as any, caseItem);
                                    })}
                                    onTouchEnd={createTouchEndHandler(caseLongPressTimer)}
                                    onTouchMove={createTouchEndHandler(caseLongPressTimer)}
                                >
                                    <div className="flex items-center gap-2 text-indigo-800 font-semibold">
                                        <FolderIcon className="w-5 h-5 text-indigo-600" />
                                        <span>{caseItem.subject}</span>
                                        <span className="text-xs text-gray-500 font-normal">(ضد: {caseItem.opponentName})</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {permissions?.can_manage_invoices && <button onClick={(e) => { e.stopPropagation(); props.onCreateInvoice(client.id, caseItem.id); }} className="p-1 text-gray-500 hover:text-green-600" title="إنشاء فاتورة"><DocumentTextIcon className="w-4 h-4" /></button>}
                                        {permissions?.can_edit_case && <button onClick={(e) => { e.stopPropagation(); props.onEditCase(caseItem, client); }} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>}
                                        {permissions?.can_delete_case && <button onClick={(e) => { e.stopPropagation(); props.onDeleteCase(caseItem.id, client.id); }} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>}
                                        <ChevronLeftIcon className={`w-4 h-4 transition-transform ${expandedCaseId === caseItem.id ? '-rotate-90' : ''}`} />
                                    </div>
                                </div>
                                {expandedCaseId === caseItem.id && (
                                     <div className="p-3 bg-white">
                                        <div className="flex border-b mb-3">
                                            <button onClick={() => setActiveTab('stages')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'stages' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>المراحل والجلسات</button>
                                            <button onClick={() => setActiveTab('accounting')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'accounting' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>المحاسبة</button>
                                            <button onClick={() => setActiveTab('documents')} className={`px-4 py-2 text-sm font-medium ${activeTab === 'documents' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>الوثائق</button>
                                        </div>
                                        {activeTab === 'stages' && (
                                            <div>
                                                {permissions?.can_add_case && (
                                                    <button onClick={() => props.onAddStage(client.id, caseItem.id)} className="text-sm mb-2 flex items-center gap-1 px-2 py-1 bg-gray-200 rounded-md hover:bg-gray-300">
                                                        <PlusIcon className="w-4 h-4"/>
                                                        إضافة مرحلة
                                                    </button>
                                                )}
                                                {caseItem.stages.map(stage => (
                                                    <div key={stage.id} className="mt-2 border rounded bg-yellow-50 overflow-hidden">
                                                        <div 
                                                            className="p-3 bg-yellow-100 flex justify-between items-center"
                                                            onContextMenu={(e) => handleStageContextMenu(e, stage, caseItem)}
                                                            onTouchStart={createTouchStartHandler(stageLongPressTimer, (e) => {
                                                                const touch = e.touches[0];
                                                                const mockEvent = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY };
                                                                handleStageContextMenu(mockEvent as any, stage, caseItem);
                                                            })}
                                                            onTouchEnd={createTouchEndHandler(stageLongPressTimer)}
                                                            onTouchMove={createTouchEndHandler(stageLongPressTimer)}
                                                        >
                                                            <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                                                                <p className="font-semibold text-sm text-yellow-800 flex items-center gap-2">
                                                                    <ClipboardDocumentIcon className="w-4 h-4 text-yellow-600" />
                                                                    {stage.court} - {stage.caseNumber}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                {permissions?.can_add_session && <button onClick={(e) => { e.stopPropagation(); props.onAddSession(client.id, caseItem.id, stage.id); }} className="p-1 text-gray-500 hover:text-blue-600"><PlusIcon className="w-4 h-4" /></button>}
                                                                {permissions?.can_edit_case && <button onClick={(e) => { e.stopPropagation(); props.onEditStage(stage, caseItem, client); }} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>}
                                                                {permissions?.can_delete_case && <button onClick={(e) => { e.stopPropagation(); props.onDeleteStage(stage.id, caseItem.id, client.id); }} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>}
                                                            </div>
                                                        </div>
                                                        {stage.decisionDate && (
                                                            <div className="p-3 bg-green-100 border-t border-green-200 animate-fade-in text-sm text-gray-700">
                                                                <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                                                                    <div className="flex items-center">
                                                                        <GavelIcon className="w-4 h-4 text-green-700 me-2 flex-shrink-0" />
                                                                        <strong className="font-semibold">تاريخ الحسم:</strong>
                                                                        <span className="ms-1">{formatDate(new Date(stage.decisionDate))}</span>
                                                                    </div>
                                                                    {stage.decisionNumber && (
                                                                        <div className="flex items-center">
                                                                            <strong className="font-semibold">رقم القرار:</strong>
                                                                            <span className="ms-1">{stage.decisionNumber}</span>
                                                                        </div>
                                                                    )}
                                                                    {stage.decisionSummary && (
                                                                        <div className="flex items-baseline">
                                                                            <strong className="font-semibold flex-shrink-0">ملخص القرار:</strong>
                                                                            <span className="ms-1 whitespace-pre-wrap">{stage.decisionSummary}</span>
                                                                        </div>
                                                                    )}
                                                                    {stage.decisionNotes && (
                                                                        <div className="flex items-baseline">
                                                                            <strong className="font-semibold flex-shrink-0">ملاحظات:</strong>
                                                                            <span className="ms-1 whitespace-pre-wrap">{stage.decisionNotes}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                         <div className="p-2 bg-green-50 border-t border-green-200">
                                                            <h5 className="flex items-center gap-2 text-sm font-semibold text-gray-600 mb-2">
                                                                <CalendarDaysIcon className="w-4 h-4 text-gray-400"/>
                                                                الجلسات
                                                            </h5>
                                                            <SessionsTable
                                                                sessions={stage.sessions.map(s => ({ ...s, stageId: stage.id, stageDecisionDate: stage.decisionDate }))}
                                                                onPostpone={props.onPostponeSession}
                                                                onEdit={permissions?.can_edit_session ? (session) => props.onEditSession(session, stage, caseItem, client) : undefined}
                                                                onDelete={permissions?.can_delete_session ? (sessionId) => props.onDeleteSession(sessionId, stage.id, caseItem.id, client.id) : undefined}
                                                                onUpdate={props.onUpdateSession}
                                                                assistants={props.assistants}
                                                                onDecide={props.onDecide}
                                                                stage={stage}
                                                                showSessionDate={true}
                                                                onContextMenu={(e, session) => handleSessionContextMenu(e, session, caseItem, stage)}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {activeTab === 'accounting' && (
                                            <CaseAccounting
                                                caseData={caseItem}
                                                client={client}
                                                caseAccountingEntries={props.accountingEntries.filter(e => e.caseId === caseItem.id)}
                                                setAccountingEntries={props.setAccountingEntries}
                                                onFeeAgreementChange={(newFee) => handleFeeChange(caseItem.id, newFee)}
                                            />
                                        )}
                                        {activeTab === 'documents' && (
                                            <CaseDocuments caseId={caseItem.id} />
                                        )}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-center text-gray-500 py-3">لا توجد قضايا لهذا الموكل.</p>
                    )}
                </div>
            )}
        </div>
    );
};

const ClientsListView: React.FC<ClientsListViewProps> = (props) => {
    const [expandedClientId, setExpandedClientId] = React.useState<string | null>(null);

    const handleToggleClient = (clientId: string) => {
        setExpandedClientId(prevId => (prevId === clientId ? null : clientId));
    };

    if (props.clients.length === 0) {
        return <p className="p-6 text-center text-gray-500">لا يوجد موكلون لعرضهم. ابدأ بإضافة موكل جديد.</p>;
    }

    return (
        <div className="p-4 space-y-4">
            {props.clients.map(client => (
                <ClientCard 
                    key={client.id} 
                    client={client} 
                    props={props} 
                    expanded={expandedClientId === client.id}
                    onToggle={() => handleToggleClient(client.id)}
                />
            ))}
        </div>
    );
};

export default React.memo(ClientsListView);
