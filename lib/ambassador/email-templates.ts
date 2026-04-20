/**
 * Shared Outlook-dark-mode-safe button email template.
 *
 * Design notes:
 * - `color-scheme` + `supported-color-schemes` meta opt out of automatic
 *   dark-mode color inversion in Apple Mail, Outlook Web, and iOS Mail.
 * - VML roundrect fallback renders a real pink button in Outlook for
 *   Windows desktop (mso), which ignores CSS padding/bgcolor on anchors.
 * - `[data-ogsc]` attribute selectors target Outlook.com web specifically
 *   so dark-mode overrides don't recolor the button.
 * - Background declared on `<td>` (`bgcolor=`), `<a>` (`background-color`),
 *   AND inline class; any one surviving the client's sanitizer is enough.
 */
export function renderButtonEmail({
  heading,
  buttonLabel,
  callbackUrl,
}: {
  heading: string
  buttonLabel: string
  callbackUrl: string
}): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    [data-ogsc] .btn-bg, [data-ogsb] .btn-bg { background-color: #e91e8c !important; }
    [data-ogsc] .btn-txt, [data-ogsb] .btn-txt { color: #ffffff !important; }
    [data-ogsc] .heading, [data-ogsb] .heading { color: #111111 !important; }
  </style>
</head>
<body style="margin:0;padding:32px 16px;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
    <tr>
      <td align="center">
        <h1 class="heading" style="font-size:20px;font-weight:700;margin:0 0 24px;color:#111111;">${heading}</h1>
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${callbackUrl}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="17%" strokecolor="#e91e8c" fillcolor="#e91e8c">
          <w:anchorlock/>
          <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:700;">${buttonLabel}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-bg" bgcolor="#e91e8c" style="background-color:#e91e8c;border-radius:8px;">
          <tr>
            <td class="btn-bg" bgcolor="#e91e8c" align="center" style="background-color:#e91e8c;border-radius:8px;">
              <a class="btn-txt" href="${callbackUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;line-height:20px;border-radius:8px;background-color:#e91e8c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${buttonLabel}</a>
            </td>
          </tr>
        </table>
        <!--<![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}
