# OpsPulse

**Real-Time Business Analytics & Operations Platform**

OpsPulse is a multi-organization business analytics and operations platform designed for e-commerce and retail businesses.

It brings business performance monitoring and everyday operational workflows into one workspace.

## Product Goals

- Centralize revenue, orders, customers, products, and inventory.
- Provide clear, data-driven business analytics.
- Support organization-scoped users and permissions.
- Deliver real-time operational updates.
- Support multi-currency reporting without losing original transaction values.
- Provide reliable reporting and data exports.

## Technology Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query and TanStack Table
- Recharts

### Backend
- Node.js
- Express
- TypeScript
- PostgreSQL
- Prisma ORM
- Socket.IO
- Zod

## Repository Structure

```text
opspulse/
├── frontend/             # Next.js application
├── backend/              # Express API and backend services
├── docs/
│   ├── requirements/     # Product and functional requirements
│   ├── architecture/     # System architecture
│   ├── database/         # Database design
│   ├── api/              # API specifications
│   ├── design/           # UI/UX and design system
│   └── screenshots/      # Product screenshots
├── .github/
│   └── workflows/        # CI/CD workflows
├── .gitignore
├── package.json          # Root npm workspace configuration
└── README.md
