/* eslint-disable camelcase */
export type TweetMedia = {
  id: number,
  media_url: string,
  url: string,
  type: string,
}

export type TwitterUser = {
  id: number,
  name: string,
  screen_name: string,
}

export type SimpleTweet = {
  id: number,
  text: string,
  hashtags: Array<string>,
  media: Array<TweetMedia>,
  user: TwitterUser,
  lang: string,
}
/* eslint-enable camelcase */
