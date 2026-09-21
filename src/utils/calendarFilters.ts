/** Date inputs and shared links may contain incomplete or invalid dates. */
export function calendarDayBoundary(
  value: string,
  endOfDay = false,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return undefined;
  return date.toISOString();
}

export function calendarRangeError(
  from: string,
  to: string,
): string | undefined {
  if ((from && !calendarDayBoundary(from)) || (to && !calendarDayBoundary(to)))
    return 'Укажите корректные даты.';
  if (from && to && from > to)
    return 'Дата окончания должна быть не раньше даты начала.';
  return undefined;
}
