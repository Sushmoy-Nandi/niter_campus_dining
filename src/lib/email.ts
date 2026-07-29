export async function sendEmail(to: string, subject: string, htmlBody: string) {
  const url = process.env.GOOGLE_SCRIPT_EMAIL_URL;
  
  if (!url) {
    console.warn("GOOGLE_SCRIPT_EMAIL_URL is not configured in .env. Skipping email to:", to);
    return false;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      // Apps Script sometimes requires following redirects when called programmatically
      redirect: "follow", 
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        subject,
        htmlBody,
        plainBody: htmlBody.replace(/<[^>]*>?/gm, ''), // basic HTML stripping for plain text fallback
      }),
    });
    
    const result = await response.json();
    if (!result.success) {
      console.error("Apps Script returned an error:", result.error);
    }
    return result.success;
  } catch (error) {
    console.error("Failed to trigger Google Apps Script email:", error);
    return false;
  }
}
