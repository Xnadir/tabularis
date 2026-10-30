import type {QueryHistoryEntry} from '@/types/queryHistory';
import {resolveZone} from './dateGroups';

/**
 * `2026-10-27 09:14:02` for an ISO timestamp, in the display timezone (OS local for
 * "auto" or an unrecognised name, like the sidebar). Unparseable input is returned as is.
 */
export function formatHistoryTimestamp(isoDate: string, timeZone?: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    };
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat('en-CA', {
            ...options,
            timeZone: resolveZone(timeZone),
        }).formatToParts(date);
    } catch {
        parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
    }
    const get = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

// Every line of free text goes behind `--`, so a multi-line error can't break the file.
const commentLines = (text: string): string[] =>
    text.split(/\r\n|\r|\n/).map((line) => `-- ${line}`.trimEnd());

/**
 * The statement ending with `;`. When its last line ends in a `--` comment, the `;`
 * goes on a line of its own, because the comment would swallow it.
 */
function terminate(sql: string): string {
    const statement = sql.trim();
    if (statement.endsWith(';')) return statement;
    const lastLine = statement.slice(statement.lastIndexOf('\n') + 1);
    return lastLine.includes('--') ? `${statement}\n;` : `${statement};`;
}

function formatEntry(entry: QueryHistoryEntry, timeZone?: string): string {
    const failed = entry.status === 'error';
    const header = [
        formatHistoryTimestamp(entry.executedAt, timeZone),
        failed ? 'failed' : 'succeeded',
        ...(entry.executionTimeMs !== null ? [`${Math.round(entry.executionTimeMs)} ms`] : []),
    ].join(' · ');
    const lines = commentLines(header);
    if (failed && entry.error?.trim()) {
        const error = entry.error.trim();
        lines.push(...commentLines(/^error\b/i.test(error) ? error : `ERROR: ${error}`));
    }
    lines.push(terminate(entry.sql));
    return lines.join('\n');
}

/**
 * The History panel's entries as a `.sql` file: for each entry, in the given order, a
 * comment header (date · outcome · duration, then the error when it failed) followed by
 * its statement ending with `;`. Entries without SQL are skipped.
 */
export function formatQueryHistoryAsSql(entries: QueryHistoryEntry[], timeZone?: string): string {
    const blocks = entries
        .filter((entry) => entry.sql.trim() !== '')
        .map((entry) => formatEntry(entry, timeZone));
    return blocks.length > 0 ? `${blocks.join('\n\n')}\n` : '';
}
