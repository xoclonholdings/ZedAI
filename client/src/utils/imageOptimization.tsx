// Image optimization utilities for performance
export const optimizeImageLoading = () => {
    // Preload critical images
    const preloadCriticalImages = () => {
        const criticalImages = [
            '/Zed-ai-logo_1753468041342.png'
        ];

        criticalImages.forEach(src => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = src;
            document.head.appendChild(link);
        });
    };

    // Lazy load non-critical images
    const setupLazyLoading = () => {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target as HTMLImageElement;
                        img.src = img.dataset.src!;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    };

    return {
        preloadCriticalImages,
        setupLazyLoading
    };
};

// Image component with optimization
import React from 'react';

type OptimizedImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
    src: string;
    alt: string;
    className?: string;
    lazy?: boolean;
};

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
    src,
    alt,
    className,
    lazy = true,
    ...props
}) => {
    if (lazy) {
        return (
            <img
                data-src={src}
                alt={alt}
                className={`lazy ${className || ''}`}
                loading="lazy"
                {...props}
            />
        );
    } else {
        return (
            <img
                src={src}
                alt={alt}
                className={className}
                {...props}
            />
        );
    }
};
