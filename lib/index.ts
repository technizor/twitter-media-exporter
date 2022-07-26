import { program } from 'commander';

import { MediaExporter, MediaExporterOptions } from './media-exporter';

// #region Command-line Flags
const intArgument = (value: string): number => parseInt(value, 10);
program.description(`Twitter Media Exporter
  In order to use this program, three environment variables are required:
    - OAUTH_KEY: An arbitrary key used for encrypting the cached OAuth token.
    - CONSUMER_KEY: Your Twitter API Application Key
    - CONSUMER_SECRET: Your Twitter API Application Secret`);
program.option('--num_parallel_downloads <num>', 'The max number of parallel image downloads', intArgument, 4);
program.option('--oauth_file_name <oauthFile>', 'The file path to cache an encrypted oauth access token', 'oauth.b64.enc');
program.option('--response_cache_file_name <responseCacheFile>', 'The file path to cache the tweet response list', 'response.json');
program.option('--image_out_dir <imgOutDir>', 'The directory path to download images to', 'img');
program.option('--before <num>', 'Restart likes scan from tweets before the specified ID', intArgument, -1);
program.parse(process.argv);
// #endregion Command-line Flags

// #region Main Program
const exporterOptions: MediaExporterOptions = {
  numParallelDownloads: program.num_parallel_downloads,
  oauthFileName: program.oauth_file_name,
  responseCacheFileName: program.response_cache_file_name,
  imageDownloadDir: program.image_out_dir,
};
const exporter = new MediaExporter(exporterOptions);
(async () => {
  try {
    await exporter.run(program.before);
  } catch (e) {
    console.log(e);
    process.exit(-1);
  }
  process.exit();
})();
// #endregion Main Program
