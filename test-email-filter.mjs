import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local if it exists
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  });
}

/**
 * Check if an email is from a single person (not a bot, listserv, or newsletter)
 * Uses Gemini 2.5 Flash Lite to analyze the email
 */
async function isAutomatedEmail(email, headers = {}, name = '', subject = '') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('GEMINI_API_KEY not set, falling back to basic heuristics');
    return isAutomatedEmailFallback(email, headers, name);
  }

  try {
    const client = new GoogleGenAI({ apiKey });

    const prompt = `Analyze the following email information and determine if this email is from a single person (human individual) or if it's from a bot, automated system, listserv, newsletter, or mass mailing service.

Email address: ${email}
Display name: ${name || '(not provided)'}
Subject: ${subject || '(not provided)'}
Headers: ${JSON.stringify(headers)}

Respond with ONLY "true" if this is from a bot/listserv/newsletter/automated system, or "false" if this is from a single person. Do not include any explanation or additional text.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [prompt]
    });
    const text = response.candidates[0].content.parts[0].text.trim().toLowerCase();

    // Parse the response - Gemini should return "true" or "false"
    if (text === 'true' || text.startsWith('true')) {
      return true;
    }
    if (text === 'false' || text.startsWith('false')) {
      return false;
    }

    // If response is unclear, fall back to heuristics
    console.warn(`Unexpected Gemini response: "${text}", falling back to heuristics`);
    return isAutomatedEmailFallback(email, headers, name);
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return isAutomatedEmailFallback(email, headers, name);
  }
}

/**
 * Fallback function with basic heuristics for when Gemini API is unavailable
 */
function isAutomatedEmailFallback(email, headers = {}, name = '') {
  const emailLower = email.toLowerCase();
  const nameLower = name.toLowerCase();

  // Check display name for "Do Not Reply" and similar patterns
  const namePatterns = [
    'do not reply', 'don\'t reply', 'do not respond',
    'don\'t respond', 'no reply', 'no response',
    'automated', 'automatic', 'system', 'notification',
    'mailer', 'unsubscribe',
  ];

  if (nameLower && namePatterns.some(pattern => nameLower.includes(pattern))) {
    return true;
  }

  // Common automated email patterns
  const automatedPatterns = [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'no_reply', 'donotreply', 'automated', 'automatic',
    'mailer', 'mailer-daemon', 'postmaster', 'daemon',
    'notification', 'notifications', 'alerts', 'alert',
    'system', 'systems', 'service', 'services',
    'bounce', 'bounces', 'unsubscribe', 'unsub',
  ];

  // Check if email contains automated patterns
  if (automatedPatterns.some(pattern => emailLower.includes(pattern))) {
    return true;
  }

  // Role-based email addresses (common for automated/mass emails)
  const roleBasedPrefixes = [
    'info@', 'support@', 'sales@', 'marketing@', 'newsletter@',
    'news@', 'updates@', 'updates@', 'team@', 'hello@',
    'contact@', 'help@', 'admin@', 'administrator@',
    'webmaster@', 'abuse@', 'security@', 'privacy@',
  ];

  if (roleBasedPrefixes.some(prefix => emailLower.startsWith(prefix))) {
    return true;
  }

  // Check email headers if available
  if (headers) {
    // Check for List-Unsubscribe header (indicates marketing/newsletter)
    if (headers['list-unsubscribe'] || headers['List-Unsubscribe']) {
      return true;
    }

    // Check for bulk email indicators
    if (headers['precedence']?.toLowerCase() === 'bulk' ||
      headers['Precedence']?.toLowerCase() === 'bulk') {
      return true;
    }

    // Check for auto-submitted header
    if (headers['auto-submitted'] || headers['Auto-Submitted']) {
      const autoSubmitted = (headers['auto-submitted'] || headers['Auto-Submitted']).toLowerCase();
      if (autoSubmitted !== 'no') {
        return true;
      }
    }

    // Check for X-Auto-Response header
    if (headers['x-auto-response'] || headers['X-Auto-Response']) {
      return true;
    }
  }

  // Check for common disposable email domains
  const disposableDomains = [
    'mailinator.com', 'guerrillamail.com', '10minutemail.com',
    'tempmail.com', 'throwaway.email', 'getnada.com',
  ];

  const domain = emailLower.split('@')[1];
  if (domain && disposableDomains.some(d => domain.includes(d))) {
    return true;
  }

  // Check for common newsletter/marketing platform domains
  const newsletterDomains = [
    'substack.com', 'mailchimp.com', 'constantcontact.com',
    'campaignmonitor.com', 'sendgrid.com', 'mailgun.com',
    'sendinblue.com', 'getresponse.com', 'aweber.com',
    'convertkit.com', 'drip.com', 'activecampaign.com',
    'hubspot.com', 'marketo.com', 'pardot.com',
    'mailjet.com', 'sparkpost.com', 'postmarkapp.com',
    'mandrill.com', 'pepipost.com', 'postal.io',
  ];

  if (domain && newsletterDomains.some(d => domain.includes(d))) {
    return true;
  }

  return false;
}

/**
 * Parse email address from "Name <email@domain.com>" format
 */
function parseEmailAddress(emailString) {
  const match = emailString.match(/(.*?)\s*<(.+?)>/) || emailString.match(/(.+)/);
  if (!match) {
    return { email: emailString, name: null };
  }
  const email = match[2] || match[1];
  const name = match[1]?.trim();
  return { email: email.trim(), name: name || null };
}

/**
 * Parse .eml file and extract From address, subject, and headers
 */
function parseEmlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const headers = {};
  let fromHeader = null;
  let subjectHeader = null;
  let listUnsubscribe = null;
  let precedence = null;
  let autoSubmitted = null;

  // Parse headers (until blank line)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Empty line indicates end of headers
    if (!line) {
      break;
    }

    // Handle multi-line headers
    if (line.startsWith(' ') || line.startsWith('\t')) {
      continue;
    }

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const headerName = line.substring(0, colonIndex).toLowerCase();
    const headerValue = line.substring(colonIndex + 1).trim();

    if (headerName === 'from') {
      fromHeader = headerValue;
    } else if (headerName === 'subject') {
      subjectHeader = headerValue;
    } else if (headerName === 'list-unsubscribe') {
      listUnsubscribe = headerValue;
      headers['list-unsubscribe'] = headerValue;
    } else if (headerName === 'precedence') {
      precedence = headerValue;
      headers['precedence'] = headerValue;
    } else if (headerName === 'auto-submitted') {
      autoSubmitted = headerValue;
      headers['auto-submitted'] = headerValue;
    }
  }

  if (!fromHeader) {
    return null;
  }

  const parsed = parseEmailAddress(fromHeader);
  return {
    email: parsed.email,
    name: parsed.name,
    subject: subjectHeader || '',
    headers: {
      'list-unsubscribe': listUnsubscribe,
      'precedence': precedence,
      'auto-submitted': autoSubmitted,
    },
  };
}

// Main test execution
async function runTests() {
  const testEmailsDir = path.join(__dirname, 'test-emails');
  const files = fs.readdirSync(testEmailsDir).filter(f => f.endsWith('.eml'));

  console.log(`\n📧 Testing ${files.length} email files with Gemini 2.5 Flash Lite...\n`);
  console.log('='.repeat(80));

  const results = {
    human: [],
    automated: [],
    errors: [],
  };

  for (const file of files) {
    const filePath = path.join(testEmailsDir, file);
    try {
      const parsed = parseEmlFile(filePath);
      if (!parsed) {
        results.errors.push({ file, reason: 'Could not parse From header' });
        continue;
      }

      console.log(`Processing: ${file}...`);
      const isAutomated = await isAutomatedEmail(parsed.email, parsed.headers, parsed.name, parsed.subject);
      const result = {
        file,
        email: parsed.email,
        name: parsed.name,
        subject: parsed.subject,
        isAutomated,
        reason: isAutomated ? 'Filtered as automated' : 'Passed filter',
      };

      if (isAutomated) {
        results.automated.push(result);
      } else {
        results.human.push(result);
      }
    } catch (error) {
      results.errors.push({ file, reason: error.message });
    }
  }

  return results;
}

// Run tests and print results
runTests().then(results => {
  // Print results
  console.log(`\n✅ HUMAN EMAILS (${results.human.length}):`);
  console.log('-'.repeat(80));
  results.human.forEach(r => {
    console.log(`  ✓ ${r.email}${r.name ? ` (${r.name})` : ''}${r.subject ? ` - "${r.subject.substring(0, 50)}${r.subject.length > 50 ? '...' : ''}"` : ''} - ${r.file}`);
  });

  console.log(`\n\n❌ AUTOMATED EMAILS (${results.automated.length}):`);
  console.log('-'.repeat(80));
  results.automated.forEach(r => {
    console.log(`  ✗ ${r.email}${r.name ? ` (${r.name})` : ''}${r.subject ? ` - "${r.subject.substring(0, 50)}${r.subject.length > 50 ? '...' : ''}"` : ''} - ${r.file}`);
  });

  if (results.errors.length > 0) {
    console.log(`\n\n⚠️  ERRORS (${results.errors.length}):`);
    console.log('-'.repeat(80));
    results.errors.forEach(r => {
      console.log(`  ⚠ ${r.file} - ${r.reason}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\nSummary:`);
  console.log(`  Human emails: ${results.human.length}`);
  console.log(`  Automated emails: ${results.automated.length}`);
  console.log(`  Errors: ${results.errors.length}`);
  console.log(`  Total: ${results.human.length + results.automated.length + results.errors.length}\n`);
}).catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
