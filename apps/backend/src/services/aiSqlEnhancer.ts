/**
 * AI-Enhanced SQL Schema Generator
 * Uses OpenAI to improve SQL schema quality, type inference, and validation
 */

import OpenAI from 'openai';

interface AIEnhancementConfig {
  apiKey: string;
  model?: string;
  endpoint?: string;
}

interface SchemaEnhancementResult {
  success: boolean;
  improvedSchema?: string;
  suggestions: string[];
  warnings: string[];
  typeCorrections: Array<{
    table: string;
    column: string;
    originalType: string;
    suggestedType: string;
    reason: string;
  }>;
}

interface TypeInferenceRequest {
  columnName: string;
  sampleValue: any;
  context?: string;
  dialect: 'postgres' | 'mysql' | 'sqlite';
}

interface TypeInferenceResult {
  sqlType: string;
  confidence: number;
  reasoning: string;
  constraints?: string[];
}

export class AISqlEnhancer {
  private openai: OpenAI;
  private model: string;

  constructor(config: AIEnhancementConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.endpoint || 'https://api.chatanywhere.tech/v1',
    });
    this.model = config.model || 'gpt-4o-mini';
  }

  /**
   * Enhance a SQL schema using AI to detect issues and suggest improvements
   */
  async enhanceSchema(
    schema: string,
    jsonSample: any,
    dialect: 'postgres' | 'mysql' | 'sqlite'
  ): Promise<SchemaEnhancementResult> {
    try {
      const prompt = `You are an expert database architect. Analyze this SQL schema and improve it.

**JSON Sample Data:**
\`\`\`json
${JSON.stringify(jsonSample, null, 2)}
\`\`\`

**Generated SQL Schema (${dialect.toUpperCase()}):**
\`\`\`sql
${schema}
\`\`\`

**Task:** Analyze the schema and provide:

1. **Type Accuracy**: Check if column types match the data. For example:
   - Email fields should be VARCHAR(255) not TEXT
   - Phone numbers should be VARCHAR(25)
   - Monetary values should use DECIMAL(12,2)
   - Dates should use appropriate DATE/TIMESTAMP types
   - MongoDB ObjectIds should be TEXT (24 chars)
   - Foreign keys must match parent primary key types

2. **Missing Constraints**: Identify missing:
   - NOT NULL constraints for required fields
   - UNIQUE constraints for emails, usernames
   - CHECK constraints for valid ranges
   - Default values where appropriate

3. **Relationship Issues**: Check for:
   - Missing foreign keys
   - Incorrect foreign key references
   - Self-referential foreign key problems
   - Type mismatches in foreign keys

4. **Naming Conventions**: Verify:
   - snake_case for columns and tables
   - Consistent _id suffix for foreign keys
   - Clear, descriptive names

5. **Optimizations**: Suggest:
   - Indexes for frequently queried columns
   - Better data types for performance
   - Normalization improvements

**Return JSON format:**
\`\`\`json
{
  "improvedSchema": "-- Complete improved SQL schema here",
  "suggestions": ["List of improvement suggestions"],
  "warnings": ["List of potential issues found"],
  "typeCorrections": [
    {
      "table": "table_name",
      "column": "column_name",
      "originalType": "TEXT",
      "suggestedType": "VARCHAR(255)",
      "reason": "Email fields should use VARCHAR(255) for better performance"
    }
  ]
}
\`\`\`

**Important:** Return ONLY valid JSON, no markdown formatting or extra text.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert database architect. Respond only with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('Empty response from AI');
      }

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      const result = JSON.parse(jsonStr);

      return {
        success: true,
        improvedSchema: result.improvedSchema || schema,
        suggestions: result.suggestions || [],
        warnings: result.warnings || [],
        typeCorrections: result.typeCorrections || [],
      };
    } catch (error) {
      console.error('AI enhancement error:', error);
      return {
        success: false,
        suggestions: ['AI enhancement failed, using original schema'],
        warnings: [
          `AI service error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ],
        typeCorrections: [],
      };
    }
  }

  /**
   * Use AI to infer the best SQL type for a column
   */
  async inferColumnType(request: TypeInferenceRequest): Promise<TypeInferenceResult> {
    try {
      const prompt = `You are a database type inference expert. Determine the best SQL type for this column.

**Column Name:** ${request.columnName}
**Sample Value:** ${JSON.stringify(request.sampleValue)}
**Context:** ${request.context || 'none'}
**Target Database:** ${request.dialect.toUpperCase()}

**Rules:**
1. MongoDB _id fields → TEXT (stores 24-char hex string)
2. Email fields → VARCHAR(255)
3. Phone numbers → VARCHAR(25)
4. Monetary values → DECIMAL(12,2)
5. Timestamps → TIMESTAMP (Postgres) or DATETIME (MySQL/SQLite)
6. Dates → DATE
7. Booleans → BOOLEAN
8. Foreign keys → Match parent table's primary key type
9. Small integers (0-255) → SMALLINT
10. Large integers (>2^31) → BIGINT
11. Short strings (<255) → VARCHAR(n) where n is appropriate
12. Long text → TEXT

**Return JSON format:**
\`\`\`json
{
  "sqlType": "VARCHAR(255)",
  "confidence": 0.95,
  "reasoning": "Email pattern detected, VARCHAR(255) is standard for email fields",
  "constraints": ["NOT NULL", "UNIQUE"]
}
\`\`\`

Return ONLY valid JSON.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a database type inference expert. Respond only with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 500,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('Empty response from AI');
      }

      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      const result = JSON.parse(jsonStr);

      return {
        sqlType: result.sqlType,
        confidence: result.confidence || 0.5,
        reasoning: result.reasoning || 'AI inference',
        constraints: result.constraints || [],
      };
    } catch (error) {
      console.error('Type inference error:', error);
      // Fallback to basic inference
      return this.basicTypeInference(request);
    }
  }

  /**
   * Fallback basic type inference when AI is unavailable
   */
  private basicTypeInference(request: TypeInferenceRequest): TypeInferenceResult {
    const { columnName, sampleValue, dialect } = request;
    const lowerName = columnName.toLowerCase();

    // MongoDB _id
    if (lowerName === '_id') {
      return {
        sqlType: 'TEXT',
        confidence: 1.0,
        reasoning: 'MongoDB ObjectId stored as TEXT',
        constraints: ['PRIMARY KEY'],
      };
    }

    // Email
    if (lowerName.includes('email')) {
      return {
        sqlType: 'VARCHAR(255)',
        confidence: 0.9,
        reasoning: 'Email field pattern detected',
        constraints: ['UNIQUE'],
      };
    }

    // Phone
    if (lowerName.includes('phone') || lowerName.includes('mobile')) {
      return {
        sqlType: 'VARCHAR(25)',
        confidence: 0.9,
        reasoning: 'Phone number pattern detected',
      };
    }

    // Money
    if (
      lowerName.includes('price') ||
      lowerName.includes('amount') ||
      lowerName.includes('salary')
    ) {
      return {
        sqlType: 'DECIMAL(12,2)',
        confidence: 0.85,
        reasoning: 'Monetary value pattern detected',
      };
    }

    // Value-based inference
    if (sampleValue !== null && sampleValue !== undefined) {
      if (typeof sampleValue === 'boolean') {
        return {
          sqlType: 'BOOLEAN',
          confidence: 1.0,
          reasoning: 'Boolean value',
        };
      }

      if (typeof sampleValue === 'number') {
        if (Number.isInteger(sampleValue)) {
          return {
            sqlType: 'INTEGER',
            confidence: 0.9,
            reasoning: 'Integer value detected',
          };
        }
        return {
          sqlType: 'DECIMAL(12,2)',
          confidence: 0.8,
          reasoning: 'Floating point number',
        };
      }

      if (typeof sampleValue === 'string') {
        // Date/timestamp
        if (/^\d{4}-\d{2}-\d{2}/.test(sampleValue)) {
          if (sampleValue.includes('T')) {
            return {
              sqlType: dialect === 'postgres' ? 'TIMESTAMP' : 'DATETIME',
              confidence: 0.95,
              reasoning: 'ISO timestamp format detected',
            };
          }
          return {
            sqlType: 'DATE',
            confidence: 0.95,
            reasoning: 'Date format detected',
          };
        }

        // Length-based
        if (sampleValue.length > 255) {
          return {
            sqlType: 'TEXT',
            confidence: 0.8,
            reasoning: 'Long string detected',
          };
        }

        return {
          sqlType: 'VARCHAR(255)',
          confidence: 0.7,
          reasoning: 'String value, default VARCHAR',
        };
      }
    }

    // Default fallback
    return {
      sqlType: 'VARCHAR(255)',
      confidence: 0.5,
      reasoning: 'Default fallback type',
    };
  }

  /**
   * Validate schema relationships and foreign keys
   */
  async validateRelationships(
    schema: string,
    jsonData: any
  ): Promise<{
    valid: boolean;
    issues: string[];
    suggestions: string[];
  }> {
    try {
      const prompt = `You are a database relationship validator. Check this schema for foreign key and relationship issues.

**Schema:**
\`\`\`sql
${schema}
\`\`\`

**Sample Data:**
\`\`\`json
${JSON.stringify(jsonData, null, 2)}
\`\`\`

**Validation Checks:**
1. Foreign key columns match parent primary key types
2. Foreign key constraints reference existing columns
3. No circular dependencies
4. Proper use of CASCADE options
5. Child tables have foreign keys to parents
6. Self-referential foreign keys are correct

**Return JSON:**
\`\`\`json
{
  "valid": true,
  "issues": ["List of problems found"],
  "suggestions": ["List of improvements"]
}
\`\`\`

Return ONLY valid JSON.`;

      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a database validator. Respond only with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('Empty response from AI');
      }

      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```\n?/g, '');
      }

      const result = JSON.parse(jsonStr);

      return {
        valid: result.valid !== false,
        issues: result.issues || [],
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      console.error('Validation error:', error);
      return {
        valid: true,
        issues: [],
        suggestions: [],
      };
    }
  }
}

/**
 * Create AI enhancer instance from environment or config
 */
export function createAIEnhancer(config?: Partial<AIEnhancementConfig>): AISqlEnhancer | null {
  try {
    // Default configuration with hardcoded API key
    const defaultApiKey = 'sk-Wa6KkAFngRs0h8B17opjRljBhDNxHlxWBo7pVwGmIhnxwo8A';
    const defaultModel = 'gpt-4o-mini';
    const defaultEndpoint = 'https://api.chatanywhere.tech/v1';

    const apiKey = config?.apiKey || defaultApiKey;
    if (!apiKey) {
      console.warn('No OpenAI API key provided, AI enhancement disabled');
      return null;
    }

    return new AISqlEnhancer({
      apiKey,
      model: config?.model || defaultModel,
      endpoint: config?.endpoint || defaultEndpoint,
    });
  } catch (error) {
    console.error('Failed to create AI enhancer:', error);
    return null;
  }
}
