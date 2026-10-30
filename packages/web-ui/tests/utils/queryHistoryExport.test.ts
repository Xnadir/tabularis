import {describe, it, expect} from 'vitest';
import {formatHistoryTimestamp, formatQueryHistoryAsSql} from '../../src/utils/queryHistoryExport';
import type {QueryHistoryEntry} from '../../src/types/queryHistory';

const entry = (overrides: Partial<QueryHistoryEntry>): QueryHistoryEntry => ({
    id: 'id',
    sql: 'SELECT 1',
    executedAt: '2026-10-27T09:14:02Z',
    executionTimeMs: 12,
    status: 'success',
    rowsAffected: null,
    error: null,
    database: null,
    ...overrides,
});

describe('queryHistoryExport', () => {
    describe('formatQueryHistoryAsSql', () => {
        it('writes the example from the issue', () => {
            const entries = [
                entry({
                    sql: 'SELECT * FROM "order"',
                    status: 'error',
                    error: 'ERROR: relation "order" does not exist',
                }),
                entry({
                    sql: 'SELECT nme FROM users',
                    executedAt: '2026-10-27T09:15:40Z',
                    executionTimeMs: 8,
                    status: 'error',
                    error: 'ERROR: column "nme" does not exist',
                }),
            ];
            expect(formatQueryHistoryAsSql(entries, 'UTC')).toBe(
                [
                    '-- 2026-10-27 09:14:02 · failed · 12 ms',
                    '-- ERROR: relation "order" does not exist',
                    'SELECT * FROM "order";',
                    '',
                    '-- 2026-10-27 09:15:40 · failed · 8 ms',
                    '-- ERROR: column "nme" does not exist',
                    'SELECT nme FROM users;',
                    '',
                ].join('\n'),
            );
        });

        it('writes a succeeded entry without an error line', () => {
            expect(formatQueryHistoryAsSql([entry({})], 'UTC')).toBe(
                '-- 2026-10-27 09:14:02 · succeeded · 12 ms\nSELECT 1;\n',
            );
        });

        it('keeps every line of a multi-line error inside a comment', () => {
            const text = formatQueryHistoryAsSql(
                [entry({status: 'error', error: 'syntax error\r\nLINE 1: SELEC 1\n        ^'})],
                'UTC',
            );
            expect(text).toBe(
                [
                    '-- 2026-10-27 09:14:02 · failed · 12 ms',
                    '-- ERROR: syntax error',
                    '-- LINE 1: SELEC 1',
                    '--         ^',
                    'SELECT 1;',
                    '',
                ].join('\n'),
            );
        });

        it('does not add a second semicolon, and keeps multi-line statements whole', () => {
            const sql = 'SELECT *\nFROM users\nWHERE id = 1;';
            expect(formatQueryHistoryAsSql([entry({sql: `  ${sql}  `})], 'UTC')).toBe(
                `-- 2026-10-27 09:14:02 · succeeded · 12 ms\n${sql}\n`,
            );
        });

        it('puts the semicolon on its own line after a trailing -- comment', () => {
            expect(formatQueryHistoryAsSql([entry({sql: 'SELECT 1 -- check'})], 'UTC')).toBe(
                '-- 2026-10-27 09:14:02 · succeeded · 12 ms\nSELECT 1 -- check\n;\n',
            );
        });

        it('leaves out an unknown duration and skips entries without SQL', () => {
            expect(
                formatQueryHistoryAsSql(
                    [entry({executionTimeMs: null}), entry({sql: '   '})],
                    'UTC',
                ),
            ).toBe('-- 2026-10-27 09:14:02 · succeeded\nSELECT 1;\n');
            expect(formatQueryHistoryAsSql([], 'UTC')).toBe('');
        });

        it('keeps the given order', () => {
            const text = formatQueryHistoryAsSql(
                [entry({sql: 'SELECT 2'}), entry({sql: 'SELECT 1'})],
                'UTC',
            );
            expect(text.indexOf('SELECT 2')).toBeLessThan(text.indexOf('SELECT 1'));
        });
    });

    describe('formatHistoryTimestamp', () => {
        it('formats in the display timezone with a 24-hour clock', () => {
            expect(formatHistoryTimestamp('2026-10-27T21:05:09Z', 'UTC')).toBe(
                '2026-10-27 21:05:09',
            );
            expect(formatHistoryTimestamp('2026-10-27T21:05:09Z', 'Asia/Tokyo')).toBe(
                '2026-10-28 06:05:09',
            );
            expect(formatHistoryTimestamp('2026-10-27T00:00:00Z', 'UTC')).toBe(
                '2026-10-27 00:00:00',
            );
        });

        it('returns unparseable input as is', () => {
            expect(formatHistoryTimestamp('not a date', 'UTC')).toBe('not a date');
        });
    });
});
