import type { ID, Entity, EntityQuery, ValueQueryOperator } from "@/common";
import { ValidationError } from "@/common/common-errors";


export function isId(value: any) : value is ID {
  return typeof value === 'string';
}

export function isIdList(value: any) : value is ID[] {
  return Array.isArray(value) && (typeof value[0] === 'string' || value.length === 0);
}

export function isEntityQuery(value: any) : value is EntityQuery<any> {
  return (Array.isArray(value) && typeof value[0] === 'object' && value[0] !== null)
    || (typeof value === 'object' && !Array.isArray(value) && value !== null);
}


// Match an Entity against an EntityQuery
export function matchEntity<TEntity extends Entity>(entity: TEntity, query: EntityQuery<TEntity>) : boolean {
  if (Array.isArray(query)) {
    const results = query.map(subquery => matchEntity(entity, subquery));
    return results.some(Boolean);
  }

  return Object.entries(query).reduce<boolean>(
    (result, [key, queryField]) => result && matchQueryField(queryField, entity[key as keyof TEntity]),
    true
  );
}


// Match a value against a query directive (a value, an array of values, or a QueryOperator)
function matchQueryField<T>(queryField: T | T[] | ValueQueryOperator<T>, value: T) : boolean {
  if (Array.isArray(queryField)) {
    return queryField.some(x => x === value);
  }
  
  else if (typeof queryField !== 'object' || queryField === null) {
    return value === queryField; 
  }

  else if (typeof queryField === 'object') {
    const [opKey, opDir] = Object.entries(queryField as ValueQueryOperator<T>)[0];
    switch (opKey as keyof ValueQueryOperator<T>) {
      case 'not':
        return value !== opDir;
    }
  }

  throw new ValidationError(`Invalid query field: ${queryField}`, ['0'], ['primitive', 'array', 'QueryOperator'], queryField);
}


// A version of Object.entries() with better type support
export type Entry<T extends {}, K extends keyof T = keyof T> =
  K extends keyof T ? [K, T[K]] : never;

export type Entries<T extends {}> = Entry<T>[];

export function objectEntries<T extends {}>(obj: T) : Entries<T> {
  return Object.entries(obj) as unknown as Entries<T>;
}
