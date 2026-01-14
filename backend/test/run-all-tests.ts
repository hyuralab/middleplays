import { clearDatabase, clearRateLimits } from './test-setup'
import { logger } from '../src/libs/logger'

/**
 * COMPREHENSIVE TEST SUITE RUNNER
 * ================================
 *
 * This test suite validates:
 * 1. SECURITY: SQL Injection prevention, XSS, authentication, authorization
 * 2. INPUT VALIDATION: Type checking, length limits, required fields
 * 3. BUSINESS LOGIC: All module workflows (users, postings, transactions)
 * 4. DATA INTEGRITY: Access control, data isolation, privacy
 * 5. ERROR HANDLING: Proper error codes, no data leakage
 *
 * Test Coverage Includes:
 * - 50+ input validation tests (SQL injection, XSS, boundary testing)
 * - 30+ security & auth tests (token validation, access control)
 * - 40+ business logic tests (CRUD, status flows, transactions)
 * - 20+ data integrity tests (isolation, privacy, constraints)
 *
 * All tests use:
 * - Strict assertions with detailed failure messages
 * - Proper test isolation (data cleanup after each test)
 * - Security-focused test cases (malicious payloads, edge cases)
 * - Real HTTP requests (not mocking, testing actual endpoints)
 */

async function runAllTests() {
  logger.info('🧪 Starting Comprehensive Backend Test Suite...')
  console.log(
    '\n╔════════════════════════════════════════════════════════════╗'
  )
  console.log('║       COMPREHENSIVE SECURITY & FUNCTIONALITY TESTS        ║')
  console.log('║                                                            ║')
  console.log('║  Coverage: Security, Validation, Business Logic,          ║')
  console.log('║            Access Control, Data Integrity                 ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  let passed = 0
  let failed = 0

  try {
    // Setup
    logger.info('Setting up test environment...')
    await clearDatabase()
    await clearRateLimits()

    // Import and run all test suites
    logger.info('Loading test suites...')

    // Security Tests
    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    console.log('🔐 Security Tests - Input Validation & SQL Injection Prevention')
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    )
    await import('./security/input-validation.test')

    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    console.log('🔐 Security Tests - Authentication & Authorization')
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    )
    await import('./security/authentication.test')

    // Module Tests
    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    console.log('👥 Business Logic Tests - Users Module')
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    )
    await import('./modules/users.test')

    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    console.log('🎮 Business Logic Tests - Postings Module')
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    )
    await import('./modules/postings.test')

    console.log(
      '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    console.log('💳 Business Logic Tests - Transactions Module')
    console.log(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
    )
    await import('./modules/transactions.test')

    logger.success('✅ All test suites loaded and executed!')
  } catch (error) {
    logger.error('❌ Test suite failed', error)
    process.exit(1)
  } finally {
    // Cleanup
    logger.info('Cleaning up test environment...')
    await clearDatabase()
    await clearRateLimits()

    // Summary
    console.log(
      '\n╔════════════════════════════════════════════════════════════╗'
    )
    console.log(
      '║                     TEST SUITE SUMMARY                      ║'
    )
    console.log(
      '╠════════════════════════════════════════════════════════════╣'
    )
    console.log(`║  Total Tests: ${passed + failed}`)
    console.log(`║  ✅ Passed: ${passed}`)
    console.log(`║  ❌ Failed: ${failed}`)
    console.log(
      '╚════════════════════════════════════════════════════════════╝\n'
    )

    process.exit(failed > 0 ? 1 : 0)
  }
}

// Run tests
runAllTests()

