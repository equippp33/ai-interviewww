import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { userTable } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";
import { lucia } from "@/server/auth";
import { cookies } from "next/headers";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/server/db";
import { Cookie } from "lucia";



export const userRouter = createTRPCRouter({





    registerUser: publicProcedure
    .input(
        z.object({
            email: z.string().email(),
            password: z.string().min(1),
        })
    )
    .mutation(async ({ input: { email, password }, ctx }) => {
        if (
            typeof password !== "string" ||
            password.length < 6 ||
            password.length > 255
        ) {
            return {
                error: "Invalid password"
            };
        }

        const result = await db
            .select({
                email: userTable.email
            })
            .from(userTable)
            .where(eq(userTable.email, email));

        if (result.length > 0) {
            throw new Error("Email already exists");
        }

        const hashedPassword = await hash(password, {
            memoryCost: 19456,
            timeCost: 2,
            outputLen: 32,
            parallelism: 1,
        });

        // Insert the new user into the database
        const insertedUser = await db.insert(userTable).values({
            email: email,
            password: hashedPassword,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        }).returning({
            id: userTable.id,
            email: userTable.email,
            role: userTable.role,
        });

        const user = insertedUser[0];

        if (!user) {
            throw new Error("Failed to register user");
        }

        // ✅ Login the user by creating a session
        const session = await lucia.createSession(user.id, {});

        // ✅ Create session cookie
        const sessionCookie = lucia.createSessionCookie(session.id);

        // ✅ Set session cookie
        (await cookies()).set(
            sessionCookie.name,
            sessionCookie.value,
            sessionCookie.attributes,
        );

        // Return user details after successful login
        return { 
            success: true,
            user 
        };
    }),







    login: publicProcedure
    .input(
        z.object({
            email: z.string(),
            password: z.string().min(1),
        }),
    )
    .mutation(async ({ input: { email, password } ,ctx }) => {
        console.log({
            host: ctx.host,
        });
    
        const response = await db
            .select({
                password: userTable.password,
                id: userTable.id,
                email: userTable.email,
                role: userTable.role,
            })
            .from(userTable)
            .where(
                or(
                    eq(userTable.email, email),
                )
            );

        const user = response[0];

        if (!user) {
            throw new Error("User not found");
        }
        if (!user.password) {
            throw new Error("Incorrect username or password");
        }

        const validPassword = await verify(user.password, password);
        if (!validPassword) {
            throw new Error("Incorrect username or password");
        }

        const session = await lucia.createSession(user.id, {});

        const sessionCookie = lucia.createSessionCookie(session.id);
        console.log(sessionCookie);

        (await cookies()).set(
            sessionCookie.name,
            sessionCookie.value,
            sessionCookie.attributes,
        );

        // Returning the role instead of category
        return { 
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            } 
        };
    }),


    getUser: protectedProcedure.query(async ({ ctx }) => {
        const user = await db.query.userTable.findFirst({
        where: eq(userTable.id, ctx.user.id),
         });
        
         return user;
    }),
        
        

    logout: protectedProcedure.mutation(async ({ ctx }) => {
        await lucia.invalidateSession(ctx.session.id);
    
        const sessionCookie = lucia.createBlankSessionCookie();
    
        (await cookies()).set(
          sessionCookie.name,
          sessionCookie.value,
          sessionCookie.attributes,
        );
    
        return {};
      }),

});