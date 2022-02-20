import { 
  ID, 
  Entity, 
  DiscriminateUnion,
  ValueQueryField,
  ValueQueryOperator,
  MaybeArray,
  OneKey,
  ArrayOperator
} from '@/common';

// A graph is a collection of nodes, a collection of edges, and an object
// that describes the relationships between the types
export type Graph<TNode extends Node = Node, TEdge extends Edge = Edge, TRelations extends _Relations<TNode, TEdge> = _Relations<TNode, TEdge>> = {
  nodes: TNode[],
  edges: TEdge[],
  relations: TRelations
}

// Basic node
export interface Node extends Entity {
  id: ID,
  type: string
}

// Basic edge
export interface Edge {
  from: ID,
  to: ID,
  type: string
}

export type _Relations<TNode extends Node, TEdge extends Edge> = {
  [NodeTypeKey in TNode['type']]: {
    [RelationKey: string]: Relation<Graph<TNode, TEdge>>
  }
}

export type Relations<TGraph extends Graph> = {
  [NodeTypeKey in NodeType<TGraph>['type']]: {
    [RelationProp: string]: Relation<TGraph>
  }
}

export type Relation<TGraph extends Graph = Graph> = 
  | FromRelation<TGraph> 
  | ToRelation<TGraph>;

// A relation can be from another node type...
export type FromRelation<TGraph extends Graph = Graph> = {
  from: NodeType<TGraph>['type'],
  type?: EdgeType<TGraph>['type']
}

// ...or to another node type
export type ToRelation<TGraph extends Graph = Graph> = {
  to: NodeType<TGraph>['type'],
  type?: EdgeType<TGraph>['type']
}

export type NodeRef = OneKey<'id', ID>;

export type NodeType<TGraph extends Graph> = TGraph['nodes'][0];
export type EdgeType<TGraph extends Graph> = TGraph['edges'][0];
export type RelationsType<TGraph extends Graph> = TGraph['relations'];

export type SpecificNodeType<TGraph extends Graph, TypeKey extends string> = DiscriminateUnion<NodeType<TGraph>, 'type', TypeKey>;
export type SpecificEdgeType<TGraph extends Graph, TypeKey extends string> = DiscriminateUnion<EdgeType<TGraph>, 'type', TypeKey>;
export type RelationsForType<TGraph extends Graph, TN extends NodeType<TGraph>> = RelationsType<TGraph>[TN['type']];
export type SpecificRelation<TGraph extends Graph, TN extends NodeType<TGraph>, PropKey extends keyof RelationsForType<TGraph, TN>> = RelationsForType<TGraph, TN>[PropKey];

export type RelatedTypeKey<R> =
  R extends FromRelation ? R['from'] :
  R extends ToRelation ? R['to'] :
  never;

export type RelatedType<TGraph extends Graph, TN extends NodeType<TGraph>, key extends keyof RelationsForType<TGraph, TN>> = 
  SpecificNodeType<TGraph, RelatedTypeKey<SpecificRelation<TGraph, TN, key>>>;



export type Query<TGraph extends Graph, TN extends NodeType<TGraph> = NodeType<TGraph>> =
  TN extends NodeType<TGraph> 
    ? Pick<TN, 'type'> & NodeQuery<TGraph, TN> 
    : never;

export type NodeQuery<TGraph extends Graph, TN extends NodeType<TGraph> = NodeType<TGraph>> =
  & ValueQueryFields<TN>
  & RelationQueryFields<TGraph, TN>;

export type ValueQueryFields<TN extends Node> = {
  [key in keyof TN as key extends 'type' ? never : key]?: ValueQueryField<TN[key]>
}

export type RelationQueryFields<TGraph extends Graph, TN extends NodeType<TGraph>> = {
  [key in keyof RelationsForType<TGraph, TN>]?: RelationQueryField<TGraph, TN, key>
}

export type RelationQueryField<TGraph extends Graph, TN extends NodeType<TGraph> = NodeType<TGraph>, key extends keyof RelationsForType<TGraph, TN> = keyof RelationsForType<TGraph, TN>> =
  | ArrayOperator<never>
  | NodeQuery<TGraph, RelatedType<TGraph, TN, key>>[];


  




export type CreateInput<TGraph extends Graph, TN extends NodeType<TGraph> = NodeType<TGraph>> =
  TN extends NodeType<TGraph> 
    ? Pick<TN, 'type'> & CreateNodeInput<TGraph, TN> 
    : never;

export type CreateNodeInput<TGraph extends Graph, TN extends NodeType<TGraph>> =
  & CreateValueFields<TN>
  & CreateRelationFields<TGraph, TN>;

export type CreateValueFields<TN extends Node> = Omit<TN, 'id' | 'type'>;

export type CreateRelationFields<TGraph extends Graph, TN extends NodeType<TGraph>> = {
  [key in keyof RelationsForType<TGraph, TN>]?: CreateRelationField<TGraph, TN, key>
}

export type CreateRelationField<TGraph extends Graph, TN extends NodeType<TGraph>, key extends keyof RelationsForType<TGraph, TN>> =
  MaybeArray<CreateRelatedNodeInput<TGraph, TN, key> | NodeRef>;

export type CreateRelatedNodeInput<TGraph extends Graph, TN extends NodeType<TGraph>, key extends keyof RelationsForType<TGraph, TN>> =
  CreateNodeInput<TGraph, RelatedType<TGraph, TN, key>>;




export type UpdateInput<TGraph extends Graph, TN extends NodeType<TGraph> = NodeType<TGraph>> =
  TN extends NodeType<TGraph> ? UpdateNodeInput<TGraph, TN> : never;

export type UpdateNodeInput<TGraph extends Graph, TN extends NodeType<TGraph> = NodeType<TGraph>> =
  & Pick<TN, 'type'>
  & UpdateValueFields<TN>
  & UpdateRelationFields<TGraph, TN>;

export type UpdateValueFields<TN extends Node> = Omit<TN, 'id' | 'type'>;

export type UpdateRelationFields<TGraph extends Graph, TN extends NodeType<TGraph>> = {
  [key in keyof RelationsForType<TGraph, TN>]?: UpdateRelationField<TGraph, TN, key>
}

export type UpdateRelationField<TGraph extends Graph, TN extends NodeType<TGraph>, key extends keyof RelationsForType<TGraph, TN>> = {
  add?: MaybeArray<Omit<NodeQuery<TGraph, RelatedType<TGraph, TN, key>>, 'type'>>,
  remove?: MaybeArray<Omit<NodeQuery<TGraph, RelatedType<TGraph, TN, key>>, 'type'>>
}




export type NodeModel<TGraph extends Graph, TN extends NodeType<TGraph> = NodeType<TGraph>> =
  & { [key in keyof TN]: TN[key] }
  & { [key in keyof RelationsForType<TGraph, TN>]: NodeModel<TGraph, RelatedType<TGraph, TN, key>>[] };

// A graph repository
export interface GraphRepository<TGraph extends Graph> {
  create<TN extends NodeType<TGraph>>(input: CreateInput<TGraph, TN>) : NodeModel<TGraph, TN>
  create<TN extends NodeType<TGraph>>(inputs: CreateInput<TGraph, TN>[]) : NodeModel<TGraph, TN>[]

  find<TN extends NodeType<TGraph>>(id: ID) : NodeModel<TGraph, TN>
  find<TN extends NodeType<TGraph>>(ids: ID[]) : NodeModel<TGraph, TN>[]
  find<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>) : NodeModel<TGraph, TN>[]
  find<TN extends NodeType<TGraph>>(queries: Query<TGraph, TN>[]) : NodeModel<TGraph, TN>[]
  
  update<TN extends NodeType<TGraph>>(id: ID, updates: UpdateInput<TGraph, TN>) : NodeModel<TGraph, TN>
  update<TN extends NodeType<TGraph>>(ids: ID[], updates: UpdateInput<TGraph, TN>) : NodeModel<TGraph, TN>[]
  update<TN extends NodeType<TGraph>>(query: Query<TGraph, TN>, updates: UpdateInput<TGraph, TN>) : NodeModel<TGraph, TN>[]
}
