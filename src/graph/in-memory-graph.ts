import { ID, MaybeArray, NotImplementedError, ValueQueryField, ValueQueryOperator } from "@/common";
import { CreateInput, Edge, Graph, GraphRepository, Node, NodeQuery, NodeModel, NodeType, Query, Relation, UpdateInput, RelationQueryField } from "@/graph/graph-types";
import { EdgeType, RelationQueryFields, RelationsForType, RelationsType, ValueQueryFields } from ".";


export class InMemoryGraphRepository<TGraph extends Graph> implements GraphRepository<TGraph> {
  private nodes: Map<ID, NodeType<TGraph>>;
  private edges: Map<ID, EdgeType<TGraph>>;
  private relations: RelationsType<TGraph>;
  private idCount: number = 0;

  // Create an InMemoryGraphReposity
  constructor(graph?: TGraph) {
    this.nodes = new Map(graph?.nodes.map(n => [n.id, n]));
    this.edges = new Map(graph?.edges.map(e => [`${e.from}:${e.to}`, e]));
    this.relations = graph?.relations ?? {};
  }

  // Create nodes and/or edges
  public create<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN>) : NodeModel<TGraph, TN>
  public create<TN extends NodeType<TGraph>>(inputs: CreateInput<TGraph, TN>[]) : NodeModel<TGraph, TN>[]
  public create<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN> | CreateInput<TGraph, TN>[]) : NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[] {
    if (Array.isArray(input))
      return input.reduce(
        (result, createInput) => [...result, this.createNode(createInput)],
        [] as NodeModel<TGraph, TN>[]
      );

    return this.createNode(input);
  }

  // Create nodes/edges from a singular input
  public createNode<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN>) : NodeModel<TGraph, TN> {
    const id = this.getNextId();
    const { type } = input;
    const { createValuesInput, createRelationsInput } = this.splitCreateInputFields(input);
    
    const node = { id, ...createValuesInput } as unknown as TN;
    this.nodes.set(id, node);

    Object.entries(createRelationsInput).forEach(([key, relationInput]) => {
      if (!relationInput) return;

      const relation = this.getRelation(type, key);
      const relatedNodes = this.makeNodesFromRelation(relation, relationInput as any);
      const edges = this.makeEdgesFromRelation(node, relation, relatedNodes);
    });

    return this.getModel<TN>(id);
  }
  
  // Create nodes from a relation and an input
  private makeNodesFromRelation(relation: Relation<TGraph>, input: MaybeArray<CreateInput<TGraph>>) : NodeType<TGraph>[] {
    const inputs = Array.isArray(input) ? input : [input];
    const { relatedType } = this.parseRelation(relation);

    return inputs.map(inp => {
      const newCreateInput = this.makeCreateInput(relatedType, inp);
      const relatedNode = this.create(newCreateInput);
  
      return relatedNode;
    });
  }

  // Create edges between one node and a list of nodes, given a relation
  private makeEdgesFromRelation(node: NodeType<TGraph>, relation: Relation<TGraph>, relatedNodes: NodeType<TGraph>[]) {
    const { direction, edgeType } = this.parseRelation(relation);

    return relatedNodes.map(relatedNode => {
      const id = direction === 'from' 
      ? `${relatedNode.id}::${node.id}`
      : `${node.id}::${relatedNode.id}`;
  
      // @ts-ignore
      return this.edges.set(id, {
        from: direction === 'from' ? relatedNode.id : node.id,
        to: direction === 'from' ? node.id : relatedNode.id,
        type: edgeType
      }).get(id)!;
    });
  }

  // Add "type" to a partial create input
  private makeCreateInput(type: NodeType<TGraph>['type'], input: Omit<CreateInput<TGraph>, 'type'>) : CreateInput<TGraph>
  private makeCreateInput(type: NodeType<TGraph>['type'], input: Omit<CreateInput<TGraph>, 'type'>[]) : CreateInput<TGraph>[]
  private makeCreateInput(type: NodeType<TGraph>['type'], input: Omit<CreateInput<TGraph>, 'type'> | Omit<CreateInput<TGraph>, 'type'>[])
    : CreateInput<TGraph> | CreateInput<TGraph>[] {
    if (Array.isArray(input))
      // @ts-ignore
      return input.map(inp => ({ ...inp, type }));

    // @ts-ignore
    return { ...input, type };
  }

  // Split a create input into data fields and relation fields
  private splitCreateInputFields<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN>) {
    const { type } = input;
    const relationKeysForType = Object.keys(this.relations[type] ?? {});
    
    const createValuesInput = Object.fromEntries(Object.entries(input).filter(
      ([key]) => !relationKeysForType.includes(key)
    )) as CreateInput<TGraph, TN>;

    const createRelationsInput = Object.fromEntries(Object.entries(input).filter(
        ([key]) => relationKeysForType.includes(key)
      )) as CreateInput<TGraph, TN>;

    return {
      createValuesInput,
      createRelationsInput
    };
  }

  // Find nodes
  public find<TN extends NodeType<TGraph>>(id: ID) : NodeModel<TGraph, TN>
  public find<TN extends NodeType<TGraph>>(ids: ID[]) : NodeModel<TGraph, TN>[]
  public find<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>) : NodeModel<TGraph, TN>[]
  public find<TN extends NodeType<TGraph>>(queries: Query<TGraph, TN>[]) : NodeModel<TGraph, TN>[]
  public find<TN extends NodeType<TGraph>>(input: ID | ID[] | Query<TGraph, TN> | Query<TGraph, TN>[]) : NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[] {
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


  private findByQuery<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>) : NodeModel<TGraph, TN>[] {
    const { type, ...nodeQuery } = query;
    return this
      .findByType<TN>(type)
      // @ts-ignore
      .filter(node => this.matchesNodeQuery(node, nodeQuery))
      .map(node => this.getModel<TN>(node));
  }


  private findByType<TN extends NodeType<TGraph>>(type: TN['type']) : TN[] {
    const result: TN[] = [];
    for (const [id, node] of this.nodes)
      if (node.type === type)
        result.push(node as TN);
    
    return result;
  }

  private matchesNodeQuery(node: NodeType<TGraph>, nodeQuery: NodeQuery<TGraph>) : boolean {
    const valueQueryFields = this.valueQueryFields(node, nodeQuery);
    const relationQueryFields = this.relationQueryFields(node, nodeQuery);

    return this.matchesValueFields(node, valueQueryFields) && this.matchesRelationFields(node, relationQueryFields);
  }

  private relationsForType<TN extends NodeType<TGraph>>(type: TN['type']) : RelationsForType<TGraph, TN> {
    return this.relations[type] ?? {};
  }

  private valueQueryFields(node: NodeType<TGraph>, nodeQuery: NodeQuery<TGraph>) : ValueQueryFields<NodeType<TGraph>> {
    return Object.fromEntries(
      Object.entries(nodeQuery).filter(([key]) => !(key in this.relationsForType(node.type)))
    ) as ValueQueryFields<NodeType<TGraph>>;
  }

  private relationQueryFields(node: NodeType<TGraph>, nodeQuery: NodeQuery<TGraph>) : RelationQueryFields<TGraph, NodeType<TGraph>> {
    return Object.fromEntries(
      Object.entries(nodeQuery).filter(([key]) => key in this.relationsForType(node.type))
    ) as RelationQueryFields<TGraph, NodeType<TGraph>>;
  }

  private matchesValueFields(node: NodeType<TGraph>, nodeQuery: ValueQueryFields<NodeType<TGraph>>) : boolean {
    return Object.entries(nodeQuery).reduce(
      (result, [key, valueQueryField]) => result && this.matchesValueQueryField(node, key as keyof NodeType<TGraph>, valueQueryField),
      true as boolean
    );
  }

  private matchesValueQueryField(node: NodeType<TGraph>, key: keyof NodeType<TGraph>, field: ValueQueryField<any>) : boolean {
    const value = node[key];

    if (Array.isArray(field) && (field[0] === null || typeof field[0] !== 'object'))
      return field.includes(value);

    if (typeof field === 'object' && field !== null)
      return this.matchesOperator(value, field);

    return value === field;
  }

  private matchesRelationFields(node: NodeType<TGraph>, fields: RelationQueryFields<TGraph, NodeType<TGraph>>) : boolean {
    return Object.entries(fields).reduce(
      (result, [key, relationQueryField]) => result && this.matchesRelationQueryField(node, key, relationQueryField!),
      true as boolean
    );
  }

  private matchesRelationQueryField(node: NodeType<TGraph>, key: string, field: RelationQueryField<TGraph, NodeType<TGraph>>) : boolean {
    const relatedNodes = this.getRelatedNodes(node, key);

    if (Array.isArray(field))
      return relatedNodes.some(relNode => field.some(nodeQuery => this.matchesNodeQuery(relNode, nodeQuery)));

    return this.matchesOperator(relatedNodes, field);
  }


  // Get all related nodes of the given type and direction
  public getRelatedNodes(from: ID | NodeType<TGraph>, key: string) : NodeType<TGraph>[] {
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




  
  // Update nodes and edges
  public update<TN extends NodeType<TGraph>>(id: ID, updates: UpdateInput<TGraph, TN>) : NodeModel<TGraph, TN>
  public update<TN extends NodeType<TGraph>>(ids: ID[], updates: UpdateInput<TGraph, TN>) : NodeModel<TGraph, TN>[]
  public update<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>, updates: UpdateInput<TGraph, TN>) : NodeModel<TGraph, TN>[]
  public update<TN extends NodeType<TGraph>>(queries: Query<TGraph, TN>[], updates: UpdateInput<TGraph, TN>) : NodeModel<TGraph, TN>[]
  
  public update<TN extends NodeType<TGraph>>(input: ID | ID[] | Query<TGraph, TN> | Query<TGraph, TN>[]) : NodeModel<TGraph, TN> | NodeModel<TGraph, TN>[] {
    throw new NotImplementedError();
  }


  // Create and return a new ID
  private getNextId() : ID {
    this.idCount = this.idCount + 1;
    return '' + this.idCount;
  }


  // Apply an operator to a value
  private matchesOperator(value: any, operator: ValueQueryOperator<any>) : boolean {
    const [op, rvalue] = Object.entries(operator)[0] as [keyof ValueQueryOperator<any>, any];
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


  // Utility for getting the direction (to/from) and the related type
  private parseRelation(relation: Relation<TGraph>) {
    const direction = 'from' in relation ? 'from' : 'to';
    const relatedType = relation[direction as keyof typeof relation] as NodeType<TGraph>['type'];
    const edgeType = relation.type as EdgeType<TGraph>['type'];
    return { direction, relatedType, edgeType };
  }

  // Check if a relation exists
  private relationExists(type: string, key: string) {
    // @ts-ignore
    return key in (this.relations[type] ?? {});
  }

  // Returns the relation for a given type and key
  private getRelation(type: string, key: string) {
    // @ts-ignore
    return this.relations[type]?.[key] as Relation<TNode>
  }


  // Proxy a node, and give it the properties expected by the relations
  // for it's type
  public getModel<TN extends NodeType<TGraph> = NodeType<TGraph>>(from: ID | TN) : NodeModel<TGraph, TN> {
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