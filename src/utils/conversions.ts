/**
 * Converts a quantity from the selected sale unit to the product's base unit.
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  piecesPerBox: number = 1
): number {
  const f = fromUnit.toLowerCase();
  const t = toUnit.toLowerCase();

  if (f === t) return quantity;

  // Mass: kg <-> g
  if (f === 'g' && t === 'kg') return quantity / 1000;
  if (f === 'kg' && t === 'g') return quantity * 1000;

  // Volume: liter <-> ml
  if (f === 'ml' && t === 'liter') return quantity / 1000;
  if (f === 'liter' && t === 'ml') return quantity * 1000;

  // Count: dozen <-> piece / number
  if ((f === 'piece' || f === 'number' || f === 'pcs') && t === 'dozen') {
    return quantity / 12;
  }
  if (f === 'dozen' && (t === 'piece' || t === 'number' || t === 'pcs')) {
    return quantity * 12;
  }

  // Packaging: box <-> piece / number
  if ((f === 'piece' || f === 'number' || f === 'pcs') && t === 'box') {
    return quantity / Math.max(1, piecesPerBox);
  }
  if (f === 'box' && (t === 'piece' || t === 'number' || t === 'pcs')) {
    return quantity * Math.max(1, piecesPerBox);
  }

  return quantity; // Fallback
}

/**
 * Gets conversion factor to show equivalent price.
 * For example: if base unit is kg and price is $100, selling in grams should convert.
 */
export function getConversionMultiplier(
  fromUnit: string,
  toUnit: string,
  piecesPerBox: number = 1
): number {
  return convertQuantity(1, fromUnit, toUnit, piecesPerBox);
}
export default convertQuantity;
