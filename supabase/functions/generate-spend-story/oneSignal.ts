export async function sendPushNotification(userId: string, text: string) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !apiKey) {
    console.error("OneSignal credentials missing");
    return;
  }

  const response = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${apiKey}`
    },
    body: JSON.stringify({
      app_id: appId,
      include_external_user_ids: [userId],
      headings: { en: "Your weekly Spend Story" },
      contents: { en: text.slice(0, 100) + (text.length > 100 ? "..." : "") },
      url: "https://pocket-money.netlify.app/dashboard"
    })
  });

  const data = await response.json();
  console.log("OneSignal response:", data);
  return data;
}
