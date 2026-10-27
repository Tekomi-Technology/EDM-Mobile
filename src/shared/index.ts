// Copied from EDM-Task-Management/packages/shared by `pnpm sync-shared`. Do not edit here: change the server
// repository and run the command again.
/**
 * The API contract shared by the API, the web app and the field staff app. The app lives in the EDM-Mobile
 * repository, which copies these files with `pnpm sync-shared`: after changing them, the app must copy them again.
 */
export * from './roles';
export * from './ticket';
export * from './schemas';
export * from './api-types';
