/**
 * Formats a duration in seconds into a human-readable string.
 *
 * Examples:
 *   30      → "30 sec"
 *   300     → "5 min"
 *   3600    → "1 h"
 *   7260    → "2 h 1 min"
 *   90000   → "1 d 1 h"
 */
export function formatTime(seconds: number): string {
    if (seconds < 60) {
        return `${seconds} sec`;
    }
    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)} min`;
    }
    if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
    }
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}
