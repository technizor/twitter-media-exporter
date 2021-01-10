import got from 'got';
import crypto_ from 'crypto';
import qs from 'querystring';
import OAuth, { Token } from 'oauth-1.0a';
import rl from 'readline';

const readline = rl.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function input(prompt: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    readline.question(prompt, (out: string) => {
      readline.close();
      resolve(out);
    });
  });
}

const requestTokenURL = 'https://api.twitter.com/oauth/request_token';
const authorizeURL = 'https://api.twitter.com/oauth/authorize';
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';

const favoritesURL = 'https://api.twitter.com/1.1/favorites/list.json'

// The code below sets the consumer key and consumer secret from your environment variables
// To set environment variables on Mac OS X, run the export commands below from the terminal:
const consumer_key = process.env.CONSUMER_KEY!;
const consumer_secret = process.env.CONSUMER_SECRET!;

const oauth = new OAuth({
  consumer: {
    key: consumer_key,
    secret: consumer_secret,
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString: string, key: string) => crypto_.createHmac('sha1', key).update(baseString).digest('base64')
});

//#region Private Types
type ApiMethod = 'GET' | 'POST';

//#endregion Private Types
//#region Public Types
export type OAuthAccessToken = {
  oauth_token: string,
  oauth_token_secret: string,
  user_id: string,
  screen_name: string,
}

export type OAuthRequestToken = {
  oauth_token: string,
  oauth_token_secret: string,
  oauth_callback_confirmed: string,
}

export type GetFavoritesListRequest = {
  user_id?: number,
  screen_name?: string,
  count?: number,
  since_id?: number,
  max_id?: number,
  include_entities?: boolean,
}
//#endregion Public Types

//#region Private Functions
function getAuthHeader(endpointURL: string, method: ApiMethod, token?: Token): OAuth.Header {
  if (token) return oauth.toHeader(oauth.authorize({ url: endpointURL, method }, token));
  return oauth.toHeader(oauth.authorize({ url: endpointURL, method }));
}

async function requestToken(): Promise<OAuthRequestToken> {
  const authHeader = getAuthHeader(requestTokenURL, 'POST');

  const req = await got.post(requestTokenURL, {
    json: {
      oauth_callback: 'oob',
    },
    headers: {
      Authorization: authHeader['Authorization'],
    },
  });

  if (req.body) {
    return qs.parse(req.body) as OAuthRequestToken;
  } else {
    throw new Error('Cannot get an OAuth request token');
  }
}

async function accessToken(oAuthRequestToken: OAuthRequestToken, verifier: string): Promise<OAuthAccessToken> {

  const authHeader = oauth.toHeader(oauth.authorize({ url: accessTokenURL, method: 'POST' }));

  const queryParams = { oauth_verifier: verifier, oauth_token: oAuthRequestToken.oauth_token };
  const url = `${accessTokenURL}?${qs.stringify(queryParams)}`;

  const req = await got.post(url, {
    headers: {
      Authorization: authHeader["Authorization"],
    }
  });

  if (req.body) {
    return qs.parse(req.body) as OAuthAccessToken;
  } else {
    throw new Error('Cannot get an OAuth request token');
  }
}

async function getRequest<T>(oAuthAccessToken: OAuthAccessToken, endpointURL: string): Promise<T> {

  const token = {
    key: oAuthAccessToken.oauth_token,
    secret: oAuthAccessToken.oauth_token_secret,
  };

  const authHeader = getAuthHeader(endpointURL, 'GET', token);

  const req = await got(endpointURL, {
    headers: {
      Authorization: authHeader["Authorization"]
    }
  });

  if (req.body) {
    return JSON.parse(req.body) as T;
  } else {
    throw new Error('Unsuccessful request');
  }
}
//#endregion Private Functions

//#region Public Functions
export async function generateOauthToken(): Promise<OAuthAccessToken> {
  // Get request token 
  const oAuthRequestToken = await requestToken();

  // Get authorization
  const urlParams = { oauth_token: oAuthRequestToken.oauth_token };
  const url = `${authorizeURL}?${qs.stringify(urlParams)}`;
  console.log('Please go here and authorize:', url);
  const pin: string = await input('Paste the PIN here: ');

  // Get the access token
  return accessToken(oAuthRequestToken, pin.trim());
}

export function likesRequest(oAuthAccessToken: OAuthAccessToken, request: GetFavoritesListRequest = {}): Promise<Array<any>> {
  const query = qs.stringify(request);
  const endpointURL = `${favoritesURL}${query.length == 0 ? '' : `?${query}`}`;
  return getRequest<Array<any>>(oAuthAccessToken, endpointURL);
}
//#endregion Public Functions