const nodemailer = require("nodemailer");
const { formatName } = require("../../utils");

exports.sendResetPasswordMail = async ({ email, name, resetLink }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
    tls: { rejectUnauthorized: false },
  });

  const appName = process.env.APP_NAME || "Mejoric";
  const userName = name ? formatName(name) : "User";

  const mailOptions = {
    from: process.env.NODEMAILER_EMAIL,
    to: email,
    subject: `${appName} - Reset your password`,
    html: `
      <div style="max-width: 600px; margin: auto; padding: 30px; font-family: Arial, sans-serif; background-color: #f9f9ff; border-radius: 10px; border: 1px solid #e0e0ff;">
        <h2 style="text-align: center; color: #3f51b5;">Reset Password</h2>
        <p style="font-size: 16px; color: #333;">
          Hello ${userName},<br><br>
          We received a request to reset your password.
        </p>

        <div style="text-align:center; margin: 25px 0;">
          <a href="${resetLink}" style="background:#3f51b5; color:#fff; padding: 12px 18px; border-radius: 6px; text-decoration:none; display:inline-block;">
            Reset Password
          </a>
        </div>

        <p style="font-size: 14px; color: #555;">
          If the button doesn't work, copy and paste this link into your browser:
        </p>
        <p style="font-size: 13px; color: #333; word-break: break-all;">
          ${resetLink}
        </p>

        <p style="font-size: 14px; color: #555;">
          This link will expire in <strong>30 minutes</strong>. If you didn't request this, you can ignore this email.
        </p>

        <hr style="margin: 30px 0;">
        <p style="font-size: 12px; color: #aaa; text-align: center;">
          © ${new Date().getFullYear()} ${appName}. All rights reserved.
        </p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Reset password email sent:", info.response);
    return { success: true, message: info.response };
  } catch (error) {
    console.error("Error sending reset password email:", error);
    return { success: false, error };
  }
};
