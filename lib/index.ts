import { program } from 'commander';

import { MediaExporter, MediaExporterOptions } from './media-exporter';

// #region Command-line Flags
const intArgument = (value: string): number => parseInt(value, 10);
program.option('--num_parallel_downloads <num>', 'The max number of parallel image downloads', intArgument, 4);
program.option('--oauth_file_name <oauthFile>', 'The file path to cache an encrypted oauth access token', 'oauth.b64.enc');
program.option('--response_cache_file_name <responseCacheFile>', 'The file path to cache the tweet response list', 'response.json');
program.option('--image_out_dir <imgOutDir>', 'The directory path to download images to', 'img');
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
    await exporter.run();
  } catch (e) {
    console.log(e);
    process.exit(-1);
  }
  process.exit();
})();
// #endregion Main Program
