# Type Conventions

## Naming
- **Backend API responses** use `snake_case` (matching SQLite columns)
- **Frontend interfaces** mirror the API shape with `snake_case` fields
- **React props** use `camelCase` 
- **React components** use `PascalCase`

This is intentional — the type interfaces are a thin translation layer.
Do not convert API field names to camelCase in the type definitions.
