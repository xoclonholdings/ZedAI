# ZED AI Project Structure

## Root Directory Structure

```
zed-front-end/
├── zed-ui/                     # Protected UI Components (DO NOT DELETE)
│   ├── interfaces/             # Main interface files
│   ├── components/             # Reusable UI components
│   ├── assets/                 # Static assets (CSS, images, etc.)
│   └── themes/                 # UI themes and styling
├── zed-backend/                # Backend Functions & Logic
│   ├── netlify-functions/      # Serverless functions
│   ├── api/                    # API endpoints
│   ├── services/               # Business logic services
│   └── middleware/             # Backend middleware
├── zed-memory/                 # Memory & Data Management
│   ├── storage/                # Data storage logic
│   ├── compression/            # Data compression utilities
│   ├── upload/                 # File upload handlers
│   └── indexing/               # Memory indexing system
├── zed-config/                 # Configuration Files
│   ├── deployment/             # Deployment configurations
│   ├── environment/            # Environment settings
│   └── project/                # Project configurations
├── zed-docs/                   # Documentation
│   ├── api/                    # API documentation
│   ├── setup/                  # Setup guides
│   ├── architecture/           # System architecture docs
│   └── deployment/             # Deployment guides
├── zed-data/                   # Data Storage (Original ZedAI_data)
├── zed-temp/                   # Temporary files & processing
└── legacy/                     # Legacy files (to be organized)
```

## Folder Naming Convention
- All folders prefixed with "zed-" to avoid naming conflicts
- Clear, descriptive names that indicate purpose
- Separate UI from backend to prevent accidental deletion
- Protected UI folder with explicit warning