import { parseMongoSchema, type MongoSchemaDefinition, type MongoField } from './mongo.js';

export interface ConvertOutput {
  artifacts: Record<string, string>;
  summary: {
    schemas: number;
  };
  warnings: string[];
}

export async function convertMongoToJson(mongoContent: string): Promise<ConvertOutput> {
  const warnings: string[] = [];
  const artifacts: Record<string, string> = {};

  try {
    const schemas = parseMongoSchema(mongoContent);

    for (const schema of schemas) {
      const jsonSchema = generateJsonSchema(schema);
      artifacts[`${schema.collection}.schema.json`] = JSON.stringify(jsonSchema, null, 2);
    }

    return {
      artifacts,
      summary: {
        schemas: schemas.length,
      },
      warnings,
    };
  } catch (error) {
    warnings.push(`Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      artifacts: {},
      summary: { schemas: 0 },
      warnings,
    };
  }
}

function generateJsonSchema(mongoSchema: MongoSchemaDefinition): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  for (const field of mongoSchema.fields) {
    properties[field.name] = mapMongoFieldToJsonSchema(field);

    if (field.required) {
      required.push(field.name);
    }
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: mongoSchema.collection,
    type: 'object',
    properties,
    required,
    additionalProperties: true,
  };
}

function mapMongoFieldToJsonSchema(field: MongoField): any {
  const schema: any = {};

  // Handle arrays
  if (field.isArray) {
    schema.type = 'array';
    if (field.nested && field.nested.length > 0) {
      // Nested object array
      const nestedProps: Record<string, any> = {};
      for (const nestedField of field.nested) {
        nestedProps[nestedField.name] = mapMongoFieldToJsonSchema(nestedField);
      }
      schema.items = {
        type: 'object',
        properties: nestedProps,
      };
    } else {
      // Simple type array
      schema.items = mapMongoTypeToJsonSchemaType(field.type);
    }
    return schema;
  }

  // Handle nested objects
  if (field.nested && field.nested.length > 0) {
    schema.type = 'object';
    schema.properties = {};
    for (const nestedField of field.nested) {
      schema.properties[nestedField.name] = mapMongoFieldToJsonSchema(nestedField);
    }
    return schema;
  }

  // Simple types
  return mapMongoTypeToJsonSchemaType(field.type);
}

function mapMongoTypeToJsonSchemaType(mongoType: string): any {
  switch (mongoType) {
    case 'string':
      return { type: 'string' };

    case 'int':
    case 'long':
      return { type: 'integer' };

    case 'double':
    case 'decimal':
      return { type: 'number' };

    case 'bool':
      return { type: 'boolean' };

    case 'date':
      return { type: 'string', format: 'date-time' };

    case 'object':
      return { type: 'object' };

    case 'array':
      return { type: 'array', items: { type: 'string' } };

    case 'binData':
      return { type: 'string', contentEncoding: 'base64' };

    case 'mixed':
    default:
      return { type: ['string', 'number', 'boolean', 'object', 'array', 'null'] };
  }
}
