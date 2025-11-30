import * as React from 'react';
import { useSupabaseData } from '../hooks/useSupabaseData';
import { AppData, DeletedIds } from '../types';

// This is the return type of the useSupabaseData hook.
// It's defined here to be used as the context's type.
export type IDataContext = ReturnType<typeof useSupabaseData>;

// Create the context with a placeholder/null value.
// The actual value will be provided by the DataProvider in App.tsx.
const DataContext = React.createContext<IDataContext | null>(null);

// Custom hook to use the data context
export const useData = () => {
    const context = React.useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};

// Export the provider component
export const DataProvider = DataContext.Provider;