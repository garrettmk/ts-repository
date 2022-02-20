import { ID } from "@/common";
import { Node, Edge, Graph } from "@/graph";


export interface User extends Node {
  type: 'user',
  username: string,
}

export interface Author extends Node {
  type: 'author',
  name: string,
}

export interface Document extends Node {
  type: 'document',
  title: string,
  pages: number,
  isPublic?: boolean
}

export interface Content extends Node {
  type: 'content',
  mimeType: string,
  data: any
}

export interface Is extends Edge {
  type: 'is'
}

export interface Owns extends Edge {
  type: 'owns'
}

export interface Uses extends Edge {
  type: 'uses'
}

export interface UsedBy extends Edge {
  type: 'usedBy'
}

export const testGraphRelations = {
  user: {
    authors: { to: 'author', type: 'is' }
  } as const,
  author: {
    users: { from: 'user', type: 'is' },
    documents: { to: 'document', type: 'owns' },
  } as const ,
  document: {
    authors: { from: 'author', type: 'owns' },
    contents: { to: 'content', type: 'uses' }
  } as const,
  content: {
    documents: { from: 'document', type: 'uses' },
  } as const
} as const;


export type TestNode = User | Author | Document | Content;
export type TestEdge = Is | Owns | Uses | UsedBy;
export type TestRelations = typeof testGraphRelations;

export type TestGraph = Graph<TestNode, TestEdge, TestRelations>;

export const testGraph: TestGraph = {
  nodes: [
    {
      id: 'user1',
      type: 'user',
      username: 'testuser'
    },
    {
      id: 'author1',
      type: 'author',
      name: 'Author 1'
    },
    {
      id: 'author2',
      type: 'author',
      name: 'Author 2',
    },
    {
      id: 'author3',
      type: 'author',
      name: 'System Author'
    },
    {
      id: 'author4',
      type: 'author',
      name: 'Writes nothing'
    },
    {
      id: 'doc1',
      type: 'document',
      title: 'Document 1',
      pages: 1
    },
    {
      id: 'doc2',
      type: 'document',
      title: 'Document 2',
      pages: 2,
      isPublic: true,
    },
    {
      id: 'doc3',
      type: 'document',
      title: 'Document 3',
      pages: 3
    },
  ],

  edges: [
    {
      from: 'user1',
      type: 'is',
      to: 'author1'
    },
    {
      from: 'user1',
      type: 'is',
      to: 'author3'
    },
    {
      from: 'author1',
      type: 'owns',
      to: 'doc1'
    },
    {
      from: 'author2',
      type: 'owns',
      to: 'doc2',
    },
    {
      from: 'author3',
      type: 'owns',
      to: 'doc2'
    },
    {
      from: 'author3',
      type: 'owns',
      to: 'doc3'
    }
  ],

  relations: testGraphRelations
}