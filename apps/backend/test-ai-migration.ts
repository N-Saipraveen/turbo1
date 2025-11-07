/**
 * Test script to demonstrate AI-enhanced JSON to SQL migration
 * Run with: tsx test-ai-migration.ts
 */

import { convertJsonToSql } from './src/services/jsonToSql.js';

// Hardcoded AI configuration
const AI_CONFIG = {
  apiKey: 'sk-Wa6KkAFngRs0h8B17opjRljBhDNxHlxWBo7pVwGmIhnxwo8A',
  model: 'gpt-4o-mini',
  endpoint: 'https://api.chatanywhere.tech/v1',
};

const testCases = [
  {
    name: 'MongoDB Employee Document',
    json: {
      _id: '507f1f77bcf86cd799439011',
      email: 'john.doe@company.com',
      phone: '+1-555-0123',
      salary: 75000.50,
      hire_date: '2024-01-15T10:30:00Z',
      manager_id: '507f1f77bcf86cd799439012',
      department: {
        _id: '507f1f77bcf86cd799439013',
        name: 'Engineering',
        budget: 500000
      },
      skills: ['JavaScript', 'TypeScript', 'React']
    }
  },
  {
    name: 'E-commerce Order',
    json: {
      _id: '6554a1b2c3d4e5f67890abcd',
      customer_email: 'customer@example.com',
      order_date: '2024-11-07',
      total_amount: 299.99,
      status: 'shipped',
      items: [
        {
          product_id: 'PROD-001',
          quantity: 2,
          price: 149.99
        },
        {
          product_id: 'PROD-002',
          quantity: 1,
          price: 49.99
        }
      ],
      shipping_address: {
        street: '123 Main St',
        city: 'Boston',
        state: 'MA',
        zip: '02101',
        country: 'USA'
      }
    }
  },
  {
    name: 'User Profile with Nested Data',
    json: {
      id: 12345,
      username: 'johndoe',
      email: 'john@example.com',
      phone: '555-1234',
      created_at: '2024-01-01T00:00:00Z',
      is_active: true,
      profile: {
        first_name: 'John',
        last_name: 'Doe',
        bio: 'Software engineer with 5 years of experience',
        avatar_url: 'https://example.com/avatar.jpg'
      },
      tags: ['developer', 'javascript', 'nodejs']
    }
  }
];

async function runTest(testCase: any, enableAI: boolean) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Test: ${testCase.name}`);
  console.log(`AI Enhancement: ${enableAI ? 'ENABLED' : 'DISABLED'}`);
  console.log('='.repeat(80));

  const startTime = Date.now();

  const result = await convertJsonToSql(
    JSON.stringify(testCase.json),
    'postgres',
    {
      enableAI,
      validateSchema: enableAI,
      aiConfig: enableAI ? AI_CONFIG : undefined,
    }
  );

  const duration = Date.now() - startTime;

  console.log(`\n📊 Summary:`);
  console.log(`  Tables created: ${result.summary.tables}`);
  console.log(`  Relationships: ${result.summary.relationships}`);
  console.log(`  Duration: ${duration}ms`);

  if (result.warnings && result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
    result.warnings.forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
  }

  if (result.aiSuggestions && result.aiSuggestions.length > 0) {
    console.log(`\n💡 AI Suggestions (${result.aiSuggestions.length}):`);
    result.aiSuggestions.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
  }

  if (result.typeCorrections && result.typeCorrections.length > 0) {
    console.log(`\n🔧 Type Corrections (${result.typeCorrections.length}):`);
    result.typeCorrections.forEach((tc, i) => {
      console.log(`  ${i + 1}. ${tc.table}.${tc.column}:`);
      console.log(`     ${tc.originalType} → ${tc.suggestedType}`);
      console.log(`     Reason: ${tc.reason}`);
    });
  }

  console.log(`\n📝 Generated Schema:`);
  console.log('-'.repeat(80));
  console.log(Object.values(result.artifacts)[0]);
  console.log('-'.repeat(80));

  return result;
}

async function main() {
  console.log('🚀 TurboDBX AI-Enhanced Migration Test Suite');
  console.log('='.repeat(80));

  console.log(`\n✅ OpenAI API Key: ${AI_CONFIG.apiKey.substring(0, 10)}...`);
  console.log(`✅ Model: ${AI_CONFIG.model}`);
  console.log(`✅ Endpoint: ${AI_CONFIG.endpoint}\n`);

  for (const testCase of testCases) {
    // Run without AI first
    await runTest(testCase, false);

    // Run with AI
    await runTest(testCase, true);

    // Compare results
    console.log('\n📈 Comparison:');
    console.log('  Without AI: Basic type inference, no validation');
    console.log('  With AI: Enhanced types, constraint detection, performance hints');

    console.log('\n');
  }

  console.log('='.repeat(80));
  console.log('✅ Test Suite Complete!');
  console.log('='.repeat(80));
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
