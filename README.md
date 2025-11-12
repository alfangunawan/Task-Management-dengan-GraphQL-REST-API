# Task Management Microservices

A minimal task management platform built on top of a microservices architecture. The system is composed of:
- **User Service (REST)** for accounts, authentication, and team management
- **Task Service (GraphQL)** for tasks, status tracking, and real-time notifications
- **API Gateway** that verifies JWT tokens and routes traffic to the proper backend
- **Next.js Frontend** that provides a dashboard experience for end users

All services communicate through the gateway and can be started together via Docker.

## Architecture

```
Frontend (Next.js)
        ↓
API Gateway (JWT verification)
        ↓                ↓
REST User Service    GraphQL Task Service
```

| Service            | Port | Protocol | Highlights                                                |
|--------------------|:----:|----------|-----------------------------------------------------------|
| Frontend           | 3002 | HTTP     | Next.js 14, authentication-aware task dashboard          |
| API Gateway        | 3000 | HTTP/WS  | JWT verification (RS256), reverse proxy, rate limiting    |
| User Service       | 3001 | HTTP     | Auth (login/register), users, teams, RSA key distribution |
| Task Service       | 4000 | HTTP/WS  | Task CRUD, notifications, GraphQL subscriptions           |

## Quick Start (Docker)

```powershell
docker compose up --build -d
```

Then visit:
- Frontend dashboard: <http://localhost:3002>
- API Gateway health: <http://localhost:3000/health>

Stop the stack when you are done:

```powershell
docker compose down
```

### Manual Development Setup

```bash
# Install dependencies for every service
npm run install:all

# Start services in separate terminals
cd services/rest-api && npm run dev
cd services/graphql-api && npm run dev
cd api-gateway && npm run dev
cd frontend-app && npm run dev
```

## Default Accounts

| Role  | Email                      | Password |
|-------|-----------------------------|----------|
| Admin | `admin@taskmanager.com`     | `admin123` |
| User  | `user@taskmanager.com`      | `user123`  |

The gateway expects a valid JWT (RS256) for every protected endpoint. Tokens are issued by the User Service using the RSA private key inside `keys/jwt-private.key`, while the API Gateway verifies them with the corresponding public key.

## Authentication Flow

1. Client calls `POST /api/auth/login` on the gateway with email/password.
2. API Gateway forwards the request to the User Service.
3. User Service issues a JWT signed with its private key and returns it alongside user information.
4. All subsequent calls must include `Authorization: Bearer <token>` so the gateway can verify and forward the request.
5. The gateway injects the decoded user payload into the `user` header for downstream services.

## REST API Usage (through API Gateway)

Base URL: `http://localhost:3000/api`

Always authenticate first:

```bash
# Login and capture token (PowerShell syntax)
$body = @{ email = 'admin@taskmanager.com'; password = 'admin123' } | ConvertTo-Json
$token = Invoke-RestMethod -Uri http://localhost:3000/api/auth/login -Method POST -Body $body -ContentType 'application/json'
$env:TOKEN = $token.token

# Check current user
Invoke-RestMethod -Uri http://localhost:3000/api/auth/me -Headers @{ Authorization = "Bearer $env:TOKEN" }
```

### Users

```bash
# List users
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/users

# Create user
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com","age":28,"role":"user"}'

# Update user
curl -X PUT http://localhost:3000/api/users/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'

# Delete user
curl -X DELETE http://localhost:3000/api/users/<id> \
  -H "Authorization: Bearer $TOKEN"
```

### Teams

```bash
# List teams
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/teams

# Create team
curl -X POST http://localhost:3000/api/teams \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Design Team","description":"Handles UI/UX"}'

# Add member
curl -X POST http://localhost:3000/api/teams/<teamId>/members \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"2"}'

# Remove member
curl -X DELETE http://localhost:3000/api/teams/<teamId>/members/<userId> \
  -H "Authorization: Bearer $TOKEN"
```

## GraphQL API Usage

Endpoint: `http://localhost:3000/graphql`

Headers required:

```
Authorization: Bearer <token>
Content-Type: application/json
```

### Query Tasks

```graphql
query Tasks($teamId: ID!, $status: TaskStatus) {
  tasks(teamId: $teamId, status: $status) {
    id
    title
    description
    status
    priority
    assignedTo
    dueDate
    updatedAt
  }
}
```

Variables example:

```json
{
  "teamId": "1",
  "status": "IN_PROGRESS"
}
```

### Create Task

```graphql
mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) {
    id
    title
    status
    assignedTo
    teamId
  }
}
```

Input example:

```json
{
  "input": {
    "title": "Prepare release notes",
    "description": "Collect highlights for the next sprint demo",
    "priority": "HIGH",
    "teamId": "1",
    "assignedTo": "2",
    "dueDate": "2025-11-18"
  }
}
```

### Update Task Status

```graphql
mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
  updateTask(id: $id, input: $input) {
    id
    status
    updatedAt
  }
}
```

Variables:

```json
{
  "id": "2",
  "input": {
    "status": "REVIEW"
  }
}
```

### Real-time Subscriptions

```graphql
subscription OnTaskCreated($teamId: ID!) {
  taskCreated(teamId: $teamId) {
    id
    title
    status
    createdAt
  }
}
```

```graphql
subscription OnNotification($userId: ID!) {
  notificationAdded(userId: $userId) {
    id
    message
    createdAt
  }
}
```

Subscriptions require a WebSocket connection (`ws://localhost:3000/graphql`). The frontend already handles this via `graphql-ws`.

## Frontend Walkthrough

1. Open <http://localhost:3002> and log in with one of the default accounts.
2. Select a team from the header drop-down.
3. Create tasks, assign members, and update statuses.
4. Real-time notifications appear at the top whenever tasks change or new assignments arrive.
5. Use the filter to view tasks by status and the refresh button to manually re-fetch if needed.

## Environment Variables

### API Gateway
- `PORT` (default `3000`)
- `REST_API_URL` (default `http://rest-api:3001` in Docker, `http://localhost:3001` locally)
- `GRAPHQL_API_URL` (default `http://graphql-api:4000` in Docker, `http://localhost:4000` locally)

### Frontend
- `NEXT_PUBLIC_API_GATEWAY_URL` (default `http://localhost:3000`)
- `NEXT_PUBLIC_GRAPHQL_URL` (default `http://localhost:3000/graphql`)
- `NEXT_PUBLIC_WS_URL` (default `ws://localhost:3000/graphql`)

### User Service
- `PORT` (default `3001`)
- RSA keys must be mounted at `/app/keys/jwt-private.key` and `/app/keys/jwt-public.key`

### Task Service
- `PORT` (default `4000`)
- Uses in-memory storage by default; swap with a database in production

## Project Structure

```
base-code-uts/
├── api-gateway/
│   ├── Dockerfile
│   └── server.js
├── services/
│   ├── rest-api/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── server.js
│   └── graphql-api/
│       └── server.js
├── frontend-app/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── keys/
│   ├── jwt-private.key
│   └── jwt-public.key
├── docker-compose.yml
└── README.md
```

## Notes & Next Steps

- Data is in-memory for demo purposes. Introduce a persistent database (PostgreSQL/MongoDB) for production use.
- Replace the simple PubSub with Redis or another shared broker when scaling multiple Task Service instances.
- Keep RSA keys secure and rotate them periodically in real deployments.
- Add automated tests for the REST and GraphQL services to cover authentication and task workflows.


- Implementation reference:
  - User accounts & teams: `services/rest-api/routes/users.js`, `services/rest-api/routes/teams.js`, mounted via `services/rest-api/server.js`
  - Authentication & authorization: `services/rest-api/routes/auth.js` issues RS256 JWTs verified by `api-gateway/server.js`
  - Task management: `services/graphql-api/server.js` hosts schema/resolvers for task CRUD and lookup
  - Real-time notifications: PubSub channels in `services/graphql-api/server.js` (`TASK_CREATED_*`, `NOTIFICATION_ADDED_*`) push live updates to clients