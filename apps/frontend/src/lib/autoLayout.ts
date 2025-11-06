import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

export interface LayoutOptions {
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/**
 * Auto-layout nodes using Dagre algorithm
 */
export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
  const {
    direction = 'TB',
    nodeWidth = 300,
    nodeHeight = 150,
    rankSep = 100,
    nodeSep = 80,
  } = options;

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure the graph
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
    edgesep: 50,
    marginx: 50,
    marginy: 50,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply layout to React Flow nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Circular layout for nodes
 */
export function getCircularLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const radius = Math.max(300, nodes.length * 50);
  const centerX = radius;
  const centerY = radius;

  const layoutedNodes = nodes.map((node, index) => {
    const angle = (index / nodes.length) * 2 * Math.PI;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    return {
      ...node,
      position: { x, y },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/**
 * Force-directed layout simulation
 */
export function getForceLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  // Simple force-directed layout
  const layoutedNodes = nodes.map((node, index) => {
    const row = Math.floor(index / 4);
    const col = index % 4;

    return {
      ...node,
      position: {
        x: col * 350 + 100,
        y: row * 250 + 100,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}
