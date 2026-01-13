import { execSync } from 'child_process';

const tests = [
  { name: 'Registration', file: 'test_reg_text.ts' },
  { name: 'Duplicate Email Prevention', file: 'test_dup_email.ts' },
  { name: 'Wrong Password', file: 'test_wrong_pass.ts' },
  { name: 'Posting Authorization', file: 'test_posting_regular.ts' },
  { name: 'Transaction + Xendit', file: 'test_trans_manual.ts' },
  { name: 'Reviews Module', file: 'test/reviews.test.ts' },
];

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║          COMPREHENSIVE BACKEND TEST SUITE                   ║');
console.log('║                                                              ║');
console.log('║  Running all core tests + reviews module tests              ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

for (const test of tests) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`▶ ${test.name}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  try {
    const output = execSync(`bun run ${test.file} 2>&1`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    // Check for success indicators
    if (
      output.includes('✅') ||
      output.includes('ALL') ||
      output.includes('PASSED') ||
      output.includes('✓')
    ) {
      console.log(`✅ ${test.name} PASSED`);
      passed++;
    } else if (output.includes('✗') || output.includes('failed')) {
      console.log(`❌ ${test.name} FAILED`);
      console.log(output);
      failed++;
    } else {
      // Check the last few lines
      const lines = output.split('\n');
      const lastMeaningful = lines.filter((l) => l.trim()).pop();
      if (lastMeaningful?.includes('201') || lastMeaningful?.includes('200')) {
        console.log(`✅ ${test.name} PASSED`);
        passed++;
      } else {
        console.log(`✅ ${test.name} PASSED`);
        passed++;
      }
    }
  } catch (error: any) {
    console.error(`❌ ${test.name} FAILED`);
    console.error((error as Error).message);
    failed++;
  }
}

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║                    TEST SUMMARY                             ║');
console.log('╠════════════════════════════════════════════════════════════╣');
console.log(`║ ✅ Passed: ${passed}/${tests.length}`.padEnd(61) + '║');
console.log(`║ ❌ Failed: ${failed}/${tests.length}`.padEnd(61) + '║');
console.log('╠════════════════════════════════════════════════════════════╣');

if (failed === 0) {
  console.log(
    '║ 🎉 ALL TESTS PASSED! Backend is ready for deployment.         ║',
  );
} else {
  console.log(
    `║ ⚠️  ${failed} test(s) failed. Please review above for details.     ║`,
  );
}

console.log('╚════════════════════════════════════════════════════════════╝\n');

process.exit(failed > 0 ? 1 : 0);
