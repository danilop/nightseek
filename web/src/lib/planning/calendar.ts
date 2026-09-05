/** RFC 5545 escaping, UTC dates and UTF-8 line folding keep the exported window
 * unambiguous across midnight, DST and calendar applications. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}
function utc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}
function fold(line: string): string {
  const encoder = new TextEncoder();
  let output = '';
  let length = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (length + size > 75) {
      output += '\r\n ';
      length = 1;
    }
    output += char;
    length += size;
  }
  return output;
}
export function createSessionCalendar(
  input: {
    name: string;
    start: Date;
    end: Date;
    location: string;
    description: string;
  },
  createdAt = new Date()
): string {
  if (
    !Number.isFinite(input.start.getTime()) ||
    !Number.isFinite(input.end.getTime()) ||
    input.end <= input.start
  ) {
    throw new RangeError('Calendar event requires a valid, positive observing interval');
  }
  const id = `${utc(input.start)}-${encodeURIComponent(input.name)}@nightseek`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NightSeek//Observing plan//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${id}`,
    `DTSTAMP:${utc(createdAt)}`,
    `DTSTART:${utc(input.start)}`,
    `DTEND:${utc(input.end)}`,
    `SUMMARY:${escapeText(`Image ${input.name}`)}`,
    `LOCATION:${escapeText(input.location)}`,
    `DESCRIPTION:${escapeText(input.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .map(fold)
    .concat('')
    .join('\r\n');
}

export function downloadSessionCalendar(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nightseek-observing-plan.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
