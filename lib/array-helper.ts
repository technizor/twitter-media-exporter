//#region Public Types
export type FilterFunc<T> = (item: T) => boolean;
export type CompFunc<T> = (a: T, b: T) => number;
//#endregion Public Types

//#region Public Functions
export function bsearch<T>(list: Array<T>, item: T, comp: CompFunc<T>): number {
  let start = 0;
  let end = list.length;

  while (start <= end) {
    let mid = Math.floor((start + end) / 2);
    let res = comp(item, list[mid]);
    if (res == 0) return mid;
    if (res < 0) {
      start = mid + 1;
    }
    else {
      end = mid - 1;
    }
  }
  return -start - 1;
}

export function descendingOrder(a: number, b: number): number {
  return a - b;
}
////#endregion Public Functions