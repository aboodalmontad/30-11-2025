
import * as React from 'react';
import { Session, Stage } from '../types';
import { formatDate, isBeforeToday, isWeekend, getPublicHoliday, parseInputDateString } from '../utils/dateUtils';
import { PencilIcon, TrashIcon, ScaleIcon, GavelIcon } from './icons';

interface SessionsTableProps {
    sessions: Session[];
    onPostpone?: (sessionId: string, newDate: Date, reason: string) => void;
    onEdit?: (session: Session) => void;
    onDelete?: (sessionId: string) => void;
    onDecide?: (session: Session) => void;
    showSessionDate?: boolean;
    onUpdate?: (sessionId: string, updatedFields: Partial<Session>) => void;
    assistants?: string[];
    allowPostponingPastSessions?: boolean;
    stage?: Stage;
    onContextMenu?: (event: React.MouseEvent, session: Session) => void;
}

const SessionsTable: React.FC<SessionsTableProps> = ({ sessions, onPostpone, onEdit, onDelete, onDecide, showSessionDate = false, onUpdate, assistants, allowPostponingPastSessions = false, stage, onContextMenu }) => {
    const [postponeData, setPostponeData] = React.useState<Record<string, { date: string; reason: string }>>({});
    const [errors, setErrors] = React.useState<Record<string, string>>({});
    const [editingCell, setEditingCell] = React.useState<{ sessionId: string; field: keyof Session } | null>(null);
    const [editValue, setEditValue] = React.useState<string | number | undefined>('');
    const longPressTimer = React.useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent, session: Session) => {
        if (!onContextMenu) return;
        longPressTimer.current = window.setTimeout(() => {
            const touch = e.touches[0];
            const mockEvent = { preventDefault: () => e.preventDefault(), clientX: touch.clientX, clientY: touch.clientY };
            onContextMenu(mockEvent as any, session);
        }, 500);
    };

    const handleTouchEnd = () => {
        if (longPressTimer.current !== null) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    };

    const handleInputChange = (sessionId: string, field: 'date' | 'reason', value: string) => {
        setPostponeData(prev => ({
            ...prev,
            [sessionId]: {
                ...(prev[sessionId] || { date: '', reason: '' }),
                [field]: value,
            },
        }));
        // Clear error when user edits fields
        if (errors[sessionId]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[sessionId];
                return newErrors;
            });
        }
    };
    
    const handlePostponeClick = (sessionId: string) => {
        if (!onPostpone) return;

        const data = postponeData[sessionId];
        const session = sessions.find(s => s.id === sessionId);

        if (!session) {
            console.error("Could not find session to postpone");
            return;
        }

        if (data && data.date && data.reason) {
            const newDate = parseInputDateString(data.date);

            if (!newDate) {
                setErrors(prev => ({ ...prev, [sessionId]: "التاريخ المحدد غير صالح." }));
                return;
            }
            
            // Normalize dates to the beginning of the day for accurate comparison
            const newDateStart = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate());
            const sessionDateStart = new Date(session.date.getFullYear(), session.date.getMonth(), session.date.getDate());

            if (newDateStart <= sessionDateStart) {
                setErrors(prev => ({ ...prev, [sessionId]: "تاريخ الجلسة القادمة يجب أن يكون بعد تاريخ الجلسة الحالية." }));
                return;
            }

            const holidayName = getPublicHoliday(newDate);
            const isWknd = isWeekend(newDate);

            if (holidayName || isWknd) {
                let warningMessage = `تنبيه: التاريخ الذي اخترته هو يوم عطلة`;
                if (holidayName) {
                    warningMessage += ` (${holidayName}).`;
                } else if (isWknd) {
                    const dayName = new Intl.DateTimeFormat('ar-SY', { weekday: 'long' }).format(newDate);
                    warningMessage += ` (${dayName}).`;
                }
                warningMessage += `\nهل أنت متأكد من ترحيل الجلسة إلى هذا اليوم؟`;
    
                if (!window.confirm(warningMessage)) {
                    return; // User cancelled
                }
            }

            // If we reach here, data is valid. Clear any existing error for this session.
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[sessionId];
                return newErrors;
            });

            onPostpone(sessionId, newDate, data.reason);
            setPostponeData(prev => {
                const newState = {...prev};
                delete newState[sessionId];
                return newState;
            });
        } else {
            setErrors(prev => ({ ...prev, [sessionId]: "يرجى إدخال تاريخ وسبب التأجيل." }));
        }
    };

    const handleCellClick = (session: Session, field: keyof Session) => {
        if (!onUpdate) return;
        const value = session[field];
        if (typeof value === 'boolean' || value instanceof Date) {
            return;
        }
        setEditingCell({ sessionId: session.id, field });
        setEditValue(value);
    };

    const handleSaveEdit = () => {
        if (!editingCell || !onUpdate) return;
        
        const currentSession = sessions.find(s => s.id === editingCell.sessionId);
        if (currentSession && currentSession[editingCell.field] !== editValue) {
             onUpdate(editingCell.sessionId, { [editingCell.field]: editValue });
        }
       
        setEditingCell(null);
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
    };

    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveEdit();
        } else if (e.key === 'Escape') {
            handleCancelEdit();
        }
    };

    if (sessions.length === 0) {
        return <p className="p-4 text-gray-500 text-center">لا توجد جلسات لعرضها.</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-right text-gray-600">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                    <tr>
                        <th className="px-2 sm:px-6 py-3">المحكمة</th>
                        <th className="px-2 sm:px-6 py-3">رقم الأساس</th>
                        {showSessionDate && <th className="px-2 sm:px-6 py-3">تاريخ الجلسة</th>}
                        <th className="px-2 sm:px-6 py-3">الموكل</th>
                        <th className="px-2 sm:px-6 py-3">الخصم</th>
                        <th className="px-2 sm:px-6 py-3">المكلف بالحضور</th>
                        <th className="px-2 sm:px-6 py-3">سبب التأجيل</th>
                        {/* Only show these headers if postponement is allowed/possible in general */}
                        <th className="px-2 sm:px-6 py-3 min-w-[170px]">تاريخ الجلسة القادمة</th>
                        <th className="px-2 sm:px-6 py-3 min-w-[200px]">سبب التأجيل القادم</th>
                        <th className="px-2 sm:px-6 py-3">إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => {
                        const isStageDecided = stage ? !!stage.decisionDate : !!s.stageDecisionDate;
                        // IMPORTANT: Only show postponement fields if onPostpone is provided AND other conditions met
                        const showPostponeFields = !!onPostpone && !s.isPostponed && !isStageDecided && (!isBeforeToday(s.date) || allowPostponingPastSessions);
                        const isEditing = (field: keyof Session) => onUpdate && editingCell?.sessionId === s.id && editingCell?.field === field;
                        const cellClasses = onUpdate ? "cursor-pointer hover:bg-blue-50 transition-colors duration-150" : "";
                        const nextReasonCellClasses = (onUpdate && s.isPostponed) ? "cursor-pointer hover:bg-blue-50 transition-colors duration-150" : "";

                        return (
                        <tr 
                            key={s.id} 
                            onContextMenu={(e) => onContextMenu && onContextMenu(e, s)}
                            onTouchStart={(e) => handleTouchStart(e, s)}
                            onTouchEnd={handleTouchEnd}
                            onTouchMove={handleTouchEnd}
                            className={`bg-white border-b hover:bg-gray-50 ${editingCell?.sessionId === s.id ? 'bg-blue-50' : ''}`}
                        >
                            <td className={`px-2 sm:px-6 py-4 ${cellClasses}`} onClick={() => !isEditing('court') && handleCellClick(s, 'court')}>
                                {isEditing('court') ? <input type="text" value={editValue || ''} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleInputKeyDown} className="p-1 border rounded bg-white w-full" autoFocus /> : s.court}
                            </td>
                            <td className={`px-2 sm:px-6 py-4 ${cellClasses}`} onClick={() => !isEditing('caseNumber') && handleCellClick(s, 'caseNumber')}>
                                {isEditing('caseNumber') ? <input type="text" value={editValue || ''} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleInputKeyDown} className="p-1 border rounded bg-white w-full" autoFocus /> : s.caseNumber}
                            </td>
                            {showSessionDate && <td className="px-2 sm:px-6 py-4">{formatDate(s.date)}</td>}
                            <td className={`px-2 sm:px-6 py-4 ${cellClasses}`} onClick={() => !isEditing('clientName') && handleCellClick(s, 'clientName')}>
                                {isEditing('clientName') ? <input type="text" value={editValue || ''} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleInputKeyDown} className="p-1 border rounded bg-white w-full" autoFocus /> : s.clientName}
                            </td>
                            <td className={`px-2 sm:px-6 py-4 ${cellClasses}`} onClick={() => !isEditing('opponentName') && handleCellClick(s, 'opponentName')}>
                                {isEditing('opponentName') ? <input type="text" value={editValue || ''} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleInputKeyDown} className="p-1 border rounded bg-white w-full" autoFocus /> : s.opponentName}
                            </td>
                            <td className={`px-2 sm:px-6 py-4 ${cellClasses}`} onClick={() => !isEditing('assignee') && handleCellClick(s, 'assignee')}>
                                {isEditing('assignee') ? <select value={editValue || 'بدون تخصيص'} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleInputKeyDown} className="p-1 border rounded bg-white w-full" autoFocus>{assistants?.map(a => <option key={a} value={a}>{a}</option>)}</select> : (s.assignee || '-')}
                            </td>
                            <td className={`px-2 sm:px-6 py-4 ${isStageDecided ? '' : cellClasses}`} onClick={() => !isEditing('postponementReason') && !isStageDecided && handleCellClick(s, 'postponementReason')}>
                                {isEditing('postponementReason') && !isStageDecided ? (
                                    <input type="text" value={editValue || ''} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleInputKeyDown} className="p-1 border rounded bg-white w-full" autoFocus />
                                ) : (
                                    s.postponementReason || 'لا يوجد'
                                )}
                            </td>
                            
                            {showPostponeFields ? (
                                <>
                                    <td className="px-2 sm:px-6 py-4">
                                        <input 
                                            type="date" 
                                            className={`p-2 border rounded-md w-full focus:outline-none focus:ring-2 ${errors[s.id] ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'}`}
                                            value={postponeData[s.id]?.date || ''}
                                            onChange={(e) => handleInputChange(s.id, 'date', e.target.value)}
                                            aria-label="تاريخ الجلسة القادمة"
                                            placeholder="DD/MM/YYYY"
                                        />
                                    </td>
                                    <td className="px-2 sm:px-6 py-4">
                                        <input 
                                            type="text" 
                                            placeholder="سبب التأجيل..." 
                                            className={`p-2 border rounded-md w-full focus:outline-none focus:ring-2 ${errors[s.id] ? 'border-red-500 focus:ring-red-500' : 'focus:ring-blue-500'}`}
                                            value={postponeData[s.id]?.reason || ''}
                                            onChange={(e) => handleInputChange(s.id, 'reason', e.target.value)}
                                            aria-label="سبب التأجيل القادم"
                                        />
                                    </td>
                                    <td className="px-2 sm:px-6 py-4">
                                        <div className="flex flex-col items-start gap-1">
                                            <div className="flex items-center gap-1">
                                                <button 
                                                    onClick={() => handlePostponeClick(s.id)}
                                                    className="px-3 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                                                    disabled={!postponeData[s.id]?.date || !postponeData[s.id]?.reason}
                                                    title="ترحيل"
                                                >
                                                    ترحيل
                                                </button>
                                                {onDecide && <button onClick={() => onDecide(s)} className="p-2 text-gray-500 hover:text-green-600" title="تسجيل قرار الحسم"><ScaleIcon className="w-4 h-4" /></button>}
                                                {onEdit && <button onClick={() => onEdit(s)} className="p-2 text-gray-500 hover:text-blue-600" aria-label="تعديل"><PencilIcon className="w-4 h-4" /></button>}
                                                {onDelete && <button onClick={() => onDelete(s.id)} className="p-2 text-gray-500 hover:text-red-600" aria-label="حذف"><TrashIcon className="w-4 h-4" /></button>}
                                            </div>
                                            {errors[s.id] && <p className="text-red-600 text-xs mt-1">{errors[s.id]}</p>}
                                        </div>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="px-2 sm:px-6 py-4 text-center">{s.nextSessionDate ? formatDate(s.nextSessionDate) : '-'}</td>
                                    <td className={`px-2 sm:px-6 py-4 ${nextReasonCellClasses}`} onClick={() => !isEditing('nextPostponementReason') && s.isPostponed && handleCellClick(s, 'nextPostponementReason')}>
                                        {isEditing('nextPostponementReason') ? <input type="text" value={editValue || ''} onChange={e => setEditValue(e.target.value)} onBlur={handleSaveEdit} onKeyDown={handleInputKeyDown} className="p-1 border rounded bg-white w-full" autoFocus /> : (s.nextPostponementReason || '-')}
                                    </td>
                                    <td className="px-2 sm:px-6 py-4 text-center">
                                       {(onEdit || onDelete) ? (
                                            <div className="flex items-center justify-center gap-2">
                                                {onEdit && <button onClick={() => onEdit(s)} className="p-2 text-gray-500 hover:text-blue-600" aria-label="تعديل"><PencilIcon className="w-4 h-4" /></button>}
                                                {onDelete && <button onClick={() => onDelete(s.id)} className="p-2 text-gray-500 hover:text-red-600" aria-label="حذف"><TrashIcon className="w-4 h-4" /></button>}
                                            </div>
                                       ) : (isStageDecided ? <GavelIcon className="w-5 h-5 text-green-600 mx-auto" title="تم حسم المرحلة"/> : '-')}
                                    </td>
                                </>
                            )}
                        </tr>
                    )})}
                </tbody>
            </table>
        </div>
    );
};

export default SessionsTable;
