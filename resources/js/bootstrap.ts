import axios from 'axios';
window.axios = axios;

window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// sessionStorage is isolated per browser tab, unlike the shared Laravel session cookie.
const tabStorageKey = 'arms_tab_id';
let armsTabId = window.sessionStorage.getItem(tabStorageKey);
if (!armsTabId) {
    armsTabId = typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `arms-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(tabStorageKey, armsTabId);
}
window.axios.defaults.headers.common['X-ARMS-Tab-ID'] = armsTabId;

// Carry the tab identifier on full-page navigations and file links, which cannot send Axios headers.
const syncTabIdToCurrentUrl = () => {
    const url = new URL(window.location.href);
    if (url.origin === window.location.origin && url.searchParams.get('arms_tab_id') !== armsTabId) {
        url.searchParams.set('arms_tab_id', armsTabId);
        window.history.replaceState(window.history.state, '', url);
    }
};
syncTabIdToCurrentUrl();
document.addEventListener('inertia:navigate', syncTabIdToCurrentUrl);
window.addEventListener('popstate', syncTabIdToCurrentUrl);
document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!target) return;

    const opensSeparateContext = target.target === '_blank' || event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1;
    const url = new URL(target.href, window.location.href);
    if (url.origin !== window.location.origin) return;

    if (opensSeparateContext) {
        url.searchParams.delete('arms_tab_id');
    } else {
        url.searchParams.set('arms_tab_id', armsTabId);
    }
    target.href = url.toString();
});
