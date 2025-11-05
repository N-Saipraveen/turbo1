import { parseJson, type JsonSchemaDefinition, inferSchemaFromData } from './json.js';

export interface ConvertOutput {
  artifacts: Record<string, string>;
  summary: {
    collection: string;
    validationRules: boolean;
  };
  warnings: string[];
}

export async function convertJsonToMongo(jsonContent: string): Promise<ConvertOutput> {
  const warnings: string[] = [];
  const artifacts: Record<string, string> = {};

  try {
    const data = parseJson(jsonContent);

    // Check if it's a JSON Schema or raw data
    let schema: JsonSchemaDefinition;
    let collectionName: string;

    if (data.$schema || (data.type && data.properties)) {
      // It's a JSON Schema
      schema = data as JsonSchemaDefinition;
      collectionName = schema.title || 'collection';
    } else {
      // It's raw data, need to infer schema
      warnings.push('Inferring schema from data - validation rules will be based on sample');
      schema = inferSchemaFromData(data);
      collectionName = 'inferred_collection';
    }

    // Generate MongoDB validation schema
    const validationSchema = generateMongoValidation(schema);
    artifacts[`${collectionName}_validation.json`] = JSON.stringify(validationSchema, null, 2);

    // Generate collection setup script
    const setupScript = generateCollectionSetup(collectionName, validationSchema);
    artifacts[`${collectionName}_setup.js`] = setupScript;

    // Generate sample document
    const sampleDoc = generateSampleDocument(schema);
    artifacts[`${collectionName}_sample.json`] = JSON.stringify(sampleDoc, null, 2);

    return {
      artifacts,
      summary: {
        collection: collectionName,
        validationRules: true,
      },
      warnings,
    };
  } catch (error) {
    warnings.push(`Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      artifacts: {},
      summary: { collection: 'unknown', validationRules: false },
      warnings,
    };
  }
}

function generateMongoValidation(schema: JsonSchemaDefinition): any {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      properties[propName] = mapJsonSchemaToMongoValidation(propSchema);

      if (schema.required?.includes(propName)) {
        required.push(propName);
      }
    }
  }

  return {
    $jsonSchema: {
      bsonType: 'object',
      required,
      properties,
    },
  };
}

function mapJsonSchemaToMongoValidation(propSchema: any): any {
  const validation: any = {};

  switch (propSchema.type) {
    case 'string':
      validation.bsonType = 'string';
      if (propSchema.maxLength) {
        validation.maxLength = propSchema.maxLength;
      }
      if (propSchema.minLength) {
        validation.minLength = propSchema.minLength;
      }
      if (propSchema.pattern) {
        validation.pattern = propSchema.pattern;
      }
      break;

    case 'integer':
      validation.bsonType = 'int';
      if (propSchema.minimum !== undefined) {
        validation.minimum = propSchema.minimum;
      }
      if (propSchema.maximum !== undefined) {
        validation.maximum = propSchema.maximum;
      }
      break;

    case 'number':
      validation.bsonType = ['double', 'decimal'];
      if (propSchema.minimum !== undefined) {
        validation.minimum = propSchema.minimum;
      }
      if (propSchema.maximum !== undefined) {
        validation.maximum = propSchema.maximum;
      }
      break;

    case 'boolean':
      validation.bsonType = 'bool';
      break;

    case 'array':
      validation.bsonType = 'array';
      if (propSchema.items) {
        validation.items = mapJsonSchemaToMongoValidation(propSchema.items);
      }
      break;

    case 'object':
      validation.bsonType = 'object';
      if (propSchema.properties) {
        validation.properties = {};
        for (const [key, val] of Object.entries(propSchema.properties)) {
          validation.properties[key] = mapJsonSchemaToMongoValidation(val);
        }
      }
      break;

    default:
      validation.bsonType = 'string';
  }

  return validation;
}

function generateCollectionSetup(collectionName: string, validationSchema: any): string {
  let script = `// MongoDB Collection Setup for ${collectionName}\n\n`;
  script += `db.createCollection("${collectionName}", {\n`;
  script += `  validator: ${JSON.stringify(validationSchema, null, 2)}\n`;
  script += `});\n\n`;
  script += `// Create index on _id (default)\n`;
  script += `db.${collectionName}.createIndex({ _id: 1 });\n\n`;
  script += `console.log("Collection '${collectionName}' created successfully with validation rules");\n`;

  return script;
}

function generateSampleDocument(schema: JsonSchemaDefinition): any {
  const doc: any = {};

  if (schema.properties) {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      doc[propName] = generateSampleValue(propSchema);
    }
  }

  return doc;
}

function generateSampleValue(propSchema: any): any {
  switch (propSchema.type) {
    case 'string':
      if (propSchema.format === 'email') return 'user@example.com';
      if (propSchema.format === 'uri') return 'https://example.com';
      if (propSchema.format === 'date-time') return new Date().toISOString();
      if (propSchema.enum) return propSchema.enum[0];
      return 'sample_string';

    case 'integer':
      return propSchema.minimum || 1;

    case 'number':
      return propSchema.minimum || 1.0;

    case 'boolean':
      return propSchema.default !== undefined ? propSchema.default : true;

    case 'array':
      return propSchema.items ? [generateSampleValue(propSchema.items)] : [];

    case 'object':
      const obj: any = {};
      if (propSchema.properties) {
        for (const [key, val] of Object.entries(propSchema.properties)) {
          obj[key] = generateSampleValue(val);
        }
      }
      return obj;

    default:
      return null;
  }
}
