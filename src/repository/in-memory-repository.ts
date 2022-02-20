import { Entity, ID, isEntityQuery, isId, isIdList, matchEntity, NotFoundError, ValidationError } from '@/common';
import { Repository } from '@/repository/repository-types';


export type CreateEntityFn<TEntity, TCreateInput> = (id: ID, input: TCreateInput) => TEntity;
export type UpdateEntityFn<TEntity, TUpdateInput> = (entity: TEntity, updates: TUpdateInput) => TEntity;
export type MatchEntityFn<TEntity, TFindInput> = (entity: TEntity, query: TFindInput) => boolean;

export type InMemoryRepositoryOptions<TEntity, TCreateInput, TUpdateInput, TFindInput> = {
  create: CreateEntityFn<TEntity, TCreateInput>,
  update: UpdateEntityFn<TEntity, TUpdateInput>,
  match?: MatchEntityFn<TEntity, TFindInput>,
}

//
// A generic in-memory repository
//
export class InMemoryRepository<TEntity extends Entity, TCreateInput, TUpdateInput, TFindInput> implements Repository<TEntity, TCreateInput, TUpdateInput, TFindInput> {
  private entities: Record<ID, TEntity> = {};
  private createEntity: CreateEntityFn<TEntity, TCreateInput>;
  private updateEntity: UpdateEntityFn<TEntity, TUpdateInput>;
  private matchEntity: MatchEntityFn<TEntity, TFindInput>;

  // Create a repository
  constructor ({ create, update, match }: InMemoryRepositoryOptions<TEntity, TCreateInput, TUpdateInput, TFindInput>) {
    this.createEntity = create;
    this.updateEntity = update;
    this.matchEntity = match ?? matchEntity;
  }

  // Create and return a new entity with the given input
  public async create(input: TCreateInput) : Promise<TEntity> {
    const id = this.getNewId();
    const entity: TEntity = this.createEntity(id, input);

    this.entities[id] = entity;

    return entity;
  }


  // Return a single entity or throw
  public async find(id: ID) : Promise<TEntity>

  // Return multiple entities or throw
  public async find(ids: ID[]) : Promise<TEntity[]>

  // Return a list of entities matching a query
  public async find(input: TFindInput) : Promise<TEntity[]>

  // Branch to the right implementation based on arguments
  public async find(selector: ID | ID[] | TFindInput) : Promise<TEntity | TEntity[]> {
    if (isId(selector))
      return this.findById(selector);

    else if (isIdList(selector))
      return this.findByIdList(selector);

    else if (isEntityQuery(selector))
      return this.findByQuery(selector);

    throw new ValidationError('Invalid input', ['selector'], ['string', 'array', 'object'], selector);
  }
  
  // Implementation: find a single entity or throw
  private async findById(id: ID) : Promise<TEntity> {
    const entity = this.entities[id];
    if (!entity)
      throw new NotFoundError(`No entity with ID: ${id}`);
    
    return entity;
  }

  // Implementation: find a list of IDs or throw
  private async findByIdList(ids: ID[]) : Promise<TEntity[]> {
    return Promise.all(ids.map(id => this.findById(id)));
  }

  // Implementation: return a list of entities matching a query
  private async findByQuery(query: TFindInput) : Promise<TEntity[]> {
    return Object.values(this.entities).filter(entity => this.matchEntity(entity, query));
  }


  // Update a single entity or throw
  public async update(id: ID, input: TUpdateInput) : Promise<TEntity>

  // Update a list of entities or throw
  public async update(ids: ID[], input: TUpdateInput) : Promise<TEntity[]>

  // Update entities matching a query
  public async update(query: TFindInput, input: TUpdateInput) : Promise<TEntity[]>

  // Branch to the right implementation for the given arguments
  public async update(selector: ID | ID[] | TFindInput, input: TUpdateInput) : Promise<TEntity | TEntity[]> {
    if (isId(selector))
      return this.updateById(selector, input);

    else if (isIdList(selector))
      return this.updateByIdList(selector, input);

    else if (isEntityQuery(selector))
      return this.updateByQuery(selector, input);

    throw new ValidationError('Invalid input', ['selector'], ['string', 'array', 'object'], typeof selector);
  }

  
  // Implementation: update a single entity or throw
  private async updateById(id: ID, input: TUpdateInput) : Promise<TEntity> {
    const current = await this.findById(id);
    const updated = this.updateEntity(current, input);
    this.entities[id] = updated;
    return updated;
  }

  // Implementation: update a list of entities or throw
  private async updateByIdList(ids: ID[], input: TUpdateInput) : Promise<TEntity[]> {
    return Promise.all(ids.map(id => this.updateById(id, input)));
  }

  // Implementation: update a list of entities matching a query
  private async updateByQuery(query: TFindInput, input: TUpdateInput) : Promise<TEntity[]> {
    return Promise.all(
      Object.values(this.entities)
        .filter(entity => this.matchEntity(entity, query))
        .map(entity => this.updateById(entity.id, input))
    );
  }

  // Delete a single entity or throw
  public async delete(id: ID) : Promise<TEntity>

  // Delete a list of entites or throw
  public async delete(ids: ID[]) : Promise<TEntity[]>

  // Delete a list of entites matching a query
  public async delete(query: TFindInput) : Promise<TEntity[]>

  // Branch to the right implementation for the given arguments
  public async delete(selector: ID | ID[] | TFindInput) : Promise<TEntity | TEntity[]> {
    if (isId(selector))
      return this.deleteById(selector);

    else if (isIdList(selector))
      return this.deleteByIdList(selector);

    else if (isEntityQuery(selector))
      return this.deleteByQuery(selector);

    throw new ValidationError('Invalid input', ['selector'], ['string', 'array', 'object'], typeof selector);
  }

  // Implementation: delete a single entity or throw
  private async deleteById(id: ID) : Promise<TEntity> {
    const current = this.entities[id];
    if (!current)
      throw new NotFoundError(`Entity with ID: ${id}`);

    delete this.entities[id];
    return current;
  }

  // Implementation: delete a list of entities or throw
  private async deleteByIdList(ids: ID[]) : Promise<TEntity[]> {
    return Promise.all(ids.map(id => this.deleteById(id)));
  }

  // Implementation: delete a list of entites matching a query
  private async deleteByQuery(query: TFindInput) : Promise<TEntity[]> {
    return Promise.all(
      Object.values(this.entities)
        .filter(entity => this.matchEntity(entity, query))
        .map(entity => this.deleteById(entity.id))
    );
  }

  // Return a new ID
  private getNewId() : ID {
    return (new Date()).getTime() + '';
  }
}