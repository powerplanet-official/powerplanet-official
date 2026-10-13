// Keep the public origin separate from checkout's local/test return URL setting.
export const siteOrigin = 'https://powerplanet.pk';
export const defaultStoreAddress = 'E-175, New Airport Road Main, Bhatta Chowk, Lahore, Pakistan';
export const storeAddress = (settings) => settings.address?.trim() || defaultStoreAddress;
export const absoluteUrl = (path = '/') => new URL(path, `${siteOrigin}/`).href;
