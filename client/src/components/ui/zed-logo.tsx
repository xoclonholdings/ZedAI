// ZED Logo component - using the EXACT logo provided by user
export const ZedLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
    <img
        src="/Zed-ai-logo_1753468041342.png"
        alt="ZED Logo"
        className={className}
        style={{ imageRendering: 'crisp-edges' }}
    />
);
