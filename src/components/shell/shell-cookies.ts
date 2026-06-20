// Plain (non-"use client") module so both the server layout and the client
// AppShell get the real string values. Importing these from a "use client"
// module into a server component would yield client-reference proxies instead.
export const SIDEBAR_COOKIE = "landland_sidebar";
export const TRIAL_COOKIE = "landland_trial_dismissed";
