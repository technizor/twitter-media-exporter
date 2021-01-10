import got from 'got';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

import { likesRequest, generateOauthToken } from './api-helper';
import { bsearch, descendingOrder } from './array-helper';
import { FileStatus, ensureDir, getFileStatus, readJsonFile, writeJsonFile, readEncryptedJsonFile, writeEncryptedJsonFile, writeFromStream } from './fs-helper';

import type { FilterFunc } from './array-helper';
import type { SimpleTweet } from './types';
import type { OAuthAccessToken, GetFavoritesListRequest } from './api-helper';

//#region Command-line Flags
const NUM_PARALLEL_DOWNLOADS = 4;
const OAUTH_FILE_NAME = 'oauth.b64.enc';
const RESPONSE_CACHE_FILE_NAME = 'response.json';
const IMAGE_DOWNLOAD_DIR = 'img';
//#endregion Command-line Flags

//#region Constants / Flag-derivatives
const imageDownloadLimit = pLimit(NUM_PARALLEL_DOWNLOADS);
const PROGRESS_FMT: cliProgress.Options = {
  format: '[{bar}] {percentage}% | {imageId} | {value}/{total}',
};
function imagePath(imageId: string) {
  return `${IMAGE_DOWNLOAD_DIR}/${imageId}`;
}
//#endregion Constants / Flag-derivatives

//#region Data Processing Functions
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
  };
}

function isMediaTweet(tweet: SimpleTweet): boolean {
  return tweet.media && tweet.media.length > 0;
}

function isNotInPrior(priorList: Array<SimpleTweet>): FilterFunc<SimpleTweet> {
  const idList = priorList.map((x: SimpleTweet) => x.id);
  return (tweet: SimpleTweet): boolean => {
    const idx = bsearch(idList, tweet.id, descendingOrder);
    return idx < 0;
  };
}
//#endregion Data Processing Functions

//#region FileOp Functions
async function downloadImage(url: string, fileName: string) {
  try {
    await writeFromStream(fileName, got.stream(url));
  } catch (err) {
    console.log(`Error for url: ${url}`, err);
  }
}

async function ensureOauth(fileName: string): Promise<OAuthAccessToken> {
  const status = await getFileStatus(fileName);
  switch (status) {
    case FileStatus.IsFile: {
      const oAuthAccessToken = await readEncryptedJsonFile<OAuthAccessToken>(fileName);
      console.log('Retrieved cached access token');
      return oAuthAccessToken;
    }
    case FileStatus.IsDirectory: {
      throw new Error(`Unexpected directory found at ${fileName}.`);
    }
    case FileStatus.NotExists: {
      console.log(`Failed to retrieve cached access token as the file ${fileName} does not exist.`);
      const oAuthAccessToken = await generateOauthToken();
      await writeEncryptedJsonFile<OAuthAccessToken>(fileName, oAuthAccessToken);
      return oAuthAccessToken;
    }
    default: {
      throw new Error(`Status of file ${fileName} is unknown.`);
    }
  }
}

export async function cachedResponseList(fileName: string): Promise<Array<SimpleTweet>> {
  const status = await getFileStatus(fileName);
  switch (status) {
    case FileStatus.IsFile: {
      const responseList = await readJsonFile<Array<SimpleTweet>>(fileName);
      console.log('Retrieved cached response list');
      return responseList;
    }
    case FileStatus.IsDirectory: {
      throw new Error(`Unexpected directory found at ${fileName}.`);
    }
    case FileStatus.NotExists: {
      console.log(`Failed to retrieve cached response list from ${fileName}. File does not exist.`);
      return [];
    }
    default: {
      throw new Error(`Status of file ${fileName} is unknown.`);
    }
  }
}
//#endregion FileOp Functions

//#region Main Program
(async () => {
  try {
    const oAuthAccessToken = await ensureOauth(OAUTH_FILE_NAME);
    // Make the request
    const priorList = await cachedResponseList(RESPONSE_CACHE_FILE_NAME);
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

    await writeJsonFile(RESPONSE_CACHE_FILE_NAME, tweetList, 2);
    console.log(`Response written to '${RESPONSE_CACHE_FILE_NAME}'. ${likeCount} new liked tweets (${mediaCount} media)`)

    const mediaList = newTweetList.map((x: SimpleTweet) => x.media.map(y => y.media_url).flat()).flat();

    if (mediaList.length > 0) {
      await ensureDir(IMAGE_DOWNLOAD_DIR);

      const bar0 = new cliProgress.MultiBar(PROGRESS_FMT, cliProgress.Presets.shades_classic);
      const bar1 = bar0.create(mediaList.length, 0, { imageId: '' });
      const result = mediaList.map(async url => {
        let imageId = url.substring(url.lastIndexOf('/') + 1);
        let b = bar0.create(100, 0, { imageId });
        await imageDownloadLimit(() => downloadImage(url, imagePath(imageId)));
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
//#endregion Main Program