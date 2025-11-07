/**
 * Topological Sorting for Foreign Key Dependencies
 *
 * Determines the correct order to insert tables to avoid FK constraint violations.
 *
 * Algorithm:
 * 1. Build dependency graph from foreign key relationships
 * 2. Perform topological sort using Kahn's algorithm
 * 3. Detect circular dependencies
 * 4. Return insert order
 *
 * Inspired by:
 * - Prisma schema dependency resolution
 * - Atlas migration ordering
 * - dbmate table ordering
 */

export interface TableDependency {
  tableName: string;
  dependsOn: string[]; // Tables this table references via FKs
}

export interface TopologicalSortResult {
  order: string[]; // Tables in safe insert order
  cycles: string[][]; // Circular dependencies detected
  independent: string[]; // Tables with no dependencies
}

/**
 * Build dependency graph from table schemas
 */
export function buildDependencyGraph(
  tableSchemas: Array<{
    name: string;
    foreignKeys: Array<{
      column: string;
      referencedTable: string;
      referencedColumn: string;
    }>;
  }>
): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();

  // Initialize all tables
  for (const table of tableSchemas) {
    if (!graph.has(table.name)) {
      graph.set(table.name, new Set());
    }
  }

  // Add dependencies
  for (const table of tableSchemas) {
    const dependencies = graph.get(table.name)!;

    for (const fk of table.foreignKeys) {
      // Ignore self-referential FKs (they don't affect insert order)
      if (fk.referencedTable !== table.name) {
        dependencies.add(fk.referencedTable);
      }
    }
  }

  return graph;
}

/**
 * Perform topological sort using Kahn's algorithm
 */
export function topologicalSort(tables: TableDependency[]): TopologicalSortResult {
  // Build dependency graph
  const graph = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  const allTables = new Set<string>();

  // Initialize
  for (const table of tables) {
    allTables.add(table.tableName);
    if (!graph.has(table.tableName)) {
      graph.set(table.tableName, new Set());
    }
    if (!inDegree.has(table.tableName)) {
      inDegree.set(table.tableName, 0);
    }
  }

  // Build edges
  for (const table of tables) {
    for (const dep of table.dependsOn) {
      // Ignore self-references
      if (dep === table.tableName) continue;

      graph.get(dep)?.add(table.tableName);
      inDegree.set(table.tableName, (inDegree.get(table.tableName) || 0) + 1);

      // Ensure dependency exists in graph
      if (!graph.has(dep)) {
        graph.set(dep, new Set());
      }
      if (!inDegree.has(dep)) {
        inDegree.set(dep, 0);
      }
      allTables.add(dep);
    }
  }

  // Find tables with no dependencies (in-degree = 0)
  const queue: string[] = [];
  const independent: string[] = [];

  for (const [table, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(table);
      independent.push(table);
    }
  }

  // Kahn's algorithm
  const order: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    visited.add(current);

    // Reduce in-degree of dependent tables
    const dependents = graph.get(current) || new Set();
    for (const dependent of dependents) {
      inDegree.set(dependent, (inDegree.get(dependent) || 0) - 1);

      if (inDegree.get(dependent) === 0) {
        queue.push(dependent);
      }
    }
  }

  // Detect cycles
  const cycles: string[][] = [];
  const unvisited = Array.from(allTables).filter(t => !visited.has(t));

  if (unvisited.length > 0) {
    // Find cycles using DFS
    const cycleDetected = detectCycles(unvisited, graph);
    cycles.push(...cycleDetected);
  }

  return {
    order,
    cycles,
    independent,
  };
}

/**
 * Detect cycles in dependency graph using DFS
 */
function detectCycles(
  unvisited: string[],
  graph: Map<string, Set<string>>
): string[][] {
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string, path: string[]): boolean {
    if (visiting.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart));
      }
      return true;
    }

    if (visited.has(node)) {
      return false;
    }

    visiting.add(node);
    path.push(node);

    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (dfs(neighbor, [...path])) {
        // Cycle found, but continue to find all cycles
      }
    }

    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const node of unvisited) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

/**
 * Extract table dependencies from schema artifacts
 */
export function extractTableDependencies(
  schemaArtifacts: Record<string, string>
): TableDependency[] {
  const dependencies: TableDependency[] = [];

  for (const [tableName, ddl] of Object.entries(schemaArtifacts)) {
    const tableNameMatch = tableName.match(/(.+)\.sql$/);
    const actualTableName = tableNameMatch ? tableNameMatch[1] : tableName;

    // Extract foreign key references from DDL
    const fkMatches = ddl.matchAll(/FOREIGN KEY.*?REFERENCES\s+["`]?(\w+)["`]?\s*\(/gi);
    const dependsOn = new Set<string>();

    for (const match of fkMatches) {
      const referencedTable = match[1];
      if (referencedTable !== actualTableName) {
        dependsOn.add(referencedTable);
      }
    }

    dependencies.push({
      tableName: actualTableName,
      dependsOn: Array.from(dependsOn),
    });
  }

  return dependencies;
}

/**
 * Get optimal insert order for tables
 */
export function getInsertOrder(
  schemaArtifacts: Record<string, string>
): { order: string[]; hasCycles: boolean; cycles: string[][] } {
  const dependencies = extractTableDependencies(schemaArtifacts);
  const result = topologicalSort(dependencies);

  return {
    order: result.order,
    hasCycles: result.cycles.length > 0,
    cycles: result.cycles,
  };
}

/**
 * Group tables by dependency level (for parallel inserts)
 */
export function groupByDependencyLevel(
  dependencies: TableDependency[]
): string[][] {
  const result = topologicalSort(dependencies);
  const levels: string[][] = [];
  const processed = new Set<string>();
  const graph = new Map<string, Set<string>>();

  // Build graph
  for (const dep of dependencies) {
    if (!graph.has(dep.tableName)) {
      graph.set(dep.tableName, new Set());
    }
    for (const parent of dep.dependsOn) {
      graph.get(dep.tableName)!.add(parent);
    }
  }

  // Group by level
  while (processed.size < result.order.length) {
    const currentLevel: string[] = [];

    for (const table of result.order) {
      if (processed.has(table)) continue;

      // Check if all dependencies are processed
      const deps = graph.get(table) || new Set();
      const allDepsProcessed = Array.from(deps).every(d => processed.has(d));

      if (allDepsProcessed) {
        currentLevel.push(table);
        processed.add(table);
      }
    }

    if (currentLevel.length > 0) {
      levels.push(currentLevel);
    } else {
      // Avoid infinite loop
      break;
    }
  }

  return levels;
}
