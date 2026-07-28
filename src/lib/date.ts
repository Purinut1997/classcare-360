const bangkokDateFormatter = new Intl.DateTimeFormat('en-CA', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
});

/** Returns a calendar date for records that follow the school's Bangkok timezone. */
export function getBangkokDate(date = new Date()) {
  const parts = bangkokDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}
