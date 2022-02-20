import { InMemoryGraphRepository } from "@/graph/in-memory-graph";
import { CreateInput, GraphRepository, CreateNodeInput } from "..";
import { Author, Document, TestEdge, testGraph, TestRelations, testGraphRelations, TestNode, User, TestGraph } from './test-graph-data';


describe('test constructor', () => {
  it('should create without erroring', () => {
    expect(() => { new InMemoryGraphRepository(); }).not.toThrow();
  });

  it('should create from data without erroring', () => {
    expect(() => {
      new InMemoryGraphRepository(testGraph)
    }).not.toThrow();
  });
});


describe('test create()', () => {
  let repo: InMemoryGraphRepository<TestGraph>;

  beforeEach(() => {
    repo = new InMemoryGraphRepository(testGraph);
  });

  it('should create a node from simple input', () => {
    const output = repo.create<User>({
      type: 'user',
      username: 'steve',
    });

    expect(output.id).toBeTruthy();
    expect(output.username).toBe('steve');
    expect(output.authors.length).toBe(0);
  });

  it('should create multiple nodes from an array of simple inputs', () => {
    const inputs: CreateInput<TestGraph, User>[] = [
      { type: 'user', username: 'steve' },
      { type: 'user', username: 'bob' },
    ];

    const outputs = repo.create<User>(inputs);

    outputs.forEach((node, idx) => {
      expect(node.id).toBeTruthy();
      expect(node).toMatchObject(inputs[idx]);
    });
  });

  it('should create two nodes and an edge between them', () => {
    const output = repo.create<User>({
      type: 'user',
      username: 'usersteve',
      authors: {
        name: 'Steve O'
      }
    });

    expect(output.id).toBeTruthy();
    expect(output.username).toBe('usersteve');
    expect(output.authors.length).toBe(1);
    expect(output.authors[0].name).toBe('Steve O');
    expect(output.authors[0].users[0].id).toBe(output.id);
  });

  it('should create three nodes and two edges', () => {
    const input: CreateInput<TestGraph, User> = {
      type: 'user',
      username: 'usteve',
      authors: [
        { name: 'Stevo' },
        { name: 'Steven' }
      ]
    };

    const output = repo.create(input);

    expect(output).toMatchObject(input);
  });

  it('should create three nodes and two edges (depth)', () => {
    const input: CreateInput<TestGraph, User> = {
      type: 'user',
      username: 'usteve',
      authors: {
        name: 'Steven',
        documents: {
          title: 'Welcome Steven',
          pages: 5
        }
      }
    };

    const output = repo.create<User>(input);
    expect(output.authors[0].documents[0].title).toBe('Welcome Steven');

    const document = output.authors[0].documents[0];
    expect(document.authors[0].users[0].username).toBe('usteve');
  });

  it('should create multiple nodes and edges from an array of complex inputs', () => {
    const output = repo.create<Author>([
      {
        type: 'author',
        name: 'Steve',
        documents: [
          { title: 'Way to go steve', pages: 1 }
        ]
      },
      {
        type: 'author',
        name: 'Bob',
        documents: [
          { title: 'Way to go bob', pages: 1 }
        ]
      }
    ]);
  });

  it('should create nodes and edges from complex input', () => {
    const output = repo.create<Document>([
      {
        type: 'document',
        title: 'One',
        pages: 1,
        authors: {
          name: 'Steve'
        }
      },
      {
        type: 'document',
        title: 'Two',
        pages: 2,
        authors: {
          name: 'Bob'
        }
      }
    ])
  })
});


describe('testing find()', () => {
  let repo: GraphRepository<TestGraph>;

  beforeEach(() => {
    repo = new InMemoryGraphRepository(testGraph);
  });

  it('should return a single node matching the given ID', () => {
    const output = repo.find<Document>('doc1');

    expect(output.id).toBe('doc1');
    expect(output.title).toBe('Document 1');
  });

  it('should return multiple nodes from a list of IDs', () => {
    const output = repo.find<Document>(['doc1', 'doc2']);

    expect(output.length).toEqual(2);
    expect(output[0].title).toBe('Document 1');
    expect(output[1].title).toBe('Document 2');
  });

  it('should return a single node matching the query', () => {
    const output = repo.find<Author>({
      type: 'author',
      id: 'author1'
    });

    expect(output.length).toBe(1);
    expect(output[0].name).toBe('Author 1');
  });

  it('should all nodes with matching type', () => {
    const output = repo.find<Author>({
      type: 'author',
    });

    expect(output.length).toBe(3);
  });

  it('should return all authors for a document with a given ID', () => {
    const output = repo.find<Author>({
      type: 'author',
      documents: [{
        id: 'doc1'
      }]
    });

    expect(output.length).toBe(1);
    expect(output[0].id).toBe('author1');
  });

  it('should return all documents for a given author', () => {
    const output = repo.find<Document>({
      type: 'document',
      authors: [{
        id: 'author1'
      }]
    });

    expect(output.length).toEqual(1);
    expect(output[0].title).toEqual('Document 1');
  });

  it('should return all documents from all authors for a given user', () => {
    const output = repo.find<Document>({
      type: 'document',
      authors: [{
        users: [{
          id: 'user1'
        }]
      }]
    });

    expect(output.length).toEqual(2);
    output.forEach(model => expect(model.authors[0].users[0].id).toEqual('user1'));
  });

  it('should return all documents for a given user and all public documents', () => {
    const output = repo.find<Document>([
      {
        type: 'document',
        authors: [{
          users: [{
            id: 'user1'
          }]
        }],
      },
      {
        type: 'document',
        isPublic: true
      }
    ]);

    expect(output.length).toBe(3);
  });

  it('should return all authors who are co-author with a given ID', () => {
    const output = repo.find<Author>({
      type: 'author',
      documents: [{ 
        authors: [{ 
          id: 'author2'
        }]
      }]
    });

    expect(output.length).toBe(2);
  });

  it('should return all authors with no documents', () => {
    const output = repo.find<Author>({
      type: 'author',
      documents: {
        length: 0
      }
    });

    expect(output.length).toBe(1);
    expect(output[0].id).toBe('author4');
  });

  it('should return all authors with more than 1 documents', () => {
    const output = repo.find<Author>({
      type: 'author',
      documents: {
        length: { gt: 1 }
      }
    });

    expect(output.length).toBe(1);
    expect(output[0].id).toBe('author3');
  });
});


// describe('test update()', () => {
//   const repo = {} as GraphRepository<TestNode, TestEdge, TestGraphRelations>;

//   it('should update a single node', () => {
//     const output = repo.update<Document>('doc1', {
//       title: 'a new title',
//     });
//   });

//   it('should update multiple nodes', () => {
//     const output = repo.update<Document>(['doc1', 'doc2'], {
//       title: 'new title'
//     });
//   });

//   it('should update all nodes matching the query', () => {
//     const output = repo.update<Document>({
//       type: 'document',
//       authors: [
//         { id: 'steve' }
//       ]
//     }, {
//       title: 'Steve doc',
//       authors: {
//         add: { name: 'bob' }
//       }
//     })
//   });

//   it('should create an edge between two existing nodes', () => {
//     const output = repo.update<Author>('steve', {
//       documents: {
//         add: { id: 'doc1' }
//       }
//     })
//   })
// })