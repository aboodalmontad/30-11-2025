import * as React from 'react';
import { getDaysInMonth, getFirstDayOfMonth, isSameDay, isToday, isWeekend, getPublicHoliday } from '../utils/dateUtils';
import { Session, Appointment } from '../types';
import { ChevronLeftIcon } from './icons';

interface CalendarProps {
    onDateSelect: (date: Date) => void;
    selectedDate: Date;
    sessions: Session[];
    appointments: Appointment[];
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onDateSelect, selectedDate, sessions, appointments, currentDate, setCurrentDate }) => {

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const weekDays = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

    // Formatter for Syrian Arabic locale with English (Latin) numerals.
    const monthYearFormatter = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
        year: 'numeric',
        month: 'long',
    });

    const dayFormatter = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
        day: 'numeric'
    });
    
    const numberFormatter = new Intl.NumberFormat('en-US');

    const changeMonth = (offset: number) => {
        setCurrentDate(new Date(year, month + offset, 1));
    };

    const getEventsCountForDay = (day: Date) => {
        const sessionCount = sessions.filter(s => isSameDay(s.date, day)).length;
        const appointmentCount = appointments.filter(a => isSameDay(a.date, day)).length;
        return { sessionCount, appointmentCount };
    };

    return (
        <div className="w-full mx-auto bg-white rounded-lg">
            <div className="flex items-center justify-between px-2 py-3">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100">
                    <ChevronLeftIcon className="w-6 h-6 transform rotate-180" />
                </button>
                <h2 className="text-lg font-bold">
                    {monthYearFormatter.format(currentDate)}
                </h2>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100">
                    <ChevronLeftIcon className="w-6 h-6" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-500 mb-2">
                {weekDays.map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {daysInMonth.map(day => {
                    const { sessionCount, appointmentCount } = getEventsCountForDay(day);
                    const isSelected = isSameDay(day, selectedDate);
                    const isCurrentDay = isToday(day);
                    const holidayName = getPublicHoliday(day);
                    const isWknd = isWeekend(day);
                    let title = holidayName || '';
                    
                    let dayClasses = "relative flex flex-col items-center justify-start pt-2 h-12 w-full rounded-full cursor-pointer transition-colors duration-200";

                    if (isSelected) {
                        dayClasses += " bg-blue-600 text-white";
                    } else if (holidayName) {
                        dayClasses += " bg-red-100 text-red-800 font-semibold hover:bg-red-200";
                    } else if (isCurrentDay) {
                        dayClasses += " bg-blue-100 text-blue-700 font-bold";
                    } else if (isWknd) {
                        dayClasses += " bg-gray-100 text-gray-500";
                    } else {
                        dayClasses += " hover:bg-gray-100";
                    }


                    return (
                        <div key={day.toString()} onClick={() => onDateSelect(day)} className={dayClasses} title={title}>
                            <span>{dayFormatter.format(day)}</span>
                             <div className="absolute bottom-1.5 flex w-full justify-center items-center gap-1">
                                {sessionCount > 0 && (
                                    <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-green-500 rounded-full" title={`${numberFormatter.format(sessionCount)} جلسات`}>
                                        {numberFormatter.format(sessionCount)}
                                    </span>
                                )}
                                {appointmentCount > 0 && (
                                    <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-purple-500 rounded-full" title={`${numberFormatter.format(appointmentCount)} مواعيد`}>
                                        {numberFormatter.format(appointmentCount)}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
             <div className="mt-4 p-2 border-t flex flex-wrap justify-center items-center gap-x-4 gap-y-2 text-xs text-gray-600">
                <div className="flex items-center"><span className="w-3 h-3 bg-green-500 rounded-full me-2"></span> جلسات</div>
                <div className="flex items-center"><span className="w-3 h-3 bg-purple-500 rounded-full me-2"></span> مواعيد</div>
                <div className="flex items-center"><span className="w-3 h-3 bg-gray-100 border border-gray-300 rounded-full me-2"></span> عطلة أسبوعية</div>
                <div className="flex items-center"><span className="w-3 h-3 bg-red-100 border border-red-200 rounded-full me-2"></span> عطلة رسمية</div>
            </div>
        </div>
    );
};

export default React.memo(Calendar);