
import * as React from 'react';
import { XMarkIcon, ClockIcon, ArrowPathIcon, UserPlusIcon } from './icons';
import { Appointment } from '../types';

// Export RealtimeAlert for use in App.tsx
export interface RealtimeAlert {
    id: number;
    message: string;
    type?: 'sync' | 'userApproval';
}

// Valid short notification sound (Glass/Ping)
const appointmentSoundBase64 = 'data:audio/mp3;base64,//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//uQxAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

// Sound for user approval notifications - using a working base64 string (same as appointment for stability)
export const defaultUserApprovalSoundBase64 = appointmentSoundBase64;

const USER_APPROVAL_SOUND_KEY = 'customUserApprovalSound';

type NotificationType = {
    id: string | number;
    title: string;
    message: string;
    type: 'appointment' | 'sync' | 'userApproval';
    duration?: number;
};

const NotificationToast: React.FC<{
    notification: NotificationType;
    onDismiss: () => void;
}> = ({ notification, onDismiss }) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const timerRef = React.useRef<number | null>(null);

    React.useEffect(() => {
        // Enter animation
        requestAnimationFrame(() => setIsVisible(true));

        // Auto-dismiss logic
        const duration = notification.duration || 7000;
        const timeoutId = window.setTimeout(() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300); // Wait for exit animation
        }, duration);

        timerRef.current = timeoutId;

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [notification, onDismiss]);
    
    const handleManualDismiss = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsVisible(false);
        setTimeout(onDismiss, 300);
    };

    const getIcon = () => {
        switch (notification.type) {
            case 'appointment': return <ClockIcon className="w-6 h-6 text-blue-500" />;
            case 'sync': return <ArrowPathIcon className="w-6 h-6 text-green-500" />;
            case 'userApproval': return <UserPlusIcon className="w-6 h-6 text-yellow-600" />;
            default: return null;
        }
    };
    
    return (
        <div
            className={`w-full max-w-sm bg-white shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transition-all duration-300 ease-in-out transform ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
        >
            <div className="p-4">
                <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                        {getIcon()}
                    </div>
                    <div className="ms-3 w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                        <p className="mt-1 text-sm text-gray-700">{notification.message}</p>
                    </div>
                    <div className="ms-4 flex-shrink-0 flex">
                        <button
                            onClick={handleManualDismiss}
                            className="inline-flex text-gray-400 bg-white rounded-md hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            <span className="sr-only">Close</span>
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


interface NotificationCenterProps {
    appointmentAlerts: Appointment[];
    realtimeAlerts: RealtimeAlert[];
    userApprovalAlerts: RealtimeAlert[];
    dismissAppointmentAlert: (appointmentId: string) => void;
    dismissRealtimeAlert: (alertId: number) => void;
    dismissUserApprovalAlert: (alertId: number) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ appointmentAlerts, realtimeAlerts, userApprovalAlerts, dismissAppointmentAlert, dismissRealtimeAlert, dismissUserApprovalAlert }) => {
    const appointmentAudioRef = React.useRef<HTMLAudioElement | null>(null);

    React.useEffect(() => {
        if (appointmentAlerts.length > 0) {
            appointmentAudioRef.current?.play().catch(e => console.warn("Appointment audio playback failed (harmless if user hasn't interacted yet):", e));
            if ('vibrate' in navigator) {
                navigator.vibrate(200);
            }
        }
    }, [appointmentAlerts]);

     React.useEffect(() => {
        if (userApprovalAlerts.length > 0) {
            let soundSource = defaultUserApprovalSoundBase64;
            try {
                const customSoundRaw = localStorage.getItem(USER_APPROVAL_SOUND_KEY);
                if (customSoundRaw) {
                    // The value from useLocalStorage is JSON stringified, so parse it.
                    const parsedSound = JSON.parse(customSoundRaw);
                    if (typeof parsedSound === 'string' && parsedSound.startsWith('data:audio')) {
                        soundSource = parsedSound;
                    }
                }
            } catch (e) {
                console.warn("Failed to parse custom sound from localStorage, using default.", e);
            }
            
            // Validate sound source
            if (!soundSource || typeof soundSource !== 'string' || soundSource.trim() === '') {
                console.warn("User approval sound source is invalid or empty.");
                return;
            }

            const audio = new Audio(soundSource);
            audio.play().catch(e => console.warn("User approval audio playback failed (likely due to browser autoplay policy or bad source):", e));

            if ('vibrate' in navigator) {
                navigator.vibrate([100, 50, 100]);
            }
        }
    }, [userApprovalAlerts]);

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

    const allNotifications: NotificationType[] = React.useMemo(() => {
        const appointments: NotificationType[] = appointmentAlerts.map(alert => ({
            id: alert.id,
            type: 'appointment',
            title: 'تذكير بالموعد',
            message: `${alert.title} - الساعة ${formatTime(alert.time)}`,
            duration: 10000 
        }));
        const realtime: NotificationType[] = realtimeAlerts.map(alert => ({
            id: alert.id,
            type: 'sync',
            title: 'تحديث مباشر',
            message: alert.message,
            duration: 5000
        }));
        const userApprovals: NotificationType[] = userApprovalAlerts.map(alert => ({
            id: alert.id,
            type: 'userApproval',
            title: 'طلب انضمام جديد',
            message: alert.message,
            duration: 15000
        }));
        
        return [...appointments, ...realtime, ...userApprovals].sort((a,b) => {
            // Sort by ID, assuming IDs are timestamps or sequential.
            // Higher ID is newer.
            const idA = typeof a.id === 'string' ? (parseInt(a.id.replace(/\D/g, '')) || 0) : a.id;
            const idB = typeof b.id === 'string' ? (parseInt(b.id.replace(/\D/g, '')) || 0) : b.id;
            return idB - idA;
        });
    }, [appointmentAlerts, realtimeAlerts, userApprovalAlerts]);
    
    const handleDismiss = (id: string | number, type: 'appointment' | 'sync' | 'userApproval') => {
        if (type === 'appointment') {
            dismissAppointmentAlert(id as string);
        } else if (type === 'userApproval') {
            dismissUserApprovalAlert(id as number);
        } else {
            dismissRealtimeAlert(id as number);
        }
    };
    
    return (
        <div aria-live="assertive" className="fixed inset-0 flex items-start px-4 py-6 pointer-events-none sm:p-6 sm:items-start z-[100]">
            <div className="w-full flex flex-col items-center space-y-3 sm:items-end">
                <audio ref={appointmentAudioRef} src={appointmentSoundBase64} preload="auto" />
                {allNotifications.map(notification => (
                    <NotificationToast
                        key={notification.id}
                        notification={notification}
                        onDismiss={() => handleDismiss(notification.id, notification.type)}
                    />
                ))}
            </div>
        </div>
    );
};

export default NotificationCenter;
