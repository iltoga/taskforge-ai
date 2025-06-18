# OAuth Token Refresh Implementation

## Overview

This implementation provides robust OAuth token refresh functionality for Google Calendar API access using NextAuth.js. It automatically handles token expiration and refresh to prevent authentication errors.

## Key Features

### 1. Automatic Token Refresh (NextAuth.js Level)
- **Proactive Refresh**: Tokens are refreshed 5 minutes before expiration
- **JWT Strategy**: Uses JWT session strategy for token persistence
- **Refresh Token Flow**: Implements Google OAuth refresh token flow
- **Error Handling**: Graceful fallback when refresh fails

### 2. Calendar Service Level Retry
- **Automatic Retry**: Calendar API calls automatically retry on auth errors
- **Token Refresh**: Uses Google OAuth2Client built-in refresh capabilities
- **Comprehensive Logging**: Detailed logging for debugging token issues
- **All Operations**: Covers getEvents, createEvent, updateEvent, deleteEvent

## Implementation Details

### NextAuth.js Configuration (`src/lib/auth.ts`)

```typescript
// Key features:
- refreshAccessToken() function for Google OAuth token refresh
- JWT callback with expiration checking and proactive refresh
- Session callback that exposes tokens and errors to the client
- Proper error handling with RefreshAccessTokenError flag
```

#### Token Refresh Logic:
1. **Token Expiration Check**: Automatically checks if access token expires in < 5 minutes
2. **Refresh Request**: Makes HTTP request to Google's token endpoint
3. **Token Update**: Updates both access and refresh tokens
4. **Error Handling**: Sets error flag if refresh fails

### Calendar Service (`src/services/calendar-service.ts`)

```typescript
// Key features:
- executeWithRetry() wrapper for all Calendar API calls
- Automatic token refresh using OAuth2Client.getAccessToken()
- Comprehensive error detection for authentication issues
- Detailed logging for troubleshooting
```

#### Retry Logic:
1. **Auth Error Detection**: Detects authentication errors in API responses
2. **Token Refresh**: Uses OAuth2Client built-in refresh mechanism
3. **Operation Retry**: Retries the original operation with fresh token
4. **Fallback**: Returns original error if refresh fails

### API Routes

All API routes now:
- Check for `RefreshAccessTokenError` in session
- Pass both access and refresh tokens to `createGoogleAuth()`
- Return 401 with clear error message when refresh fails

## Usage

### For Developers

1. **Testing Token Refresh**: Use the test endpoint `/api/test/oauth-refresh`
2. **Monitoring**: Check console logs for token refresh activity
3. **Error Handling**: Look for "RefreshAccessTokenError" in responses

### For Users

- **Seamless Experience**: Token refresh happens automatically
- **Re-authentication**: If refresh fails, users need to sign out and sign in again
- **Clear Messaging**: Error messages guide users on what to do

## Configuration Requirements

### Environment Variables
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=your_nextauth_secret
```

### Google OAuth Configuration
- **Access Type**: Must be set to "offline" to receive refresh tokens
- **Prompt**: Set to "consent" to ensure refresh tokens are always provided
- **Scopes**: Include calendar scope: `https://www.googleapis.com/auth/calendar`

## Error Scenarios and Handling

### 1. Token Expired (Normal Case)
- **Detection**: NextAuth.js JWT callback detects expiration
- **Action**: Automatically refreshes token before API calls
- **Result**: Seamless user experience

### 2. Token Expired During API Call
- **Detection**: Calendar service detects auth error in API response
- **Action**: Refreshes token and retries operation
- **Result**: Operation completes successfully

### 3. Refresh Token Invalid/Expired
- **Detection**: Refresh request returns error
- **Action**: Sets RefreshAccessTokenError flag
- **Result**: User prompted to re-authenticate

### 4. Network/Server Errors
- **Detection**: HTTP errors during refresh
- **Action**: Logs error and sets error flag
- **Result**: Graceful degradation with clear error message

## Monitoring and Debugging

### Logs to Watch For

```bash
# Successful token refresh
🔄 Refreshing Google access token...
✅ Token refresh successful

# Token refresh failure
❌ Error refreshing access token: [error details]

# Calendar service retry
🔧 Authentication error in getEvents, attempting token refresh
✅ Token refresh successful, retrying getEvents
```

### Test Endpoint

Access `/api/test/oauth-refresh` to:
- Verify token refresh functionality
- Check current token status
- Test calendar API connectivity
- Debug authentication issues

## Best Practices

1. **Monitor Logs**: Regularly check for refresh failures
2. **User Communication**: Provide clear instructions when re-auth is needed
3. **Graceful Degradation**: Handle auth failures gracefully in UI
4. **Testing**: Use test endpoint during development
5. **Token Security**: Never log actual token values

## Security Considerations

- **Refresh Token Storage**: Stored securely in JWT (encrypted by NextAuth.js)
- **Token Transmission**: Only sent over HTTPS
- **Error Handling**: Avoids exposing sensitive token information
- **Automatic Cleanup**: Failed refresh tokens are cleared from session

## Future Improvements

1. **Background Refresh**: Implement client-side background token refresh
2. **Token Caching**: Add token caching layer for high-traffic scenarios
3. **Metrics**: Add monitoring for refresh success/failure rates
4. **Batch Operations**: Optimize token refresh for batch calendar operations
