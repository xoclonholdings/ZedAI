import React from 'react';

interface ZedLogoProps {
    className?: string;
    size?: number;
}

export const ZedLogo: React.FC<ZedLogoProps> = ({
    className = "",
    size = 40
}) => {
    // Map size to Tailwind classes for common sizes
    const getSizeClass = (size: number) => {
        if (size <= 16) return "w-4 h-4";
        if (size <= 20) return "w-5 h-5";
        if (size <= 24) return "w-6 h-6";
        if (size <= 32) return "w-8 h-8";
        if (size <= 40) return "w-10 h-10";
        if (size <= 48) return "w-12 h-12";
        if (size <= 64) return "w-16 h-16";
        if (size <= 80) return "w-20 h-20";
        return "w-24 h-24";
    };

    return (
        <img
            src="/Zed-ai-logo_1753468041342.png"
            alt="ZED AI"
            className={`inline-block ${getSizeClass(size)} ${className}`}
        />
    );
};

export default ZedLogo;
