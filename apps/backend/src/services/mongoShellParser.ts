import stripComments from 'strip-comments';

/**
 * Preprocesses MongoDB Shell syntax and converts it to normalized JSON
 */
export function preprocessMongoShell(content: string): string {
  // 1. Check if this looks like MongoDB Shell syntax
  if (!isMongoShellSyntax(content)) {
    // Return as-is if it's already JSON
    return content;
  }

  // 2. Remove comments
  let processed = stripComments(content, {
    language: 'javascript',
    preserveNewlines: true,
  });

  // 3. Extract collections from db.createCollection() commands
  const collections = extractCollections(processed);

  // 4. Extract documents from insertOne/insertMany commands
  const documents = extractDocuments(processed);

  // 5. If we found MongoDB Shell commands, construct normalized output
  if (collections.length > 0 || documents.length > 0) {
    return constructNormalizedOutput(collections, documents);
  }

  // 6. Try to convert JavaScript object literals to JSON
  processed = convertJsObjectsToJson(processed);

  return processed;
}

/**
 * Detects if content contains MongoDB Shell syntax
 */
function isMongoShellSyntax(content: string): boolean {
  // Check for common MongoDB Shell patterns
  const patterns = [
    /db\.createCollection/,
    /db\.\w+\.insert/,
    /db\.\w+\.find/,
    /db\.\w+\.update/,
    /db\.\w+\.createIndex/,
    /\/\//,  // Single-line comments
    /\/\*/,  // Multi-line comments
  ];

  return patterns.some(pattern => pattern.test(content));
}

/**
 * Extracts collection definitions from db.createCollection() commands
 */
function extractCollections(content: string): Array<{
  name: string;
  schema?: any;
  indexes?: any[];
}> {
  const collections: Array<{ name: string; schema?: any; indexes?: any[] }> = [];

  // Match db.createCollection("name", { validator: { $jsonSchema: {...} } })
  const createCollectionRegex = /db\.createCollection\s*\(\s*["'](\w+)["']\s*,\s*(\{[\s\S]*?\})\s*\)/g;

  let match;
  while ((match = createCollectionRegex.exec(content)) !== null) {
    const collectionName = match[1];
    const optionsStr = match[2];

    try {
      // Convert JS object to JSON and parse
      const optionsJson = convertJsObjectsToJson(optionsStr);
      const options = JSON.parse(optionsJson);

      const collection: { name: string; schema?: any; indexes?: any[] } = {
        name: collectionName,
      };

      // Extract validator.$jsonSchema if present
      if (options.validator && options.validator.$jsonSchema) {
        collection.schema = options.validator.$jsonSchema;
      }

      collections.push(collection);
    } catch (err) {
      console.warn(`Failed to parse collection ${collectionName} options:`, err);
    }
  }

  return collections;
}

/**
 * Extracts documents from insertOne/insertMany commands
 */
function extractDocuments(content: string): Array<{
  collection: string;
  documents: any[];
}> {
  const results: Array<{ collection: string; documents: any[] }> = [];

  // Match db.collection.insertOne({...})
  const insertOneRegex = /db\.(\w+)\.insertOne\s*\(\s*(\{[\s\S]*?\})\s*\)/g;
  let match;

  while ((match = insertOneRegex.exec(content)) !== null) {
    const collectionName = match[1];
    const docStr = match[2];

    try {
      const docJson = convertJsObjectsToJson(docStr);
      const doc = JSON.parse(docJson);

      const existing = results.find(r => r.collection === collectionName);
      if (existing) {
        existing.documents.push(doc);
      } else {
        results.push({ collection: collectionName, documents: [doc] });
      }
    } catch (err) {
      console.warn(`Failed to parse insertOne document:`, err);
    }
  }

  // Match db.collection.insertMany([{...}, {...}])
  const insertManyRegex = /db\.(\w+)\.insertMany\s*\(\s*(\[[\s\S]*?\])\s*\)/g;

  while ((match = insertManyRegex.exec(content)) !== null) {
    const collectionName = match[1];
    const docsStr = match[2];

    try {
      const docsJson = convertJsObjectsToJson(docsStr);
      const docs = JSON.parse(docsJson);

      const existing = results.find(r => r.collection === collectionName);
      if (existing) {
        existing.documents.push(...docs);
      } else {
        results.push({ collection: collectionName, documents: docs });
      }
    } catch (err) {
      console.warn(`Failed to parse insertMany documents:`, err);
    }
  }

  return results;
}

/**
 * Converts JavaScript object literals to JSON
 */
function convertJsObjectsToJson(content: string): string {
  let result = content;

  // Convert MongoDB-specific syntax to JSON
  const conversions: Array<[RegExp, string]> = [
    // ObjectId("...") → {"$oid": "..."}
    [/ObjectId\s*\(\s*["']([^"']+)["']\s*\)/g, '{"$$oid":"$1"}'],

    // new Date("...") → {"$date": "..."}
    [/new\s+Date\s*\(\s*["']([^"']+)["']\s*\)/g, '{"$$date":"$1"}'],

    // ISODate("...") → {"$date": "..."}
    [/ISODate\s*\(\s*["']([^"']+)["']\s*\)/g, '{"$$date":"$1"}'],

    // NumberLong(...) → number
    [/NumberLong\s*\(\s*(\d+)\s*\)/g, '$1'],

    // NumberInt(...) → number
    [/NumberInt\s*\(\s*(\d+)\s*\)/g, '$1'],

    // NumberDecimal("...") → {"$numberDecimal": "..."}
    [/NumberDecimal\s*\(\s*["']([^"']+)["']\s*\)/g, '{"$$numberDecimal":"$1"}'],

    // Decimal128("...") → {"$numberDecimal": "..."}
    [/Decimal128\s*\(\s*["']([^"']+)["']\s*\)/g, '{"$$numberDecimal":"$1"}'],
  ];

  for (const [pattern, replacement] of conversions) {
    result = result.replace(pattern, replacement);
  }

  // Remove trailing commas in objects and arrays
  result = result.replace(/,(\s*[}\]])/g, '$1');

  return result;
}

/**
 * Constructs normalized output from extracted collections and documents
 */
function constructNormalizedOutput(
  collections: Array<{ name: string; schema?: any; indexes?: any[] }>,
  documents: Array<{ collection: string; documents: any[] }>
): string {
  const output: any = {};

  // If we have schemas, use those
  if (collections.length > 0) {
    output.collections = collections;
  }

  // If we have sample documents, include those
  if (documents.length > 0) {
    output.documents = documents;
  }

  // If we only have documents without schemas, use the documents directly
  if (documents.length > 0 && collections.length === 0) {
    // Return just the documents for schema inference
    if (documents.length === 1) {
      return JSON.stringify(documents[0].documents, null, 2);
    } else {
      const allDocs: any = {};
      for (const doc of documents) {
        allDocs[doc.collection] = doc.documents;
      }
      return JSON.stringify(allDocs, null, 2);
    }
  }

  return JSON.stringify(output, null, 2);
}

/**
 * Metadata extraction for UI feedback
 */
export function detectMongoShellFeatures(content: string): {
  isMongoShell: boolean;
  features: string[];
} {
  const features: string[] = [];

  if (/\/\//.test(content)) {
    features.push('Single-line comments');
  }

  if (/\/\*[\s\S]*?\*\//.test(content)) {
    features.push('Multi-line comments');
  }

  if (/db\.createCollection/.test(content)) {
    features.push('createCollection commands');
  }

  if (/db\.\w+\.insert(One|Many)/.test(content)) {
    features.push('insert commands');
  }

  if (/ObjectId\(/.test(content)) {
    features.push('ObjectId() syntax');
  }

  if (/new\s+Date\(/.test(content) || /ISODate\(/.test(content)) {
    features.push('Date() syntax');
  }

  return {
    isMongoShell: features.length > 0,
    features,
  };
}
