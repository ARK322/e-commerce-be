export const baseLayout = (content: string) => `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; padding: 32px;">
          <tr>
            <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #18181b; line-height: 1.6;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

export const codeBox = (code: string) => `
  <div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
    <p style="margin: 0 0 8px; font-size: 14px; color: #71717a;">Doğrulama kodun</p>
    <p style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: ui-monospace, monospace;">${code}</p>
  </div>
`;

export const actionButton = (url: string, label: string) => `
  <p style="text-align: center; margin: 28px 0;">
    <a href="${url}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600;">${label}</a>
  </p>
`;

export const footerNote = (text: string) => `
  <p style="margin: 24px 0 0; font-size: 13px; color: #71717a;">${text}</p>
`;

export const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const reasonBox = (reason: string) => `
  <div style="background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px; padding: 16px; margin: 24px 0;">
    <p style="margin: 0 0 4px; font-size: 13px; color: #71717a;">Red sebebi</p>
    <p style="margin: 0; font-size: 15px; color: #18181b;">${escapeHtml(reason)}</p>
  </div>
`;
