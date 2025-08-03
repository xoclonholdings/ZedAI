/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./client/index.html",
        "./client/src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Cyberpunk colors
                purple: {
                    500: '#a855f7',
                    600: '#9333ea',
                    400: '#c084fc',
                },
                cyan: {
                    500: '#06b6d4',
                    600: '#0891b2',
                    400: '#22d3ee',
                },
                pink: {
                    500: '#ec4899',
                    600: '#db2777',
                    400: '#f472b6',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                'inter': ['Inter', 'system-ui', 'sans-serif'],
                'orbitron': ['Orbitron', 'monospace'],
                'space-grotesk': ['Space Grotesk', 'sans-serif'],
            },
            backgroundImage: {
                'gradient-cyberpunk': 'linear-gradient(135deg, #a855f7, #06b6d4, #ec4899)',
                'gradient-text': 'linear-gradient(to right, #a855f7, #06b6d4, #ec4899)',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'cyberpunk-pulse': 'cyberpunk-pulse 10s ease-in-out infinite',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-10px)' },
                },
                'cyberpunk-pulse': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.8' },
                },
            },
        },
    },
    plugins: [],
}
