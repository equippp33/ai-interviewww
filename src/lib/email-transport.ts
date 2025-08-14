import { env } from "@/env";
import { createTransport } from "nodemailer";

const emailTransport = createTransport({
  host: "email-smtp.ap-south-1.amazonaws.com",
  port: 587,
  auth: {
    user: env.SES_USER,
    pass: env.SES_PASSWORD,
  },
});

export default emailTransport;
