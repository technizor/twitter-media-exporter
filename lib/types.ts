/* eslint camelcase off */
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

export type GetFavoritesListRequest = {
  user_id?: number,
  screen_name?: string,
  count?: number,
  since_id?: number,
  max_id?: number,
  include_entities?: boolean,
}

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
