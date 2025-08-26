import { z } from "zod";
import axios from "axios";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const imageRouter = createTRPCRouter({
  convertToBase64: publicProcedure
    .input(z.object({ imageUrl: z.string().url() }))
    .mutation(async ({ input }) => {
      const response = await axios.get(input.imageUrl, {
        responseType: "arraybuffer",
      });

      const mimeType = response.headers["content-type"];
      const base64 = Buffer.from(response.data, "binary").toString("base64");

      return `data:${mimeType};base64,${base64}`;
    }),
});
