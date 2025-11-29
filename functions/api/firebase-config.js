export async function onRequest(context) {
  return new Response(
    JSON.stringify({
      apiKey: context.env.FIREBASE_API_KEY,
      authDomain: context.env.FIREBASE_AUTH_DOMAIN,
      projectId: context.env.FIREBASE_PROJECT_ID,
      storageBucket: context.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: context.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: context.env.FIREBASE_APP_ID,
      measurementId: context.env.FIREBASE_MEASUREMENT_ID
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
