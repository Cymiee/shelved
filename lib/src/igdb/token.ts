import axios from "axios";

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

// Call this server-side (Edge Function / backend) only.
// Never expose clientSecret to the browser.
export async function fetchIGDBAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const { data } = await axios.post<TwitchTokenResponse>(
    "https://id.twitch.tv/oauth2/token",
    null,
    {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      },
    }
  );
  return data.access_token;
}
