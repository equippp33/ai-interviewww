import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import emailTransport from "@/lib/email-transport";
import { studentInterviewMails } from "@/server/db/schema";

// Helper function to create email template with tracking pixel
const createEmailTemplate = (
  content: string,
  baseUrl: string,
  trackingId: string,
) => `
    <div style="font-family: Arial, sans-serif;">
      ${content}
      <img src="${baseUrl}/api/track-email/${trackingId}" alt="" style="width:1px;height:1px;" />
    </div>
`;

export const sendSubmitInterviewEmail = async ({
  email,
  studentId,
  fullName,
  phoneNumber,
  collegeName,
  yearOfPassing,
  rollno,
  stream,
  interviewId,
}: {
  email: string;
  studentId: string;
  fullName: string | null;
  phoneNumber: string | null;
  collegeName: string | null;
  yearOfPassing: string | null;
  rollno: string | null;
  stream: string | null;
  interviewId: string | null;
}) => {
  const trackingId = crypto.randomUUID();
  const baseUrl = "https://bfsi.equippp.global"; // Adjust based on your environment

  const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://images.equippp.global/skill.png" alt="logo" style="max-width: 150px; height: auto;" />
      </div>
      <p>Dear ${fullName},</p>
      <p>Thank you for submitting your pre-course assessment. Your responses have been successfully recorded. You will be notified once the evaluation process is complete. Please stay tuned for further updates.</p>
      <p>Best regards,<br>Team BFSI</p>
  `;

  const htmlMessage = createEmailTemplate(content, baseUrl, trackingId);

  const mailOptions = {
    from: "developer@equippp.com",
    to: email,
    bcc: [
      "mani.krshna214@gmail.com",
      "nivasyadavv077@gmail.com",
      "santhakrishna@threepointolabs.com",
    ],
    subject: "BFSI Equippp skill pre course assessment",
    html: htmlMessage,
  };

  const streamPrefix = stream?.toLowerCase().includes("engineer") ? "GE" : "GD";
  const yearPart = yearOfPassing?.slice(-2) ?? "24"; // Get last 2 digits of year
  const paddedRollNo = rollno?.toString().padStart(4, "0") ?? "0000"; // Pad rollno to 4 digits
  const equipppId = `${streamPrefix}${yearPart}B${paddedRollNo}`;

  try {
    await emailTransport.sendMail(mailOptions);
    await db
      .update(studentInterviewMails)
      .set({
        isSubmitted: "true",
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(studentInterviewMails.studentEmail, email));
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};

export const sendInterviewCompletedEmail = async ({
  email,
  studentId,
  fullName,
  reportUrl,
  phoneNumber,
  collegeName,
  yearOfPassing,
  rollno,
  stream,
  score,
  areaOfImprovement,
  interviewId,
}: {
  email: string;
  studentId: string;
  fullName: string | null;
  phoneNumber: string | null;
  collegeName: string | null;
  yearOfPassing: string | null;
  rollno: string | null;
  stream: string | null;
  reportUrl: string;
  score?: number;
  areaOfImprovement?: string;
  interviewId: string | null;
}) => {
  const trackingId = crypto.randomUUID();
  const baseUrl = "https://bfsi.equippp.global";

  const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://images.equippp.global/skill.png" alt="logo" style="max-width: 150px; height: auto;" />
      </div>
      <p>Dear ${fullName},</p>
      <p>Please find attached your score along with identified areas for improvement.</p>
      ${score ? `<p>Assessment Score: ${score}</p>` : ""}
      ${areaOfImprovement ? `<p>Areas for improvement: ${areaOfImprovement}</p>` : ""}
      <p>Best regards,<br>Team BFSI</p>
  `;

  const htmlMessage = createEmailTemplate(content, baseUrl, trackingId);

  const mailOptions = {
    from: "developer@equippp.com",
    to: email,
    bcc: [
      "mani.krshna214@gmail.com",
      "nivasyadavv077@gmail.com",
      "santhakrishna@threepointolabs.com",
    ],
    subject: "BFSI Equippp skill pre course assessment",
    html: htmlMessage,
  };

  const streamPrefix = stream?.toLowerCase().includes("engineer") ? "GE" : "GD";
  const yearPart = yearOfPassing?.slice(-2) ?? "24"; // Get last 2 digits of year
  const paddedRollNo = rollno?.toString().padStart(4, "0") ?? "0000"; // Pad rollno to 4 digits
  const equipppId = `${streamPrefix}${yearPart}B${paddedRollNo}`;

  try {
    await emailTransport.sendMail(mailOptions);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "true",
    //   emailSentAt: new Date(),
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });
    return true;
  } catch (e) {
    console.error(e);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "false",
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });
    return false;
  }
};

export const sendInterviewFailedEmail = async ({
  email,
  studentId,
  fullName,
  interviewId,
  phoneNumber,
  collegeName,
  yearOfPassing,
  rollno,
  stream,
}: {
  email: string;
  studentId: string;
  fullName: string | null;
  interviewId: string | null;
  phoneNumber: string | null;
  collegeName: string | null;
  yearOfPassing: string | null;
  rollno: string | null;
  stream: string | null;
}) => {
  const trackingId = crypto.randomUUID();
  const baseUrl = "https://bfsi.equippp.global";

  const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://images.equippp.global/skill.png" alt="logo" style="max-width: 150px; height: auto;" />
      </div>
      <p>Dear ${fullName},</p>
      <p>We encountered an issue while processing your interview submission.</p>
      <p>Our team has been notified and will look into this matter.</p>
      <p>If you continue to experience issues, please contact our support team.</p>
      <p>Best regards,<br>Team BFSI</p>
  `;

  const htmlMessage = createEmailTemplate(content, baseUrl, trackingId);

  const mailOptions = {
    from: "developer@equippp.com",
    to: email,
    bcc: [
      "mani.krshna214@gmail.com",
      "nivasyadavv077@gmail.com",
      "santhakrishna@threepointolabs.com",
    ],
    subject: "Equippp BFSI Interview Processing Update",
    html: htmlMessage,
  };

  const streamPrefix = stream?.toLowerCase().includes("engineer") ? "GE" : "GD";
  const yearPart = yearOfPassing?.slice(-2) ?? "24"; // Get last 2 digits of year
  const paddedRollNo = rollno?.toString().padStart(4, "0") ?? "0000"; // Pad rollno to 4 digits
  const equipppId = `${streamPrefix}${yearPart}B${paddedRollNo}`;

  try {
    await emailTransport.sendMail(mailOptions);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "true",
    //   emailSentAt: new Date(),
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });

    return true;
  } catch (e) {
    console.error(e);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "false",
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });
    return false;
  }
};

export const sendInterviewIssueResolvedEmail = async ({
  email,
  studentId,
  fullName,
  score,
  interviewId,
  phoneNumber,
  collegeName,
  yearOfPassing,
  rollno,
  stream,
}: {
  email: string;
  studentId: string;
  fullName: string | null;
  score: number | null;
  interviewId: string | null;
  phoneNumber: string | null;
  collegeName: string | null;
  yearOfPassing: string | null;
  rollno: string | null;
  stream: string | null;
}) => {
  const trackingId = crypto.randomUUID();
  const baseUrl = "https://bfsi.equippp.global";

  const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://images.equippp.global/skill.png" alt="logo" style="max-width: 150px; height: auto;" />
      </div>
      <p>Dear ${fullName},</p>
      <p>Thank you for your patience while we resolved the technical issue with your interview processing.</p>
      <p>We are pleased to inform you that your interview has been successfully processed. Your interview score is ${score}.</p>
      <p>Your dedication to completing the interview process is commendable, and we appreciate your understanding during the temporary delay.</p>
      <p>If you have any questions about your results or need further assistance, please don't hesitate to contact our support team.</p>
      <p>Best regards,<br>Team BFSI</p>
  `;

  const htmlMessage = createEmailTemplate(content, baseUrl, trackingId);

  const mailOptions = {
    from: "developer@equippp.com",
    to: email,
    bcc: [
      "mani.krshna214@gmail.com",
      "nivasyadavv077@gmail.com",
      "santhakrishna@threepointolabs.com",
    ],
    subject: "Equippp BFSI Interview Results - Issue Resolved",
    html: htmlMessage,
    text: `Dear ${fullName},\n\nThank you for your patience while we resolved the technical issue with your interview processing.\n\nWe are pleased to inform you that your interview has been successfully processed. Your interview score is 1.\n\nYour dedication to completing the interview process is commendable, and we appreciate your understanding during the temporary delay.\n\nIf you have any questions about your results or need further assistance, please don't hesitate to contact our support team.\n\nBest regards,\nEquippp BFSI Team`,
  };

  const streamPrefix = stream?.toLowerCase().includes("engineer") ? "GE" : "GD";
  const yearPart = yearOfPassing?.slice(-2) ?? "24"; // Get last 2 digits of year
  const paddedRollNo = rollno?.toString().padStart(4, "0") ?? "0000"; // Pad rollno to 4 digits
  const equipppId = `${streamPrefix}${yearPart}B${paddedRollNo}`;

  try {
    await emailTransport.sendMail(mailOptions);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "true",
    //   emailSentAt: new Date(),
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });

    return true;
  } catch (e) {
    console.error(e);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "false",
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });
    return false;
  }
};

export const sendInterviewViolatedEmail = async ({
  email,
  studentId,
  fullName,
  interviewId,
  phoneNumber,
  collegeName,
  yearOfPassing,
  rollno,
  stream,
  nextAttemptTime,
}: {
  email: string;
  studentId: string;
  fullName: string | null;
  interviewId: string | null;
  phoneNumber: string | null;
  collegeName: string | null;
  yearOfPassing: string | null;
  rollno: string | null;
  stream: string | null;
  nextAttemptTime: Date;
}) => {
  const trackingId = crypto.randomUUID();
  const baseUrl = "https://bfsi.equippp.global";

  const content = `
      <div style="text-align: center; margin-bottom: 20px;">
        <img src="https://images.equippp.global/skill.png" alt="logo" style="max-width: 150px; height: auto;" />
      </div>
      <p>Hi ${fullName},</p>
      <p>We noticed some irregularities during your interview session that violated our guidelines.</p>
      <p>You can attempt the interview again after ${nextAttemptTime.toLocaleString()}.</p>
      <p>Please ensure to:</p>
      <ul>
        <li>Stay within the camera frame</li>
        <li>Maintain proper lighting</li>
        <li>Avoid any external assistance</li>
        <li>Complete the interview in one sitting</li>
      </ul>
      <p>If you need any assistance, please contact our support team.</p>
      <p>Best regards,<br>Team BFSI</p>
  `;

  const htmlMessage = createEmailTemplate(content, baseUrl, trackingId);

  const mailOptions = {
    from: "developer@equippp.com",
    to: email,
    subject: "Equippp BFSI Interview - Session Violation Notice",
    html: htmlMessage,
    bcc: [
      "mani.krshna214@gmail.com",
      "nivasyadavv077@gmail.com",
      "santhakrishna@threepointolabs.com",
    ],
  };

  const streamPrefix = stream?.toLowerCase().includes("engineer") ? "GE" : "GD";
  const yearPart = yearOfPassing?.slice(-2) ?? "24"; // Get last 2 digits of year
  const paddedRollNo = rollno?.toString().padStart(4, "0") ?? "0000"; // Pad rollno to 4 digits
  const equipppId = `${streamPrefix}${yearPart}B${paddedRollNo}`;

  try {
    await emailTransport.sendMail(mailOptions);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "true",
    //   emailSentAt: new Date(),
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });

    return true;
  } catch (e) {
    console.error(e);
    // await db.insert(studentInterviewMails).values({
    //   fullName: fullName,
    //   studentEmail: email,
    //   subject: mailOptions.subject,
    //   phoneNumber: phoneNumber,
    //   userId: studentId,
    //   collegeName: collegeName,
    //   interviewId: interviewId,
    //   equipppId: equipppId,
    //   isEmailSent: "false",
    //   emailTrackingId: trackingId,
    //   isEmailRead: false,
    //   emailReadedAt: null,
    // });
    return false;
  }
};
