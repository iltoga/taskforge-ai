# Email Authentication Filtering

This application now includes email filtering capabilities that allow you to restrict access to only specific Gmail addresses. This is useful for controlling who can access your calendar assistant application.

## How Email Filtering Works

When email filtering is enabled:
- Only users with email addresses in the allowed list can sign in with Google OAuth
- Users with unauthorized email addresses will be denied access during the login process
- If no email filtering is configured, all users can access the application

## Configuration

### 1. Set Up Allowed Emails

Copy the example configuration file:
```bash
cp config/allowed-emails.example.json config/allowed-emails.json
```

Edit `config/allowed-emails.json` to include the Gmail addresses you want to allow:
```json
{
  "allowedEmails": [
    "your-email@gmail.com",
    "colleague@gmail.com",
    "admin@gmail.com"
  ]
}
```

### 2. Management Commands

Use the built-in CLI tools to manage allowed emails:

#### List all allowed emails
```bash
npm run email-filter:list
```

#### Add an email to the allowed list
```bash
npm run email-filter:add user@gmail.com
```

#### Remove an email from the allowed list
```bash
npm run email-filter:remove user@gmail.com
```

#### Show statistics
```bash
npm run email-filter:stats
```

#### Clear all emails (disables filtering)
```bash
npm run email-filter:clear
```

#### Show help
```bash
npm run email-filter help
```

## Security Considerations

1. **Email Address Validation**: The system validates that email addresses are properly formatted
2. **Case Insensitive**: Email comparisons are case-insensitive
3. **Configuration File Security**: The `config/allowed-emails.json` file is added to `.gitignore` to prevent accidental commits of real email addresses
4. **Graceful Fallback**: If the configuration file is missing or malformed, the system logs warnings and allows all users (fail-open approach)

## File Structure

```
config/
├── allowed-emails.json         # Your actual configuration (not committed)
└── allowed-emails.example.json # Example template (committed)

scripts/
└── manage-emails.js           # CLI management tool

src/config/
├── email-filter.ts           # Core filtering logic
└── email-filter-manager.ts   # Management utilities
```

## Environment Setup

No additional environment variables are required. The email filtering works with your existing Google OAuth configuration.

## Troubleshooting

### Problem: All users are being allowed access when filtering should be enabled
- Check that `config/allowed-emails.json` exists and is properly formatted
- Review the server logs for configuration loading messages
- Verify that email addresses in the config file are lowercase and properly formatted

### Problem: Authorized users are being denied access
- Ensure the email address in the config exactly matches the Google account email
- Check for extra spaces or formatting issues in the configuration file
- Review server logs for specific denial messages

### Problem: Configuration changes don't take effect
- Restart the application after modifying the configuration file
- The configuration is loaded at application startup

## Example Usage

```bash
# Initial setup
cp config/allowed-emails.example.json config/allowed-emails.json

# Add your email
npm run email-filter:add your-email@gmail.com

# Add team members
npm run email-filter:add teammate1@gmail.com
npm run email-filter:add teammate2@gmail.com

# Review current configuration
npm run email-filter:list

# Check statistics
npm run email-filter:stats
```

## Disabling Email Filtering

To disable email filtering and allow all users:

1. Delete the configuration file: `rm config/allowed-emails.json`
2. Or clear all emails: `npm run email-filter:clear`
3. Restart the application

When no emails are configured, the system will log a warning and allow all users to access the application.
