import { createId } from '@paralleldrive/cuid2'

export const createTestUser = (overrides = {}) => ({
  email: `test-${createId()}@example.com`,
  password: 'SecurePass123!@#',
  fullName: 'Test User',
  ...overrides,
})

export const validUserData = {
  email: 'valid@example.com',
  password: 'SecurePass123!@#',
  fullName: 'Valid User',
}

export const invalidUserData = {
  // Invalid emails
  invalidEmail: {
    email: 'not-an-email',
    password: 'SecurePass123!@#',
    fullName: 'Test',
  },
  // Empty email
  emptyEmail: {
    email: '',
    password: 'SecurePass123!@#',
    fullName: 'Test',
  },
  // Invalid password - too short
  weakPassword: {
    email: 'test@example.com',
    password: 'short',
    fullName: 'Test',
  },
  // Empty password
  emptyPassword: {
    email: 'test@example.com',
    password: '',
    fullName: 'Test',
  },
  // Empty name
  emptyName: {
    email: 'test@example.com',
    password: 'SecurePass123!@#',
    fullName: '',
  },
  // XSS attempt in email
  xssEmail: {
    email: '<script>alert("xss")</script>@example.com',
    password: 'SecurePass123!@#',
    fullName: 'Test',
  },
  // SQL injection attempt in name
  sqlInjectionName: {
    email: 'test@example.com',
    password: 'SecurePass123!@#',
    fullName: "'; DROP TABLE users; --",
  },
  // Very long email
  longEmail: {
    email: `${'a'.repeat(300)}@example.com`,
    password: 'SecurePass123!@#',
    fullName: 'Test',
  },
  // Very long password
  longPassword: {
    email: 'test@example.com',
    password: 'a'.repeat(10000),
    fullName: 'Test',
  },
  // Missing required field
  missingEmail: {
    password: 'SecurePass123!@#',
    fullName: 'Test',
  },
  missingPassword: {
    email: 'test@example.com',
    fullName: 'Test',
  },
  missingName: {
    email: 'test@example.com',
    password: 'SecurePass123!@#',
  },
}

export const securityTestPayloads = {
  sqlInjection: [
    "1' OR '1'='1",
    "admin' --",
    "1; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
  ],
  xss: [
    '<script>alert("xss")</script>',
    '<img src=x onerror="alert(1)">',
    'javascript:alert("xss")',
    '<svg onload="alert(1)">',
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
  ],
  nullBytes: [
    'test\x00.txt',
    'file\0.jpg',
  ],
}
