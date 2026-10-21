/**
 * Normalizes venue objects/strings safely into human-readable labels.
 * Prevents React rendering crashes (e.g. "Objects are not valid as a React child").
 */
export const formatVenueLabel = (venue: any): string => {
  if (!venue) return 'Online / TBA';
  if (typeof venue === 'string') return venue;
  if (typeof venue === 'object') {
    if (venue.name && venue.city) return `${venue.name}, ${venue.city}`;
    if (venue.name) return venue.name;
    if (venue.city) return venue.city;
    if (venue.address) return venue.address;
    if (venue.type === 'ONLINE') return 'Virtual Event (Online)';
    if (venue.type === 'HYBRID') return 'Hybrid Event';
    if (venue.type) return String(venue.type);
    return 'Venue Announced Soon';
  }
  return String(venue);
};
