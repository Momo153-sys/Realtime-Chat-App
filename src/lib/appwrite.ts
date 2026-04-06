import { Client, Account, Databases, ID, Query } from 'appwrite';

// Use environment variables for security and flexibility
const PROJECT_ID = import.meta.env.VITE_APPWRITE_PROJECT_ID || '69c441350013d15e30de';
const ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';

export const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);

export { ID, Query };