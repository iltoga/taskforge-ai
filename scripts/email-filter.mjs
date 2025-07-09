import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const configPath = join(process.cwd(), 'settings', 'allowed-emails.json');

function loadConfig() {
  if (!existsSync(configPath)) {
    return { allowedEmails: [] };
  }
  const content = readFileSync(configPath, 'utf8');
  return JSON.parse(content);
}

function saveConfig(config) {
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const command = process.argv[2];
const email = process.argv[3];

switch (command) {
  case 'list':
    const config = loadConfig();
    if (config.allowedEmails.length === 0) {
      console.log('📭 No emails in the allowed list (all users can access)');
    } else {
      console.log('📋 Allowed emails:');
      config.allowedEmails.forEach((email, index) => {
        console.log(`  ${index + 1}. ${email}`);
      });
    }
    break;

  case 'add':
    if (!email) {
      console.error('❌ Email address is required');
      process.exit(1);
    }
    const addConfig = loadConfig();
    const normalizedEmail = email.toLowerCase().trim();
    if (addConfig.allowedEmails.includes(normalizedEmail)) {
      console.log(`Email ${normalizedEmail} already exists`);
    } else {
      addConfig.allowedEmails.push(normalizedEmail);
      addConfig.allowedEmails.sort();
      saveConfig(addConfig);
      console.log(`✅ Added ${normalizedEmail}`);
    }
    break;

  case 'remove':
    if (!email) {
      console.error('❌ Email address is required');
      process.exit(1);
    }
    const removeConfig = loadConfig();
    const normalizedRemoveEmail = email.toLowerCase().trim();
    const index = removeConfig.allowedEmails.indexOf(normalizedRemoveEmail);
    if (index === -1) {
      console.log(`Email ${normalizedRemoveEmail} not found`);
    } else {
      removeConfig.allowedEmails.splice(index, 1);
      saveConfig(removeConfig);
      console.log(`🗑️ Removed ${normalizedRemoveEmail}`);
    }
    break;

  default:
    console.log(`
🔒 Email Filter Management

Usage:
  node scripts/email-filter.mjs <command> [email]

Commands:
  list              Show all allowed emails
  add <email>       Add an email to the allowed list
  remove <email>    Remove an email from the allowed list

Examples:
  node scripts/email-filter.mjs list
  node scripts/email-filter.mjs add user@gmail.com
  node scripts/email-filter.mjs remove user@gmail.com
`);
}
