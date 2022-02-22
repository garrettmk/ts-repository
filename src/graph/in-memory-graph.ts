import { ID, NotImplementedError, objectEntries, ValidationError, ValueQueryField, ValueQueryOperator, ValueQueryOperatorKey } from "@/common";
import { CreateInput, Graph, GraphRepository, NodeModel, NodeQueryFields, NodeType, Query, Relation, RelationQueryField, UpdateInput } from "@/graph/graph-types";
import { CreateNodeFields, CreateRelationField, CreateRelationFields, CreateValueFields, EdgeType, NodeRef, RelationQueryFields, RelationsForType, RelationsType, UpdateRelationField, UpdateRelationFields, UpdateValueFields, ValueQueryFields } from ".";


export class InMemoryGraphRepository<TGraph extends Graph> implements GraphRepository<TGraph> {
  private readonly nodes: Map<ID, NodeType<TGraph>>;
  private readonly edges: Map<ID, EdgeType<TGraph>>;
  private readonly relations: RelationsType<TGraph>;
  private idCount: number = 0;

  // Create an InMemoryGraphReposity
  constructor(graph?: TGraph) {
    this.nodes = new Map(graph?.nodes.map(n => [n.id, n]));
    this.edges = new Map(graph?.edges.map(e => [`${e.from}:${e.to}`, e]));
    this.relations = graph?.relations ?? {};
  }

  // Create nodes and/or edges
  public create<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN>): NodeModel<TGraph, TN>
  public create<TN extends NodeType<TGraph>>(inputs: CreateInput<TGraph, TN>[]): NodeModel<TGraph, TN>[]
  public create<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN> | CreateInput<TGraph, TN>[]): NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[]
  public create<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN> | CreateInput<TGraph, TN>[]): NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[] {
    if (Array.isArray(input))
      return input
        .map(inp => this.createNode(inp))
        .map(node => this.getModel(node));

    const node = this.createNode(input);
    return this.getModel(node);
  }

  // Find nodes
  public find<TN extends NodeType<TGraph>>(id: ID): NodeModel<TGraph, TN>
  public find<TN extends NodeType<TGraph>>(ids: ID[]): NodeModel<TGraph, TN>[]
  public find<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>): NodeModel<TGraph, TN>[]
  public find<TN extends NodeType<TGraph>>(queries: Query<TGraph, TN>[]): NodeModel<TGraph, TN>[]
  public find<TN extends NodeType<TGraph>>(input: ID | ID[] | Query<TGraph, TN> | Query<TGraph, TN>[]): NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[]
  public find<TN extends NodeType<TGraph>>(input: ID | ID[] | Query<TGraph, TN> | Query<TGraph, TN>[]): NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[] {
    if (typeof input === 'string')
      return this.getModel<TN>(input);

    if (Array.isArray(input) && typeof input[0] === 'string')
      return (input as ID[]).map(id => this.getModel<TN>(id));

    if (Array.isArray(input))
      return (input as Query<TGraph, TN>[]).reduce(
        (result, inp) => [...result, ...this.findByQuery(inp)],
        [] as NodeModel<TGraph, TN>[]
      );

    return this.findByQuery(input);
  }


  // Update nodes and edges
  public update<TN extends NodeType<TGraph>>(id: ID, updates: UpdateInput<TGraph, TN>): NodeModel<TGraph, TN>
  public update<TN extends NodeType<TGraph>>(ids: ID[], updates: UpdateInput<TGraph, TN>): NodeModel<TGraph, TN>[]
  public update<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>, updates: UpdateInput<TGraph, TN>): NodeModel<TGraph, TN>[]
  public update<TN extends NodeType<TGraph>>(queries: Query<TGraph, TN>[], updates: UpdateInput<TGraph, TN>): NodeModel<TGraph, TN>[]
  public update<TN extends NodeType<TGraph>>(input: ID | ID[] | Query<TGraph, TN> | Query<TGraph, TN>[], updates: UpdateInput<TGraph, TN>): NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[] {
    const nodes = [this.find<TN>(input)].flat() as TN[];
    const updatedNodes = nodes.map(n => this.updateNode(n, updates));
    return updatedNodes.map(n => this.getModel<TN>(n));
  }


  // Delete nodes
  public delete<TN extends NodeType<TGraph>>(id: ID): TN
  public delete<TN extends NodeType<TGraph>>(ids: ID[]): TN[]
  public delete<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>): TN[]
  public delete<TN extends NodeType<TGraph>>(queries: Query<TGraph, TN>): TN[]
  public delete<TN extends NodeType<TGraph>>(input: ID | ID[] | Query<TGraph, TN> | Query<TGraph, TN>[]): TN[]
  public delete<TN extends NodeType<TGraph>>(input: ID | ID[] | Query<TGraph, TN> | Query<TGraph, TN>[]): TN[] {
    const nodes = [this.find<TN>(input)].flat() as TN[];
    nodes.forEach(n => {
      this.removeEdgesFromNode(n);
      this.nodes.delete(n.id);
    });

    return nodes;
  }



  // Create and return a new ID
  private getNextId(): ID {
    this.idCount = this.idCount + 1;
    return '' + this.idCount;
  }

  // Create and return an edge ID
  private getEdgeId(node: NodeType<TGraph>, relatedNode: NodeType<TGraph>, relation: Relation<TGraph>): ID {
    const { direction, edgeType } = this.parseRelation(relation);
    return direction === 'from'
      ? `${relatedNode.id}::${edgeType}::${node.id}`
      : `${node.id}::${edgeType}::${relatedNode.id}`;
  }

  // Check if a relation exists
  private relationExists(type: string, key: string) {
    return key in (this.relations[type] ?? {});
  }

  // Returns the relation for a given type and key
  private getRelation<TN extends NodeType<TGraph>>(type: TN['type'], key: keyof RelationsForType<TGraph, TN>): Relation<TGraph> {
    // @ts-ignore
    return this.relationsForType(type)[key];
  }

  // Returns true if the input is a NodeRef
  private isNodeRef(value: any): value is NodeRef {
    return typeof value === 'object'
      && value !== null
      && Object.keys(value).length === 1
      && 'id' in value
      && typeof value['id'] === 'string';
  }

  // Utility for getting the direction (to/from) and the related type
  private parseRelation(relation: Relation<TGraph>) {
    const direction = 'from' in relation ? 'from' : 'to';
    const relatedType = relation[direction as keyof typeof relation] as NodeType<TGraph>['type'];
    const edgeType = relation.type as EdgeType<TGraph>['type'];
    return { direction, relatedType, edgeType };
  }

  // Create nodes/edges from a singular input
  private createNode<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN>): TN {
    const id = this.getNextId();
    const { type } = input;
    const createValueFields = this.getCreateValueFields(type, input);
    const createRelationFields = this.getCreateRelationsFields(type, input);

    const node = { id, ...createValueFields } as unknown as TN;
    this.nodes.set(id, node);

    objectEntries(createRelationFields).forEach(([key, relationInput]) => {
      if (!relationInput) return;

      const relation = this.getRelation(type, key);
      const relatedNodes = this.makeNodesFromRelation(relation, relationInput!);
      const edges = this.makeEdgesFromRelation(node, relation, relatedNodes);
    });

    return this.getModel<TN>(id);
  }

  // Return just the value fields from a create input
  private getCreateValueFields<TN extends NodeType<TGraph>>(type: TN['type'], input: CreateInput<TGraph, TN>): CreateValueFields<TN> {
    return Object.fromEntries(
      Object.entries(input).filter(([key]) => !(key in this.relationsForType(type)))
    ) as unknown as CreateValueFields<TN>;
  }

  // Return just the relation fields from a create input
  private getCreateRelationsFields<TN extends NodeType<TGraph>>(type: TN['type'], input: CreateInput<TGraph, TN>): CreateRelationFields<TGraph, TN> {
    return Object.fromEntries(
      objectEntries(input).filter(([key]) => key in this.relationsForType(type))
    ) as CreateRelationFields<TGraph, TN>;
  }

  // Create nodes using
  private makeNodesFromRelation(relation: Relation<TGraph>, input: CreateRelationField<TGraph>): NodeType<TGraph>[] {
    const inputs = Array.isArray(input) ? input : [input];
    const { relatedType } = this.parseRelation(relation);

    return inputs.map(inp => {
      if (this.isNodeRef(inp))
        return this.nodes.get(inp.id)!;

      const newCreateInput = this.makeCreateInput(relatedType, inp);
      const relatedNode = this.create(newCreateInput);

      return relatedNode;
    });
  }

  // Create the appropriate edges between one node and a list of desired related nodes
  private makeEdgesFromRelation(node: NodeType<TGraph>, relation: Relation<TGraph>, relatedNodes: NodeType<TGraph>[]) {
    const { direction, edgeType } = this.parseRelation(relation);

    return relatedNodes.map(relatedNode => {
      const id = this.getEdgeId(node, relatedNode, relation);

      return this.edges.set(id, {
        from: direction === 'from' ? relatedNode.id : node.id,
        to: direction === 'from' ? node.id : relatedNode.id,
        type: edgeType
      }).get(id)!;
    });
  }

  // Remove all the edges described by a relation from an anchor and a list of related nodes
  private removeEdgesFromRelation(node: NodeType<TGraph>, relation: Relation<TGraph>, relatedNodes: NodeType<TGraph>[]) {
    return relatedNodes.map(relatedNode => {
      const id = this.getEdgeId(node, relatedNode, relation);
      this.edges.delete(id);
      return id;
    });
  }

  // Removes all edges to/from a node
  private removeEdgesFromNode(node: NodeType<TGraph>) {
    this.edges.forEach((edge, id) => {
      if (edge.from === node.id || edge.to === node.id)
        this.edges.delete(id);
    });
  }

  // Add "type" to a partial create input
  private makeCreateInput<TN extends NodeType<TGraph>>(type: TN['type'], input: CreateNodeFields<TGraph, TN>): CreateInput<TGraph, TN>
  private makeCreateInput<TN extends NodeType<TGraph>>(type: TN['type'], input: CreateNodeFields<TGraph, TN>[]): CreateInput<TGraph, TN>[]
  private makeCreateInput<TN extends NodeType<TGraph>>(type: TN['type'], input: CreateNodeFields<TGraph, TN> | CreateNodeFields<TGraph, TN>[]): CreateInput<TGraph, TN> | CreateInput<TGraph, TN>[]
  private makeCreateInput<TN extends NodeType<TGraph>>(type: TN['type'], input: CreateNodeFields<TGraph, TN> | CreateNodeFields<TGraph, TN>[]): CreateInput<TGraph, TN> | CreateInput<TGraph, TN>[] {
    if (Array.isArray(input))
      return input.map(inp => ({ ...inp, type }));

    return { ...input, type };
  }

  // Return a list of NodeModels for nodes matching a query object
  private findByQuery<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>): NodeModel<TGraph, TN>[] {
    const { type } = query;
    return this
      .findByType<TN>(type)
      .filter(node => this.matchesNodeQuery(node, query))
      .map(node => this.getModel<TN>(node));
  }

  // Return a list of nodes matching a type
  private findByType<TN extends NodeType<TGraph>>(type: TN['type']): TN[] {
    const result: TN[] = [];
    for (const [id, node] of this.nodes)
      if (node.type === type)
        result.push(node as TN);

    return result;
  }

  // Return a list of nodes matching a given type and query (a relation sub-query)
  private matchesNodeQuery<TN extends NodeType<TGraph>>(node: TN, nodeQuery: NodeQueryFields<TGraph, TN>): boolean {
    const valueQueryFields = this.getValueQueryFields(node, nodeQuery);
    const relationQueryFields = this.getRelationQueryFields(node, nodeQuery);

    return this.matchesValueFields(node, valueQueryFields) && this.matchesRelationFields(node, relationQueryFields);
  }

  // Return the relations for a given type, or an empty object
  private relationsForType<TN extends NodeType<TGraph>>(type: TN['type']): RelationsForType<TGraph, TN> {
    return this.relations[type] ?? {};
  }

  // Return the value fields part of a node query
  private getValueQueryFields(node: NodeType<TGraph>, nodeQuery: NodeQueryFields<TGraph>): ValueQueryFields<NodeType<TGraph>> {
    return Object.fromEntries(
      objectEntries(nodeQuery).filter(([key]) => !(key in this.relationsForType(node.type)))
    ) as ValueQueryFields<NodeType<TGraph>>;
  }

  // Return the relation fields part of a node query
  private getRelationQueryFields(node: NodeType<TGraph>, nodeQuery: NodeQueryFields<TGraph>): RelationQueryFields<TGraph, NodeType<TGraph>> {
    return Object.fromEntries(
      objectEntries(nodeQuery).filter(([key]) => key in this.relationsForType(node.type))
    ) as RelationQueryFields<TGraph, NodeType<TGraph>>;
  }

  // Returns true if a node matches the given value query fields
  private matchesValueFields(node: NodeType<TGraph>, nodeQuery: ValueQueryFields<NodeType<TGraph>>): boolean {
    return objectEntries(nodeQuery).reduce(
      (result, [key, valueQueryField]) => result && this.matchesValueQueryField(node, key as keyof NodeType<TGraph>, valueQueryField),
      true as boolean
    );
  }

  // Returns true if a node matches a specific value query field
  private matchesValueQueryField(node: NodeType<TGraph>, key: keyof NodeType<TGraph>, field: ValueQueryField<any>): boolean {
    const value = node[key];

    if (Array.isArray(field) && (field[0] === null || typeof field[0] !== 'object'))
      return field.includes(value);

    if (typeof field === 'object' && field !== null)
      return this.matchesOperator(value, field);

    return value === field;
  }

  // Returns true if a node matches the given relation query fields
  private matchesRelationFields(node: NodeType<TGraph>, fields: RelationQueryFields<TGraph, NodeType<TGraph>>): boolean {
    return objectEntries(fields).reduce(
      (result, [key, relationQueryField]) => result && this.matchesRelationQueryField(node, key as string, relationQueryField!),
      true as boolean
    );
  }

  // Returns true if a node matches a specific relation query field
  private matchesRelationQueryField(node: NodeType<TGraph>, key: string, field: RelationQueryField<TGraph, NodeType<TGraph>>): boolean {
    const relatedNodes = this.getRelatedNodes(node, key);

    if (Array.isArray(field))
      return relatedNodes.some(relNode => field.some(nodeQuery => this.matchesNodeQuery(relNode, nodeQuery)));

    return this.matchesOperator(relatedNodes, field);
  }

  // Returns true if a value matches a given operator
  private matchesOperator(value: any, operator: ValueQueryOperator<any>): boolean {
    const [op, rvalue] = this.parseOperator(operator);

    switch (op) {
      case 'eq':
        return value === rvalue;

      case 'ne':
        return value !== rvalue;

      case 'lt':
        return value < rvalue;

      case 'lte':
        return value <= rvalue;

      case 'gt':
        return value > rvalue;

      case 'gte':
        return value >= rvalue;

      case 're':
        return (rvalue as RegExp).test(value);

      case 'empty':
        return (value as any[]).length === 0 && rvalue;

      case 'length': {
        const length = (value as any[]).length;
        if (typeof rvalue === 'object' && rvalue !== null)
          return this.matchesOperator(length, rvalue);
        else
          return length === rvalue;
      }

      case 'includes':
        return (value as any[]).includes(rvalue);

      default:
        throw new NotImplementedError(`Unknown operator: ${JSON.stringify(operator)}`);
    }
  }

  // Turn an operator object ({ eq: 5 }) into a tuple (['eq', 5])
  private parseOperator(operator: ValueQueryOperator<any>): [ValueQueryOperatorKey, any] {
    const entries = objectEntries(operator);
    if (entries.length !== 1)
      throw new ValidationError(`Not a valid operator: ${JSON.stringify(operator)}`, ['0'], 'ValueQueryOperator<any>', operator);

    return entries[0];
  }


  // Get all related nodes of the given type and direction
  public getRelatedNodes(from: ID | NodeType<TGraph>, key: string): NodeType<TGraph>[] {
    const node = typeof from === 'string' ? this.nodes.get(from)! : from;
    const relation = this.getRelation(node.type, key);
    const { direction, relatedType, edgeType } = this.parseRelation(relation);
    const result: NodeType<TGraph>[] = [];

    this.edges.forEach(edge => {
      if (edgeType && (edge.type !== edgeType))
        return;

      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);

      if (direction === 'to' && fromNode?.id === node.id && toNode?.type === relatedType) {
        result.push(toNode!);
      }
      else if (direction === 'from' && fromNode?.type === relatedType && toNode?.id === node.id) {
        result.push(fromNode!);
      }
    });

    return result;
  }

  // Update and return a specific node
  private updateNode<TN extends NodeType<TGraph>>(node: TN, updates: UpdateInput<TGraph, TN>): TN {
    const updateNodeFields = this.getUpdateValueFields(node, updates);
    const updateRelationFields = this.getUpdateRelationFields(node, updates);

    const newNode = this.updateNodeValues(node, updateNodeFields);
    this.updateNodeRelations(node, updateRelationFields);

    return newNode;
  }

  // Return the value field updates from an update input
  private getUpdateValueFields<TN extends NodeType<TGraph>>(node: TN, updates: UpdateInput<TGraph, TN>): UpdateValueFields<TN> {
    return Object.fromEntries(
      Object.entries(updates).filter(([key]) => !(key in this.relationsForType(node.type)))
    ) as UpdateValueFields<TN>
  };

  // Return the relation field updates from an update input
  private getUpdateRelationFields<TN extends NodeType<TGraph>>(node: TN, updates: UpdateInput<TGraph, TN>): UpdateRelationFields<TGraph, TN> {
    return Object.fromEntries(
      Object.entries(updates).filter(([key]) => key in this.relationsForType(node.type))
    ) as UpdateRelationFields<TGraph, TN>;
  }

  // Update and return a node
  private updateNodeValues<TN extends NodeType<TGraph>>(node: TN, updateNodeFields: UpdateValueFields<TN>): TN {
    return { ...node, ...updateNodeFields };
  };

  // Update the edges to/from a node with the given relation field updates
  private updateNodeRelations<TN extends NodeType<TGraph>>(node: TN, updateRelationFields: UpdateRelationFields<TGraph, TN>): EdgeType<TGraph>[] {
    return Object.entries(updateRelationFields).reduce(
      (result, [key, updateRelationField]) => {
        this.updateNodeRelation(node, key, updateRelationField);
        return result;
      },
      [] as EdgeType<TGraph>[]
    );
  }

  // Update a specific relation using a relation field update input
  private updateNodeRelation<TN extends NodeType<TGraph>>(node: TN, key: string, updateRelationField: UpdateRelationField<TGraph, TN>) {
    const { add, remove } = updateRelationField;
    const relation = this.getRelation(node.type, key);
    const { relatedType } = this.parseRelation(relation);

    if (add) {
      const subquery = this.makeQuery(relatedType, add);
      const addNodes = [this.find(subquery)].flat() as NodeType<TGraph>[];
      this.makeEdgesFromRelation(node, relation, addNodes);
    }

    if (remove) {
      const subquery = this.makeQuery(relatedType, remove);
      const removeNodes = [this.find(subquery)].flat() as NodeType<TGraph>[];
      this.removeEdgesFromRelation(node, relation, removeNodes);
    }
  }

  // Add "type" to a partial query
  private makeQuery<TN extends NodeType<TGraph>>(type: TN['type'], input: NodeQueryFields<TGraph, TN>): Query<TGraph, TN>
  private makeQuery<TN extends NodeType<TGraph>>(type: TN['type'], input: NodeQueryFields<TGraph, TN>[]): Query<TGraph, TN>[]
  private makeQuery<TN extends NodeType<TGraph>>(type: TN['type'], input: NodeQueryFields<TGraph, TN> | NodeQueryFields<TGraph, TN>[]): Query<TGraph, TN> | Query<TGraph, TN>[]
  private makeQuery<TN extends NodeType<TGraph>>(type: TN['type'], input: NodeQueryFields<TGraph, TN> | NodeQueryFields<TGraph, TN>[]): Query<TGraph, TN> | Query<TGraph, TN>[] {
    if (Array.isArray(input))
      return input.map(inp => ({ ...inp, type }));

    return { ...input, type };
  }

  // Proxy a node, and give it the properties expected by the relations
  // for it's type
  public getModel<TN extends NodeType<TGraph> = NodeType<TGraph>>(from: ID | TN): NodeModel<TGraph, TN> {
    const node = typeof from === 'string'
      ? this.nodes.get(from)!
      : from;

    const relations = this.relations[node.type as NodeType<TGraph>['type']];

    return new Proxy(node, {
      ownKeys: (target) => {
        const keys = [
          ...Reflect.ownKeys(node),
          ...Reflect.ownKeys(relations)
        ];
        return keys;
      },

      getOwnPropertyDescriptor: (target, key) => {
        if (key in node || key in relations)
          return {
            writable: false,
            configurable: true,
            enumerable: true,
          };
      },

      defineProperty: (target, key, descriptor) => false,

      get: (target, key, receiver) => {
        if (key === Symbol.toStringTag)
          return `NodeModel<${node.type}>`;

        if (key in node || typeof key !== 'string')
          return node[key as keyof NodeType<TGraph>];

        if (!this.relationExists(node.type, key))
          return undefined;

        const relatedNodes = this.getRelatedNodes(node, key);
        const relatedModels = relatedNodes.map(n => this.getModel(n));

        return relatedModels;
      },
    }) as unknown as NodeModel<TGraph, TN>
  }
}