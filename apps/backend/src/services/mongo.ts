export interface MongoSchemaDefinition {
  collection: string;
  fields: MongoField[];
  indexes?: MongoIndex[];
  validationRules?: any;
}

export interface MongoField {
  name: string;
  type: string;
  required: boolean;
  isArray?: boolean;
  nested?: MongoField[];
}

export interface MongoIndex {
  name: string;
  fields: Record<string, 1 | -1>;
  unique?: boolean;
}

export function inferMongoSchema(documents: any[]): MongoSchemaDefinition[] {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error('Documents must be a non-empty array');
  }

  // Sample the first document to infer structure
  const sampleDoc = documents[0];
  const collectionName = sampleDoc._collection || 'collection';

  const fields = inferFieldsFromDocument(sampleDoc);

  return [{
    collection: collectionName,
    fields,
  }];
}

function inferFieldsFromDocument(doc: any, _parentKey = ''): MongoField[] {
  const fields: MongoField[] = [];

  for (const [key, value] of Object.entries(doc)) {
    if (key === '_id' || key === '_collection') continue;

    const field: MongoField = {
      name: key,
      type: inferMongoType(value),
      required: value !== null && value !== undefined,
    };

    if (Array.isArray(value)) {
      field.isArray = true;
      if (value.length > 0 && typeof value[0] === 'object') {
        field.nested = inferFieldsFromDocument(value[0]);
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      field.nested = inferFieldsFromDocument(value);
    }

    fields.push(field);
  }

  return fields;
}

function inferMongoType(value: any): string {
  if (value === null || value === undefined) {
    return 'mixed';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? inferMongoType(value[0]) : 'array';
  }

  if (value instanceof Date) {
    return 'date';
  }

  switch (typeof value) {
    case 'string':
      return 'string';
    case 'number':
      return Number.isInteger(value) ? 'int' : 'double';
    case 'boolean':
      return 'bool';
    case 'object':
      return 'object';
    default:
      return 'mixed';
  }
}

export function parseMongoSchema(content: string): MongoSchemaDefinition[] {
  try {
    // Import preprocessor
    const { preprocessMongoShell } = require('./mongoShellParser.js');

    // Preprocess MongoDB Shell syntax to normalized JSON
    const processed = preprocessMongoShell(content);

    const data = JSON.parse(processed);

    // Check if we have explicit schema definitions
    if (data.collections && Array.isArray(data.collections)) {
      // Explicit schema format from createCollection commands
      return data.collections.map((col: any) => ({
        collection: col.name,
        fields: col.schema?.properties
          ? extractFieldsFromJsonSchema(col.schema)
          : [],
        indexes: col.indexes,
      }));
    }

    if (Array.isArray(data)) {
      return inferMongoSchema(data);
    } else if (typeof data === 'object') {
      // Check if it's a documents object with collection names as keys
      if (data.documents) {
        // Format: { documents: [{ collection: 'name', documents: [...] }] }
        const schemas: MongoSchemaDefinition[] = [];
        for (const doc of data.documents) {
          schemas.push(...inferMongoSchema(doc.documents));
        }
        return schemas;
      }

      // Single document
      return inferMongoSchema([data]);
    } else {
      throw new Error('Invalid MongoDB data format');
    }
  } catch (error) {
    throw new Error(`MongoDB schema parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function extractFieldsFromJsonSchema(jsonSchema: any): MongoField[] {
  const fields: MongoField[] = [];
  const properties = jsonSchema.properties || {};
  const required = jsonSchema.required || [];

  for (const [name, prop] of Object.entries(properties)) {
    const propDef = prop as any;

    const field: MongoField = {
      name,
      type: mapJsonSchemaTypeToMongo(propDef.type, propDef),
      required: required.includes(name),
    };

    if (propDef.type === 'array' && propDef.items) {
      field.isArray = true;
      if (propDef.items.type === 'object' && propDef.items.properties) {
        field.nested = extractFieldsFromJsonSchema(propDef.items);
      }
    } else if (propDef.type === 'object' && propDef.properties) {
      field.nested = extractFieldsFromJsonSchema(propDef);
    }

    fields.push(field);
  }

  return fields;
}

function mapJsonSchemaTypeToMongo(type: string, propDef: any): string {
  switch (type) {
    case 'string':
      if (propDef.format === 'date-time') return 'date';
      return 'string';
    case 'number':
      return 'double';
    case 'integer':
      return 'int';
    case 'boolean':
      return 'bool';
    case 'array':
      return 'array';
    case 'object':
      return 'object';
    default:
      return 'mixed';
  }
}
