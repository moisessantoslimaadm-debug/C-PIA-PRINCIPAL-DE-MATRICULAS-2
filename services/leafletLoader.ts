
let leafletPromise: Promise<void> | null = null;

export const loadLeaflet = (): Promise<void> => {
  // If L is already defined, we don't need to do anything
  if (typeof (window as any).L !== 'undefined') {
    return Promise.resolve();
  }

  // If we're already loading, return the existing promise
  if (leafletPromise) {
    return leafletPromise;
  }

  // Start loading
  leafletPromise = new Promise((resolve, reject) => {
    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    
    script.onload = () => {
      // Load Heatmap Plugin after Leaflet is ready
      const heatScript = document.createElement('script');
      heatScript.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
      heatScript.crossOrigin = '';
      
      heatScript.onload = () => resolve();
      heatScript.onerror = (e) => {
          console.warn("Heatmap plugin failed to load", e);
          resolve(); // Resolve anyway so basic map works
      };
      
      document.head.appendChild(heatScript);
    };

    script.onerror = (e) => {
        leafletPromise = null; // Reset on error so we can retry
        reject(e);
    };

    document.head.appendChild(script);
  });

  return leafletPromise;
};
