import { DebugBundle } from './types.js';

export class SecretSanitizer {
  private static rules = [
    { name: 'API Key (OpenAI/Anthropic/Google/GitHub)', pattern: /(?:sk-(?:proj-|ant-)?|AIzaSy|xoxb-|ghp_|gho_|github_pat_)[A-Za-z0-9_\-]{16,}/g, repl: '[REDACTED_API_KEY]' },
    { name: 'AWS Credentials', pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g, repl: '[REDACTED_AWS_KEY]' },
    { name: 'JWT Auth Tokens', pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, repl: '[REDACTED_JWT_TOKEN]' },
    { name: 'Bearer Token Headers', pattern: /(?:Bearer\s+)[A-Za-z0-9_\-\.]{15,}/gi, repl: 'Bearer [REDACTED_AUTH_TOKEN]' },
    { name: 'Database URIs with Passwords', pattern: /((?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqp):\/\/[^:\s]+:)([^@\s]+)(@[^\s]+)/gi, repl: '$1[REDACTED_PASSWORD]$3' },
    { name: 'Secret & Password Assignments', pattern: /((?:password|passwd|pwd|db_pass|secret|token|api_key)\s*[:=]\s*["']?)([^"'\s\n]{3,})(["']?)/gi, repl: '$1[REDACTED_SECRET]$3' },
    { name: 'Private Key Blocks', pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, repl: '[REDACTED_PRIVATE_KEY_BLOCK]' }
  ];

  public static sanitizeString(input?: string): string {
    if (!input || typeof input !== 'string') return input || '';
    let result = input;
    for (const rule of this.rules) {
      rule.pattern.lastIndex = 0;
      result = result.replace(rule.pattern, (...args) => {
        if (rule.repl.includes('$')) {
          let rep = rule.repl;
          for (let i = 1; i < args.length - 2; i++) {
            rep = rep.replace(new RegExp(`\\$${i}`, 'g'), args[i] || '');
          }
          return rep;
        }
        return rule.repl;
      });
    }
    return result;
  }

  public static sanitizeBundle(bundle: DebugBundle): DebugBundle {
    const cloned: DebugBundle = JSON.parse(JSON.stringify(bundle));
    cloned.error.message = this.sanitizeString(cloned.error.message);
    if (cloned.error.stackTrace) cloned.error.stackTrace = this.sanitizeString(cloned.error.stackTrace);

    if (cloned.environment.extraEnv) {
      const cleanEnv: Record<string, string> = {};
      for (const [k, v] of Object.entries(cloned.environment.extraEnv)) {
        if (/key|secret|token|pass|auth|cert|cred/i.test(k)) {
          cleanEnv[k] = '[REDACTED]';
        } else {
          cleanEnv[k] = this.sanitizeString(v);
        }
      }
      cloned.environment.extraEnv = cleanEnv;
    }

    if (cloned.relevantFiles) {
      cloned.relevantFiles = cloned.relevantFiles.map(f => ({
        ...f,
        filePath: this.sanitizeString(f.filePath),
        content: this.sanitizeString(f.content)
      }));
    }

    if (cloned.recentChanges) {
      cloned.recentChanges = cloned.recentChanges.map(c => ({
        ...c,
        file: this.sanitizeString(c.file),
        summary: this.sanitizeString(c.summary)
      }));
    }

    cloned.sanitized = true;
    return cloned;
  }
}
