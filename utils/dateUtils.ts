

export const getDaysInMonth = (year: number, month: number): Date[] => {
    const date = new Date(year, month, 1);
    const days: Date[] = [];
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
};

export const isSameDay = (date1: Date, date2: Date): boolean => {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
};

export const isToday = (date: Date): boolean => {
    return isSameDay(date, new Date());
}

export const isBeforeToday = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    return date < today;
}

export const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('ar-SY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
};

/**
 * A robust helper function to format a Date object or string into a 'YYYY-MM-DD' string for input fields.
 * It handles null, undefined, empty, and invalid date strings gracefully.
 * @param date The date to format.
 * @returns A formatted 'YYYY-MM-DD' string or an empty string if the date is invalid.
 */
export const toInputDateString = (date: Date | string | null | undefined): string => {
    if (!date) return ''; // Handles null, undefined, ''
    const d = new Date(date);
    if (isNaN(d.getTime())) { // Handles invalid dates
        return '';
    }
    // Using toISOString and slicing is a reliable way to get YYYY-MM-DD format,
    // as it correctly handles timezones by converting to UTC first.
    return d.toISOString().split('T')[0];
};

/**
 * A robust helper function to parse a 'YYYY-MM-DD' string from an input field into a Date object.
 * It correctly handles timezones by creating the date at midnight in the user's local timezone.
 * @param dateString The date string to parse.
 * @returns A Date object or null if the string is invalid.
 */
export const parseInputDateString = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    // The 'T00:00:00' part ensures the date is parsed in the local timezone, not UTC.
    const d = new Date(`${dateString}T00:00:00`);
    if (isNaN(d.getTime())) {
        console.warn(`Invalid date string provided to parseInputDateString: ${dateString}`);
        return null;
    }
    return d;
};


// --- Holiday and Weekend Logic ---

// List of fixed Syrian public holidays (Month is 0-indexed)
const fixedHolidays: { month: number; day: number; name: string }[] = [
    { month: 0, day: 1, name: 'رأس السنة الميلادية' },
    { month: 2, day: 21, name: 'عيد الأم' },
    { month: 3, day: 17, name: 'عيد الجلاء' },
    { month: 4, day: 1, name: 'عيد العمال العالمي' },
    { month: 4, day: 6, name: 'عيد الشهداء' },
    { month: 9, day: 6, name: 'ذكرى حرب تشرين' },
    { month: 11, day: 25, name: 'عيد الميلاد المجيد' },
];

// Approximations for floating holidays for 2024-2025.
const floatingHolidays: { [year: number]: { month: number; day: number; name: string; length?: number }[] } = {
    2024: [
        { month: 3, day: 10, name: 'عيد الفطر', length: 3 },
        { month: 5, day: 16, name: 'عيد الأضحى', length: 4 },
        { month: 6, day: 7, name: 'رأس السنة الهجرية' },
        { month: 8, day: 15, name: 'المولد النبوي الشريف' },
        { month: 2, day: 31, name: 'عيد الفصح (غربي)'},
        { month: 4, day: 5, name: 'عيد الفصح (شرقي)'},
    ],
    2025: [
        { month: 2, day: 30, name: 'عيد الفطر', length: 3 },
        { month: 5, day: 6, name: 'عيد الأضحى', length: 4 },
        { month: 5, day: 26, name: 'رأس السنة الهجرية' },
        { month: 8, day: 4, name: 'المولد النبوي الشريف' },
        { month: 3, day: 20, name: 'عيد الفصح (غربي وشرقي)'},
    ],
};

/**
 * Checks if a given date is a weekend (Friday or Saturday).
 * @param date The date to check.
 * @returns True if the date is a Friday or Saturday.
 */
export const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 5 || day === 6; // 5 = Friday, 6 = Saturday
};

/**
 * Checks if a given date is a Syrian public holiday.
 * @param date The date to check.
 * @returns The name of the holiday if it is one, otherwise null.
 */
export const getPublicHoliday = (date: Date): string | null => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    // Check fixed holidays
    const fixedHoliday = fixedHolidays.find(h => h.month === month && h.day === day);
    if (fixedHoliday) {
        return fixedHoliday.name;
    }

    // Check floating holidays for the given year
    const yearFloatingHolidays = floatingHolidays[year] || [];
    for (const holiday of yearFloatingHolidays) {
        if (holiday.length) { // For multi-day holidays like Eid
            const startDate = new Date(year, holiday.month, holiday.day);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + holiday.length - 1);

            if (date >= startDate && date <= endDate) {
                return holiday.name;
            }
        } else { // For single-day holidays
             if (holiday.month === month && holiday.day === day) {
                return holiday.name;
            }
        }
    }
    
    return null;
};