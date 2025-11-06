export interface SampleSchema {
  name: string;
  description: string;
  type: 'sql' | 'json' | 'mongo';
  content: string;
}

export const sampleSchemas: SampleSchema[] = [
  {
    name: 'E-commerce Database',
    description: 'Complete online store with users, products, orders',
    type: 'sql',
    content: `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  total_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
);`,
  },
  {
    name: 'Blog Platform',
    description: 'Blogging platform with posts, comments, tags',
    type: 'sql',
    content: `CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  bio TEXT
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  author_id INTEGER REFERENCES authors(id),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY,
  post_id INTEGER REFERENCES posts(id),
  author_name VARCHAR(100),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE post_tags (
  post_id INTEGER REFERENCES posts(id),
  tag_id INTEGER REFERENCES tags(id),
  PRIMARY KEY (post_id, tag_id)
);`,
  },
  {
    name: 'Social Network',
    description: 'Social media with users, posts, friendships',
    type: 'sql',
    content: `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  profile_picture VARCHAR(255),
  bio TEXT,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  image_url VARCHAR(255),
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE friendships (
  user_id INTEGER REFERENCES users(id),
  friend_id INTEGER REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE likes (
  user_id INTEGER REFERENCES users(id),
  post_id INTEGER REFERENCES posts(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id)
);`,
  },
  {
    name: 'MongoDB E-commerce',
    description: 'E-commerce schema for MongoDB',
    type: 'mongo',
    content: `[
  {
    "collection": "users",
    "fields": [
      { "name": "_id", "type": "ObjectId", "required": true },
      { "name": "username", "type": "String", "required": true },
      { "name": "email", "type": "String", "required": true },
      { "name": "passwordHash", "type": "String", "required": true },
      { "name": "createdAt", "type": "Date" }
    ]
  },
  {
    "collection": "products",
    "fields": [
      { "name": "_id", "type": "ObjectId", "required": true },
      { "name": "name", "type": "String", "required": true },
      { "name": "description", "type": "String" },
      { "name": "price", "type": "Number", "required": true },
      { "name": "category", "type": "String" },
      { "name": "stock", "type": "Number" },
      { "name": "tags", "type": "Array" }
    ]
  },
  {
    "collection": "orders",
    "fields": [
      { "name": "_id", "type": "ObjectId", "required": true },
      { "name": "userId", "type": "ObjectId", "required": true },
      { "name": "items", "type": "Array", "required": true },
      { "name": "totalAmount", "type": "Number", "required": true },
      { "name": "status", "type": "String" },
      { "name": "createdAt", "type": "Date" }
    ]
  }
]`,
  },
  {
    name: 'JSON Schema Example',
    description: 'Company database in JSON format',
    type: 'json',
    content: `[
  {
    "name": "departments",
    "columns": [
      { "name": "id", "type": "INTEGER", "isPrimaryKey": true },
      { "name": "name", "type": "VARCHAR(100)", "nullable": false },
      { "name": "manager_id", "type": "INTEGER" }
    ]
  },
  {
    "name": "employees",
    "columns": [
      { "name": "id", "type": "INTEGER", "isPrimaryKey": true },
      { "name": "first_name", "type": "VARCHAR(50)", "nullable": false },
      { "name": "last_name", "type": "VARCHAR(50)", "nullable": false },
      { "name": "email", "type": "VARCHAR(255)", "nullable": false },
      { "name": "department_id", "type": "INTEGER", "isForeignKey": true,
        "references": { "table": "departments", "column": "id" } },
      { "name": "salary", "type": "DECIMAL(10,2)" },
      { "name": "hire_date", "type": "DATE" }
    ]
  },
  {
    "name": "projects",
    "columns": [
      { "name": "id", "type": "INTEGER", "isPrimaryKey": true },
      { "name": "name", "type": "VARCHAR(200)", "nullable": false },
      { "name": "department_id", "type": "INTEGER", "isForeignKey": true,
        "references": { "table": "departments", "column": "id" } },
      { "name": "budget", "type": "DECIMAL(12,2)" },
      { "name": "start_date", "type": "DATE" },
      { "name": "end_date", "type": "DATE" }
    ]
  }
]`,
  },
];
