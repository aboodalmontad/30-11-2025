import * as React from 'react';

export interface MenuItem {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
}

interface ContextMenuProps {
    isOpen: boolean;
    position: { x: number; y: number };
    menuItems: MenuItem[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ isOpen, position, menuItems, onClose }) => {
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[200px] animate-fade-in"
            style={{ top: position.y, left: position.x }}
        >
            <ul className="space-y-1">
                {menuItems.map((item, index) => (
                    <li key={index}>
                        <button
                            onClick={() => {
                                item.onClick();
                                onClose();
                            }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-md hover:bg-gray-100 text-right"
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default ContextMenu;