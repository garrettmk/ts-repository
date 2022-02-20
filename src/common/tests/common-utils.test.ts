import { isId, isIdList, isEntityQuery } from "@/common";


describe('test the isId() utility', () => {
  it.each(['abcd123', ''])('should return true for a valid ID', id => {
    expect(isId(id)).toBe(true);
  });

  it.each([123, null, undefined, {}, [], true, false])('should return false for an invalid ID', value => {
    expect(isId(value)).toBe(false);
  })
});


describe('test the isIdList() utility', () => {
  it.each([
    ['123', '1235'],
    []
  ])('should return true for a valid ID list', (...value) => {
    expect(isIdList(value)).toBe(true);
  });

  it.each([123, null, 'astring', true, false, {}])('should return false for an invalid ID list', value => {
    expect(isIdList(value)).toBe(false);
  })
});


