import {
	getISOWeek,
	getISOWeekYear,
	startOfISOWeek,
	addWeeks as addWeeksToDate,
	addDays,
	format
} from 'date-fns';
import type { ISODate, WeekKey } from './types';

/** The ISO week key (`YYYY-Www`, ISO week-year) for a given date. */
export function weekKeyOf(date: Date): WeekKey {
	const year = getISOWeekYear(date);
	const week = getISOWeek(date);
	return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The ISO week key for today. */
export function todayWeekKey(): WeekKey {
	return weekKeyOf(new Date());
}

/** The Monday (local) that starts the given ISO week. */
export function weekKeyToMonday(key: WeekKey): Date {
	const m = key.match(/^(\d{4})-W(\d{2})$/);
	if (!m) throw new Error(`Invalid week key: ${key}`);
	const year = Number(m[1]);
	const week = Number(m[2]);
	// ISO week 1 is the week containing Jan 4; add (week - 1) weeks to its Monday.
	const week1Monday = startOfISOWeek(new Date(year, 0, 4));
	return addWeeksToDate(week1Monday, week - 1);
}

/** The 7 local ISO dates (Monday..Sunday) of a week. */
export function weekToDates(key: WeekKey): ISODate[] {
	const monday = weekKeyToMonday(key);
	return Array.from({ length: 7 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'));
}

/** Shift a week key by n weeks (handles year rollover and 53-week years). */
export function addWeeks(key: WeekKey, n: number): WeekKey {
	return weekKeyOf(addWeeksToDate(weekKeyToMonday(key), n));
}

/** A human label for a week, e.g. "Jul 6 – 12, 2026" or "Jun 29 – Jul 5, 2026". */
export function formatWeekRange(key: WeekKey): string {
	const monday = weekKeyToMonday(key);
	const sunday = addDays(monday, 6);
	const left = format(monday, 'MMM d');
	const right = monday.getMonth() === sunday.getMonth() ? format(sunday, 'd') : format(sunday, 'MMM d');
	return `${left} – ${right}, ${format(sunday, 'yyyy')}`;
}

/** Short weekday + day-of-month label for a date, e.g. "Mon 6". */
export function formatDayLabel(isoDate: ISODate): string {
	const [y, m, d] = isoDate.split('-').map(Number);
	return format(new Date(y, m - 1, d), 'EEE d');
}
