import * as React from 'react';

/**
 * @deprecated This component has been replaced by ConfigurationModal.tsx and is no longer used.
 * Its contents were moved to implement the configuration logic in a component with a more fitting name.
 */
const SetupWizard: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
    // This component should not be rendered. If it is, log an error and try to recover.
    React.useEffect(() => {
        console.error("Deprecated SetupWizard component was rendered. Attempting to recover.");
        onRetry();
    }, [onRetry]);

    return null; // Render nothing.
};

export default SetupWizard;
