import * as React from 'react';

/**
 * A custom hook that syncs a state value with localStorage.
 * It's more robust than a simple useEffect implementation, ensuring
 * that data is read once and saved atomically.
 * @param key The key to use in localStorage.
 * @param initialValue The initial value to use if nothing is in storage.
 * @param reviver An optional function for JSON.parse to revive data (e.g., for dates).
 * @returns A stateful value, and a function to update it.
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  reviver?: (key: string, value: any) => any
): [T, React.Dispatch<React.SetStateAction<T>>] {
    
    // State to store our value
    // Pass initial state function to useState so logic is only executed once
    const [storedValue, setStoredValue] = React.useState<T>(() => {
        if (typeof window === 'undefined') {
            return initialValue;
        }
        try {
            const item = window.localStorage.getItem(key);
            // Parse stored json or if none return initialValue
            return item ? JSON.parse(item, reviver) : initialValue;
        } catch (error) {
            console.error("Error reading from localStorage", key, error);
            return initialValue;
        }
    });

    // Return a wrapped version of useState's setter function that ...
    // ... persists the new value to localStorage.
    const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
        try {
            // Allow value to be a function so we have same API as useState
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            // Save state
            setStoredValue(valueToStore);
            // Save to local storage
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
        } catch (error) {
            console.error("Error writing to localStorage", key, error);
        }
    };

    return [storedValue, setValue];
}