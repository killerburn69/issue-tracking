# Issue Tracking API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Environment Variables](#environment-variables)
4. [Authentication](#authentication)
5. [API Endpoints](#api-endpoints)
   - [Authentication Endpoints](#authentication-endpoints)
   - [Team Management Endpoints](#team-management-endpoints)
6. [Data Models](#data-models)
7. [Error Handling](#error-handling)
8. [Swagger Documentation](#swagger-documentation)

---

## Overview

This is a NestJS-based REST API backend for an Issue Tracking system. The API provides authentication, user management, and team collaboration features with role-based access control.

### Key Features

- **User Authentication**: Email/password authentication and Google OAuth 2.0
- **Team Management**: Create, update, and manage teams
- **Role-Based Access Control**: OWNER, ADMIN, and MEMBER roles
- **Team Invitations**: Email-based invitation system
- **Activity Logging**: Track team activities and member actions
- **Password Reset**: Secure password reset via email
- **Soft Deletes**: Soft delete functionality for users and teams

### Technology Stack

- **Framework**: NestJS 11.x
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (JSON Web Tokens) + Passport.js
- **Validation**: class-validator
- **Email**: Nodemailer
- **API Documentation**: Swagger/OpenAPI

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see [Environment Variables](#environment-variables))

4. Start the development server:
   ```bash
   npm run start:dev
   ```

The API will be available at `http://localhost:3001`

### Available Scripts

```bash
# Development
npm run start:dev      # Start in watch mode

# Production
npm run build          # Build the project
npm run start:prod     # Start production server

# Testing
npm run test           # Run unit tests
npm run test:e2e       # Run end-to-end tests
npm run test:cov       # Run tests with coverage

# Code Quality
npm run lint           # Run ESLint
npm run format         # Format code with Prettier
```

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/issue-tracking
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/issue-tracking?retryWrites=true&w=majority

# JWT
JWT_SECRET=your-secret-key-here

# Frontend URL (for redirects and email links)
FRONTEND_URL=http://localhost:3000

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Environment Variable Descriptions

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string | `mongodb://localhost:27017/issue-tracker` |
| `JWT_SECRET` | Yes | Secret key for JWT token signing | `secret-key` (not secure for production) |
| `FRONTEND_URL` | No | Frontend application URL for redirects | `http://localhost:3000` |
| `SMTP_HOST` | No | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | No | SMTP server port | `587` |
| `SMTP_USER` | Yes | SMTP authentication username | - |
| `SMTP_PASS` | Yes | SMTP authentication password | - |
| `SMTP_FROM` | Yes | Email sender address | - |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth client secret | - |

---

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. After successful login or signup, you'll receive a JWT token that must be included in subsequent requests.

### Authentication Flow

1. **Sign Up** or **Login** to receive a JWT token
2. Include the token in the `Authorization` header: `Bearer <token>`
3. Token expires after 24 hours

### Protected Routes

Most routes (except authentication endpoints) require a valid JWT token. Include it in the request header:

```
Authorization: Bearer <your-jwt-token>
```

---

## API Endpoints

### Base URL

```
http://localhost:3001
```

### Authentication Endpoints

#### 1. Sign Up

Create a new user account.

**Endpoint:** `POST /auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Validation Rules:**
- `email`: Valid email address, max 255 characters
- `password`: 6-100 characters
- `name`: 1-50 characters

**Response:** `200 OK`
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "isOAuth": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `409 Conflict`: Email already exists

---

#### 2. Login

Authenticate an existing user.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "profileImage": "https://...",
    "isOAuth": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid email or password

---

#### 3. Google OAuth Login

Authenticate using Google OAuth 2.0.

**Endpoint:** `POST /auth/google`

**Request Body:**
```json
{
  "profile": {
    "email": "user@gmail.com",
    "name": "John Doe",
    "picture": "https://...",
    "sub": "google-user-id"
  }
}
```

**Response:** `200 OK`
```json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@gmail.com",
    "name": "John Doe",
    "profileImage": "https://...",
    "isOAuth": true,
    "oauthProvider": "google"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Alternative OAuth Flow:**

**Endpoint:** `GET /api/auth/google`

Initiates Google OAuth flow. Redirects to Google authentication page.

**Callback Endpoint:** `GET /api/auth/google/callback`

Handles Google OAuth callback and redirects to frontend with token.

---

#### 4. Get User Profile

Get the authenticated user's profile.

**Endpoint:** `GET /auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "name": "John Doe",
  "profileImage": "https://...",
  "isOAuth": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid or missing token

---

#### 5. Update Profile

Update the authenticated user's profile.

**Endpoint:** `PUT /auth/profile`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Jane Doe",
  "profileImage": "https://example.com/avatar.jpg"
}
```

**Validation Rules:**
- `name`: 1-50 characters (optional)
- `profileImage`: Valid URL (optional)

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "name": "Jane Doe",
  "profileImage": "https://example.com/avatar.jpg",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

#### 6. Change Password

Change the authenticated user's password (regular users only).

**Endpoint:** `PUT /auth/change-password`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "oldpassword123",
  "newPassword": "newpassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Current password is incorrect or password change not allowed for OAuth users

---

#### 7. Forgot Password

Request a password reset email.

**Endpoint:** `POST /auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "If the email exists, a reset link has been sent"
}
```

**Note:** Always returns success message for security (doesn't reveal if email exists).

---

#### 8. Reset Password

Reset password using a reset token.

**Endpoint:** `POST /auth/reset-password?token=<reset-token>`

**Query Parameters:**
- `token` (required): Password reset token from email

**Request Body:**
```json
{
  "newPassword": "newpassword123",
  "confirmPassword": "newpassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Password reset successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid/expired token, passwords don't match, or user not found

---

#### 9. Delete Account

Soft delete the authenticated user's account.

**Endpoint:** `DELETE /auth/account`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "password": "password123"
}
```

**Note:** Password only required for regular users, not OAuth users.

**Response:** `200 OK`
```json
{
  "message": "Account deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Password required for regular users, incorrect password, or user not found

---

### Team Management Endpoints

All team endpoints require authentication. Include JWT token in the Authorization header.

#### 1. Create Team

Create a new team (creator becomes OWNER).

**Endpoint:** `POST /teams`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Development Team"
}
```

**Validation Rules:**
- `name`: 1-50 characters

**Response:** `201 Created`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Development Team",
  "ownerId": "507f1f77bcf86cd799439012",
  "isDeleted": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

#### 2. Get User's Teams

Get all teams the authenticated user is a member of.

**Endpoint:** `GET /teams/my-teams`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "_id": "...",
    "teamId": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Development Team",
      "ownerId": "...",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "userRole": "OWNER",
    "user": "John Doe"
  }
]
```

---

#### 3. Get Team Details

Get details of a specific team.

**Endpoint:** `GET /teams/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Development Team",
  "ownerId": "507f1f77bcf86cd799439012",
  "isDeleted": false,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `404 Not Found`: Team not found
- `403 Forbidden`: Not a member of this team

---

#### 4. Update Team

Update team details (OWNER and ADMIN only).

**Endpoint:** `PUT /teams/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Updated Team Name"
}
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Updated Team Name",
  "ownerId": "...",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `403 Forbidden`: Insufficient permissions (not OWNER or ADMIN)
- `404 Not Found`: Team not found

---

#### 5. Delete Team

Delete a team (OWNER only).

**Endpoint:** `DELETE /teams/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Development Team",
  ...
}
```

**Error Responses:**
- `403 Forbidden`: Not the team owner
- `404 Not Found`: Team not found

---

#### 6. Invite Member

Invite a user to join the team (OWNER and ADMIN only).

**Endpoint:** `POST /teams/:id/invite`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "email": "newmember@example.com",
  "role": "MEMBER"
}
```

**Validation Rules:**
- `email`: Valid email address
- `role`: One of `OWNER`, `ADMIN`, `MEMBER` (default: `MEMBER`)

**Response:** `201 Created`
```json
{
  "_id": "...",
  "teamId": "507f1f77bcf86cd799439011",
  "email": "newmember@example.com",
  "role": "MEMBER",
  "status": "pending",
  "token": "abc123xyz...",
  "expiresAt": "2024-01-08T00:00:00.000Z",
  "invitedBy": "507f1f77bcf86cd799439012",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `403 Forbidden`: Insufficient permissions
- `409 Conflict`: User is already a team member

**Note:** An invitation email is sent to the provided email address with a link to accept the invitation. Invitations expire in 7 days.

---

#### 7. Accept Team Invitation

Accept a team invitation using the invitation token.

**Endpoint:** `POST /teams/invite/accept?token=<invitation-token>`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `token` (required): Invitation token from email

**Response:** `200 OK`
```json
{
  "message": "Invitation accepted successfully",
  "team": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Development Team"
  },
  "alreadyMember": false,
  "isOwnerOfOtherTeams": false
}
```

**Error Responses:**
- `404 Not Found`: Invalid or expired invitation

---

#### 8. Get Team Members

Get all members of a team (all members can view).

**Endpoint:** `GET /teams/:id/members`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "_id": "...",
    "teamId": "507f1f77bcf86cd799439011",
    "userId": {
      "_id": "...",
      "name": "John Doe",
      "email": "john@example.com",
      "profileImage": "https://..."
    },
    "role": "OWNER",
    "joinedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Error Responses:**
- `403 Forbidden`: Not a member of this team
- `404 Not Found`: Team not found

---

#### 9. Kick Member

Remove a member from the team (OWNER and ADMIN only).

**Endpoint:** `DELETE /teams/:id/members/:userId`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Member removed successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Cannot kick yourself
- `403 Forbidden`: Insufficient permissions or cannot kick team owner
- `404 Not Found`: Member not found

**Permission Rules:**
- OWNER can kick anyone except themselves
- ADMIN can kick MEMBERs, but not OWNERs or other ADMINs
- Cannot kick the team owner

---

#### 10. Leave Team

Leave a team as a member (OWNER cannot leave).

**Endpoint:** `POST /teams/:id/leave`

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Left team successfully"
}
```

**Error Responses:**
- `403 Forbidden`: OWNER cannot leave team (must transfer ownership or delete team)
- `404 Not Found`: Not a member of this team

---

#### 11. Change Member Role

Change a member's role (OWNER only).

**Endpoint:** `PUT /teams/:id/role`

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "userId": "507f1f77bcf86cd799439013",
  "newRole": "ADMIN"
}
```

**Validation Rules:**
- `userId`: Valid MongoDB ObjectId
- `newRole`: One of `OWNER`, `ADMIN`, `MEMBER`

**Response:** `200 OK`
```json
{
  "_id": "...",
  "teamId": "507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439013",
  "role": "ADMIN",
  "joinedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `403 Forbidden`: Not the team owner or cannot change OWNER role
- `404 Not Found`: Member not found

**Note:** When transferring ownership (setting `newRole` to `OWNER`), the current owner becomes an ADMIN.

---

#### 12. Get Team Activities

Get activity log for a team (all members can view).

**Endpoint:** `GET /teams/:id/activities?page=1&limit=20`

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response:** `200 OK`
```json
{
  "activities": [
    {
      "_id": "...",
      "teamId": "507f1f77bcf86cd799439011",
      "type": "TEAM_CREATED",
      "performedBy": {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "description": "Team \"Development Team\" was created",
      "metadata": {},
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

**Activity Types:**
- `TEAM_CREATED`: Team was created
- `TEAM_UPDATED`: Team details were updated
- `MEMBER_JOINED`: Member joined the team
- `MEMBER_LEFT`: Member left the team
- `MEMBER_KICKED`: Member was removed
- `ROLE_CHANGED`: Member role was changed

---

## Data Models

### User

```typescript
{
  _id: ObjectId;
  email: string;
  password?: string; // Hashed, only for regular users
  name: string;
  profileImage?: string;
  isOAuth: boolean;
  oauthProvider?: 'google';
  oauthId?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Team

```typescript
{
  _id: ObjectId;
  name: string; // 1-50 characters
  ownerId: ObjectId; // Reference to User
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Team Member

```typescript
{
  _id: ObjectId;
  teamId: ObjectId; // Reference to Team
  userId: ObjectId; // Reference to User
  role: TeamRole; // 'OWNER' | 'ADMIN' | 'MEMBER'
  joinedAt: Date;
}
```

### Team Role Enum

```typescript
enum TeamRole {
  OWNER = 'OWNER',   // Full control, can delete team
  ADMIN = 'ADMIN',   // Can manage members and settings
  MEMBER = 'MEMBER'  // Basic access
}
```

### Team Invite

```typescript
{
  _id: ObjectId;
  teamId: ObjectId; // Reference to Team
  email: string;
  role: TeamRole;
  invitedBy: ObjectId; // Reference to User
  token: string;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: Date;
  createdAt: Date;
}
```

### Team Activity

```typescript
{
  _id: ObjectId;
  teamId: ObjectId; // Reference to Team
  type: ActivityType;
  performedBy: ObjectId; // Reference to User
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
```

### Password Reset Token

```typescript
{
  _id: ObjectId;
  email: string;
  token: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}
```

---

## Error Handling

The API uses standard HTTP status codes and returns error responses in the following format:

```json
{
  "statusCode": 400,
  "message": "Error message",
  "error": "Bad Request"
}
```

### Common Status Codes

| Code | Meaning | Common Causes |
|------|---------|---------------|
| `200` | Success | Request completed successfully |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Invalid input, validation errors |
| `401` | Unauthorized | Missing or invalid authentication token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `409` | Conflict | Resource already exists (e.g., duplicate email) |
| `500` | Internal Server Error | Server-side error |

### Example Error Responses

**Validation Error (400):**
```json
{
  "statusCode": 400,
  "message": [
    "email must be an email",
    "password must be longer than or equal to 6 characters"
  ],
  "error": "Bad Request"
}
```

**Unauthorized (401):**
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized"
}
```

**Forbidden (403):**
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**Not Found (404):**
```json
{
  "statusCode": 404,
  "message": "Team not found",
  "error": "Not Found"
}
```

---

## Swagger Documentation

Interactive API documentation is available via Swagger UI when the application is running.

**Access Swagger UI:**
```
http://localhost:3001/docs
```

The Swagger UI provides:
- Complete API endpoint documentation
- Interactive API testing
- Request/response schemas
- Authentication support (JWT Bearer token)

To use authentication in Swagger:
1. Click the "Authorize" button
2. Enter your JWT token (obtained from `/auth/login` or `/auth/signup`)
3. Click "Authorize"
4. Now you can test protected endpoints

---

## Additional Notes

### Soft Deletes

Users and teams use soft delete functionality:
- `isDeleted`: Boolean flag
- `deletedAt`: Timestamp when deleted
- Soft-deleted resources are excluded from queries

### Password Security

- Passwords are hashed using bcryptjs with 10 salt rounds
- OAuth users don't have passwords
- Password reset tokens expire after 1 hour
- Reset tokens are single-use

### Email Configuration

For Gmail SMTP:
1. Enable 2-Factor Authentication
2. Generate an App Password
3. Use the App Password as `SMTP_PASS`

### CORS

The API is configured to accept requests from `http://localhost:3000` by default. Update CORS settings in `src/main.ts` for production.

---

## Support

For issues, questions, or contributions, please refer to the main project repository.

