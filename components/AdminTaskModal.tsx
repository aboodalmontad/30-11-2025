import * as React from 'react';
import { AdminTask } from '../types';
import { toInputDateString } from '../utils/dateUtils';

interface AdminTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (taskData: Omit<AdminTask, 'id' | 'completed'> & { id?: string }) => void;
    initialData?: Partial<Omit<AdminTask, 'dueDate'>> & { dueDate?: string; id?: string };
    assistants: string[];
}

const AdminTaskModal: React.FC<AdminTaskModalProps> = ({ isOpen, onClose, onSubmit, initialData, assistants }) => {
    const [taskFormData, setTaskFormData] = React.useState({
        task: '',
        dueDate: toInputDateString(new Date()),
        importance: 'normal' as 'normal' | 'important' | 'urgent',
        assignee: 'بدون تخصيص',
        location: '',
    });
    
    // Effect to reset and populate form state when the modal opens.
    React.useEffect(() => {
        if (isOpen) {
            const defaultState = {
                task: '',
                dueDate: toInputDateString(new Date()),
                importance: 'normal' as const,
                assignee: 'بدون تخصيص',
                location: '',
            };
            setTaskFormData({ ...defaultState, ...initialData });
        }
    }, [isOpen, initialData]);

    const handleTaskFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setTaskFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTaskSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!taskFormData.task || !taskFormData.dueDate) return;

        const [year, month, day] = taskFormData.dueDate.split('-').map(Number);
        const taskDate = new Date(year, month - 1, day);

        // Explicitly construct the payload for onSubmit to ensure type safety and prevent spreading unwanted properties.
        onSubmit({
            // Spread taskFormData to include any other properties like orderIndex if they exist
            ...taskFormData,
            id: initialData?.id, // Override with id from initialData for editing
            dueDate: taskDate, // Use the parsed Date object
            location: taskFormData.location || 'غير محدد', // Ensure location has a default
        } as Omit<AdminTask, 'completed'> & { id?: string });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{initialData?.id ? 'تعديل مهمة' : 'إضافة مهمة جديدة'}</h2>
                <form onSubmit={handleTaskSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">المهمة</label>
                        <textarea name="task" value={taskFormData.task} onChange={handleTaskFormChange} className="w-full p-2 border rounded" rows={3} required />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">المكان</label>
                        <input 
                            type="text" 
                            name="location" 
                            list="locations"
                            value={taskFormData.location || ''} 
                            onChange={handleTaskFormChange} 
                            className="w-full p-2 border rounded" 
                            placeholder="مثال: القصر العدلي"
                        />
                        <datalist id="locations">
                            <option value="القصر العدلي" />
                            <option value="المكتب" />
                            <option value="السجل العقاري" />
                            <option value="السجل المدني" />
                            <option value="المالية" />
                        </datalist>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">تاريخ الاستحقاق</label>
                            <input type="date" name="dueDate" value={taskFormData.dueDate} onChange={handleTaskFormChange} className="w-full p-2 border rounded" placeholder="DD/MM/YYYY" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">الأهمية</label>
                            <select name="importance" value={taskFormData.importance} onChange={handleTaskFormChange} className="w-full p-2 border rounded" required>
                                <option value="normal">عادي</option>
                                <option value="important">مهم</option>
                                <option value="urgent">عاجل</option>
                            </select>
                        </div>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">تخصيص لـ</label>
                        <select name="assignee" value={taskFormData.assignee} onChange={handleTaskFormChange} className="w-full p-2 border rounded">
                            {assistants.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>
                    <div className="mt-6 flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminTaskModal;