import { describe, it, expect } from 'vitest';
import { parseSql } from '../services/sql.js';
import { convertJsonToSql } from '../services/jsonToSql.js';

describe('SQL Parser', () => {
  it('should parse a simple CREATE TABLE statement', () => {
    const sql = `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255)
      );
    `;

    const tables = parseSql(sql, 'postgres');
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('users');
    expect(tables[0].columns).toHaveLength(2);
  });

  it('should handle tables with foreign keys', () => {
    const sql = `
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `;

    const tables = parseSql(sql, 'postgres');
    expect(tables).toHaveLength(1);
    expect(tables[0].foreignKeys).toHaveLength(1);
  });
});

describe('JSON to SQL Converter', () => {
  it('should map MongoDB _id to TEXT PRIMARY KEY, not INTEGER', async () => {
    // Input: MongoDB document with ObjectId _id (as string after normalization)
    const jsonContent = JSON.stringify({
      _id: '690c9ca0c54bcc3591789345',
      name: 'Alice'
    });

    const result = await convertJsonToSql(jsonContent, 'postgres');

    // The artifact key is 'main_table.sql' by default
    const ddl = result.artifacts['main_table.sql'];

    // Verify the DDL contains _id TEXT PRIMARY KEY (with quoted identifiers)
    expect(ddl).toBeDefined();
    expect(ddl).toContain('"_id" TEXT PRIMARY KEY');
    expect(ddl).not.toContain('"_id" INTEGER');
    expect(ddl).not.toContain('"_id" INT');

    // Verify table was created
    expect(result.summary.tables).toBe(1);
  });

  it('should still map other _id suffix fields (like user_id) to INTEGER', async () => {
    const jsonContent = JSON.stringify({
      id: 1,
      user_id: 123,
      name: 'Product'
    });

    const result = await convertJsonToSql(jsonContent, 'postgres');

    // The artifact key is 'main_table.sql' by default
    const ddl = result.artifacts['main_table.sql'];

    // Verify user_id is INTEGER (foreign key, with quoted identifiers)
    expect(ddl).toBeDefined();
    expect(ddl).toContain('"user_id" INTEGER');
  });

  it('should use _id in foreign key REFERENCES for MongoDB documents', async () => {
    // MongoDB document with nested structure
    const jsonContent = JSON.stringify({
      _id: '690c9ca0c54bcc3591789345',
      name: 'John Doe',
      profile: {
        _id: '690c9ca0c54bcc3591789346',
        bio: 'Software engineer',
        avatar_url: 'https://example.com/avatar.jpg'
      }
    });

    const result = await convertJsonToSql(jsonContent, 'postgres');

    // Get both table DDLs
    const mainTableDdl = result.artifacts['main_table.sql'];

    // Verify main table uses _id as PK
    expect(mainTableDdl).toContain('"_id" TEXT PRIMARY KEY');

    // Verify nested table references parent's _id (not 'id')
    // The FK column should be main_table__id and reference main_table(_id)
    expect(mainTableDdl).toContain('REFERENCES "main_table"("_id")');

    // Verify FK column type matches parent PK type (TEXT)
    expect(mainTableDdl).toContain('"main_table__id" TEXT');
  });

  it('should handle self-referential foreign keys with _id', async () => {
    // Employee with manager_id self-reference
    const jsonContent = JSON.stringify({
      _id: '690c9ca0c54bcc3591789347',
      name: 'Alice',
      manager_id: '690c9ca0c54bcc3591789348'
    });

    const result = await convertJsonToSql(jsonContent, 'postgres');
    const ddl = result.artifacts['main_table.sql'];

    // Verify main table uses _id as PK
    expect(ddl).toContain('"_id" TEXT PRIMARY KEY');

    // Verify self-referential FK references _id (not 'id')
    expect(ddl).toContain('REFERENCES "main_table"("_id")');

    // Verify manager_id column exists with TEXT type
    expect(ddl).toContain('"manager_id" TEXT');
  });
});
