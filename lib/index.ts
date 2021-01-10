import got from 'got';
import stream from 'stream';
import { promisify } from 'util';
import fs from 'fs';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

import { likesRequest, generateOauthToken } from './api-helper';
import { bsearch, descendingOrder } from './array-helper';
import { ensureDir, readJsonFile, writeJsonFile } from './fs-helper';

import type { FilterFunc } from './array-helper';
import type { SimpleTweet } from './types';
import type { OAuthAccessToken, GetFavoritesListRequest } from './api-helper';

const pipeline = promisify(stream.pipeline);
const fsp = fs.promises;
const imageDownloadLimit = pLimit(4);

const fileName = 'response.json';

const progressFormatStr = '[{bar}] {percentage}% | {url} | {value}/{total}';

async function getImage(url: string, fileName: string) {
  try {
    const stat = await fsp.stat(fileName);
    if (stat.isFile()) return;
  } catch (err) {
    try {
      await pipeline(got.stream(url), fs.createWriteStream(fileName))
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

function isNotInPrior(priorList: Array<SimpleTweet>): FilterFunc<SimpleTweet> {
  const idList = priorList.map((x: SimpleTweet) => x.id);
  return (tweet: SimpleTweet): boolean => {
    const idx = bsearch(idList, tweet.id, descendingOrder);
    return idx < 0;
  }
}

export async function ensureOauth(fileName: string): Promise<OAuthAccessToken> {
  try {
    const stat = await fsp.stat(fileName);
    if (stat.isDirectory()) throw `${fileName} should not be a directory`;
    const oAuthAccessToken = await readJsonFile<OAuthAccessToken>(fileName);
    console.log('Retrieved cached access token');
    return oAuthAccessToken;
  } catch (err) {
    console.log(`Failed to retrieve cached access token: ${err}`);

    const oAuthAccessToken = await generateOauthToken();
    await writeJsonFile<OAuthAccessToken>(fileName, oAuthAccessToken);

    return oAuthAccessToken;
  }
}

export async function cachedResponseList(fileName: string): Promise<Array<SimpleTweet>> {
  try {
    const stat = await fsp.stat(fileName);
    if (stat.isDirectory()) throw `${fileName} should not be a directory`;
    const responseList = await readJsonFile<Array<SimpleTweet>>(fileName);
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
    const priorList = await cachedResponseList(fileName);
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

      const bar0 = new cliProgress.MultiBar({ format: progressFormatStr }, cliProgress.Presets.shades_classic);
      const bar1 = bar0.create(mediaList.length, 0, { url: '' });
      const result = mediaList.map(async url => {
        let b = bar0.create(100, 0, { url });
        await imageDownloadLimit(() => getImage(url, `img/${url.substring(url.lastIndexOf('/') + 1)}`));
        b.update(100);
        b.stop();
        bar1.increment();
        await new Promise(resolve => setTimeout(resolve, 500));
        bar0.remove(b);
      });
      await Promise.all(result);
      bar1.stop();
      bar0.stop();
      console.log(`Downloaded ${mediaList.length} new media files`);
    }
  } catch (e) {
    console.log(e);
    process.exit(-1);
  }
  process.exit();
})();