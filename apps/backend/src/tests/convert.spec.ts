import { describe, it, expect } from 'vitest';
import { parseSql } from '../services/sql.js';

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
