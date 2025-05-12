# Security Policy

## Supported Versions

The following versions of @plust/datasleuth are currently being supported with
security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

We take the security of @plust/datasleuth seriously. If you believe you've found
a security vulnerability, please follow these steps:

1. **Do not disclose the vulnerability publicly** - Please don't create a public
   GitHub issue for security vulnerabilities.

2. **Email the maintainers directly** - Send an email to security@example.com
   with details about the vulnerability.

3. **Include the following information**:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce the issue
   - Affected versions
   - Potential mitigations if known

## What to Expect

- **Acknowledgment**: We will acknowledge your report within 48 hours.
- **Updates**: We'll provide updates on our progress as we investigate.
- **Disclosure**: We'll work with you to determine an appropriate disclosure
  timeline.
- **Credit**: Unless you prefer to remain anonymous, we'll acknowledge your
  responsible disclosure in the release notes.

## Security Best Practices for Users

- Always use the latest version of @plust/datasleuth
- Keep your API keys secure and never commit them to public repositories
- Use environment variables for sensitive configuration
- Implement proper rate limiting and monitoring when using LLM-related features
- Regularly audit your dependencies using `npm audit`
