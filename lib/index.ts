import got from 'got';
import path from 'path';
import crypto_ from 'crypto';
import OAuth from 'oauth-1.0a';
import qs from 'querystring';
import stream from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import cliProgress from 'cli-progress';

const pipeline = promisify(stream.pipeline);
const fsp = fs.promises;
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

import {
  SimpleTweet,
  GetFavoritesListRequest,
  OAuthAccessToken,
  OAuthRequestToken,
} from './types';

// The code below sets the consumer key and consumer secret from your environment variables
// To set environment variables on Mac OS X, run the export commands below from the terminal:
const consumer_key = process.env.CONSUMER_KEY!;
const consumer_secret = process.env.CONSUMER_SECRET!;

const requestTokenURL = 'https://api.twitter.com/oauth/request_token';
const authorizeURL = new URL('https://api.twitter.com/oauth/authorize');
const accessTokenURL = 'https://api.twitter.com/oauth/access_token';

const fileName = 'response.json';

const oauth = new OAuth({
  consumer: {
    key: consumer_key,
    secret: consumer_secret,
  },
  signature_method: 'HMAC-SHA1',
  hash_function: (baseString: string, key: string) => crypto_.createHmac('sha1', key).update(baseString).digest('base64')
});

async function input(prompt: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    readline.question(prompt, (out: string) => {
      readline.close();
      resolve(out);
    });
  });
}

async function requestToken(): Promise<OAuthRequestToken> {

  const authHeader = oauth.toHeader(oauth.authorize({ url: requestTokenURL, method: 'POST' }));

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

  const path = `https://api.twitter.com/oauth/access_token?oauth_verifier=${verifier}&oauth_token=${oAuthRequestToken.oauth_token}`

  const req = await got.post(path, {
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

async function getRequest(oAuthAccessToken: OAuthAccessToken, endpointURL: string) {

  const token = {
    key: oAuthAccessToken.oauth_token,
    secret: oAuthAccessToken.oauth_token_secret,
  };

  const authHeader = oauth.toHeader(oauth.authorize({ url: endpointURL, method: 'GET' }, token));

  const req = await got(endpointURL, {
    headers: {
      Authorization: authHeader["Authorization"]
    }
  });

  if (req.body) {
    return JSON.parse(req.body);
  } else {
    throw new Error('Unsuccessful request');
  }
}

async function getImage(url: string, fileName: string) {
  try {
    const stat = await fsp.stat(fileName);
    if (stat.isFile()) return;
  } catch (err) {
    try {
      await pipeline(got.stream(url), fs.createWriteStream(fileName))
      console.log(`Downloaded ${url}`);
    } catch (err) {
      console.log(`Error for url: ${url}`, err);
    }
  }
}

function mediaTweetFlatten(tweet: any): SimpleTweet {
  return {
    id: tweet.id,
    text: tweet.text,
    hashtags: tweet.entities?.hashtags?.map((x: any) => x.text),
    media: tweet.extended_entities?.media?.map((x: any) => ({
      id: x.id,
      media_url: x.media_url,
      url: x.url,
      type: x.type,
    })),
    user: {
      id: tweet.user.id,
      name: tweet.user.name,
      screen_name: tweet.user.screen_name,
    },
    lang: tweet.lang,
  }
}

function isMediaTweet(tweet: SimpleTweet): boolean {
  return tweet.media && tweet.media.length > 0;
}

type FilterFunc<T> = (item: T) => boolean;
type CompFunc<T> = (a: T, b: T) => number;

function bsearch<T>(list: Array<T>, item: T, comp: CompFunc<T>): number {
  let start = 0;
  let end = list.length;

  while (start <= end) {
    let mid = Math.floor((start + end) / 2);
    let res = comp(item, list[mid]);
    if (res == 0) return mid;
    if (res < 0) {
      start = mid + 1;
    }
    else {
      end = mid - 1;
    }
  }
  return -start - 1;
}

function reverseChronological(a: number, b: number): number {
  return a - b;
}

function isNotInPrior(priorList: Array<SimpleTweet>): FilterFunc<SimpleTweet> {
  const idList = priorList.map((x: SimpleTweet) => x.id);
  return (tweet: SimpleTweet): boolean => {
    const idx = bsearch(idList, tweet.id, reverseChronological);
    return idx < 0;
  }
}

async function likesRequest(oAuthAccessToken: OAuthAccessToken, request: GetFavoritesListRequest = {}) {
  const query = qs.stringify(request);
  let endpointURL = `https://api.twitter.com/1.1/favorites/list.json${query.length == 0 ? '' : `?${query}`}`;
  return await getRequest(oAuthAccessToken, endpointURL);
}

async function ensureDir(dirName: string) {
  try {
    await fsp.access(dirName, fs.constants.R_OK | fs.constants.W_OK);
    const stat = await fsp.stat(dirName);
    if (!stat.isDirectory() && !stat.isFile()) {
      await fsp.mkdir(dirName);
    }
  } catch (err) {
    console.log(err);
    await fsp.mkdir(dirName);
  }
}

async function ensureOauth(fileName: string): Promise<OAuthAccessToken> {
  try {
    const stat = await fsp.stat(fileName);
    if (stat.isDirectory()) throw `${fileName} should not be a directory`;
    const oAuthAccessToken = JSON.parse(await fsp.readFile(fileName, { encoding: 'utf8' })) as OAuthAccessToken;
    console.log('Retrieved cached access token');
    return oAuthAccessToken;
  } catch (err) {
    console.log(`Failed to retrieve cached access token: ${err}`);
    // Get request token 
    const oAuthRequestToken = await requestToken();

    // Get authorization
    authorizeURL.searchParams.append('oauth_token', oAuthRequestToken.oauth_token);
    console.log('Please go here and authorize:', authorizeURL.href);
    const pin: string = await input('Paste the PIN here: ');

    // Get the access token
    const oAuthAccessToken = await accessToken(oAuthRequestToken, pin.trim());
    await fsp.writeFile(fileName, JSON.stringify(oAuthAccessToken), { encoding: 'utf8' });

    return oAuthAccessToken;
  }
}

async function ensureResponseList(fileName: string): Promise<Array<SimpleTweet>> {
  try {
    const stat = await fsp.stat(fileName);
    if (stat.isDirectory()) throw `${fileName} should not be a directory`;
    const responseList = JSON.parse(await fsp.readFile(fileName, { encoding: 'utf8' })) as Array<SimpleTweet>;
    console.log('Retrieved cached response list');
    return responseList;
  } catch (err) {
    console.log(`Failed to retrieve cached response list: ${err}`);
    return [];
  }
}

(async () => {
  try {
    const oAuthAccessToken = await ensureOauth('oauth.b64');
    // Make the request
    const priorList = await ensureResponseList(fileName);
    const params: GetFavoritesListRequest = { count: 200 };
    let tweetList: Array<SimpleTweet> = [];

    let lastResponse = await likesRequest(oAuthAccessToken, params);

    while (lastResponse.length > 0) {
      tweetList = tweetList.concat(lastResponse.map(mediaTweetFlatten).filter(isMediaTweet));
      let maxId = lastResponse[lastResponse.length - 1].id;
      lastResponse = await likesRequest(oAuthAccessToken, { ...params, max_id: maxId });
    }

    let newTweetList = tweetList.filter(isNotInPrior(priorList));
    let likeCount = newTweetList.length;
    let mediaCount = newTweetList
      .map(x => x.media ? x.media.length : 0)
      .reduce((a, b) => a + b, 0);

    await fsp.writeFile(fileName, JSON.stringify(tweetList, null, 2), 'utf8');
    console.log(`Response written to '${fileName}'. ${likeCount} new liked tweets (${mediaCount} media)`)

    const mediaList = newTweetList.map((x: SimpleTweet) => x.media.map(y => y.media_url).flat()).flat();

    if (mediaList.length > 0) {
      await ensureDir('img');
      const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      bar1.start(mediaList.length, 0);
      for (let i = 0; i < mediaList.length; i++) {
        let url = mediaList[i];
        await getImage(url, `img/${url.substring(url.lastIndexOf('/') + 1)}`);
        bar1.update(i + 1)
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      bar1.stop();
      console.log(`Downloaded ${mediaList.length} new media files`);
    }
  } catch (e) {
    console.log(e);
    process.exit(-1);
  }
  process.exit();
})();