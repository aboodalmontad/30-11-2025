
import * as React from 'react';
import Calendar from '../components/Calendar';
import { Session, AdminTask, Appointment, Stage, Client } from '../types';
import { formatDate, isSameDay, isBeforeToday, toInputDateString } from '../utils/dateUtils';
import { PrintIcon, PlusIcon, PencilIcon, TrashIcon, SearchIcon, ExclamationTriangleIcon, CalendarIcon, ChevronLeftIcon, ScaleIcon, BuildingLibraryIcon, ShareIcon, UserIcon, ClipboardDocumentIcon, ClipboardDocumentCheckIcon, HomeIcon, ListBulletIcon, ViewColumnsIcon } from '../components/icons';
import SessionsTable from '../components/SessionsTable';
import PrintableReport from '../components/PrintableReport';
import { printElement } from '../utils/printUtils';
import { MenuItem } from '../components/ContextMenu';
import { useDebounce } from '../hooks/useDebounce';
import { useData } from '../context/DataContext';

// ... (Constants importanceMap, importanceMapAdminTasks, formatTime, and AppointmentsTable remain the same)
const importanceMap: { [key: string]: { text: string, className: string } } = {
    normal: { text: 'عادي', className: 'bg-gray-100 text-gray-800' },
    important: { text: 'مهم', className: 'bg-yellow-100 text-yellow-800' },
    urgent: { text: 'عاجل', className: 'bg-red-100 text-red-800' },
};

const importanceMapAdminTasks: { [key: string]: { text: string, className: string } } = {
    normal: { text: 'عادي', className: 'bg-gray-200 text-gray-800' },
    important: { text: 'مهم', className: 'bg-yellow-200 text-yellow-800' },
    urgent: { text: 'عاجل', className: 'bg-red-200 text-red-800' },
};

const formatTime = (time: string) => {
    if (!time) return '';
    let [hours, minutes] = time.split(':');
    let hh = parseInt(hours, 10);
    const ampm = hh >= 12 ? 'مساءً' : 'صباحًا';
    hh = hh % 12;
    hh = hh ? hh : 12; 
    const finalHours = hh.toString().padStart(2, '0');
    return `${finalHours}:${minutes} ${ampm}`;
};

const AppointmentsTable: React.FC<{ appointments: Appointment[], onAddAppointment: () => void, onEdit: (appointment: Appointment) => void, onDelete: (appointment: Appointment) => void, onContextMenu: (event: React.MouseEvent, appointment: Appointment) => void, onToggleComplete: (id: string) => void }> = React.memo(({ appointments, onAddAppointment, onEdit, onDelete, onContextMenu, onToggleComplete }) => {
    const longPressTimer = React.useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent, appointment: Appointment) => {
        longPressTimer.current = window.setTimeout(() => {
            const touch = e.touches[0];
            const mockEvent = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY };
            onContextMenu(mockEvent as any, appointment);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current !== null) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                <h3 className="text-lg font-bold">سجل المواعيد</h3>
                <button onClick={onAddAppointment} className="no-print flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                    <PlusIcon className="w-5 h-5" />
                    <span>موعد جديد</span>
                </button>
            </div>
            {appointments.length > 0 ? (
                 <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-600">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                            <tr>
                                <th className="px-6 py-3">تم</th>
                                <th className="px-6 py-3">الموعد</th>
                                <th className="px-6 py-3">الوقت</th>
                                <th className="px-6 py-3">الشخص المسؤول</th>
                                <th className="px-6 py-3">الأهمية</th>
                                <th className="px-6 py-3">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map(a => (
                                <tr 
                                    key={a.id} 
                                    onContextMenu={(e) => onContextMenu(e, a)}
                                    onTouchStart={(e) => handleTouchStart(e, a)}
                                    onTouchEnd={handleTouchEnd}
                                    onTouchMove={handleTouchEnd}
                                    className={`border-b transition-colors ${a.completed ? 'bg-green-50 text-gray-500 hover:bg-green-100' : 'bg-white hover:bg-gray-50'}`}>
                                    <td className="px-6 py-4">
                                        <input
                                            type="checkbox"
                                            checked={a.completed}
                                            onChange={() => onToggleComplete(a.id)}
                                            className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            aria-label={`Mark appointment ${a.title} as ${a.completed ? 'incomplete' : 'complete'}`}
                                        />
                                    </td>
                                    <td className={`px-6 py-4 ${a.completed ? 'line-through' : ''}`}>{a.title}</td>
                                    <td className={`px-6 py-4 ${a.completed ? 'line-through' : ''}`}>{formatTime(a.time)}</td>
                                    <td className={`px-6 py-4 ${a.completed ? 'line-through' : ''}`}>{a.assignee}</td>
                                    <td className="px-6 py-4">
                                         <span className={`px-2 py-1 text-xs font-medium rounded-full ${importanceMap[a.importance]?.className}`}>
                                            {importanceMap[a.importance]?.text}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 flex items-center gap-2">
                                        <button onClick={() => onEdit(a)} className="p-2 text-gray-500 hover:text-blue-600" aria-label="تعديل"><PencilIcon className="w-4 h-4" /></button>
                                        <button onClick={() => onDelete(a)} className="p-2 text-gray-500 hover:text-red-600" aria-label="حذف"><TrashIcon className="w-4 h-4" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <p className="p-4 text-gray-500">لا توجد مواعيد لهذا اليوم.</p>}
        </div>
    );
});

interface HomePageProps {
    onOpenAdminTaskModal: (initialData?: any) => void;
    showContextMenu: (event: React.MouseEvent, menuItems: MenuItem[]) => void;
    mainView: 'agenda' | 'adminTasks';
    selectedDate: Date;
    setSelectedDate: (date: Date) => void;
}

const HomePage: React.FC<HomePageProps> = ({ 
    onOpenAdminTaskModal, 
    showContextMenu,
    mainView,
    selectedDate,
    setSelectedDate 
}) => {
    const { 
        appointments, 
        allSessions, 
        setAppointments, 
        adminTasks, 
        setAdminTasks, 
        assistants, 
        deleteAdminTask, 
        deleteAppointment,
        unpostponedSessions,
        postponeSession,
        setClients,
        clients,
        adminTasksLayout,
        setAdminTasksLayout,
        locationOrder: savedLocationOrder,
        setLocationOrder: setSavedLocationOrder,
        permissions, // Destructure permissions
    } = useData();

    // ... (State variables and effects remain the same)
    const [calendarViewDate, setCalendarViewDate] = React.useState(selectedDate);
    type ViewMode = 'daily' | 'unpostponed' | 'upcoming';
    const [viewMode, setViewMode] = React.useState<ViewMode>('daily');
    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = React.useState(false);
    const [editingAppointment, setEditingAppointment] = React.useState<Appointment | null>(null);
    const [newAppointment, setNewAppointment] = React.useState<{ title: string; date: string; time: string; importance: 'normal' | 'important' | 'urgent'; reminderTimeInMinutes: number; assignee: string; }>({ title: '', date: '', time: '', importance: 'normal', reminderTimeInMinutes: 15, assignee: 'بدون تخصيص' });
    const [dateWarning, setDateWarning] = React.useState<string | null>(null);

    const [activeTaskTab, setActiveTaskTab] = React.useState<'pending' | 'completed'>('pending');
    const [adminTaskSearch, setAdminTaskSearch] = React.useState('');
    const debouncedAdminTaskSearch = useDebounce(adminTaskSearch, 300);
    const [isDeleteAppointmentModalOpen, setIsDeleteAppointmentModalOpen] = React.useState(false);
    const [appointmentToDelete, setAppointmentToDelete] = React.useState<Appointment | null>(null);
    const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = React.useState(false);
    const [taskToDelete, setTaskToDelete] = React.useState<AdminTask | null>(null);
    
    const draggedTaskId = React.useRef<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [dragOverTaskId, setDragOverTaskId] = React.useState<string | null>(null);
    const [dropPosition, setDropPosition] = React.useState<'before' | 'after' | null>(null);
    
    const [locationOrder, setLocationOrder] = React.useState<string[]>([]);
    const [draggedGroupLocation, setDraggedGroupLocation] = React.useState<string | null>(null);
    const [activeLocationTab, setActiveLocationTab] = React.useState<string>('');
    const [dragOverLocation, setDragOverLocation] = React.useState<string | null>(null);

    const [editingAssigneeTaskId, setEditingAssigneeTaskId] = React.useState<string | null>(null);
    
    const [decideModal, setDecideModal] = React.useState<{ isOpen: boolean; session?: Session, stage?: Stage }>({ isOpen: false });
    const [decideFormData, setDecideFormData] = React.useState({ decisionNumber: '', decisionSummary: '', decisionNotes: '' });
    
    React.useEffect(() => {
        setCalendarViewDate(selectedDate);
    }, [selectedDate]);

    // ... (Appointment and Task Handlers remain same)
    const handleOpenAddAppointmentModal = () => {
        setEditingAppointment(null);
        setNewAppointment({ title: '', date: toInputDateString(selectedDate), time: '', importance: 'normal', reminderTimeInMinutes: 15, assignee: 'بدون تخصيص' });
        setIsAppointmentModalOpen(true);
        setDateWarning(null);
    };

    const handleOpenEditAppointmentModal = (apt: Appointment) => {
        setEditingAppointment(apt);
        setNewAppointment({
            title: apt.title,
            date: toInputDateString(apt.date),
            time: apt.time,
            importance: apt.importance,
            reminderTimeInMinutes: apt.reminderTimeInMinutes ?? 15,
            assignee: apt.assignee ?? 'بدون تخصيص',
        });
        setIsAppointmentModalOpen(true);
    }

    const handleCloseAppointmentModal = () => {
        setIsAppointmentModalOpen(false);
        setEditingAppointment(null);
        setDateWarning(null);
    }
    
    const handleToggleAppointmentComplete = (id: string) => {
        setAppointments(prev => 
            prev.map(apt => 
                apt.id === id ? { ...apt, completed: !apt.completed, updated_at: new Date() } : apt
            )
        );
    };

    const handleAppointmentFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        if (name === 'date' && !editingAppointment) {
            const selectedInputDate = new Date(`${value}T00:00:00`);
            if (isBeforeToday(selectedInputDate)) {
                setDateWarning('تنبيه: التاريخ المحدد في الماضي.');
            } else {
                setDateWarning(null);
            }
        }
        
        const processedValue = name === 'reminderTimeInMinutes' ? Number(value) : value;
        setNewAppointment(prev => ({ ...prev, [name]: processedValue }));
    };

    const handleSaveAppointment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAppointment.title || !newAppointment.time || !newAppointment.date) return;
        
        const [year, month, day] = newAppointment.date.split('-').map(Number);
        const appointmentDate = new Date(year, month - 1, day);

        if (editingAppointment) {
            setAppointments(prev => prev.map(apt => apt.id === editingAppointment.id ? {
                ...apt,
                title: newAppointment.title,
                date: appointmentDate,
                time: newAppointment.time,
                importance: newAppointment.importance,
                reminderTimeInMinutes: newAppointment.reminderTimeInMinutes,
                assignee: newAppointment.assignee,
                notified: false,
                updated_at: new Date(),
            } : apt));
        } else {
            const newAppointmentObject: Appointment = {
                id: `apt-${Date.now()}`,
                title: newAppointment.title,
                time: newAppointment.time,
                date: appointmentDate,
                importance: newAppointment.importance,
                completed: false,
                reminderTimeInMinutes: newAppointment.reminderTimeInMinutes,
                assignee: newAppointment.assignee,
                notified: false,
                updated_at: new Date(),
            };
            setAppointments(prevAppointments => [...prevAppointments, newAppointmentObject]);
        }
        handleCloseAppointmentModal();
    };
    
    const openDeleteAppointmentModal = (appointment: Appointment) => {
        setAppointmentToDelete(appointment);
        setIsDeleteAppointmentModalOpen(true);
    };

    const closeDeleteAppointmentModal = () => {
        setAppointmentToDelete(null);
        setIsDeleteAppointmentModalOpen(false);
    };

    const handleConfirmDeleteAppointment = () => {
        if (appointmentToDelete) {
            deleteAppointment(appointmentToDelete.id);
            closeDeleteAppointmentModal();
        }
    };

    const openDeleteTaskModal = (task: AdminTask) => {
        setTaskToDelete(task);
        setIsDeleteTaskModalOpen(true);
    };

    const closeDeleteTaskModal = () => {
        setTaskToDelete(null);
        setIsDeleteTaskModalOpen(false);
    };

    const handleConfirmDeleteTask = () => {
        if (taskToDelete) {
            deleteAdminTask(taskToDelete.id);
            closeDeleteTaskModal();
        }
    };

    const handleToggleTaskComplete = (id: string) => {
        setAdminTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed, updated_at: new Date() } : t));
    };

    const handleAssigneeChange = (taskId: string, newAssignee: string) => {
        setAdminTasks(prevTasks =>
            prevTasks.map(t =>
                t.id === taskId ? { ...t, assignee: newAssignee, updated_at: new Date() } : t
            )
        );
        setEditingAssigneeTaskId(null);
    };

    const handleShareTask = (task: AdminTask) => {
        const message = [
            `*مهمة إدارية:*`,
            `*المهمة:* ${task.task}`,
            `*المكان:* ${task.location || 'غير محدد'}`,
            `*تاريخ الاستحقاق:* ${formatDate(task.dueDate)}`,
            `*الأهمية:* ${importanceMapAdminTasks[task.importance]?.text}`,
            `*المسؤول:* ${task.assignee || 'غير محدد'}`
        ].join('\n');

        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    // ... (Drag and Drop Handlers remain the same)
    const handleDragStart = (e: React.DragEvent, type: 'task' | 'group', id: string) => { e.stopPropagation(); document.body.classList.add('grabbing'); if (type === 'task') { e.dataTransfer.setData('application/lawyer-app-task-id', id); e.dataTransfer.effectAllowed = 'move'; draggedTaskId.current = id; } else { e.dataTransfer.setData('application/lawyer-app-group-location', id); e.dataTransfer.effectAllowed = 'move'; setDraggedGroupLocation(id); } setIsDragging(true); };
    const handleDragEnd = () => { document.body.classList.remove('grabbing'); draggedTaskId.current = null; setDraggedGroupLocation(null); setIsDragging(false); setDragOverTaskId(null); setDropPosition(null); setDragOverLocation(null); };

    const handleTaskDrop = (targetTaskId: string | null, targetLocation: string, position: 'before' | 'after') => {
        const currentDraggedId = draggedTaskId.current;
        if (!currentDraggedId) return;
    
        setAdminTasks(currentTasks => {
            const updatedTasks = currentTasks.map(t => ({...t}));
    
            const draggedTask = updatedTasks.find(t => t.id === currentDraggedId);
            if (!draggedTask) return currentTasks;
    
            const sourceLocation = draggedTask.location || 'غير محدد';
            const isChangingGroup = sourceLocation !== targetLocation;
            
            draggedTask.location = targetLocation;
            draggedTask.updated_at = new Date();
    
            let targetGroup = updatedTasks
                .filter(t => (t.location || 'غير محدد') === targetLocation)
                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
            const draggedTaskIndexInTarget = targetGroup.findIndex(t => t.id === currentDraggedId);
            if(draggedTaskIndexInTarget > -1) {
                targetGroup.splice(draggedTaskIndexInTarget, 1);
            }
    
            let insertIndex = targetGroup.length;
            if(targetTaskId) {
                const targetTaskIndexInTarget = targetGroup.findIndex(t => t.id === targetTaskId);
                if(targetTaskIndexInTarget > -1) {
                    insertIndex = position === 'before' ? targetTaskIndexInTarget : targetTaskIndexInTarget + 1;
                }
            }
            
            targetGroup.splice(insertIndex, 0, draggedTask);
    
            targetGroup.forEach((task, index) => {
                const originalTask = updatedTasks.find(t => t.id === task.id);
                if(originalTask && originalTask.orderIndex !== index) {
                    originalTask.orderIndex = index;
                    originalTask.updated_at = new Date();
                }
            });
    
            if (isChangingGroup) {
                const sourceGroup = updatedTasks
                    .filter(t => (t.location || 'غير محدد') === sourceLocation && t.id !== currentDraggedId)
                    .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    
                sourceGroup.forEach((task, index) => {
                    const originalTask = updatedTasks.find(t => t.id === task.id);
                    if(originalTask && originalTask.orderIndex !== index) {
                        originalTask.orderIndex = index;
                        originalTask.updated_at = new Date();
                    }
                });
            }
            
            return updatedTasks;
        });
    };
    
    const handleGroupDragOver = (e: React.DragEvent) => { e.preventDefault(); };
    const handleGroupDrop = (e: React.DragEvent, targetLocation: string) => { e.preventDefault(); const taskId = e.dataTransfer.getData('application/lawyer-app-task-id'); if (taskId) { handleTaskDrop(null, targetLocation, 'after'); } };

    // Session Handlers
    const handlePostponeSession = (sessionId: string, newDate: Date, newReason: string) => { postponeSession(sessionId, newDate, newReason); };
    const handleUpdateSession = (sessionId: string, updatedFields: Partial<Session>) => { setClients(currentClients => { return currentClients.map(client => ({ ...client, updated_at: new Date(), cases: client.cases.map(caseItem => ({ ...caseItem, updated_at: new Date(), stages: caseItem.stages.map(stage => { const sessionIndex = stage.sessions.findIndex(s => s.id === sessionId); if (sessionIndex === -1) { return stage; } const updatedSessions = [...stage.sessions]; updatedSessions[sessionIndex] = { ...updatedSessions[sessionIndex], ...updatedFields, updated_at: new Date(), }; return { ...stage, sessions: updatedSessions, updated_at: new Date(), }; }), })), })); }); };
    const handleOpenDecideModal = (session: Session) => { if (!session.stageId) { console.error("Cannot decide session: stageId is missing.", session); return; } let foundStage: Stage | null = null; for (const client of clients) { for (const caseItem of client.cases) { const stage = caseItem.stages.find(st => st.id === session.stageId); if (stage) { foundStage = stage; break; } } if (foundStage) break; } if (!foundStage) { console.error("Cannot decide session: Corresponding stage not found for stageId:", session.stageId); return; } setDecideFormData({ decisionNumber: '', decisionSummary: '', decisionNotes: '' }); setDecideModal({ isOpen: true, session, stage: foundStage }); };
    const handleCloseDecideModal = () => { setDecideModal({ isOpen: false }); };
    const handleDecideSubmit = (e: React.FormEvent) => { e.preventDefault(); const { session, stage } = decideModal; if (!session || !stage) return; setClients(currentClients => currentClients.map(client => ({ ...client, updated_at: new Date(), cases: client.cases.map(c => ({ ...c, updated_at: new Date(), stages: c.stages.map(st => { if (st.id === stage.id) { return { ...st, decisionDate: session.date, decisionNumber: decideFormData.decisionNumber, decisionSummary: decideFormData.decisionSummary, decisionNotes: decideFormData.decisionNotes, updated_at: new Date(), }; } return st; }) })) }))); handleCloseDecideModal(); };

    // Memos
    const dailyData = React.useMemo(() => ({ dailySessions: allSessions.filter(s => isSameDay(s.date, selectedDate)), dailyAppointments: appointments.filter(a => isSameDay(a.date, selectedDate)) }), [selectedDate, allSessions, appointments]);
    const upcomingSessions = React.useMemo(() => { const tomorrow = new Date(selectedDate); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0, 0, 0, 0); return allSessions.filter(s => new Date(s.date) >= tomorrow).sort((a, b) => a.date.getTime() - b.date.getTime()); }, [allSessions, selectedDate]);
    const groupedTasks: Record<string, AdminTask[]> = React.useMemo(() => {
        const isCompleted = activeTaskTab === 'completed';
        const filtered = adminTasks.filter(task => {
            const searchLower = debouncedAdminTaskSearch.toLowerCase();
            const matchesSearch = searchLower === '' || task.task.toLowerCase().includes(searchLower) || (task.assignee && task.assignee.toLowerCase().includes(searchLower)) || (task.location && task.location.toLowerCase().includes(searchLower));
            return task.completed === isCompleted && matchesSearch;
        });
        
        filtered.sort((a, b) => (a.orderIndex ?? Infinity) - (b.orderIndex ?? Infinity));

        return filtered.reduce((acc, task) => {
            const location = task.location || 'غير محدد';
            if (!acc[location]) {
                acc[location] = [];
            }
            acc[location].push(task);
            return acc;
        }, {} as Record<string, AdminTask[]>);
    }, [adminTasks, activeTaskTab, debouncedAdminTaskSearch]);
    
    React.useEffect(() => { const allKnownLocations = new Set(Object.keys(groupedTasks)); const currentSavedOrder = savedLocationOrder || []; const ordered = currentSavedOrder.filter(loc => allKnownLocations.has(loc)); const orderedSet = new Set(ordered); let changed = false; allKnownLocations.forEach(loc => { if (!orderedSet.has(loc)) { ordered.push(loc); changed = true; } }); if (changed || ordered.length !== currentSavedOrder.length) { setSavedLocationOrder(ordered); } setLocationOrder(ordered); }, [groupedTasks, savedLocationOrder, setSavedLocationOrder]);
    React.useEffect(() => { if (activeLocationTab && locationOrder.includes(activeLocationTab)) { return; } if (locationOrder.length > 0) { setActiveLocationTab(locationOrder[0]); } else { setActiveLocationTab(''); } }, [locationOrder, activeLocationTab]);

    const handleDateSelect = (date: Date) => { setSelectedDate(date); setViewMode('daily'); };
    const handleShowTodaysAgenda = () => { const today = new Date(); setSelectedDate(today); setCalendarViewDate(today); setViewMode('daily'); };
    const getTitle = () => { switch(viewMode) { case 'unpostponed': return "الجلسات غير المرحلة"; case 'upcoming': return `الجلسات القادمة (بعد ${formatDate(selectedDate)})`; case 'daily': default: return `جدول أعمال يوم: ${formatDate(selectedDate)}`; } };
    
    // ... (ContextMenu Handlers remain same)
    const handleAppointmentContextMenu = (event: React.MouseEvent, appointment: Appointment) => { const menuItems: MenuItem[] = [ { label: 'إرسال إلى المهام الإدارية', icon: <BuildingLibraryIcon className="w-4 h-4" />, onClick: () => { const description = `متابعة موعد "${appointment.title}" يوم ${formatDate(appointment.date)} الساعة ${formatTime(appointment.time)}.\nالمكلف: ${appointment.assignee || 'غير محدد'}.\nالأهمية: ${importanceMap[appointment.importance]?.text}.`; onOpenAdminTaskModal({ task: description, assignee: appointment.assignee, importance: appointment.importance, }); } }, { label: 'مشاركة عبر واتساب', icon: <ShareIcon className="w-4 h-4" />, onClick: () => { const message = [ `*موعد:* ${appointment.title}`, `*التاريخ:* ${formatDate(appointment.date)}`, `*الوقت:* ${formatTime(appointment.time)}`, `*المسؤول:* ${appointment.assignee || 'غير محدد'}`, `*الأهمية:* ${importanceMap[appointment.importance]?.text}` ].join('\n'); const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`; window.open(whatsappUrl, '_blank'); } } ]; showContextMenu(event, menuItems); }
    const handleSessionContextMenu = (event: React.MouseEvent, session: Session) => { let client, caseItem, stage; for (const c of clients) { for (const cs of c.cases) { const s = cs.stages.find(st => st.id === session.stageId); if (s) { client = c; caseItem = cs; stage = s; break; } } if (stage) break; } let description = ''; let message = ''; if (client && caseItem && stage) { const details = [ `*الموكل:* ${client.name}`, `*الخصم:* ${caseItem.opponentName}`, `*القضية:* ${caseItem.subject}`, `*المحكمة:* ${stage.court}`, `*رقم الأساس:* ${stage.caseNumber}`, `*تاريخ الجلسة:* ${formatDate(session.date)}`, `*المكلف بالحضور:* ${session.assignee || 'غير محدد'}`, `*سبب التأجيل السابق:* ${session.postponementReason || 'لا يوجد'}` ]; if (session.stageDecisionDate) { details.push('---'); details.push(`*تم حسم المرحلة:*`); details.push(`*تاريخ الحسم:* ${formatDate(new Date(session.stageDecisionDate))}`); if (stage.decisionNumber) details.push(`*رقم القرار:* ${stage.decisionNumber}`); if (stage.decisionSummary) details.push(`*ملخص القرار:* ${stage.decisionSummary}`); } description = `متابعة جلسة قضائية:\n- ${details.join('\n- ')}`; message = `*ملخص جلسة قضائية:*\n${details.join('\n')}`; } else { description = `متابعة جلسة قضية (${session.clientName} ضد ${session.opponentName}) يوم ${formatDate(session.date)} في محكمة ${session.court} (أساس: ${session.caseNumber}).\nسبب التأجيل السابق: ${session.postponementReason || 'لا يوجد'}.\nالمكلف بالحضور: ${session.assignee}.`; message = [ `*جلسة قضائية:*`, `*القضية:* ${session.clientName} ضد ${session.opponentName}`, `*المحكمة:* ${session.court} (أساس: ${session.caseNumber})`, `*التاريخ:* ${formatDate(session.date)}`, `*المسؤول:* ${session.assignee || 'غير محدد'}`, `*سبب التأجيل السابق:* ${session.postponementReason || 'لا يوجد'}` ].join('\n'); } const menuItems: MenuItem[] = [ { label: 'إرسال إلى المهام الإدارية', icon: <BuildingLibraryIcon className="w-4 h-4" />, onClick: () => { onOpenAdminTaskModal({ task: description, assignee: session.assignee, }); } }, { label: 'مشاركة عبر واتساب', icon: <ShareIcon className="w-4 h-4" />, onClick: () => { const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`; window.open(whatsappUrl, '_blank'); } } ]; showContextMenu(event, menuItems); }
    const handleAdminTaskContextMenu = (event: React.MouseEvent, task: AdminTask) => { const menuItems: MenuItem[] = [ { label: 'مشاركة عبر واتساب', icon: <ShareIcon className="w-4 h-4" />, onClick: () => handleShareTask(task), }, ]; showContextMenu(event, menuItems); };

    const adminTaskLongPressTimer = React.useRef<number | null>(null);
    const handleAdminTaskTouchStart = (e: React.TouchEvent, task: AdminTask) => { adminTaskLongPressTimer.current = window.setTimeout(() => { const touch = e.touches[0]; const mockEvent = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY }; handleAdminTaskContextMenu(mockEvent as any, task); }, 500); };
    const handleAdminTaskTouchEnd = () => { if (adminTaskLongPressTimer.current !== null) { window.clearTimeout(adminTaskLongPressTimer.current); adminTaskLongPressTimer.current = null; } };

    const renderTaskItem = (task: AdminTask, location: string) => ( <div key={task.id} draggable={activeTaskTab === 'pending'} onDragStart={e => handleDragStart(e, 'task', task.id)} onDragEnd={handleDragEnd} onDragOver={e => { if (activeTaskTab !== 'pending' || !draggedTaskId.current || draggedTaskId.current === task.id) return; e.preventDefault(); setDragOverTaskId(task.id); const rect = e.currentTarget.getBoundingClientRect(); const midpoint = rect.top + rect.height / 2; setDropPosition(e.clientY < midpoint ? 'before' : 'after'); }} onDragLeave={() => { setDragOverTaskId(null); setDropPosition(null); }} onDrop={e => { if (activeTaskTab !== 'pending' || !dropPosition) return; e.preventDefault(); e.stopPropagation(); handleTaskDrop(task.id, location, dropPosition); setDragOverTaskId(null); setDropPosition(null); }} onContextMenu={(e) => handleAdminTaskContextMenu(e, task)} onTouchStart={(e) => handleAdminTaskTouchStart(e, task)} onTouchEnd={handleAdminTaskTouchEnd} onTouchMove={handleAdminTaskTouchEnd} className={`relative p-3 border rounded-lg transition-all duration-150 ${draggedTaskId.current === task.id ? 'opacity-40 scale-95' : 'opacity-100 scale-100'} ${task.completed ? 'bg-green-50/70 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-sm'} ${activeTaskTab === 'pending' ? 'cursor-move' : ''}`} > {dragOverTaskId === task.id && dropPosition === 'before' && <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10"></div>} <div className="flex items-start gap-3"> <div className="flex-shrink-0 pt-1"> <input type="checkbox" checked={task.completed} onChange={() => handleToggleTaskComplete(task.id)} className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" /> </div> <div className="flex-grow min-w-0"> <p className={`font-medium text-base whitespace-pre-wrap ${task.completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>{task.task}</p> <div className="mt-2 flex items-center gap-x-4 gap-y-2 text-sm text-gray-600"> <div className="flex items-center gap-1.5" onClick={() => activeTaskTab === 'pending' && setEditingAssigneeTaskId(task.id)}> <UserIcon className="w-4 h-4 text-gray-400" /> {editingAssigneeTaskId === task.id ? ( <select value={task.assignee} onChange={(e) => handleAssigneeChange(task.id, e.target.value)} onBlur={() => setEditingAssigneeTaskId(null)} className="p-1 border rounded bg-white text-sm focus:ring-blue-500 focus:border-blue-500" autoFocus> {assistants.map(name => ( <option key={name} value={name}> {name} </option> ))} </select> ) : ( <span className={activeTaskTab === 'pending' ? 'cursor-pointer hover:text-blue-600' : ''}> {task.assignee || '-'} </span> )} </div> <div className="flex items-center gap-1.5"> <CalendarIcon className="w-4 h-4 text-gray-400" /> <span>{formatDate(task.dueDate)}</span> </div> <div className="flex items-center gap-1.5"> <span className={`px-2 py-1 text-xs font-semibold rounded-full ${importanceMapAdminTasks[task.importance]?.className}`}> {importanceMapAdminTasks[task.importance]?.text} </span> </div> </div> </div> <div className="flex flex-col sm:flex-row items-center gap-0 sm:gap-1 flex-shrink-0"> <button onClick={() => handleShareTask(task)} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-green-600 rounded-full" title="مشاركة عبر واتساب"><ShareIcon className="w-4 h-4" /></button> 
        {permissions.can_edit_admin_task && <button onClick={() => onOpenAdminTaskModal(task)} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 rounded-full"><PencilIcon className="w-4 h-4" /></button>} 
        {permissions.can_delete_admin_task && <button onClick={() => openDeleteTaskModal(task)} className="p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600 rounded-full"><TrashIcon className="w-4 h-4" /></button>} 
    </div> </div> {dragOverTaskId === task.id && dropPosition === 'after' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 rounded-full z-10"></div>} </div> );

    return (
        <div className="space-y-6">
            
            {mainView === 'agenda' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                    <div className="lg:col-span-1 bg-white p-4 rounded-lg shadow space-y-4 no-print">
                        <Calendar 
                            onDateSelect={handleDateSelect} 
                            selectedDate={selectedDate} 
                            sessions={allSessions} 
                            appointments={appointments}
                            currentDate={calendarViewDate}
                            setCurrentDate={setCalendarViewDate}
                        />
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setViewMode('unpostponed')}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 text-sm font-semibold ${viewMode === 'unpostponed' ? 'bg-red-700' : 'bg-red-600 hover:bg-red-700'}`}
                                >
                                    <ExclamationTriangleIcon className="w-5 h-5" />
                                    <span>غير المرحلة</span>
                                </button>
                                {unpostponedSessions.length > 0 && (
                                     <span className="absolute -top-2 -start-2 flex h-5 w-5 items-center justify-center rounded-full bg-yellow-400 text-black text-xs font-bold ring-2 ring-white animate-pulse" title={`${unpostponedSessions.length} جلسات غير مرحلة`}>
                                        {unpostponedSessions.length}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={handleShowTodaysAgenda}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm font-semibold ${viewMode === 'daily' ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                <CalendarIcon className="w-5 h-5" />
                                <span>أجندة اليوم</span>
                            </button>
                            <button
                                onClick={() => setViewMode('upcoming')}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-sm font-semibold ${viewMode === 'upcoming' ? 'bg-green-700' : 'bg-green-600 hover:bg-green-700'}`}
                            >
                                <ChevronLeftIcon className="w-5 h-5" />
                                <span>القادمة</span>
                            </button>
                        </div>
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                         <div id="print-section">
                            <div className="mb-4">
                                <h2 className="text-2xl font-semibold">{getTitle()}</h2>
                            </div>
                            <div className="space-y-6">
                                {viewMode === 'daily' && (
                                    <>
                                        <div className="bg-white rounded-lg shadow overflow-hidden">
                                            <h3 className="text-lg font-bold p-4 bg-gray-50 border-b">جدول الجلسات</h3>
                                            <SessionsTable 
                                                sessions={dailyData.dailySessions} 
                                                onPostpone={permissions.can_postpone_session ? handlePostponeSession : undefined} 
                                                onUpdate={permissions.can_edit_session ? handleUpdateSession : undefined} 
                                                onDecide={permissions.can_decide_session ? handleOpenDecideModal : undefined} 
                                                assistants={assistants} 
                                                allowPostponingPastSessions={true} 
                                                onContextMenu={handleSessionContextMenu} 
                                            />
                                        </div>
                                        <AppointmentsTable 
                                            appointments={dailyData.dailyAppointments} 
                                            // ...
                                            onAddAppointment={permissions.can_add_admin_task ? handleOpenAddAppointmentModal : () => {}} // Using general task permission or add a new one for appointments
                                            // Note: Appointments currently don't have distinct permissions in the interface, using Admin Task ones as proxy or keep basic
                                            onEdit={permissions.can_edit_admin_task ? handleOpenEditAppointmentModal : () => {}}
                                            onDelete={permissions.can_delete_admin_task ? openDeleteAppointmentModal : () => {}}
                                            onContextMenu={handleAppointmentContextMenu} 
                                            onToggleComplete={handleToggleAppointmentComplete} 
                                        />
                                    </>
                                )}
                                {viewMode === 'unpostponed' && (
                                    <div className="bg-white rounded-lg shadow overflow-hidden">
                                        <SessionsTable 
                                            sessions={unpostponedSessions} 
                                            onPostpone={permissions.can_postpone_session ? handlePostponeSession : undefined} 
                                            onUpdate={permissions.can_edit_session ? handleUpdateSession : undefined} 
                                            onDecide={permissions.can_decide_session ? handleOpenDecideModal : undefined} 
                                            assistants={assistants} 
                                            allowPostponingPastSessions={true} 
                                            showSessionDate={true} 
                                            onContextMenu={handleSessionContextMenu} 
                                        />
                                    </div>
                                )}
                                {viewMode === 'upcoming' && (
                                    <div className="bg-white rounded-lg shadow overflow-hidden">
                                        <SessionsTable 
                                            sessions={upcomingSessions} 
                                            onPostpone={permissions.can_postpone_session ? handlePostponeSession : undefined} 
                                            onUpdate={permissions.can_edit_session ? handleUpdateSession : undefined} 
                                            onDecide={permissions.can_decide_session ? handleOpenDecideModal : undefined} 
                                            assistants={assistants} 
                                            showSessionDate={true} 
                                            onContextMenu={handleSessionContextMenu} 
                                        />
                                    </div>
                                )}
                            </div>
                         </div>
                    </div>
                </div>
            )}
            
            {mainView === 'adminTasks' && (
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow space-y-4 no-print animate-fade-in">
                    <div className="flex justify-between items-center flex-wrap gap-4 border-b pb-3">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-semibold">المهام الإدارية</h2>
                            {permissions.can_add_admin_task && (
                                <button onClick={() => onOpenAdminTaskModal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                                    <PlusIcon className="w-5 h-5" />
                                    <span>مهمة جديدة</span>
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1 p-1 bg-gray-200 rounded-lg">
                                <button onClick={() => setAdminTasksLayout('horizontal')} className={`p-2 rounded-md transition-colors ${adminTasksLayout === 'horizontal' ? 'bg-white shadow-sm' : 'hover:bg-gray-300'}`} title="عرض أفقي (قائمة)">
                                    <ListBulletIcon className="w-5 h-5 text-gray-700" />
                                </button>
                                <button onClick={() => setAdminTasksLayout('vertical')} className={`p-2 rounded-md transition-colors ${adminTasksLayout === 'vertical' ? 'bg-white shadow-sm' : 'hover:bg-gray-300'}`} title="عرض عمودي (أعمدة)">
                                    <ViewColumnsIcon className="w-5 h-5 text-gray-700" />
                                </button>
                            </div>
                            <div className="relative">
                                <input 
                                    type="search" 
                                    placeholder="ابحث عن مهمة..." 
                                    value={adminTaskSearch}
                                    onChange={(e) => setAdminTaskSearch(e.target.value)}
                                    className="w-full sm:w-64 p-2 ps-10 text-sm border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500" 
                                />
                                <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                                    <SearchIcon className="w-4 h-4 text-gray-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* ... (rest of admin tasks view) */}
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTaskTab('pending')}
                                className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${activeTaskTab === 'pending' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                المهام المعلقة
                            </button>
                            <button
                                onClick={() => setActiveTaskTab('completed')}
                                className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-sm ${activeTaskTab === 'completed' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                            >
                                المهام المنجزة
                            </button>
                        </nav>
                    </div>

                    {adminTasksLayout === 'vertical' ? (
                        <div className="flex flex-row gap-4 pt-4">
                            {locationOrder.length > 0 && (
                                <nav className="flex flex-col gap-2 w-28 flex-shrink-0" aria-label="Location Tabs">
                                    {locationOrder.map(location => (
                                        <button
                                            key={location}
                                            onClick={() => setActiveLocationTab(location)}
                                            draggable={activeTaskTab === 'pending'}
                                            onDragStart={e => handleDragStart(e, 'group', location)}
                                            onDragEnd={handleDragEnd}
                                            onDragOver={(e) => {
                                                if (draggedTaskId.current) {
                                                    e.preventDefault();
                                                    setDragOverLocation(location);
                                                } else if (draggedGroupLocation) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            onDragLeave={() => setDragOverLocation(null)}
                                            onDrop={e => {
                                                setDragOverLocation(null);
                                                if (draggedTaskId.current) {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleTaskDrop(null, location, 'after');
                                                } else { 
                                                    if (activeTaskTab !== 'pending') return;
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (!draggedGroupLocation || draggedGroupLocation === location) return;
                                                    const newOrder = [...locationOrder];
                                                    const sourceIndex = newOrder.indexOf(draggedGroupLocation);
                                                    const targetIndex = newOrder.indexOf(location);
                                                    if (sourceIndex === -1 || targetIndex === -1) return;
                                                    const [movedItem] = newOrder.splice(sourceIndex, 1);
                                                    newOrder.splice(targetIndex, 0, movedItem);
                                                    setLocationOrder(newOrder);
                                                    setSavedLocationOrder(newOrder);
                                                }
                                            }}
                                            className={`whitespace-normal break-words w-full text-right px-2 py-2 border-r-4 font-medium text-sm transition-colors duration-150 focus:outline-none ${activeTaskTab === 'pending' ? 'cursor-grab' : ''} ${
                                                activeLocationTab === location
                                                    ? 'border-blue-500 bg-blue-50 text-blue-600 font-semibold'
                                                    : 'border-transparent text-gray-600 hover:bg-gray-100'
                                            } ${
                                                draggedGroupLocation === location ? 'opacity-30' : 'opacity-100'
                                            } ${dragOverLocation === location ? 'bg-blue-200 border-blue-500' : ''}`}
                                        >
                                            {location}
                                        </button>
                                    ))}
                                </nav>
                            )}
                            <div className="flex-grow min-w-0">
                                 {locationOrder.length > 0 && activeLocationTab ? (
                                    <div 
                                        onDragOver={handleGroupDragOver}
                                        onDrop={e => handleGroupDrop(e, activeLocationTab)}
                                        className={`p-2 rounded-lg min-h-[200px] transition-colors duration-200 ${isDragging ? 'border-dashed border-blue-500 bg-blue-50' : 'bg-gray-50 border border-gray-200'}`}
                                    >
                                        {(groupedTasks[activeLocationTab] || []).length > 0 ? (
                                            <div className="space-y-3">
                                                {(groupedTasks[activeLocationTab] || []).map(task => renderTaskItem(task, activeLocationTab))}
                                            </div>
                                        ) : (
                                            <p className="text-center text-gray-500 py-8">لا توجد مهام في هذا المكان.</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center bg-gray-50 border border-dashed rounded-lg min-h-[200px]">
                                        <p className="text-center text-gray-500 py-8">
                                            {locationOrder.length > 0 ? "اختر مجموعة لعرض المهام" : "لا توجد مهام لعرضها."}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="pt-4">
                            {locationOrder.length > 0 ? (
                                <div>
                                    <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Location Tabs">
                                        {locationOrder.map(location => (
                                            <button
                                                key={location}
                                                onClick={() => setActiveLocationTab(location)}
                                                draggable={activeTaskTab === 'pending'}
                                                onDragStart={e => handleDragStart(e, 'group', location)}
                                                onDragEnd={handleDragEnd}
                                                onDragOver={(e) => {
                                                    if (draggedTaskId.current) {
                                                        e.preventDefault();
                                                        setDragOverLocation(location);
                                                    } else if (draggedGroupLocation) {
                                                        e.preventDefault();
                                                    }
                                                }}
                                                onDragLeave={() => setDragOverLocation(null)}
                                                onDrop={e => {
                                                    setDragOverLocation(null);
                                                    if (draggedTaskId.current) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleTaskDrop(null, location, 'after');
                                                    } else { // Existing group drop logic
                                                        if (activeTaskTab !== 'pending') return;
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (!draggedGroupLocation || draggedGroupLocation === location) return;
                                                        const newOrder = [...locationOrder];
                                                        const sourceIndex = newOrder.indexOf(draggedGroupLocation);
                                                        const targetIndex = newOrder.indexOf(location);
                                                        if (sourceIndex === -1 || targetIndex === -1) return;
                                                        const [movedItem] = newOrder.splice(sourceIndex, 1);
                                                        newOrder.splice(targetIndex, 0, movedItem);
                                                        setLocationOrder(newOrder);
                                                        setSavedLocationOrder(newOrder);
                                                    }
                                                }}
                                                className={`whitespace-nowrap py-3 px-4 border font-medium text-sm rounded-t-lg transition-colors duration-150 focus:outline-none ${activeTaskTab === 'pending' ? 'cursor-grab' : ''} ${
                                                    activeLocationTab === location
                                                        ? 'bg-gray-50 border-gray-200 border-b-gray-50 text-blue-600 font-semibold'
                                                        : 'bg-white border-transparent border-b-gray-200 text-gray-500 hover:text-gray-700'
                                                } ${
                                                    draggedGroupLocation === location ? 'opacity-30' : ''
                                                } ${dragOverLocation === location ? 'bg-blue-200' : ''}`}
                                            >
                                                {location}
                                            </button>
                                        ))}
                                    </nav>
                                    <div 
                                        onDragOver={handleGroupDragOver}
                                        onDrop={e => handleGroupDrop(e, activeLocationTab)}
                                        className={`p-2 sm:p-4 space-y-3 rounded-b-lg min-h-[100px] transition-colors duration-200 ${isDragging ? 'border-dashed border-blue-500 bg-blue-50' : 'bg-gray-50 border border-gray-200'}`}
                                    >
                                        {(groupedTasks[activeLocationTab] || []).length > 0 ? (
                                            (groupedTasks[activeLocationTab] || []).map(task => renderTaskItem(task, activeLocationTab))
                                        ) : (
                                            <p className="text-center text-gray-500 py-8">لا توجد مهام في هذا المكان.</p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center border border-dashed rounded-lg min-h-[200px]">
                                    <p className="text-center text-gray-500 py-8">لا توجد مهام لعرضها.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
           
            {isAppointmentModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handleCloseAppointmentModal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">{editingAppointment ? 'تعديل موعد' : 'إضافة موعد جديد'}</h2>
                        <form onSubmit={handleSaveAppointment}>
                            {/* ... (Appointment form inputs) ... */}
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">الموعد</label>
                                    <input type="text" id="title" name="title" value={newAppointment.title} onChange={handleAppointmentFormChange} className="mt-1 w-full p-2 border rounded" required />
                                </div>
                                <div>
                                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">التاريخ</label>
                                    <input type="date" id="date" name="date" value={newAppointment.date} onChange={handleAppointmentFormChange} className="mt-1 w-full p-2 border rounded" placeholder="DD/MM/YYYY" required />
                                    {dateWarning && (
                                        <p className="mt-1 text-xs text-yellow-600 flex items-center gap-1">
                                            <ExclamationTriangleIcon className="w-4 h-4" />
                                            {dateWarning}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label htmlFor="time" className="block text-sm font-medium text-gray-700">الوقت</label>
                                    <input type="time" id="time" name="time" value={newAppointment.time} onChange={handleAppointmentFormChange} className="mt-1 w-full p-2 border rounded" required />
                                </div>
                                <div>
                                    <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">الشخص المسؤول</label>
                                    <select id="assignee" name="assignee" value={newAppointment.assignee} onChange={handleAppointmentFormChange} className="mt-1 w-full p-2 border rounded">
                                        {assistants.map(name => <option key={name} value={name}>{name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="importance" className="block text-sm font-medium text-gray-700">الأهمية</label>
                                    <select id="importance" name="importance" value={newAppointment.importance} onChange={handleAppointmentFormChange} className="mt-1 w-full p-2 border rounded" required>
                                        <option value="normal">عادي</option>
                                        <option value="important">مهم</option>
                                        <option value="urgent">عاجل</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="reminderTimeInMinutes" className="block text-sm font-medium text-gray-700">تذكير قبل</label>
                                    <select id="reminderTimeInMinutes" name="reminderTimeInMinutes" value={newAppointment.reminderTimeInMinutes} onChange={handleAppointmentFormChange} className="mt-1 w-full p-2 border rounded" required>
                                        <option value="5">5 دقائق</option>
                                        <option value="10">10 دقائق</option>
                                        <option value="15">15 دقيقة</option>
                                        <option value="30">30 دقيقة</option>
                                        <option value="60">ساعة واحدة</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-4">
                                <button type="button" onClick={handleCloseAppointmentModal} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{editingAppointment ? 'حفظ التعديلات' : 'إضافة'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDeleteAppointmentModalOpen && appointmentToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={closeDeleteAppointmentModal}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                تأكيد حذف الموعد
                            </h3>
                            <p className="text-gray-600 my-4">
                                هل أنت متأكد من حذف موعد "{appointmentToDelete.title}"؟<br />
                                هذا الإجراء لا يمكن التراجع عنه.
                            </p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button
                                type="button"
                                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                                onClick={closeDeleteAppointmentModal}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                onClick={handleConfirmDeleteAppointment}
                            >
                                نعم، قم بالحذف
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteTaskModalOpen && taskToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={closeDeleteTaskModal}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900">
                                تأكيد حذف المهمة
                            </h3>
                            <p className="text-gray-600 my-4">
                                هل أنت متأكد من حذف مهمة "{taskToDelete.task}"؟<br />
                                هذا الإجراء لا يمكن التراجع عنه.
                            </p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button
                                type="button"
                                className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                                onClick={closeDeleteTaskModal}
                            >
                                إلغاء
                            </button>
                            <button
                                type="button"
                                className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
                                onClick={handleConfirmDeleteTask}
                            >
                                نعم، قم بالحذف
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {decideModal.isOpen && decideModal.session && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={handleCloseDecideModal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">تسجيل قرار الحسم</h2>
                        <form onSubmit={handleDecideSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">تاريخ الحسم</label>
                                <input type="date" value={toInputDateString(decideModal.session.date)} readOnly className="w-full p-2 border rounded bg-gray-100" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">رقم القرار</label>
                                <input type="text" value={decideFormData.decisionNumber} onChange={e => setDecideFormData(p => ({...p, decisionNumber: e.target.value}))} className="w-full p-2 border rounded" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">ملخص القرار</label>
                                <textarea value={decideFormData.decisionSummary} onChange={e => setDecideFormData(p => ({...p, decisionSummary: e.target.value}))} className="w-full p-2 border rounded" rows={3}></textarea>
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700">ملاحظات</label>
                                <textarea value={decideFormData.decisionNotes} onChange={e => setDecideFormData(p => ({...p, decisionNotes: e.target.value}))} className="w-full p-2 border rounded" rows={2}></textarea>
                            </div>
                            <div className="mt-6 flex justify-end gap-4">
                                <button type="button" onClick={handleCloseDecideModal} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ القرار</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePage;
