// PostgREST filters cannot cast numeric columns. Text search remains partial;
// a complete vendor ID accepts both its displayed zero padding and raw number.
export function supplierSearchFilter(query: string) {
  const value = JSON.stringify(`%${query}%`);
  const filters = ["name", "phone", "address"].map(column => `${column}.ilike.${value}`);
  const number = Number(query);
  if (/^\d+$/.test(query) && Number.isInteger(number) && number > 0 && number <= 99_999_999) {
    filters.push(`vendor_number.eq.${number}`);
  }
  return filters.join(",");
}
