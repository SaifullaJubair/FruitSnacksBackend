import nodemailer from "nodemailer";
import { getEmailConfig } from "../app/setting/setting.services";
import { getCachedSetting } from "../helpers/settingCache";

const buildEmailHtml = (opts: {
  otp: number;
  siteName: string;
  logoUrl: string;
  expiresMinutes: number;
}): string => {
  const { otp, siteName, logoUrl, expiresMinutes } = opts;
  const year = new Date().getFullYear();
  const digits = String(otp).padStart(6, "0").split("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Password Reset OTP</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%);padding:32px 40px;text-align:center;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${siteName}" style="height:48px;max-width:180px;object-fit:contain;margin-bottom:12px;display:block;margin-left:auto;margin-right:auto;" />`
                : `<div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:1px;">${siteName}</div>`
              }
              <p style="color:#bfdbfe;font-size:13px;margin:6px 0 0;">Admin Portal</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">Password Reset</h1>
              <p style="margin:0 0 28px;font-size:14px;color:#64748b;line-height:1.6;">
                Use the one-time code below to reset your admin password.
                This code expires in <strong>${expiresMinutes} minutes</strong>.
              </p>

              <!-- OTP boxes -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  ${digits
                    .map(
                      (d) =>
                        `<td style="padding:0 4px;">
                          <div style="width:44px;height:56px;background:#f1f5f9;border:2px solid #e2e8f0;border-radius:10px;
                                      font-size:28px;font-weight:800;color:#1d4ed8;text-align:center;
                                      line-height:56px;letter-spacing:0;">${d}</div>
                        </td>`,
                    )
                    .join("")}
                </tr>
              </table>

              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
                <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.5;">
                  🔒 <strong>Security reminder:</strong> Never share this code with anyone.
                  ${siteName} staff will never ask for your OTP.
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.
                Your account remains secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © ${year} ${siteName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const SendEmailOTP = async (
  otp: number,
  toEmail: string,
  adminName: string,
  { ignoreEnabledFlag = false } = {},
): Promise<boolean> => {
  try {
    const cfg = await getEmailConfig({ ignoreEnabledFlag });
    if (!cfg) {
      console.warn("SendEmailOTP: email disabled or unconfigured — skipping");
      return false;
    }

    // Fetch site branding for the template
    const setting = await getCachedSetting().catch(() => null);
    const siteName = (setting as any)?.title || "FruitSnacks";
    const rawLogo = (setting as any)?.logo || "";
    // Encode spaces/special chars in S3 URLs (e.g. "web logo.png" → "web%20logo.png")
    const logoUrl = rawLogo ? rawLogo.replace(/ /g, "%20") : "";

    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.username, pass: cfg.password },
    });

    const html = buildEmailHtml({ otp, siteName, logoUrl, expiresMinutes: 10 });

    await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromAddress}>`,
      to: toEmail,
      subject: `${otp} is your ${siteName} admin OTP`,
      html,
    });

    return true;
  } catch (error: any) {
    console.error("SendEmailOTP error:", error?.message);
    return false;
  }
};
