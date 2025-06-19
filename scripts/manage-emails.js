#!/usr/bin/env node

/**
 * CLI script to manage allowed emails for authentication
 * Usage:
 *   node scripts/manage-emails.js add user@gmail.com
 *   node scripts/manage-emails.js remove user@gmail.com
 *   node scripts/manage-emails.js list
 *   node scripts/manage-emails.js clear
 */

import { createInterface } from 'readline';
import { EmailFilterManager } from '../src/config/email-filter-manager.js';

const manager = new EmailFilterManager();

function showHelp() {
  console.log(`
🔒 Email Filter Management CLI

Usage:
  node scripts/manage-emails.js <command> [email]

Commands:
  add <email>     Add an email to the allowed list
  remove <email>  Remove an email from the allowed list
  list           Show all allowed emails
  clear          Remove all emails from the allowed list
  stats          Show configuration statistics
  help           Show this help message

Examples:
  node scripts/manage-emails.js add user@gmail.com
  node scripts/manage-emails.js remove user@gmail.com
  node scripts/manage-emails.js list
  node scripts/manage-emails.js clear
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help') {
    showHelp();
    return;
  }

  const command = args[0];
  const email = args[1];

  try {
    switch (command) {
      case 'add':
        if (!email) {
          console.error('❌ Email address is required for add command');
          process.exit(1);
        }
        manager.addEmail(email);
        break;

      case 'remove':
        if (!email) {
          console.error('❌ Email address is required for remove command');
          process.exit(1);
        }
        manager.removeEmail(email);
        break;

      case 'list':
        const emails = manager.getAllowedEmails();
        if (emails.length === 0) {
          console.log('📭 No emails in the allowed list (all users can access)');
        } else {
          console.log('📋 Allowed emails:');
          emails.forEach((email, index) => {
            console.log(`  ${index + 1}. ${email}`);
          });
        }
        break;

      case 'clear':
        console.log('⚠️  This will remove ALL allowed emails. Continue? (y/N)');

        // Simple confirmation - in production you might want to use a proper prompt library
        const rl = createInterface({
          input: process.stdin,
          output: process.stdout
        });

        rl.question('', (answer) => {
          if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            manager.clearAllEmails();
            console.log('✅ All emails cleared');
          } else {
            console.log('❌ Operation cancelled');
          }
          rl.close();
        });
        break;

      case 'stats':
        const stats = manager.getStats();
        console.log('📊 Email Filter Statistics:');
        console.log(`  Total emails: ${stats.totalEmails}`);
        console.log(`  Gmail addresses: ${stats.gmailCount}`);
        console.log(`  Other providers: ${stats.otherCount}`);

        if (stats.totalEmails === 0) {
          console.log('  Status: ⚠️  All users can access (no filtering)');
        } else {
          console.log('  Status: 🔒 Email filtering is active');
        }
        break;

      case 'validate-gmail':
        try {
          manager.validateGmailOnly();
          console.log('✅ All emails are Gmail addresses');
        } catch (error) {
          console.error('❌', error.message);
          process.exit(1);
        }
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
