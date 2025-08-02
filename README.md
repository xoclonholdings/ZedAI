# 🎯 ZED Frontend
## React TypeScript Frontend for ZED AI Assistant

ZED Frontend is a modern React application built with TypeScript, Vite, and Tailwind CSS, featuring a cyberpunk-themed interface for the ZED AI Assistant platform.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

**Frontend runs on:** http://localhost:5173  
**Backend API:** http://localhost:5001

## 🎨 Features

### **Cyberpunk Interface**
- Dark theme with purple-cyan-pink gradients
- Animated backgrounds and floating effects
- Responsive design with glassmorphism effects
- Real-time chat with streaming responses

### **Core Components**
- **Authentication**: Secure login with session management
- **Chat Interface**: Real-time messaging with file uploads
- **User Management**: Admin panel for user CRUD operations
- **File Processing**: Support for multiple file formats
- **Memory System**: Three-tier memory management UI

### **Technical Stack**
- **React 18+** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **React Query** for API state management
- **Wouter** for client-side routing
- **Lucide React** for icons

## 📁 Project Structure

```
frontend_design/
├── client/                 # Main React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and helpers
│   │   └── types/          # TypeScript definitions
│   ├── index.html          # HTML template
│   └── debug.html          # Debug page
├── server/                 # Backend integration types
├── config/                 # Configuration files
│   ├── vite.config.ts      # Vite configuration
│   ├── tailwind.config.ts  # Tailwind configuration
│   ├── tsconfig.json       # TypeScript configuration
│   └── components.json     # Shadcn UI configuration
└── assets/                 # Static assets
```

## 🔧 Configuration

### Environment Variables
The frontend connects to the backend via proxy configuration in `vite.config.ts`:

```typescript
server: {
  port: 5173,
  proxy: {
    "/api": {
      target: "http://localhost:5001",
      changeOrigin: true,
      secure: false,
    },
  },
}
```

### Tailwind Configuration
Custom cyberpunk theme colors and animations configured in `tailwind.config.ts`.

## 🎭 Design System

### Color Palette
```css
--purple: #a855f7    /* Primary actions */
--cyan: #06b6d4      /* Secondary actions */
--pink: #ec4899      /* Accent colors */
--black: #000000     /* Background */
--gray-900: #111827  /* Cards/panels */
```

### Typography
- **Font**: Inter, system fonts
- **Gradients**: Multi-color text effects
- **Responsive**: Mobile-first design

## 🚀 Development

### Available Scripts
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run preview     # Preview production build
npm run lint        # Run ESLint
```

### API Integration
The frontend integrates with the ZED backend API for:
- Authentication and session management
- Real-time chat functionality
- File upload and processing
- User management (admin)
- Memory system operations

## 📱 Responsive Design

The application is fully responsive with:
- Mobile-first approach
- Touch-friendly interfaces
- Adaptive layouts
- Progressive enhancement

## 🔐 Security Features

- Session-based authentication
- CSRF protection
- Secure file uploads
- Input validation
- XSS prevention

## 📦 Dependencies

### Core Dependencies
- `react` - UI library
- `react-dom` - DOM rendering
- `typescript` - Type safety
- `vite` - Build tool
- `tailwindcss` - Styling

### UI Components
- `@tanstack/react-query` - Server state management
- `lucide-react` - Icon library
- `wouter` - Routing

## 🚀 Deployment

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any static hosting service.

### Netlify Deployment
The project includes `netlify.toml` configuration for easy Netlify deployment.

## 📚 Documentation

For detailed feature specifications and implementation details, see:
- `ZED_FRONTEND_FEATURES_SPECIFICATION.md`
- `ZED_COMPONENT_LIBRARY.md`
- `ZED_API_INTEGRATION_GUIDE.md`
- `ZED_IMPLEMENTATION_CHECKLIST.md`

## 🤝 Contributing

This is a proprietary project for XOCLON HOLDINGS INC.

## 📄 License

Proprietary software for XOCLON HOLDINGS INC.  
All rights reserved.
