/**
 * Utility functions for handling the "ongoing" keyword in date fields.
 *
 * The "ongoing" keyword represents items that have started but haven't ended yet,
 * such as people still alive or events that are still happening (e.g., War in Ukraine).
 */

export const ONGOING_KEYWORD = 'ongoing';

/**
 * Check if a value represents an ongoing/open-ended date.
 * Case-insensitive comparison.
 * Handles both raw strings and Obsidian Bases objects that wrap values.
 */
export function isOngoing(value: unknown): boolean {
	// Direct string check
	if (typeof value === 'string') {
		return value.toLowerCase() === ONGOING_KEYWORD;
	}
	// Obsidian Bases wraps values in objects with a 'data' property or toString()
	if (typeof value === 'object' && value !== null) {
		// Check 'data' property (Bases text field wrapper)
		if ('data' in value && typeof (value as any).data === 'string') {
			return (value as any).data.toLowerCase() === ONGOING_KEYWORD;
		}
		// Check toString() result
		const str = value.toString();
		if (str && str !== '[object Object]') {
			return str.toLowerCase() === ONGOING_KEYWORD;
		}
	}
	return false;
}

/**
 * Resolve an "ongoing" value to the current date.
 * Returns null if the value is not "ongoing" (caller should parse normally).
 */
export function resolveOngoingDate(value: unknown): Date | null {
	if (isOngoing(value)) {
		return new Date();
	}
	return null;
}
