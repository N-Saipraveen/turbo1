export interface JsonSchemaDefinition {
  $schema?: string;
  title?: string;
  type: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  additionalProperties?: boolean;
}

export function validateJsonSchema(schema: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    if (typeof schema !== 'object' || schema === null) {
      errors.push('Schema must be an object');
      return { valid: false, errors };
    }

    if (!schema.type) {
      errors.push('Schema must have a type property');
      return { valid: false, errors };
    }

    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown validation error');
    return { valid: false, errors };
  }
}

export function inferSchemaFromData(data: any): JsonSchemaDefinition {
  if (Array.isArray(data)) {
    if (data.length === 0) {
      return { type: 'array', items: { type: 'object' } };
    }

    const itemSchema = inferSchemaFromData(data[0]);
    return { type: 'array', items: itemSchema };
  }

  if (data === null) {
    return { type: 'null' };
  }

  if (typeof data === 'object') {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      properties[key] = inferSchemaFromData(value);
      if (value !== null && value !== undefined) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: false,
    };
  }

  switch (typeof data) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return Number.isInteger(data) ? { type: 'integer' } : { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      return { type: 'string' };
  }
}

export function parseJson(content: string): any {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
