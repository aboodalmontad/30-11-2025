/**
 * @deprecated This component's functionality has been moved into `hooks/useSupabaseData.ts` 
 * to support synchronization of documents across devices.
 * This file is kept to avoid breaking file system references but should no longer be used directly.
 */
import * as React from 'react';

export const useCaseDocuments = (caseId: string) => {
    React.useEffect(() => {
        console.warn("useCaseDocuments is deprecated and should be replaced with document handling from the useData() context.");
    }, []);
    
    return { 
        documents: [], 
        loading: false, 
        error: "This hook is deprecated.", 
        // Fix: Changed function signature to accept any arguments to prevent type errors in consuming components before they are refactored.
        addDocuments: async (...args: any[]) => {}, 
        deleteDocument: async (...args: any[]) => {} 
    };
};
