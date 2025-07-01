import { Lucia } from "lucia";
import { sessionsTable, userTable } from "./db/schema";
import { db } from "./db";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";





const adapter = new DrizzlePostgreSQLAdapter(db, sessionsTable, userTable);

export const lucia = new Lucia(adapter, {
	sessionCookie: {
		expires: false,
		attributes: {
			secure: process.env.NODE_ENV === "production"
		}
	},
	getUserAttributes: (attributes) => {
		return {
			// attributes has the type of DatabaseUserAttributes
			username: attributes.username
		};
	}
});

declare module "lucia" {
	interface Register {
		Lucia: typeof lucia;
		DatabaseUserAttributes: DatabaseUserAttributes;
	}
}

interface DatabaseUserAttributes {
	username: string;
}