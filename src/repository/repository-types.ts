import { Entity, ID, EntityQuery } from '@/common';


export interface Repository<
  TEntity extends Entity, 
  TCreateInput = Entity,
  TUpdateInput = Partial<Omit<TEntity, 'id'>>, 
  TFindInput = EntityQuery<TEntity>
> {
  create(input: TCreateInput) : Promise<TEntity>
  find(id: ID) : Promise<TEntity>
  find(ids: ID[]) : Promise<TEntity[]>
  find(input: TFindInput) : Promise<TEntity[]>
  update(id: ID, input: TUpdateInput) : Promise<TEntity>
  update(ids: ID[], input: TUpdateInput) : Promise<TEntity[]>
  update(entities: TFindInput, input: TUpdateInput) : Promise<TEntity[]>
  delete(id: ID) : Promise<TEntity>
  delete(ids: ID[]) : Promise<TEntity[]>
  delete(input: TFindInput) : Promise<TEntity[]>
}