const cache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string>>();
let lastRequestTime = 0;

async function waitForRateLimit() {
  const now = Date.now();
  const wait = Math.max(0, lastRequestTime + 1100 - now);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastRequestTime = Date.now();
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key)!;
  if (pendingRequests.has(key)) return pendingRequests.get(key)!;

  const promise = (async () => {
    await waitForRateLimit();
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&accept-language=ru`,
        { headers: { 'User-Agent': 'EcoHunt/1.0' } }
      );
      const data = await res.json();
      const addr = data.address;

      let name: string;
      if (addr?.road) {
        const road = addr.road;
        const cross = addr.neighbourhood || addr.suburb || '';
        name = cross ? `${road}, ${cross}` : road;
        if (addr.house_number) name = `${road} ${addr.house_number}${cross ? `, ${cross}` : ''}`;
      } else {
        name = data.display_name?.split(',').slice(0, 2).join(',').trim() || 'Неизвестная локация';
      }

      cache.set(key, name);
      return name;
    } catch {
      const fallback = 'Неизвестная локация';
      cache.set(key, fallback);
      return fallback;
    } finally {
      pendingRequests.delete(key);
    }
  })();

  pendingRequests.set(key, promise);
  return promise;
}
